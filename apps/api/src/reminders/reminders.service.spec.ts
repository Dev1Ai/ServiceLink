import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { RemindersService, ReminderJobData } from './reminders.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MetricsService } from '../metrics/metrics.service';
import { REMINDER_QUEUE_PROVIDER } from './reminders.queue';
import { AssignmentReminderStatus } from '@prisma/client';

type GetFn = (key: string) => string | undefined;

const baseConfigMap: Record<string, string> = {
  REMINDER_LEAD_MINUTES: '15',
  REMINDER_LOOKAHEAD_MINUTES: '60',
  REMINDER_OVERDUE_MINUTES: '15',
  REMINDER_POLL_INTERVAL_MS: '60000',
  REMINDER_WORKER_CONCURRENCY: '1',
  REMINDER_WORKER_ENABLED: 'true',
};

const makeConfig = (getOverride?: GetFn): ConfigService =>
  ({
    get: (key: string) => (getOverride ? getOverride(key) : baseConfigMap[key]),
  } as unknown as ConfigService);

describe('RemindersService', () => {
  const addMock = jest.fn();
  const queueStub = { add: addMock, close: jest.fn() } as any;
  const connectionStub = { quit: jest.fn() } as any;

  const prismaAssignmentFindMany = jest.fn();
  const prismaAssignmentUpdate = jest.fn();
  const prismaAssignmentFindUnique = jest.fn();
  const prismaAssignmentUpdateMany = jest.fn();

  const prisma = {
    assignment: {
      findMany: prismaAssignmentFindMany,
      update: prismaAssignmentUpdate,
      findUnique: prismaAssignmentFindUnique,
      updateMany: prismaAssignmentUpdateMany,
    },
  } as unknown as PrismaService;

  const notifications = {
    notifyAssignmentReminder: jest.fn(),
  } as unknown as NotificationsService;

  const metrics = {
    incReminderSent: jest.fn(),
    incReminderFailed: jest.fn(),
  } as unknown as MetricsService;

  let service: RemindersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaAssignmentFindMany.mockReset();
    prismaAssignmentUpdate.mockReset();
    prismaAssignmentFindUnique.mockReset();
    prismaAssignmentUpdateMany.mockReset();
    addMock.mockReset();

    const moduleRef = await Test.createTestingModule({
      providers: [
        RemindersService,
        { provide: ConfigService, useValue: makeConfig() },
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: MetricsService, useValue: metrics },
        {
          provide: REMINDER_QUEUE_PROVIDER,
          useValue: { queue: queueStub, connection: connectionStub },
        },
      ],
    }).compile();

    service = moduleRef.get(RemindersService);
  });

  describe('isEnabled', () => {
    it('returns true when worker is enabled', () => {
      expect(service.isEnabled()).toBe(true);
    });

    it('returns false when worker is disabled', async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          RemindersService,
          {
            provide: ConfigService,
            useValue: makeConfig((key) => (key === 'REMINDER_WORKER_ENABLED' ? 'false' : baseConfigMap[key])),
          },
          { provide: PrismaService, useValue: prisma },
          { provide: NotificationsService, useValue: notifications },
          { provide: MetricsService, useValue: metrics },
          { provide: REMINDER_QUEUE_PROVIDER, useValue: null },
        ],
      }).compile();

      const disabledService = moduleRef.get(RemindersService);
      expect(disabledService.isEnabled()).toBe(false);
    });
  });

  describe('scanAndEnqueue', () => {
    it('queues reminders for scheduled assignments within lookahead window', async () => {
      const scheduledStart = new Date(Date.now() + 20 * 60 * 1000);
      prismaAssignmentFindMany.mockResolvedValue([
        { id: 'assign-1', jobId: 'job-1', scheduleVersion: 3, scheduledStart },
      ]);
      prismaAssignmentUpdate.mockResolvedValue({});
      addMock.mockResolvedValue({});

      const queued = await service.scanAndEnqueue();

      expect(queued).toBe(1);
      expect(addMock).toHaveBeenCalledWith(
        'assignment-reminder',
        expect.objectContaining({ assignmentId: 'assign-1', scheduleVersion: 3 }),
        expect.objectContaining({ jobId: 'assignment:assign-1:v3' }),
      );
      expect(prismaAssignmentUpdate).toHaveBeenCalledWith({
        where: { id: 'assign-1' },
        data: { reminderStatus: AssignmentReminderStatus.QUEUED },
      });
    });

    it('queues multiple assignments', async () => {
      const scheduledStart1 = new Date(Date.now() + 20 * 60 * 1000);
      const scheduledStart2 = new Date(Date.now() + 30 * 60 * 1000);
      prismaAssignmentFindMany.mockResolvedValue([
        { id: 'assign-1', jobId: 'job-1', scheduleVersion: 1, scheduledStart: scheduledStart1 },
        { id: 'assign-2', jobId: 'job-2', scheduleVersion: 2, scheduledStart: scheduledStart2 },
      ]);
      prismaAssignmentUpdate.mockResolvedValue({});
      addMock.mockResolvedValue({});

      const queued = await service.scanAndEnqueue();

      expect(queued).toBe(2);
      expect(addMock).toHaveBeenCalledTimes(2);
      expect(prismaAssignmentUpdate).toHaveBeenCalledTimes(2);
    });

    it('skips assignments with null scheduledStart', async () => {
      prismaAssignmentFindMany.mockResolvedValue([
        { id: 'assign-1', jobId: 'job-1', scheduleVersion: 1, scheduledStart: null },
      ]);

      const queued = await service.scanAndEnqueue();

      expect(queued).toBe(0);
      expect(addMock).not.toHaveBeenCalled();
    });

    it('handles queue add failure and increments metrics', async () => {
      const scheduledStart = new Date(Date.now() + 20 * 60 * 1000);
      prismaAssignmentFindMany.mockResolvedValue([
        { id: 'assign-1', jobId: 'job-1', scheduleVersion: 1, scheduledStart },
      ]);
      addMock.mockRejectedValue(new Error('Queue full'));

      const queued = await service.scanAndEnqueue();

      expect(queued).toBe(0);
      expect(metrics.incReminderFailed).toHaveBeenCalledWith('enqueue');
    });

    it('returns 0 when worker disabled', async () => {
      prismaAssignmentFindMany.mockResolvedValue([]);

      const moduleRef = await Test.createTestingModule({
        providers: [
          RemindersService,
          {
            provide: ConfigService,
            useValue: makeConfig((key) => (key === 'REMINDER_WORKER_ENABLED' ? 'false' : baseConfigMap[key])),
          },
          { provide: PrismaService, useValue: prisma },
          { provide: NotificationsService, useValue: notifications },
          { provide: MetricsService, useValue: metrics },
          { provide: REMINDER_QUEUE_PROVIDER, useValue: null },
        ],
      }).compile();

      const disabledService = moduleRef.get(RemindersService);
      const queued = await disabledService.scanAndEnqueue();
      expect(queued).toBe(0);
      expect(addMock).not.toHaveBeenCalled();
    });

    it('returns 0 when no assignments found', async () => {
      prismaAssignmentFindMany.mockResolvedValue([]);

      const queued = await service.scanAndEnqueue();

      expect(queued).toBe(0);
      expect(addMock).not.toHaveBeenCalled();
    });

    it('calculates correct delay for near-future assignments', async () => {
      const scheduledStart = new Date(Date.now() + 20 * 60 * 1000); // 20 min from now
      prismaAssignmentFindMany.mockResolvedValue([
        { id: 'assign-1', jobId: 'job-1', scheduleVersion: 1, scheduledStart },
      ]);
      prismaAssignmentUpdate.mockResolvedValue({});
      addMock.mockResolvedValue({});

      await service.scanAndEnqueue();

      expect(addMock).toHaveBeenCalledWith(
        'assignment-reminder',
        expect.any(Object),
        expect.objectContaining({
          delay: expect.any(Number),
          attempts: 3,
          removeOnComplete: true,
        }),
      );
    });
  });

  describe('markOverdue', () => {
    it('updates assignments older than threshold', async () => {
      prismaAssignmentUpdateMany.mockResolvedValue({ count: 1 });
      await (service as any).markOverdue();
      expect(prismaAssignmentUpdateMany).toHaveBeenCalled();
    });

    it('does not run when worker disabled', async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          RemindersService,
          {
            provide: ConfigService,
            useValue: makeConfig((key) => (key === 'REMINDER_WORKER_ENABLED' ? 'false' : baseConfigMap[key])),
          },
          { provide: PrismaService, useValue: prisma },
          { provide: NotificationsService, useValue: notifications },
          { provide: MetricsService, useValue: metrics },
          { provide: REMINDER_QUEUE_PROVIDER, useValue: null },
        ],
      }).compile();

      const disabledService = moduleRef.get(RemindersService);
      await (disabledService as any).markOverdue();
      expect(prismaAssignmentUpdateMany).not.toHaveBeenCalled();
    });

    it('updates multiple assignments to OVERDUE status', async () => {
      prismaAssignmentUpdateMany.mockResolvedValue({ count: 5 });

      await (service as any).markOverdue();

      expect(prismaAssignmentUpdateMany).toHaveBeenCalledWith({
        where: {
          status: 'scheduled',
          scheduledStart: { not: null, lt: expect.any(Date) },
          reminderStatus: { not: AssignmentReminderStatus.OVERDUE },
        },
        data: { reminderStatus: AssignmentReminderStatus.OVERDUE },
      });
    });
  });

  describe('handleReminder', () => {
    it('sends reminder and updates assignment', async () => {
      const data: ReminderJobData = { assignmentId: 'assign-1', jobId: 'job-1', scheduleVersion: 2 };
      prismaAssignmentFindUnique.mockResolvedValue({
        id: 'assign-1',
        jobId: 'job-1',
        status: 'scheduled',
        scheduleVersion: 2,
        scheduledStart: new Date().toISOString(),
        scheduleNotes: 'bring tools',
        reminderStatus: AssignmentReminderStatus.QUEUED,
        provider: { userId: 'prov-user' },
        job: { customerId: 'cust-user' },
      });
      prismaAssignmentUpdate.mockResolvedValue({});

      await (service as any).handleReminder(data);

      expect(notifications.notifyAssignmentReminder).toHaveBeenCalledWith(
        expect.objectContaining({ assignmentId: 'assign-1', providerId: 'prov-user', customerId: 'cust-user' }),
      );
      expect(prismaAssignmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'assign-1' },
          data: expect.objectContaining({ reminderStatus: AssignmentReminderStatus.SENT }),
        }),
      );
      expect(metrics.incReminderSent).toHaveBeenCalledWith('scheduled');
    });

    it('skips when assignment not found', async () => {
      const data: ReminderJobData = { assignmentId: 'nonexistent', jobId: 'job-1', scheduleVersion: 1 };
      prismaAssignmentFindUnique.mockResolvedValue(null);

      await (service as any).handleReminder(data);

      expect(notifications.notifyAssignmentReminder).not.toHaveBeenCalled();
      expect(prismaAssignmentUpdate).not.toHaveBeenCalled();
    });

    it('skips when schedule version changed', async () => {
      const data: ReminderJobData = { assignmentId: 'assign-1', jobId: 'job-1', scheduleVersion: 2 };
      prismaAssignmentFindUnique.mockResolvedValue({
        id: 'assign-1',
        jobId: 'job-1',
        status: 'scheduled',
        scheduleVersion: 3, // Different version
        scheduledStart: new Date().toISOString(),
        reminderStatus: AssignmentReminderStatus.QUEUED,
        provider: { userId: 'prov-user' },
        job: { customerId: 'cust-user' },
      });

      await (service as any).handleReminder(data);

      expect(notifications.notifyAssignmentReminder).not.toHaveBeenCalled();
      expect(prismaAssignmentUpdate).not.toHaveBeenCalled();
    });

    it('skips when assignment status is not scheduled', async () => {
      const data: ReminderJobData = { assignmentId: 'assign-1', jobId: 'job-1', scheduleVersion: 2 };
      prismaAssignmentFindUnique.mockResolvedValue({
        id: 'assign-1',
        jobId: 'job-1',
        status: 'completed',
        scheduleVersion: 2,
        scheduledStart: new Date().toISOString(),
        reminderStatus: AssignmentReminderStatus.QUEUED,
        provider: { userId: 'prov-user' },
        job: { customerId: 'cust-user' },
      });

      await (service as any).handleReminder(data);

      expect(notifications.notifyAssignmentReminder).not.toHaveBeenCalled();
      expect(prismaAssignmentUpdate).not.toHaveBeenCalled();
    });

    it('skips when reminder already sent', async () => {
      const data: ReminderJobData = { assignmentId: 'assign-1', jobId: 'job-1', scheduleVersion: 2 };
      prismaAssignmentFindUnique.mockResolvedValue({
        id: 'assign-1',
        jobId: 'job-1',
        status: 'scheduled',
        scheduleVersion: 2,
        scheduledStart: new Date().toISOString(),
        reminderStatus: AssignmentReminderStatus.SENT, // Already sent
        provider: { userId: 'prov-user' },
        job: { customerId: 'cust-user' },
      });

      await (service as any).handleReminder(data);

      expect(notifications.notifyAssignmentReminder).not.toHaveBeenCalled();
      expect(prismaAssignmentUpdate).not.toHaveBeenCalled();
    });

    it('handles null scheduledStart', async () => {
      const data: ReminderJobData = { assignmentId: 'assign-1', jobId: 'job-1', scheduleVersion: 2 };
      prismaAssignmentFindUnique.mockResolvedValue({
        id: 'assign-1',
        jobId: 'job-1',
        status: 'scheduled',
        scheduleVersion: 2,
        scheduledStart: null,
        reminderStatus: AssignmentReminderStatus.QUEUED,
        provider: { userId: 'prov-user' },
        job: { customerId: 'cust-user' },
      });
      prismaAssignmentUpdate.mockResolvedValue({});

      await (service as any).handleReminder(data);

      expect(notifications.notifyAssignmentReminder).toHaveBeenCalledWith(
        expect.objectContaining({ scheduledStart: null }),
      );
    });

    it('increments reminder count in database', async () => {
      const data: ReminderJobData = { assignmentId: 'assign-1', jobId: 'job-1', scheduleVersion: 2 };
      prismaAssignmentFindUnique.mockResolvedValue({
        id: 'assign-1',
        jobId: 'job-1',
        status: 'scheduled',
        scheduleVersion: 2,
        scheduledStart: new Date().toISOString(),
        reminderStatus: AssignmentReminderStatus.QUEUED,
        provider: { userId: 'prov-user' },
        job: { customerId: 'cust-user' },
      });
      prismaAssignmentUpdate.mockResolvedValue({});

      await (service as any).handleReminder(data);

      expect(prismaAssignmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reminderCount: { increment: 1 },
            reminderLastSentAt: expect.any(Date),
          }),
        }),
      );
    });

    it('does not run when worker disabled', async () => {
      const data: ReminderJobData = { assignmentId: 'assign-1', jobId: 'job-1', scheduleVersion: 2 };

      const moduleRef = await Test.createTestingModule({
        providers: [
          RemindersService,
          {
            provide: ConfigService,
            useValue: makeConfig((key) => (key === 'REMINDER_WORKER_ENABLED' ? 'false' : baseConfigMap[key])),
          },
          { provide: PrismaService, useValue: prisma },
          { provide: NotificationsService, useValue: notifications },
          { provide: MetricsService, useValue: metrics },
          { provide: REMINDER_QUEUE_PROVIDER, useValue: null },
        ],
      }).compile();

      const disabledService = moduleRef.get(RemindersService);
      await (disabledService as any).handleReminder(data);

      expect(prismaAssignmentFindUnique).not.toHaveBeenCalled();
    });
  });
});
