import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let notificationsService: NotificationsService;

  const mockNotificationsService = {
    getNotifications: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
  };

  const mockAuthRequest = {
    user: {
      userId: 'user-123',
      email: 'test@example.com',
      role: 'CUSTOMER',
    },
  };

  const mockNotifications = [
    {
      id: 'notif-1',
      userId: 'user-123',
      type: 'JOB_CREATED',
      title: 'New Job Created',
      body: 'Your job has been created',
      data: {},
      read: false,
      createdAt: new Date('2025-11-23T10:00:00Z'),
    },
    {
      id: 'notif-2',
      userId: 'user-123',
      type: 'QUOTE_RECEIVED',
      title: 'Quote Received',
      body: 'You have received a quote',
      data: {},
      read: true,
      createdAt: new Date('2025-11-23T09:00:00Z'),
    },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<NotificationsController>(NotificationsController);
    notificationsService = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getNotifications', () => {
    it('should return notifications for authenticated user', async () => {
      mockNotificationsService.getNotifications.mockResolvedValue(mockNotifications);

      const result = await controller.getNotifications(mockAuthRequest as any);

      expect(result).toEqual(mockNotifications);
      expect(notificationsService.getNotifications).toHaveBeenCalledWith('user-123', 50, false);
    });

    it('should use default limit of 50 when not provided', async () => {
      mockNotificationsService.getNotifications.mockResolvedValue(mockNotifications);

      await controller.getNotifications(mockAuthRequest as any);

      expect(notificationsService.getNotifications).toHaveBeenCalledWith('user-123', 50, false);
    });

    it('should use custom limit when provided', async () => {
      mockNotificationsService.getNotifications.mockResolvedValue([mockNotifications[0]]);

      await controller.getNotifications(mockAuthRequest as any, '10');

      expect(notificationsService.getNotifications).toHaveBeenCalledWith('user-123', 10, false);
    });

    it('should filter by unread when unreadOnly=true', async () => {
      const unreadOnly = [mockNotifications[0]];
      mockNotificationsService.getNotifications.mockResolvedValue(unreadOnly);

      const result = await controller.getNotifications(mockAuthRequest as any, undefined, 'true');

      expect(result).toEqual(unreadOnly);
      expect(notificationsService.getNotifications).toHaveBeenCalledWith('user-123', 50, true);
    });

    it('should not filter when unreadOnly=false', async () => {
      mockNotificationsService.getNotifications.mockResolvedValue(mockNotifications);

      await controller.getNotifications(mockAuthRequest as any, undefined, 'false');

      expect(notificationsService.getNotifications).toHaveBeenCalledWith('user-123', 50, false);
    });

    it('should handle custom limit and unreadOnly together', async () => {
      mockNotificationsService.getNotifications.mockResolvedValue([mockNotifications[0]]);

      await controller.getNotifications(mockAuthRequest as any, '25', 'true');

      expect(notificationsService.getNotifications).toHaveBeenCalledWith('user-123', 25, true);
    });

    it('should parse limit as integer', async () => {
      mockNotificationsService.getNotifications.mockResolvedValue(mockNotifications);

      await controller.getNotifications(mockAuthRequest as any, '100');

      expect(notificationsService.getNotifications).toHaveBeenCalledWith('user-123', 100, false);
    });

    it('should handle empty notifications array', async () => {
      mockNotificationsService.getNotifications.mockResolvedValue([]);

      const result = await controller.getNotifications(mockAuthRequest as any);

      expect(result).toEqual([]);
      expect(notificationsService.getNotifications).toHaveBeenCalledWith('user-123', 50, false);
    });

    it('should extract userId from request.user', async () => {
      const customRequest = {
        user: { userId: 'different-user', email: 'other@example.com', role: 'PROVIDER' },
      };
      mockNotificationsService.getNotifications.mockResolvedValue([]);

      await controller.getNotifications(customRequest as any);

      expect(notificationsService.getNotifications).toHaveBeenCalledWith('different-user', 50, false);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count for authenticated user', async () => {
      mockNotificationsService.getUnreadCount.mockResolvedValue(5);

      const result = await controller.getUnreadCount(mockAuthRequest as any);

      expect(result).toEqual({ count: 5 });
      expect(notificationsService.getUnreadCount).toHaveBeenCalledWith('user-123');
    });

    it('should return zero when no unread notifications', async () => {
      mockNotificationsService.getUnreadCount.mockResolvedValue(0);

      const result = await controller.getUnreadCount(mockAuthRequest as any);

      expect(result).toEqual({ count: 0 });
      expect(notificationsService.getUnreadCount).toHaveBeenCalledWith('user-123');
    });

    it('should return count as number', async () => {
      mockNotificationsService.getUnreadCount.mockResolvedValue(42);

      const result = await controller.getUnreadCount(mockAuthRequest as any);

      expect(result.count).toBe(42);
      expect(typeof result.count).toBe('number');
    });

    it('should extract userId from request.user', async () => {
      const customRequest = {
        user: { userId: 'another-user', email: 'test@test.com', role: 'CUSTOMER' },
      };
      mockNotificationsService.getUnreadCount.mockResolvedValue(3);

      await controller.getUnreadCount(customRequest as any);

      expect(notificationsService.getUnreadCount).toHaveBeenCalledWith('another-user');
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const updatedNotif = { ...mockNotifications[0], read: true };
      mockNotificationsService.markAsRead.mockResolvedValue(updatedNotif);

      const result = await controller.markAsRead(mockAuthRequest as any, 'notif-1');

      expect(result).toEqual(updatedNotif);
      expect(notificationsService.markAsRead).toHaveBeenCalledWith('notif-1', 'user-123');
    });

    it('should pass notification ID and userId to service', async () => {
      mockNotificationsService.markAsRead.mockResolvedValue(mockNotifications[0]);

      await controller.markAsRead(mockAuthRequest as any, 'some-notif-id');

      expect(notificationsService.markAsRead).toHaveBeenCalledWith('some-notif-id', 'user-123');
    });

    it('should handle different notification IDs', async () => {
      mockNotificationsService.markAsRead.mockResolvedValue(mockNotifications[1]);

      await controller.markAsRead(mockAuthRequest as any, 'notif-999');

      expect(notificationsService.markAsRead).toHaveBeenCalledWith('notif-999', 'user-123');
    });

    it('should extract userId from request.user', async () => {
      const customRequest = {
        user: { userId: 'provider-456', email: 'provider@test.com', role: 'PROVIDER' },
      };
      mockNotificationsService.markAsRead.mockResolvedValue(mockNotifications[0]);

      await controller.markAsRead(customRequest as any, 'notif-1');

      expect(notificationsService.markAsRead).toHaveBeenCalledWith('notif-1', 'provider-456');
    });

    it('should propagate service errors', async () => {
      mockNotificationsService.markAsRead.mockRejectedValue(new Error('Notification not found'));

      await expect(controller.markAsRead(mockAuthRequest as any, 'invalid-id')).rejects.toThrow(
        'Notification not found',
      );
    });

    it('should propagate authorization errors', async () => {
      mockNotificationsService.markAsRead.mockRejectedValue(new Error('Not authorized'));

      await expect(controller.markAsRead(mockAuthRequest as any, 'notif-1')).rejects.toThrow('Not authorized');
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      const updateResult = { count: 5 };
      mockNotificationsService.markAllAsRead.mockResolvedValue(updateResult);

      const result = await controller.markAllAsRead(mockAuthRequest as any);

      expect(result).toEqual(updateResult);
      expect(notificationsService.markAllAsRead).toHaveBeenCalledWith('user-123');
    });

    it('should extract userId from request.user', async () => {
      const customRequest = {
        user: { userId: 'admin-789', email: 'admin@test.com', role: 'ADMIN' },
      };
      mockNotificationsService.markAllAsRead.mockResolvedValue({ count: 0 });

      await controller.markAllAsRead(customRequest as any);

      expect(notificationsService.markAllAsRead).toHaveBeenCalledWith('admin-789');
    });

    it('should handle zero notifications updated', async () => {
      mockNotificationsService.markAllAsRead.mockResolvedValue({ count: 0 });

      const result = await controller.markAllAsRead(mockAuthRequest as any);

      expect(result).toEqual({ count: 0 });
    });

    it('should handle multiple notifications updated', async () => {
      mockNotificationsService.markAllAsRead.mockResolvedValue({ count: 15 });

      const result = await controller.markAllAsRead(mockAuthRequest as any);

      expect(result).toEqual({ count: 15 });
    });

    it('should call service only once per request', async () => {
      mockNotificationsService.markAllAsRead.mockResolvedValue({ count: 3 });

      await controller.markAllAsRead(mockAuthRequest as any);

      expect(notificationsService.markAllAsRead).toHaveBeenCalledTimes(1);
    });
  });

  describe('Request handling', () => {
    it('should handle multiple users correctly', async () => {
      const user1Request = {
        user: { userId: 'user-1', email: 'user1@test.com', role: 'CUSTOMER' },
      };
      const user2Request = {
        user: { userId: 'user-2', email: 'user2@test.com', role: 'PROVIDER' },
      };

      mockNotificationsService.getNotifications.mockResolvedValue([]);

      await controller.getNotifications(user1Request as any);
      await controller.getNotifications(user2Request as any);

      expect(notificationsService.getNotifications).toHaveBeenNthCalledWith(1, 'user-1', 50, false);
      expect(notificationsService.getNotifications).toHaveBeenNthCalledWith(2, 'user-2', 50, false);
    });

    it('should preserve user context across endpoint calls', async () => {
      mockNotificationsService.getNotifications.mockResolvedValue([]);
      mockNotificationsService.getUnreadCount.mockResolvedValue(0);

      await controller.getNotifications(mockAuthRequest as any);
      await controller.getUnreadCount(mockAuthRequest as any);

      expect(notificationsService.getNotifications).toHaveBeenCalledWith('user-123', 50, false);
      expect(notificationsService.getUnreadCount).toHaveBeenCalledWith('user-123');
    });
  });

  describe('Query parameter parsing', () => {
    it('should handle numeric string limit', async () => {
      mockNotificationsService.getNotifications.mockResolvedValue([]);

      await controller.getNotifications(mockAuthRequest as any, '75');

      expect(notificationsService.getNotifications).toHaveBeenCalledWith('user-123', 75, false);
    });

    it('should handle string "true" for unreadOnly', async () => {
      mockNotificationsService.getNotifications.mockResolvedValue([]);

      await controller.getNotifications(mockAuthRequest as any, undefined, 'true');

      expect(notificationsService.getNotifications).toHaveBeenCalledWith('user-123', 50, true);
    });

    it('should handle string "false" for unreadOnly', async () => {
      mockNotificationsService.getNotifications.mockResolvedValue([]);

      await controller.getNotifications(mockAuthRequest as any, undefined, 'false');

      expect(notificationsService.getNotifications).toHaveBeenCalledWith('user-123', 50, false);
    });

    it('should handle undefined limit', async () => {
      mockNotificationsService.getNotifications.mockResolvedValue([]);

      await controller.getNotifications(mockAuthRequest as any, undefined);

      expect(notificationsService.getNotifications).toHaveBeenCalledWith('user-123', 50, false);
    });

    it('should handle undefined unreadOnly', async () => {
      mockNotificationsService.getNotifications.mockResolvedValue([]);

      await controller.getNotifications(mockAuthRequest as any, undefined, undefined);

      expect(notificationsService.getNotifications).toHaveBeenCalledWith('user-123', 50, false);
    });
  });

  describe('Edge cases', () => {
    it('should handle very large limit values', async () => {
      mockNotificationsService.getNotifications.mockResolvedValue([]);

      await controller.getNotifications(mockAuthRequest as any, '999999');

      expect(notificationsService.getNotifications).toHaveBeenCalledWith('user-123', 999999, false);
    });

    it('should handle limit of 1', async () => {
      mockNotificationsService.getNotifications.mockResolvedValue([mockNotifications[0]]);

      await controller.getNotifications(mockAuthRequest as any, '1');

      expect(notificationsService.getNotifications).toHaveBeenCalledWith('user-123', 1, false);
    });

    it('should handle concurrent requests from same user', async () => {
      mockNotificationsService.getNotifications.mockResolvedValue(mockNotifications);

      await Promise.all([
        controller.getNotifications(mockAuthRequest as any),
        controller.getNotifications(mockAuthRequest as any),
        controller.getNotifications(mockAuthRequest as any),
      ]);

      expect(notificationsService.getNotifications).toHaveBeenCalledTimes(3);
    });
  });
});
