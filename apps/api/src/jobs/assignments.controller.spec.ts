import { Test, TestingModule } from '@nestjs/testing';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { JwtAuthGuard, RolesGuard } from '../auth/jwt.guard';
import { ProvidersRoleLimitGuard } from '../common/guards/providers-role-limit.guard';

describe('AssignmentsController', () => {
  let controller: AssignmentsController;
  let assignmentsService: AssignmentsService;

  const mockAssignmentsService = {
    proposeScheduleAsProvider: jest.fn(),
    confirmSchedule: jest.fn(),
    rejectAssignment: jest.fn(),
    checkIn: jest.fn(),
    checkOut: jest.fn(),
    getCheckpoints: jest.fn(),
    updateLocation: jest.fn(),
    getLatestLocation: jest.fn(),
  };

  const mockProviderRequest = {
    user: {
      sub: 'provider-123',
      email: 'provider@example.com',
      role: 'PROVIDER',
    },
  };

  const mockCustomerRequest = {
    user: {
      sub: 'customer-456',
      email: 'customer@example.com',
      role: 'CUSTOMER',
    },
  };

  const mockAssignment = {
    id: 'assign-1',
    jobId: 'job-1',
    providerId: 'provider-123',
    status: 'ACCEPTED',
    acceptedAt: new Date(),
    scheduledStart: new Date(),
    scheduledEnd: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssignmentsController],
      providers: [
        {
          provide: AssignmentsService,
          useValue: mockAssignmentsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ProvidersRoleLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AssignmentsController>(AssignmentsController);
    assignmentsService = module.get<AssignmentsService>(AssignmentsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('proposeAsProvider', () => {
    it('should propose schedule as provider', async () => {
      const dto = {
        start: new Date('2025-12-01T10:00:00Z'),
        end: new Date('2025-12-01T12:00:00Z'),
      };
      mockAssignmentsService.proposeScheduleAsProvider.mockResolvedValue(mockAssignment);

      const result = await controller.proposeAsProvider('assign-1', mockProviderRequest as any, dto);

      expect(result).toEqual(mockAssignment);
      expect(assignmentsService.proposeScheduleAsProvider).toHaveBeenCalledWith(
        'assign-1',
        'provider-123',
        dto,
      );
    });

    it('should extract providerId from request.user.sub', async () => {
      const dto = {
        start: new Date(),
        end: new Date(),
      };
      mockAssignmentsService.proposeScheduleAsProvider.mockResolvedValue(mockAssignment);

      await controller.proposeAsProvider('assign-1', mockProviderRequest as any, dto);

      expect(assignmentsService.proposeScheduleAsProvider).toHaveBeenCalledWith(
        'assign-1',
        mockProviderRequest.user.sub,
        expect.any(Object),
      );
    });

    it('should pass schedule times to service', async () => {
      const start = new Date('2025-12-01T10:00:00Z');
      const end = new Date('2025-12-01T12:00:00Z');
      const dto = { start, end };
      mockAssignmentsService.proposeScheduleAsProvider.mockResolvedValue(mockAssignment);

      await controller.proposeAsProvider('assign-1', mockProviderRequest as any, dto);

      expect(assignmentsService.proposeScheduleAsProvider).toHaveBeenCalledWith(
        'assign-1',
        'provider-123',
        { start, end },
      );
    });
  });

  describe('confirmSchedule', () => {
    it('should confirm schedule as provider', async () => {
      const dto = { version: 0 };
      mockAssignmentsService.confirmSchedule.mockResolvedValue(mockAssignment);

      const result = await controller.confirmSchedule('assign-1', mockProviderRequest as any, dto);

      expect(result).toEqual(mockAssignment);
      expect(assignmentsService.confirmSchedule).toHaveBeenCalledWith('assign-1', {
        userId: 'provider-123',
        role: 'PROVIDER',
      }, dto);
    });

    it('should confirm schedule as customer', async () => {
      const dto = { version: 0 };
      mockAssignmentsService.confirmSchedule.mockResolvedValue(mockAssignment);

      const result = await controller.confirmSchedule('assign-1', mockCustomerRequest as any, dto);

      expect(result).toEqual(mockAssignment);
      expect(assignmentsService.confirmSchedule).toHaveBeenCalledWith('assign-1', {
        userId: 'customer-456',
        role: 'CUSTOMER',
      }, dto);
    });

    it('should map PROVIDER role correctly', async () => {
      const dto = { version: 0 };
      mockAssignmentsService.confirmSchedule.mockResolvedValue(mockAssignment);

      await controller.confirmSchedule('assign-1', mockProviderRequest as any, dto);

      const callArgs = mockAssignmentsService.confirmSchedule.mock.calls[0];
      expect(callArgs[1].role).toBe('PROVIDER');
    });

    it('should map CUSTOMER role correctly', async () => {
      const dto = { version: 0 };
      mockAssignmentsService.confirmSchedule.mockResolvedValue(mockAssignment);

      await controller.confirmSchedule('assign-1', mockCustomerRequest as any, dto);

      const callArgs = mockAssignmentsService.confirmSchedule.mock.calls[0];
      expect(callArgs[1].role).toBe('CUSTOMER');
    });

    it('should handle ADMIN role as CUSTOMER', async () => {
      const adminRequest = {
        user: { sub: 'admin-789', email: 'admin@example.com', role: 'ADMIN' },
      };
      const dto = { version: 0 };
      mockAssignmentsService.confirmSchedule.mockResolvedValue(mockAssignment);

      await controller.confirmSchedule('assign-1', adminRequest as any, dto);

      const callArgs = mockAssignmentsService.confirmSchedule.mock.calls[0];
      expect(callArgs[1].role).toBe('CUSTOMER');
    });
  });

  describe('rejectAssignment', () => {
    it('should reject assignment', async () => {
      const dto = { reason: 'Not available' };
      mockAssignmentsService.rejectAssignment.mockResolvedValue(mockAssignment);

      const result = await controller.rejectAssignment('assign-1', mockProviderRequest as any, dto);

      expect(result).toEqual(mockAssignment);
      expect(assignmentsService.rejectAssignment).toHaveBeenCalledWith(
        'assign-1',
        'provider-123',
        dto,
      );
    });

    it('should pass rejection reason to service', async () => {
      const dto = { reason: 'Too far away' };
      mockAssignmentsService.rejectAssignment.mockResolvedValue(mockAssignment);

      await controller.rejectAssignment('assign-1', mockProviderRequest as any, dto);

      expect(assignmentsService.rejectAssignment).toHaveBeenCalledWith(
        'assign-1',
        'provider-123',
        { reason: 'Too far away' },
      );
    });

    it('should extract providerId from request', async () => {
      const dto = { reason: 'Conflict' };
      mockAssignmentsService.rejectAssignment.mockResolvedValue(mockAssignment);

      await controller.rejectAssignment('assign-1', mockProviderRequest as any, dto);

      expect(assignmentsService.rejectAssignment).toHaveBeenCalledWith(
        'assign-1',
        mockProviderRequest.user.sub,
        expect.any(Object),
      );
    });
  });

  describe('checkIn', () => {
    it('should check in to job site', async () => {
      const dto = { latitude: 40.7128, longitude: -74.006, timestamp: '2025-12-01T10:00:00Z' };
      const checkInResult = { success: true, timestamp: new Date() };
      mockAssignmentsService.checkIn.mockResolvedValue(checkInResult);

      const result = await controller.checkIn('assign-1', mockProviderRequest as any, dto);

      expect(result).toEqual(checkInResult);
      expect(assignmentsService.checkIn).toHaveBeenCalledWith('assign-1', 'provider-123', dto);
    });

    it('should pass GPS coordinates to service', async () => {
      const dto = { latitude: 34.0522, longitude: -118.2437, timestamp: '2025-12-01T10:00:00Z' };
      mockAssignmentsService.checkIn.mockResolvedValue({ success: true });

      await controller.checkIn('assign-1', mockProviderRequest as any, dto);

      expect(assignmentsService.checkIn).toHaveBeenCalledWith('assign-1', 'provider-123', {
        latitude: 34.0522,
        longitude: -118.2437,
        timestamp: '2025-12-01T10:00:00Z',
      });
    });

    it('should extract providerId from request', async () => {
      const dto = { latitude: 0, longitude: 0, timestamp: '2025-12-01T10:00:00Z' };
      mockAssignmentsService.checkIn.mockResolvedValue({ success: true });

      await controller.checkIn('assign-1', mockProviderRequest as any, dto);

      expect(assignmentsService.checkIn).toHaveBeenCalledWith(
        'assign-1',
        mockProviderRequest.user.sub,
        expect.any(Object),
      );
    });
  });

  describe('checkOut', () => {
    it('should check out from job site', async () => {
      const dto = { latitude: 40.7128, longitude: -74.006, timestamp: '2025-12-01T12:00:00Z' };
      const checkOutResult = { success: true, timestamp: new Date() };
      mockAssignmentsService.checkOut.mockResolvedValue(checkOutResult);

      const result = await controller.checkOut('assign-1', mockProviderRequest as any, dto);

      expect(result).toEqual(checkOutResult);
      expect(assignmentsService.checkOut).toHaveBeenCalledWith('assign-1', 'provider-123', dto);
    });

    it('should pass GPS coordinates to service', async () => {
      const dto = { latitude: 51.5074, longitude: -0.1278, timestamp: '2025-12-01T12:00:00Z' };
      mockAssignmentsService.checkOut.mockResolvedValue({ success: true });

      await controller.checkOut('assign-1', mockProviderRequest as any, dto);

      expect(assignmentsService.checkOut).toHaveBeenCalledWith('assign-1', 'provider-123', {
        latitude: 51.5074,
        longitude: -0.1278,
        timestamp: '2025-12-01T12:00:00Z',
      });
    });

    it('should extract providerId from request', async () => {
      const dto = { latitude: 0, longitude: 0, timestamp: '2025-12-01T12:00:00Z' };
      mockAssignmentsService.checkOut.mockResolvedValue({ success: true });

      await controller.checkOut('assign-1', mockProviderRequest as any, dto);

      expect(assignmentsService.checkOut).toHaveBeenCalledWith(
        'assign-1',
        mockProviderRequest.user.sub,
        expect.any(Object),
      );
    });
  });

  describe('getCheckpoints', () => {
    it('should get checkpoints for assignment', async () => {
      const checkpoints = [
        { type: 'CHECK_IN', latitude: 40.7128, longitude: -74.006, timestamp: new Date() },
        { type: 'CHECK_OUT', latitude: 40.7128, longitude: -74.006, timestamp: new Date() },
      ];
      mockAssignmentsService.getCheckpoints.mockResolvedValue(checkpoints);

      const result = await controller.getCheckpoints('assign-1', mockProviderRequest as any);

      expect(result).toEqual(checkpoints);
      expect(assignmentsService.getCheckpoints).toHaveBeenCalledWith('assign-1', 'provider-123');
    });

    it('should work for customer requests', async () => {
      const checkpoints: any[] = [];
      mockAssignmentsService.getCheckpoints.mockResolvedValue(checkpoints);

      const result = await controller.getCheckpoints('assign-1', mockCustomerRequest as any);

      expect(result).toEqual(checkpoints);
      expect(assignmentsService.getCheckpoints).toHaveBeenCalledWith('assign-1', 'customer-456');
    });

    it('should extract userId from request', async () => {
      mockAssignmentsService.getCheckpoints.mockResolvedValue([]);

      await controller.getCheckpoints('assign-1', mockProviderRequest as any);

      expect(assignmentsService.getCheckpoints).toHaveBeenCalledWith(
        'assign-1',
        mockProviderRequest.user.sub,
      );
    });
  });

  describe('updateLocation', () => {
    it('should update provider location', async () => {
      const dto = { latitude: 40.7128, longitude: -74.006, accuracy: 10, timestamp: '2025-12-01T11:00:00Z' };
      const updateResult = { success: true, timestamp: new Date() };
      mockAssignmentsService.updateLocation.mockResolvedValue(updateResult);

      const result = await controller.updateLocation('assign-1', mockProviderRequest as any, dto);

      expect(result).toEqual(updateResult);
      expect(assignmentsService.updateLocation).toHaveBeenCalledWith('assign-1', 'provider-123', dto);
    });

    it('should pass GPS coordinates to service', async () => {
      const dto = { latitude: 48.8566, longitude: 2.3522, accuracy: 15, timestamp: '2025-12-01T11:00:00Z' };
      mockAssignmentsService.updateLocation.mockResolvedValue({ success: true });

      await controller.updateLocation('assign-1', mockProviderRequest as any, dto);

      expect(assignmentsService.updateLocation).toHaveBeenCalledWith('assign-1', 'provider-123', {
        latitude: 48.8566,
        longitude: 2.3522,
        accuracy: 15,
        timestamp: '2025-12-01T11:00:00Z',
      });
    });

    it('should extract providerId from request', async () => {
      const dto = { latitude: 0, longitude: 0, accuracy: 5, timestamp: '2025-12-01T11:00:00Z' };
      mockAssignmentsService.updateLocation.mockResolvedValue({ success: true });

      await controller.updateLocation('assign-1', mockProviderRequest as any, dto);

      expect(assignmentsService.updateLocation).toHaveBeenCalledWith(
        'assign-1',
        mockProviderRequest.user.sub,
        expect.any(Object),
      );
    });
  });

  describe('getLatestLocation', () => {
    it('should get latest provider location', async () => {
      const location = {
        latitude: 40.7128,
        longitude: -74.006,
        timestamp: new Date(),
        providerId: 'provider-123',
      };
      mockAssignmentsService.getLatestLocation.mockResolvedValue(location);

      const result = await controller.getLatestLocation('assign-1', mockCustomerRequest as any);

      expect(result).toEqual(location);
      expect(assignmentsService.getLatestLocation).toHaveBeenCalledWith('assign-1', 'customer-456');
    });

    it('should extract userId from request', async () => {
      mockAssignmentsService.getLatestLocation.mockResolvedValue(null);

      await controller.getLatestLocation('assign-1', mockCustomerRequest as any);

      expect(assignmentsService.getLatestLocation).toHaveBeenCalledWith(
        'assign-1',
        mockCustomerRequest.user.sub,
      );
    });

    it('should handle null location', async () => {
      mockAssignmentsService.getLatestLocation.mockResolvedValue(null);

      const result = await controller.getLatestLocation('assign-1', mockCustomerRequest as any);

      expect(result).toBeNull();
    });
  });

  describe('Assignment ID handling', () => {
    it('should use assignment ID from route parameter', async () => {
      const dto = { start: new Date(), end: new Date() };
      mockAssignmentsService.proposeScheduleAsProvider.mockResolvedValue(mockAssignment);

      await controller.proposeAsProvider('custom-assign-id', mockProviderRequest as any, dto);

      expect(assignmentsService.proposeScheduleAsProvider).toHaveBeenCalledWith(
        'custom-assign-id',
        expect.any(String),
        expect.any(Object),
      );
    });

    it('should handle different assignment IDs across endpoints', async () => {
      mockAssignmentsService.checkIn.mockResolvedValue({ success: true });
      mockAssignmentsService.checkOut.mockResolvedValue({ success: true });

      await controller.checkIn('assign-1', mockProviderRequest as any, {
        latitude: 0,
        longitude: 0,
        timestamp: '2025-12-01T10:00:00Z'
      });
      await controller.checkOut('assign-2', mockProviderRequest as any, {
        latitude: 0,
        longitude: 0,
        timestamp: '2025-12-01T12:00:00Z'
      });

      expect(assignmentsService.checkIn).toHaveBeenCalledWith('assign-1', expect.any(String), expect.any(Object));
      expect(assignmentsService.checkOut).toHaveBeenCalledWith('assign-2', expect.any(String), expect.any(Object));
    });
  });

  describe('User context', () => {
    it('should preserve user context in provider requests', async () => {
      const dto = { latitude: 0, longitude: 0, timestamp: '2025-12-01T10:00:00Z' };
      mockAssignmentsService.checkIn.mockResolvedValue({ success: true });

      await controller.checkIn('assign-1', mockProviderRequest as any, dto);

      expect(assignmentsService.checkIn).toHaveBeenCalledWith(
        expect.any(String),
        mockProviderRequest.user.sub,
        expect.any(Object),
      );
    });

    it('should preserve user context in customer requests', async () => {
      mockAssignmentsService.getLatestLocation.mockResolvedValue(null);

      await controller.getLatestLocation('assign-1', mockCustomerRequest as any);

      expect(assignmentsService.getLatestLocation).toHaveBeenCalledWith(
        expect.any(String),
        mockCustomerRequest.user.sub,
      );
    });
  });
});
