import 'reflect-metadata';
import { AssignmentsService, ASSIGNMENT_STATUS } from './assignments.service';
import { ScheduleProposedBy, CheckpointType } from '@prisma/client';
import { ConflictException, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';

const mockDate = (value: string) => new Date(value);

describe('AssignmentsService', () => {
  const notifications = {
    notifyScheduleProposed: jest.fn(),
    notifyScheduleConfirmed: jest.fn(),
    notifyAssignmentRejected: jest.fn(),
    notifyCheckIn: jest.fn(),
    notifyCheckOut: jest.fn(),
    sendNotification: jest.fn().mockResolvedValue(undefined),
  };

  const prisma: any = {
    job: { findUnique: jest.fn(), update: jest.fn() },
    assignment: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    assignmentCheckpoint: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    locationUpdate: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    quote: { updateMany: jest.fn() },
    $transaction: jest.fn().mockImplementation(async (fn: any) => fn(prisma)),
  };

  const service = new AssignmentsService(prisma, notifications as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('proposes schedule as customer and bumps version', async () => {
    const start = mockDate('2025-01-01T09:00:00Z');
    const end = mockDate('2025-01-01T11:00:00Z');

    prisma.job.findUnique.mockResolvedValue({
      id: 'job1',
      customerId: 'cust1',
      assignment: { id: 'assign1', scheduleVersion: 0, status: ASSIGNMENT_STATUS.PENDING_SCHEDULE },
    });
    prisma.assignment.updateMany.mockResolvedValue({ count: 1 });
    prisma.assignment.findUnique.mockResolvedValue({
      id: 'assign1',
      scheduleVersion: 1,
      scheduledStart: start,
      scheduledEnd: end,
      scheduleProposedBy: ScheduleProposedBy.CUSTOMER,
      status: ASSIGNMENT_STATUS.CUSTOMER_PROPOSED,
    });

    const result = await service.proposeScheduleAsCustomer('job1', 'cust1', {
      start,
      end,
      version: 0,
      notes: 'See you soon',
    });

    expect(result.scheduleVersion).toBe(1);
    expect(prisma.assignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'assign1', scheduleVersion: 0 },
        data: expect.objectContaining({
          scheduledStart: start,
          scheduledEnd: end,
          scheduleProposedBy: ScheduleProposedBy.CUSTOMER,
          status: ASSIGNMENT_STATUS.CUSTOMER_PROPOSED,
        }),
      }),
    );
    expect(notifications.notifyScheduleProposed).toHaveBeenCalledWith(
      expect.objectContaining({ assignmentId: 'assign1', jobId: 'job1', proposedBy: 'customer' }),
    );
  });

  it('throws Conflict when schedule version mismatches', async () => {
    const start = mockDate('2025-01-01T09:00:00Z');
    const end = mockDate('2025-01-01T10:00:00Z');

    prisma.job.findUnique.mockResolvedValue({
      id: 'job1',
      customerId: 'cust1',
      assignment: { id: 'assign1', scheduleVersion: 3, status: ASSIGNMENT_STATUS.PENDING_SCHEDULE },
    });
    prisma.assignment.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.proposeScheduleAsCustomer('job1', 'cust1', { start, end, version: 2 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('prevents provider confirmation when not assigned to them', async () => {
    const start = mockDate('2025-01-01T09:00:00Z');
    const end = mockDate('2025-01-01T10:00:00Z');
    prisma.assignment.findUnique.mockResolvedValue({
      id: 'assign1',
      jobId: 'job1',
      scheduleVersion: 1,
      scheduledStart: start,
      scheduledEnd: end,
      scheduleNotes: null,
      provider: { userId: 'provider-123', id: 'prov1' },
      job: { customerId: 'cust1' },
    });

    await expect(
      service.confirmSchedule('assign1', { userId: 'wrong-provider', role: 'PROVIDER' }, { version: 1 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('confirms schedule and marks assignment scheduled', async () => {
    const start = mockDate('2025-01-02T09:00:00Z');
    const end = mockDate('2025-01-02T10:30:00Z');

    prisma.assignment.findUnique
      .mockResolvedValueOnce({
        id: 'assign1',
        jobId: 'job1',
        scheduleVersion: 2,
        scheduledStart: start,
        scheduledEnd: end,
        scheduleNotes: null,
        provider: { userId: 'provider-123', id: 'prov1' },
        job: { customerId: 'cust1' },
      })
      .mockResolvedValueOnce({
        id: 'assign1',
        status: ASSIGNMENT_STATUS.SCHEDULED,
        scheduleVersion: 3,
        scheduledStart: start,
        scheduledEnd: end,
      });
    prisma.assignment.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.confirmSchedule('assign1', { userId: 'provider-123', role: 'PROVIDER' }, { version: 2 });

    expect(result.status).toBe(ASSIGNMENT_STATUS.SCHEDULED);
    expect(prisma.assignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'assign1', scheduleVersion: 2 } }),
    );
    expect(notifications.notifyScheduleConfirmed).toHaveBeenCalledWith(
      expect.objectContaining({ assignmentId: 'assign1', confirmedBy: 'provider' }),
    );
  });

  it('rejects assignment and requeues job', async () => {
    prisma.assignment.findUnique.mockResolvedValue({
      id: 'assign1',
      jobId: 'job1',
      providerId: 'prov1',
      scheduleVersion: 2,
      provider: { userId: 'provider-123' },
    });
    prisma.assignment.update.mockResolvedValue({ id: 'assign1', status: ASSIGNMENT_STATUS.PROVIDER_REJECTED });

    const result = await service.rejectAssignment('assign1', 'provider-123', { reason: 'Conflict' });

    expect(result.status).toBe(ASSIGNMENT_STATUS.PROVIDER_REJECTED);
    expect(prisma.quote.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { jobId: 'job1', status: 'accepted' } }),
    );
    expect(notifications.notifyAssignmentRejected).toHaveBeenCalledWith(
      expect.objectContaining({ assignmentId: 'assign1', jobId: 'job1', reason: 'Conflict' }),
    );
  });

  it('prevents rejecting assignment when provider does not own it', async () => {
    prisma.assignment.findUnique.mockResolvedValue({
      id: 'assign1',
      jobId: 'job1',
      providerId: 'prov1',
      scheduleVersion: 1,
      provider: { userId: 'provider-123' },
    });

    await expect(service.rejectAssignment('assign1', 'wrong-user', {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('marks assignment complete for provider', async () => {
    prisma.assignment.findUnique.mockResolvedValue({
      id: 'assign1',
      status: ASSIGNMENT_STATUS.SCHEDULED,
      provider: { userId: 'provider-123', user: { name: 'Provider Name' } },
      job: { customerId: 'cust1', title: 'Test Job' },
    });
    prisma.assignment.update.mockResolvedValue({ id: 'assign1', status: ASSIGNMENT_STATUS.COMPLETED });

    const result = await service.completeAssignmentAsProvider('assign1', 'provider-123');

    expect(result).toBeTruthy();
    expect(result!.status).toBe(ASSIGNMENT_STATUS.COMPLETED);
    expect(prisma.assignment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'assign1' }, data: expect.objectContaining({ status: ASSIGNMENT_STATUS.COMPLETED, completedAt: expect.any(Date) }) }),
    );
  });

  // M11 Phase 2: GPS Features

  describe('checkIn', () => {
    it('creates check-in checkpoint for provider', async () => {
      const checkInDto = {
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 10,
        timestamp: '2025-12-01T10:00:00Z',
      };

      prisma.assignment.findUnique.mockResolvedValue({
        id: 'assign1',
        provider: { userId: 'provider-123' },
        status: ASSIGNMENT_STATUS.SCHEDULED,
      });

      const mockCheckpoint = {
        id: 'checkpoint-1',
        assignmentId: 'assign1',
        type: CheckpointType.CHECK_IN,
        ...checkInDto,
        photoUrl: null,
        notes: null,
        createdAt: new Date(),
      };
      prisma.assignmentCheckpoint.create.mockResolvedValue(mockCheckpoint);

      const result = await service.checkIn('assign1', 'provider-123', checkInDto);

      expect(result).toEqual(mockCheckpoint);
      expect(prisma.assignmentCheckpoint.create).toHaveBeenCalledWith({
        data: {
          assignmentId: 'assign1',
          type: CheckpointType.CHECK_IN,
          latitude: 40.7128,
          longitude: -74.006,
          accuracy: 10,
          timestamp: new Date('2025-12-01T10:00:00Z'),
          photoUrl: undefined,
          notes: undefined,
        },
      });
      expect(notifications.notifyCheckIn).toHaveBeenCalledWith({ assignmentId: 'assign1' });
    });

    it('includes photo and notes in check-in', async () => {
      const checkInDto = {
        latitude: 34.0522,
        longitude: -118.2437,
        accuracy: 5,
        timestamp: '2025-12-01T09:00:00Z',
        photoUrl: 'https://s3.amazonaws.com/photo.jpg',
        notes: 'Arrived at site',
      };

      prisma.assignment.findUnique.mockResolvedValue({
        id: 'assign2',
        provider: { userId: 'provider-456' },
        status: ASSIGNMENT_STATUS.SCHEDULED,
      });

      prisma.assignmentCheckpoint.create.mockResolvedValue({
        id: 'checkpoint-2',
        assignmentId: 'assign2',
        type: CheckpointType.CHECK_IN,
        ...checkInDto,
        createdAt: new Date(),
      });

      await service.checkIn('assign2', 'provider-456', checkInDto);

      expect(prisma.assignmentCheckpoint.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          photoUrl: 'https://s3.amazonaws.com/photo.jpg',
          notes: 'Arrived at site',
        }),
      });
    });

    it('throws NotFoundException if assignment not found', async () => {
      prisma.assignment.findUnique.mockResolvedValue(null);

      await expect(
        service.checkIn('nonexistent', 'provider-123', {
          latitude: 0,
          longitude: 0,
          accuracy: 10,
          timestamp: '2025-12-01T10:00:00Z',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException if provider does not own assignment', async () => {
      prisma.assignment.findUnique.mockResolvedValue({
        id: 'assign1',
        provider: { userId: 'other-provider' },
        status: ASSIGNMENT_STATUS.SCHEDULED,
      });

      await expect(
        service.checkIn('assign1', 'wrong-provider', {
          latitude: 0,
          longitude: 0,
          accuracy: 10,
          timestamp: '2025-12-01T10:00:00Z',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws BadRequestException if assignment not scheduled', async () => {
      prisma.assignment.findUnique.mockResolvedValue({
        id: 'assign1',
        provider: { userId: 'provider-123' },
        status: ASSIGNMENT_STATUS.PENDING_SCHEDULE,
      });

      await expect(
        service.checkIn('assign1', 'provider-123', {
          latitude: 0,
          longitude: 0,
          accuracy: 10,
          timestamp: '2025-12-01T10:00:00Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('checkOut', () => {
    it('creates check-out checkpoint for provider', async () => {
      const checkOutDto = {
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 10,
        timestamp: '2025-12-01T14:00:00Z',
      };

      prisma.assignment.findUnique.mockResolvedValue({
        id: 'assign1',
        provider: { userId: 'provider-123' },
        status: ASSIGNMENT_STATUS.SCHEDULED,
        checkpoints: [
          { type: CheckpointType.CHECK_IN, timestamp: new Date('2025-12-01T10:00:00Z') },
        ],
      });

      const mockCheckpoint = {
        id: 'checkpoint-2',
        assignmentId: 'assign1',
        type: CheckpointType.CHECK_OUT,
        ...checkOutDto,
        photoUrl: null,
        notes: null,
        createdAt: new Date(),
      };
      prisma.assignmentCheckpoint.create.mockResolvedValue(mockCheckpoint);

      const result = await service.checkOut('assign1', 'provider-123', checkOutDto);

      expect(result).toEqual(mockCheckpoint);
      expect(prisma.assignmentCheckpoint.create).toHaveBeenCalledWith({
        data: {
          assignmentId: 'assign1',
          type: CheckpointType.CHECK_OUT,
          latitude: 40.7128,
          longitude: -74.006,
          accuracy: 10,
          timestamp: new Date('2025-12-01T14:00:00Z'),
          photoUrl: undefined,
          notes: undefined,
        },
      });
      expect(notifications.notifyCheckOut).toHaveBeenCalledWith({ assignmentId: 'assign1' });
    });

    it('includes photo and notes in check-out', async () => {
      const checkOutDto = {
        latitude: 51.5074,
        longitude: -0.1278,
        accuracy: 8,
        timestamp: '2025-12-01T15:00:00Z',
        photoUrl: 'https://s3.amazonaws.com/checkout.jpg',
        notes: 'Job completed',
      };

      prisma.assignment.findUnique.mockResolvedValue({
        id: 'assign3',
        provider: { userId: 'provider-789' },
        status: ASSIGNMENT_STATUS.SCHEDULED,
        checkpoints: [
          { type: CheckpointType.CHECK_IN, timestamp: new Date() },
        ],
      });

      prisma.assignmentCheckpoint.create.mockResolvedValue({
        id: 'checkpoint-3',
        assignmentId: 'assign3',
        type: CheckpointType.CHECK_OUT,
        ...checkOutDto,
        createdAt: new Date(),
      });

      await service.checkOut('assign3', 'provider-789', checkOutDto);

      expect(prisma.assignmentCheckpoint.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          photoUrl: 'https://s3.amazonaws.com/checkout.jpg',
          notes: 'Job completed',
        }),
      });
    });

    it('throws BadRequestException if provider has not checked in', async () => {
      prisma.assignment.findUnique.mockResolvedValue({
        id: 'assign1',
        provider: { userId: 'provider-123' },
        status: ASSIGNMENT_STATUS.SCHEDULED,
        checkpoints: [],
      });

      await expect(
        service.checkOut('assign1', 'provider-123', {
          latitude: 0,
          longitude: 0,
          accuracy: 10,
          timestamp: '2025-12-01T14:00:00Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws ForbiddenException if provider does not own assignment', async () => {
      prisma.assignment.findUnique.mockResolvedValue({
        id: 'assign1',
        provider: { userId: 'other-provider' },
        status: ASSIGNMENT_STATUS.SCHEDULED,
        checkpoints: [{ type: CheckpointType.CHECK_IN, timestamp: new Date() }],
      });

      await expect(
        service.checkOut('assign1', 'wrong-provider', {
          latitude: 0,
          longitude: 0,
          accuracy: 10,
          timestamp: '2025-12-01T14:00:00Z',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('getCheckpoints', () => {
    it('returns checkpoints for provider', async () => {
      const mockCheckpoints = [
        {
          id: 'checkpoint-1',
          assignmentId: 'assign1',
          type: CheckpointType.CHECK_IN,
          latitude: 40.7128,
          longitude: -74.006,
          accuracy: 10,
          timestamp: new Date('2025-12-01T10:00:00Z'),
          photoUrl: null,
          notes: null,
          createdAt: new Date(),
        },
        {
          id: 'checkpoint-2',
          assignmentId: 'assign1',
          type: CheckpointType.CHECK_OUT,
          latitude: 40.7128,
          longitude: -74.006,
          accuracy: 10,
          timestamp: new Date('2025-12-01T14:00:00Z'),
          photoUrl: null,
          notes: null,
          createdAt: new Date(),
        },
      ];

      prisma.assignment.findUnique.mockResolvedValue({
        id: 'assign1',
        provider: { userId: 'provider-123' },
        job: { customerId: 'customer-456' },
      });
      prisma.assignmentCheckpoint.findMany.mockResolvedValue(mockCheckpoints);

      const result = await service.getCheckpoints('assign1', 'provider-123');

      expect(result).toEqual(mockCheckpoints);
      expect(prisma.assignmentCheckpoint.findMany).toHaveBeenCalledWith({
        where: { assignmentId: 'assign1' },
        orderBy: { timestamp: 'asc' },
      });
    });

    it('returns checkpoints for customer', async () => {
      prisma.assignment.findUnique.mockResolvedValue({
        id: 'assign1',
        provider: { userId: 'provider-123' },
        job: { customerId: 'customer-456' },
      });
      prisma.assignmentCheckpoint.findMany.mockResolvedValue([]);

      const result = await service.getCheckpoints('assign1', 'customer-456');

      expect(result).toEqual([]);
    });

    it('throws ForbiddenException for unauthorized user', async () => {
      prisma.assignment.findUnique.mockResolvedValue({
        id: 'assign1',
        provider: { userId: 'provider-123' },
        job: { customerId: 'customer-456' },
      });

      await expect(service.getCheckpoints('assign1', 'unauthorized-user')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('updateLocation', () => {
    it('creates location update for provider', async () => {
      const locationDto = {
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 10,
        timestamp: '2025-12-01T11:00:00Z',
      };

      prisma.assignment.findUnique.mockResolvedValue({
        id: 'assign1',
        provider: { userId: 'provider-123' },
        status: ASSIGNMENT_STATUS.SCHEDULED,
      });

      prisma.locationUpdate.findFirst.mockResolvedValue(null);

      const mockLocationUpdate = {
        id: 'location-1',
        assignmentId: 'assign1',
        ...locationDto,
        timestamp: new Date(locationDto.timestamp),
        createdAt: new Date(),
      };
      prisma.locationUpdate.create.mockResolvedValue(mockLocationUpdate);

      const result = await service.updateLocation('assign1', 'provider-123', locationDto);

      expect(result).toEqual(mockLocationUpdate);
      expect(prisma.locationUpdate.create).toHaveBeenCalledWith({
        data: {
          assignmentId: 'assign1',
          latitude: 40.7128,
          longitude: -74.006,
          accuracy: 10,
          timestamp: new Date('2025-12-01T11:00:00Z'),
        },
      });
    });

    it('throws BadRequestException if rate limited', async () => {
      prisma.assignment.findUnique.mockResolvedValue({
        id: 'assign1',
        provider: { userId: 'provider-123' },
        status: ASSIGNMENT_STATUS.SCHEDULED,
      });

      // Recent update exists
      prisma.locationUpdate.findFirst.mockResolvedValue({
        id: 'recent-update',
        createdAt: new Date(),
      });

      await expect(
        service.updateLocation('assign1', 'provider-123', {
          latitude: 0,
          longitude: 0,
          accuracy: 10,
          timestamp: '2025-12-01T11:00:00Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException if assignment not scheduled', async () => {
      prisma.assignment.findUnique.mockResolvedValue({
        id: 'assign1',
        provider: { userId: 'provider-123' },
        status: ASSIGNMENT_STATUS.PENDING_SCHEDULE,
      });

      await expect(
        service.updateLocation('assign1', 'provider-123', {
          latitude: 0,
          longitude: 0,
          accuracy: 10,
          timestamp: '2025-12-01T11:00:00Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws ForbiddenException if provider does not own assignment', async () => {
      prisma.assignment.findUnique.mockResolvedValue({
        id: 'assign1',
        provider: { userId: 'other-provider' },
        status: ASSIGNMENT_STATUS.SCHEDULED,
      });

      await expect(
        service.updateLocation('assign1', 'wrong-provider', {
          latitude: 0,
          longitude: 0,
          accuracy: 10,
          timestamp: '2025-12-01T11:00:00Z',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('getLatestLocation', () => {
    it('returns latest location for customer', async () => {
      prisma.assignment.findUnique.mockResolvedValue({
        id: 'assign1',
        job: { customerId: 'customer-456' },
      });

      const mockLocation = {
        id: 'location-1',
        assignmentId: 'assign1',
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 10,
        timestamp: new Date('2025-12-01T11:30:00Z'),
        createdAt: new Date(),
      };
      prisma.locationUpdate.findFirst.mockResolvedValue(mockLocation);

      const result = await service.getLatestLocation('assign1', 'customer-456');

      expect(result).toEqual(mockLocation);
      expect(prisma.locationUpdate.findFirst).toHaveBeenCalledWith({
        where: {
          assignmentId: 'assign1',
          timestamp: { gte: expect.any(Date) },
        },
        orderBy: { timestamp: 'desc' },
      });
    });

    it('returns null if no recent location', async () => {
      prisma.assignment.findUnique.mockResolvedValue({
        id: 'assign1',
        job: { customerId: 'customer-456' },
      });

      prisma.locationUpdate.findFirst.mockResolvedValue(null);

      const result = await service.getLatestLocation('assign1', 'customer-456');

      expect(result).toBeNull();
    });

    it('throws ForbiddenException if user is not customer', async () => {
      prisma.assignment.findUnique.mockResolvedValue({
        id: 'assign1',
        job: { customerId: 'customer-456' },
      });

      await expect(service.getLatestLocation('assign1', 'wrong-customer')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('throws NotFoundException if assignment not found', async () => {
      prisma.assignment.findUnique.mockResolvedValue(null);

      await expect(service.getLatestLocation('nonexistent', 'customer-456')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
