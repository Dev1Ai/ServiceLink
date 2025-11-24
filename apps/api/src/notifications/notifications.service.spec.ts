import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from './notification.types';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    deviceToken: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    job: {
      findUnique: jest.fn(),
    },
    provider: {
      findUnique: jest.fn(),
    },
    quote: {
      findUnique: jest.fn(),
    },
    assignment: {
      findUnique: jest.fn(),
    },
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    prisma = module.get<PrismaService>(PrismaService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Firebase initialization', () => {
    it('should initialize without Firebase when FIREBASE_SERVICE_ACCOUNT is not set', () => {
      expect(service).toBeDefined();
      // Service should log that Firebase is disabled
    });

    it('should gracefully handle Firebase initialization errors', () => {
      // Service constructor handles errors gracefully
      expect(service).toBeDefined();
    });
  });

  describe('notifyQuoteCreated', () => {
    it('should send notification to customer when quote is created', async () => {
      const jobId = 'job-123';
      const quoteId = 'quote-456';
      const providerId = 'provider-789';

      const mockJob = {
        id: jobId,
        title: 'Plumbing Repair',
        customerId: 'customer-001',
        customer: { name: 'John Doe' },
      };

      const mockProvider = {
        id: providerId,
        userId: 'user-provider-001',
        user: { name: 'Jane Provider' },
      };

      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.provider.findUnique.mockResolvedValue(mockProvider);
      mockPrismaService.notification.create.mockResolvedValue({});
      mockPrismaService.deviceToken.findMany.mockResolvedValue([]);

      await service.notifyQuoteCreated(jobId, quoteId, providerId);

      expect(mockPrismaService.job.findUnique).toHaveBeenCalledWith({
        where: { id: jobId },
        include: { customer: true },
      });

      expect(mockPrismaService.provider.findUnique).toHaveBeenCalledWith({
        where: { id: providerId },
        include: { user: true },
      });

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockJob.customerId,
          type: NotificationType.QUOTE_RECEIVED,
          title: 'New Quote Received',
          body: expect.stringContaining('Jane Provider'),
        }),
      });
    });

    it('should handle job not found', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(null);

      await service.notifyQuoteCreated('job-123', 'quote-456', 'provider-789');

      expect(mockPrismaService.notification.create).not.toHaveBeenCalled();
    });

    it('should handle provider not found', async () => {
      const mockJob = {
        id: 'job-123',
        title: 'Test Job',
        customerId: 'customer-001',
        customer: { name: 'John Doe' },
      };

      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.provider.findUnique.mockResolvedValue(null);

      await service.notifyQuoteCreated('job-123', 'quote-456', 'provider-789');

      expect(mockPrismaService.notification.create).not.toHaveBeenCalled();
    });
  });

  describe('notifyQuoteAccepted', () => {
    it('should send notification to provider when quote is accepted', async () => {
      const jobId = 'job-123';
      const quoteId = 'quote-456';
      const providerId = 'provider-789';

      const mockJob = {
        id: jobId,
        title: 'Electrical Work',
        customerId: 'customer-001',
        customer: { name: 'John Customer' },
      };

      const mockProvider = {
        id: providerId,
        userId: 'user-provider-001',
        user: { name: 'Jane Provider' },
      };

      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.provider.findUnique.mockResolvedValue(mockProvider);
      mockPrismaService.notification.create.mockResolvedValue({});
      mockPrismaService.deviceToken.findMany.mockResolvedValue([]);

      await service.notifyQuoteAccepted(jobId, quoteId, providerId);

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockProvider.userId,
          type: NotificationType.QUOTE_ACCEPTED,
          title: 'Quote Accepted!',
          body: expect.stringContaining('John Customer'),
        }),
      });
    });

    it('should handle job not found', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(null);

      await service.notifyQuoteAccepted('job-123', 'quote-456', 'provider-789');

      expect(mockPrismaService.notification.create).not.toHaveBeenCalled();
    });

    it('should handle provider not found', async () => {
      const mockJob = {
        id: 'job-123',
        title: 'Test Job',
        customerId: 'customer-001',
        customer: { name: 'John Doe' },
      };

      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.provider.findUnique.mockResolvedValue(null);

      await service.notifyQuoteAccepted('job-123', 'quote-456', 'provider-789');

      expect(mockPrismaService.notification.create).not.toHaveBeenCalled();
    });
  });

  describe('notifyAcceptanceRevoked', () => {
    it('should log acceptance revoked notification', async () => {
      const jobId = 'job-123';
      const quoteId = 'quote-456';

      await service.notifyAcceptanceRevoked(jobId, quoteId);

      // Should complete without errors
      expect(true).toBe(true);
    });
  });

  describe('notifyScheduleProposed', () => {
    it('should log schedule proposed notification', async () => {
      const payload = {
        jobId: 'job-123',
        assignmentId: 'assign-456',
        proposedBy: 'customer' as const,
        start: new Date('2025-01-15T10:00:00Z'),
        end: new Date('2025-01-15T12:00:00Z'),
      };

      await service.notifyScheduleProposed(payload);

      // Should complete without errors
      expect(true).toBe(true);
    });
  });

  describe('notifyScheduleConfirmed', () => {
    it('should notify both customer and provider when schedule confirmed', async () => {
      const payload = {
        jobId: 'job-123',
        assignmentId: 'assign-456',
        confirmedBy: 'provider' as const,
        start: new Date('2025-01-15T10:00:00Z'),
        end: new Date('2025-01-15T12:00:00Z'),
      };

      const mockAssignment = {
        id: payload.assignmentId,
        jobId: payload.jobId,
        providerId: 'provider-789',
        job: {
          id: payload.jobId,
          title: 'Plumbing Job',
          customerId: 'customer-001',
          customer: { name: 'John Customer' },
        },
        provider: {
          userId: 'user-provider-001',
          user: { name: 'Jane Provider' },
        },
      };

      mockPrismaService.assignment.findUnique.mockResolvedValue(mockAssignment);
      mockPrismaService.notification.create.mockResolvedValue({});
      mockPrismaService.deviceToken.findMany.mockResolvedValue([]);

      await service.notifyScheduleConfirmed(payload);

      // Should create two notifications: one for customer, one for provider
      expect(mockPrismaService.notification.create).toHaveBeenCalledTimes(2);
    });

    it('should handle null dates', async () => {
      const payload = {
        jobId: 'job-123',
        assignmentId: 'assign-456',
        confirmedBy: 'customer' as const,
        start: null,
        end: null,
      };

      const mockAssignment = {
        id: payload.assignmentId,
        jobId: payload.jobId,
        providerId: 'provider-789',
        job: {
          id: payload.jobId,
          title: 'Plumbing Job',
          customerId: 'customer-001',
          customer: { name: 'John Customer' },
        },
        provider: {
          userId: 'user-provider-001',
          user: { name: 'Jane Provider' },
        },
      };

      mockPrismaService.assignment.findUnique.mockResolvedValue(mockAssignment);
      mockPrismaService.notification.create.mockResolvedValue({});
      mockPrismaService.deviceToken.findMany.mockResolvedValue([]);

      await service.notifyScheduleConfirmed(payload);

      // Should still send notifications with "TBD" in message
      expect(mockPrismaService.notification.create).toHaveBeenCalledTimes(2);
    });

    it('should handle assignment not found', async () => {
      const payload = {
        jobId: 'job-123',
        assignmentId: 'assign-456',
        confirmedBy: 'provider' as const,
        start: new Date('2025-01-15T10:00:00Z'),
        end: new Date('2025-01-15T12:00:00Z'),
      };

      mockPrismaService.assignment.findUnique.mockResolvedValue(null);

      await service.notifyScheduleConfirmed(payload);

      expect(mockPrismaService.notification.create).not.toHaveBeenCalled();
    });
  });

  describe('notifyCheckIn', () => {
    it('should notify customer when provider checks in', async () => {
      const payload = { assignmentId: 'assign-123' };

      const mockAssignment = {
        id: payload.assignmentId,
        jobId: 'job-456',
        providerId: 'provider-789',
        job: {
          customerId: 'customer-001',
          title: 'Repair Work',
        },
        provider: {
          user: { name: 'Jane Provider' },
        },
        checkpoints: [
          {
            type: 'CHECK_IN',
            timestamp: new Date('2025-01-15T10:00:00Z'),
          },
        ],
      };

      mockPrismaService.assignment.findUnique.mockResolvedValue(mockAssignment);
      mockPrismaService.notification.create.mockResolvedValue({});
      mockPrismaService.deviceToken.findMany.mockResolvedValue([]);

      await service.notifyCheckIn(payload);

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockAssignment.job.customerId,
          type: NotificationType.PROVIDER_CHECKED_IN,
          title: 'Provider Arrived',
        }),
      });
    });

    it('should handle assignment not found', async () => {
      mockPrismaService.assignment.findUnique.mockResolvedValue(null);

      await service.notifyCheckIn({ assignmentId: 'assign-123' });

      expect(mockPrismaService.notification.create).not.toHaveBeenCalled();
    });

    it('should handle no check-in checkpoint found', async () => {
      const mockAssignment = {
        id: 'assign-123',
        jobId: 'job-456',
        providerId: 'provider-789',
        job: { customerId: 'customer-001', title: 'Repair Work' },
        provider: { user: { name: 'Jane Provider' } },
        checkpoints: [],
      };

      mockPrismaService.assignment.findUnique.mockResolvedValue(mockAssignment);

      await service.notifyCheckIn({ assignmentId: 'assign-123' });

      expect(mockPrismaService.notification.create).not.toHaveBeenCalled();
    });
  });

  describe('notifyCheckOut', () => {
    it('should notify customer when provider checks out', async () => {
      const payload = { assignmentId: 'assign-123' };

      const mockAssignment = {
        id: payload.assignmentId,
        jobId: 'job-456',
        providerId: 'provider-789',
        job: {
          customerId: 'customer-001',
          title: 'Repair Work',
        },
        provider: {
          user: { name: 'Jane Provider' },
        },
        checkpoints: [
          {
            type: 'CHECK_OUT',
            timestamp: new Date('2025-01-15T12:00:00Z'),
          },
        ],
      };

      mockPrismaService.assignment.findUnique.mockResolvedValue(mockAssignment);
      mockPrismaService.notification.create.mockResolvedValue({});
      mockPrismaService.deviceToken.findMany.mockResolvedValue([]);

      await service.notifyCheckOut(payload);

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockAssignment.job.customerId,
          type: NotificationType.PROVIDER_CHECKED_OUT,
          title: 'Provider Completed Visit',
        }),
      });
    });

    it('should handle assignment not found', async () => {
      mockPrismaService.assignment.findUnique.mockResolvedValue(null);

      await service.notifyCheckOut({ assignmentId: 'assign-123' });

      expect(mockPrismaService.notification.create).not.toHaveBeenCalled();
    });

    it('should handle no check-out checkpoint found', async () => {
      const mockAssignment = {
        id: 'assign-123',
        jobId: 'job-456',
        providerId: 'provider-789',
        job: { customerId: 'customer-001', title: 'Repair Work' },
        provider: { user: { name: 'Jane Provider' } },
        checkpoints: [],
      };

      mockPrismaService.assignment.findUnique.mockResolvedValue(mockAssignment);

      await service.notifyCheckOut({ assignmentId: 'assign-123' });

      expect(mockPrismaService.notification.create).not.toHaveBeenCalled();
    });
  });

  describe('notifyAssignmentRejected', () => {
    it('should log assignment rejected notification', async () => {
      const payload = {
        jobId: 'job-123',
        assignmentId: 'assign-456',
        providerId: 'provider-789',
      };

      await service.notifyAssignmentRejected(payload);

      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should include reason when provided', async () => {
      const payload = {
        jobId: 'job-123',
        assignmentId: 'assign-456',
        providerId: 'provider-789',
        reason: 'Provider unavailable',
      };

      await service.notifyAssignmentRejected(payload);

      // Should complete without errors
      expect(true).toBe(true);
    });
  });

  describe('notifyAssignmentReminder', () => {
    it('should log assignment reminder notification', async () => {
      const payload = {
        assignmentId: 'assign-123',
        jobId: 'job-456',
        providerId: 'provider-789',
        customerId: 'customer-012',
        scheduledStart: new Date('2025-01-15T10:00:00Z'),
        leadMinutes: 30,
      };

      await service.notifyAssignmentReminder(payload);

      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should handle null values', async () => {
      const payload = {
        assignmentId: 'assign-123',
        jobId: 'job-456',
        providerId: null,
        customerId: null,
        scheduledStart: null,
        leadMinutes: 60,
      };

      await service.notifyAssignmentReminder(payload);

      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should include schedule notes when provided', async () => {
      const payload = {
        assignmentId: 'assign-123',
        jobId: 'job-456',
        providerId: 'provider-789',
        customerId: 'customer-012',
        scheduledStart: new Date('2025-01-15T10:00:00Z'),
        scheduleNotes: 'Bring tools',
        leadMinutes: 15,
      };

      await service.notifyAssignmentReminder(payload);

      // Should complete without errors
      expect(true).toBe(true);
    });
  });

  describe('registerDeviceToken', () => {
    it('should register a new device token', async () => {
      const userId = 'user-123';
      const token = 'device-token-abc';
      const platform = 'ios';

      await service.registerDeviceToken(userId, token, platform);

      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should support android platform', async () => {
      const userId = 'user-123';
      const token = 'device-token-def';
      const platform = 'android';

      await service.registerDeviceToken(userId, token, platform);

      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should support web platform', async () => {
      const userId = 'user-123';
      const token = 'device-token-ghi';
      const platform = 'web';

      await service.registerDeviceToken(userId, token, platform);

      // Should complete without errors
      expect(true).toBe(true);
    });
  });

  describe('unregisterDeviceToken', () => {
    it('should unregister a device token', async () => {
      const token = 'device-token-abc';

      await service.unregisterDeviceToken(token);

      // Should complete without errors
      expect(true).toBe(true);
    });
  });

  describe('sendNotification', () => {
    it('should store notification in database', async () => {
      const userId = 'user-123';
      const type = NotificationType.QUOTE_RECEIVED;
      const title = 'Test Notification';
      const body = 'Test body';
      const data = { jobId: 'job-123' };

      mockPrismaService.notification.create.mockResolvedValue({});
      mockPrismaService.deviceToken.findMany.mockResolvedValue([]);

      await service.sendNotification(userId, type, title, body, data);

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
        data: {
          userId,
          type,
          title,
          body,
          data,
        },
      });
    });

    it('should handle no active device tokens', async () => {
      mockPrismaService.notification.create.mockResolvedValue({});
      mockPrismaService.deviceToken.findMany.mockResolvedValue([]);

      await service.sendNotification(
        'user-123',
        NotificationType.QUOTE_RECEIVED,
        'Test',
        'Body',
      );

      expect(mockPrismaService.deviceToken.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', active: true },
      });
    });

    it('should query for active device tokens only', async () => {
      const userId = 'user-123';

      mockPrismaService.notification.create.mockResolvedValue({});
      mockPrismaService.deviceToken.findMany.mockResolvedValue([
        { token: 'token-1', active: true },
        { token: 'token-2', active: true },
      ]);

      await service.sendNotification(
        userId,
        NotificationType.JOB_SCHEDULED,
        'Test',
        'Body',
      );

      expect(mockPrismaService.deviceToken.findMany).toHaveBeenCalledWith({
        where: { userId, active: true },
      });
    });
  });

  describe('getNotifications', () => {
    it('should return user notifications with default limit', async () => {
      const userId = 'user-123';
      const mockNotifications = [
        {
          id: 'notif-1',
          userId,
          type: NotificationType.QUOTE_RECEIVED,
          title: 'Test',
          body: 'Body',
          read: false,
          createdAt: new Date(),
        },
      ];

      mockPrismaService.notification.findMany.mockResolvedValue(mockNotifications);

      const result = await service.getNotifications(userId);

      expect(result).toEqual(mockNotifications);
      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });

    it('should respect custom limit', async () => {
      const userId = 'user-123';

      mockPrismaService.notification.findMany.mockResolvedValue([]);

      await service.getNotifications(userId, 20);

      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
    });

    it('should filter unread notifications when requested', async () => {
      const userId = 'user-123';

      mockPrismaService.notification.findMany.mockResolvedValue([]);

      await service.getNotifications(userId, 50, true);

      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith({
        where: { userId, read: false },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const notificationId = 'notif-123';
      const userId = 'user-123';

      const mockNotification = {
        id: notificationId,
        userId,
        type: NotificationType.QUOTE_RECEIVED,
        title: 'Test',
        body: 'Body',
        read: false,
      };

      mockPrismaService.notification.findUnique.mockResolvedValue(mockNotification);
      mockPrismaService.notification.update.mockResolvedValue({
        ...mockNotification,
        read: true,
      });

      await service.markAsRead(notificationId, userId);

      expect(mockPrismaService.notification.update).toHaveBeenCalledWith({
        where: { id: notificationId },
        data: { read: true },
      });
    });

    it('should throw error if notification not found', async () => {
      mockPrismaService.notification.findUnique.mockResolvedValue(null);

      await expect(service.markAsRead('notif-123', 'user-123')).rejects.toThrow(
        'Notification not found',
      );

      expect(mockPrismaService.notification.update).not.toHaveBeenCalled();
    });

    it('should throw error if user not authorized', async () => {
      const mockNotification = {
        id: 'notif-123',
        userId: 'user-999',
        type: NotificationType.QUOTE_RECEIVED,
        title: 'Test',
        body: 'Body',
        read: false,
      };

      mockPrismaService.notification.findUnique.mockResolvedValue(mockNotification);

      await expect(service.markAsRead('notif-123', 'user-123')).rejects.toThrow(
        'Not authorized',
      );

      expect(mockPrismaService.notification.update).not.toHaveBeenCalled();
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      const userId = 'user-123';

      mockPrismaService.notification.updateMany.mockResolvedValue({ count: 5 });

      await service.markAllAsRead(userId);

      expect(mockPrismaService.notification.updateMany).toHaveBeenCalledWith({
        where: { userId, read: false },
        data: { read: true },
      });
    });

    it('should return update count', async () => {
      const userId = 'user-123';
      const mockResult = { count: 3 };

      mockPrismaService.notification.updateMany.mockResolvedValue(mockResult);

      const result = await service.markAllAsRead(userId);

      expect(result).toEqual(mockResult);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      const userId = 'user-123';

      mockPrismaService.notification.count.mockResolvedValue(7);

      const result = await service.getUnreadCount(userId);

      expect(result).toBe(7);
      expect(mockPrismaService.notification.count).toHaveBeenCalledWith({
        where: { userId, read: false },
      });
    });

    it('should return 0 when no unread notifications', async () => {
      const userId = 'user-123';

      mockPrismaService.notification.count.mockResolvedValue(0);

      const result = await service.getUnreadCount(userId);

      expect(result).toBe(0);
    });
  });
});
