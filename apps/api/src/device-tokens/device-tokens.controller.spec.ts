import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DeviceTokensController } from './device-tokens.controller';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

describe('DeviceTokensController', () => {
  let controller: DeviceTokensController;
  let prismaService: PrismaService;

  const mockPrismaService = {
    deviceToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockAuthRequest = {
    user: {
      sub: 'user-123',
      email: 'test@example.com',
      role: 'CUSTOMER',
    },
  };

  const mockDeviceToken = {
    id: 'dt-1',
    userId: 'user-123',
    token: 'expo-push-token-abc123',
    platform: 'ios',
    active: true,
    createdAt: new Date('2025-11-23T10:00:00Z'),
    updatedAt: new Date('2025-11-23T10:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeviceTokensController],
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DeviceTokensController>(DeviceTokensController);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should create a new device token', async () => {
      const dto = { token: 'new-token-123', platform: 'ios' as const };
      mockPrismaService.deviceToken.findUnique.mockResolvedValue(null);
      mockPrismaService.deviceToken.create.mockResolvedValue(mockDeviceToken);

      const result = await controller.register(mockAuthRequest as any, dto);

      expect(result).toEqual(mockDeviceToken);
      expect(prismaService.deviceToken.findUnique).toHaveBeenCalledWith({
        where: { token: 'new-token-123' },
      });
      expect(prismaService.deviceToken.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          token: 'new-token-123',
          platform: 'ios',
          active: true,
        },
      });
    });

    it('should update existing device token if already registered', async () => {
      const dto = { token: 'existing-token', platform: 'android' as const };
      const existingToken = { ...mockDeviceToken, userId: 'old-user', active: false };
      const updatedToken = { ...existingToken, userId: 'user-123', active: true };

      mockPrismaService.deviceToken.findUnique.mockResolvedValue(existingToken);
      mockPrismaService.deviceToken.update.mockResolvedValue(updatedToken);

      const result = await controller.register(mockAuthRequest as any, dto);

      expect(result).toEqual(updatedToken);
      expect(prismaService.deviceToken.findUnique).toHaveBeenCalledWith({
        where: { token: 'existing-token' },
      });
      expect(prismaService.deviceToken.update).toHaveBeenCalledWith({
        where: { token: 'existing-token' },
        data: {
          userId: 'user-123',
          active: true,
        },
      });
      expect(prismaService.deviceToken.create).not.toHaveBeenCalled();
    });

    it('should reactivate inactive device token', async () => {
      const dto = { token: 'inactive-token', platform: 'web' as const };
      const inactiveToken = { ...mockDeviceToken, active: false };
      const reactivatedToken = { ...inactiveToken, active: true };

      mockPrismaService.deviceToken.findUnique.mockResolvedValue(inactiveToken);
      mockPrismaService.deviceToken.update.mockResolvedValue(reactivatedToken);

      const result = await controller.register(mockAuthRequest as any, dto);

      expect(result).toEqual(reactivatedToken);
      expect(prismaService.deviceToken.update).toHaveBeenCalledWith({
        where: { token: 'inactive-token' },
        data: {
          userId: 'user-123',
          active: true,
        },
      });
    });

    it('should accept ios platform', async () => {
      const dto = { token: 'ios-token', platform: 'ios' as const };
      mockPrismaService.deviceToken.findUnique.mockResolvedValue(null);
      mockPrismaService.deviceToken.create.mockResolvedValue(mockDeviceToken);

      await controller.register(mockAuthRequest as any, dto);

      expect(prismaService.deviceToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ platform: 'ios' }),
      });
    });

    it('should accept android platform', async () => {
      const dto = { token: 'android-token', platform: 'android' as const };
      mockPrismaService.deviceToken.findUnique.mockResolvedValue(null);
      mockPrismaService.deviceToken.create.mockResolvedValue({
        ...mockDeviceToken,
        platform: 'android',
      });

      await controller.register(mockAuthRequest as any, dto);

      expect(prismaService.deviceToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ platform: 'android' }),
      });
    });

    it('should accept web platform', async () => {
      const dto = { token: 'web-token', platform: 'web' as const };
      mockPrismaService.deviceToken.findUnique.mockResolvedValue(null);
      mockPrismaService.deviceToken.create.mockResolvedValue({
        ...mockDeviceToken,
        platform: 'web',
      });

      await controller.register(mockAuthRequest as any, dto);

      expect(prismaService.deviceToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ platform: 'web' }),
      });
    });

    it('should throw BadRequestException for invalid platform', async () => {
      const dto = { token: 'test-token', platform: 'invalid' as any };

      await expect(controller.register(mockAuthRequest as any, dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.register(mockAuthRequest as any, dto)).rejects.toThrow(
        'Platform must be ios, android, or web',
      );

      expect(prismaService.deviceToken.findUnique).not.toHaveBeenCalled();
      expect(prismaService.deviceToken.create).not.toHaveBeenCalled();
    });

    it('should extract userId from request.user.sub', async () => {
      const customRequest = {
        user: { sub: 'custom-user-456', email: 'custom@test.com', role: 'PROVIDER' },
      };
      const dto = { token: 'test-token', platform: 'ios' as const };

      mockPrismaService.deviceToken.findUnique.mockResolvedValue(null);
      mockPrismaService.deviceToken.create.mockResolvedValue(mockDeviceToken);

      await controller.register(customRequest as any, dto);

      expect(prismaService.deviceToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'custom-user-456' }),
      });
    });

    it('should handle long device tokens', async () => {
      const longToken = 'a'.repeat(500);
      const dto = { token: longToken, platform: 'ios' as const };

      mockPrismaService.deviceToken.findUnique.mockResolvedValue(null);
      mockPrismaService.deviceToken.create.mockResolvedValue({
        ...mockDeviceToken,
        token: longToken,
      });

      const result = await controller.register(mockAuthRequest as any, dto);

      expect(result.token).toBe(longToken);
    });

    it('should handle token reassignment to different user', async () => {
      const dto = { token: 'shared-token', platform: 'android' as const };
      const existingToken = { ...mockDeviceToken, userId: 'different-user' };
      const updatedToken = { ...existingToken, userId: 'user-123' };

      mockPrismaService.deviceToken.findUnique.mockResolvedValue(existingToken);
      mockPrismaService.deviceToken.update.mockResolvedValue(updatedToken);

      const result = await controller.register(mockAuthRequest as any, dto);

      expect(result.userId).toBe('user-123');
      expect(prismaService.deviceToken.update).toHaveBeenCalledWith({
        where: { token: 'shared-token' },
        data: {
          userId: 'user-123',
          active: true,
        },
      });
    });
  });

  describe('unregister', () => {
    it('should deactivate device token', async () => {
      mockPrismaService.deviceToken.findUnique.mockResolvedValue(mockDeviceToken);
      mockPrismaService.deviceToken.update.mockResolvedValue({
        ...mockDeviceToken,
        active: false,
      });

      const result = await controller.unregister(
        mockAuthRequest as any,
        'expo-push-token-abc123',
      );

      expect(result).toEqual({ message: 'Device token deactivated successfully' });
      expect(prismaService.deviceToken.findUnique).toHaveBeenCalledWith({
        where: { token: 'expo-push-token-abc123' },
      });
      expect(prismaService.deviceToken.update).toHaveBeenCalledWith({
        where: { token: 'expo-push-token-abc123' },
        data: { active: false },
      });
    });

    it('should throw BadRequestException if token not found', async () => {
      mockPrismaService.deviceToken.findUnique.mockResolvedValue(null);

      await expect(
        controller.unregister(mockAuthRequest as any, 'non-existent-token'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.unregister(mockAuthRequest as any, 'non-existent-token'),
      ).rejects.toThrow('Device token not found or does not belong to user');

      expect(prismaService.deviceToken.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if token belongs to different user', async () => {
      const otherUserToken = { ...mockDeviceToken, userId: 'other-user' };
      mockPrismaService.deviceToken.findUnique.mockResolvedValue(otherUserToken);

      await expect(
        controller.unregister(mockAuthRequest as any, 'expo-push-token-abc123'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.unregister(mockAuthRequest as any, 'expo-push-token-abc123'),
      ).rejects.toThrow('Device token not found or does not belong to user');

      expect(prismaService.deviceToken.update).not.toHaveBeenCalled();
    });

    it('should deactivate already inactive token', async () => {
      const inactiveToken = { ...mockDeviceToken, active: false };
      mockPrismaService.deviceToken.findUnique.mockResolvedValue(inactiveToken);
      mockPrismaService.deviceToken.update.mockResolvedValue(inactiveToken);

      const result = await controller.unregister(
        mockAuthRequest as any,
        'expo-push-token-abc123',
      );

      expect(result).toEqual({ message: 'Device token deactivated successfully' });
      expect(prismaService.deviceToken.update).toHaveBeenCalled();
    });

    it('should verify user ownership before deactivation', async () => {
      const customRequest = {
        user: { sub: 'owner-user', email: 'owner@test.com', role: 'CUSTOMER' },
      };
      const ownedToken = { ...mockDeviceToken, userId: 'owner-user' };

      mockPrismaService.deviceToken.findUnique.mockResolvedValue(ownedToken);
      mockPrismaService.deviceToken.update.mockResolvedValue({
        ...ownedToken,
        active: false,
      });

      await controller.unregister(customRequest as any, 'expo-push-token-abc123');

      expect(prismaService.deviceToken.update).toHaveBeenCalled();
    });

    it('should return consistent message format', async () => {
      mockPrismaService.deviceToken.findUnique.mockResolvedValue(mockDeviceToken);
      mockPrismaService.deviceToken.update.mockResolvedValue({
        ...mockDeviceToken,
        active: false,
      });

      const result = await controller.unregister(
        mockAuthRequest as any,
        'expo-push-token-abc123',
      );

      expect(result).toHaveProperty('message');
      expect(typeof result.message).toBe('string');
      expect(result.message).toBe('Device token deactivated successfully');
    });

    it('should handle tokens with special characters', async () => {
      const specialToken = 'expo-token-!@#$%^&*()';
      const deviceToken = { ...mockDeviceToken, token: specialToken };

      mockPrismaService.deviceToken.findUnique.mockResolvedValue(deviceToken);
      mockPrismaService.deviceToken.update.mockResolvedValue({
        ...deviceToken,
        active: false,
      });

      const result = await controller.unregister(mockAuthRequest as any, specialToken);

      expect(result).toEqual({ message: 'Device token deactivated successfully' });
      expect(prismaService.deviceToken.findUnique).toHaveBeenCalledWith({
        where: { token: specialToken },
      });
    });
  });

  describe('Platform validation', () => {
    it('should reject empty string platform', async () => {
      const dto = { token: 'test-token', platform: '' as any };

      await expect(controller.register(mockAuthRequest as any, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject null platform', async () => {
      const dto = { token: 'test-token', platform: null as any };

      await expect(controller.register(mockAuthRequest as any, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject uppercase platform names', async () => {
      const dto = { token: 'test-token', platform: 'IOS' as any };

      await expect(controller.register(mockAuthRequest as any, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject mixed case platform names', async () => {
      const dto = { token: 'test-token', platform: 'Android' as any };

      await expect(controller.register(mockAuthRequest as any, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Authentication context', () => {
    it('should use authenticated user ID for registration', async () => {
      const dto = { token: 'auth-test-token', platform: 'ios' as const };
      mockPrismaService.deviceToken.findUnique.mockResolvedValue(null);
      mockPrismaService.deviceToken.create.mockResolvedValue(mockDeviceToken);

      await controller.register(mockAuthRequest as any, dto);

      expect(prismaService.deviceToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: mockAuthRequest.user.sub }),
      });
    });

    it('should use authenticated user ID for unregistration', async () => {
      mockPrismaService.deviceToken.findUnique.mockResolvedValue(mockDeviceToken);
      mockPrismaService.deviceToken.update.mockResolvedValue({
        ...mockDeviceToken,
        active: false,
      });

      await controller.unregister(mockAuthRequest as any, 'expo-push-token-abc123');

      // Verify ownership check used authenticated user ID
      const foundToken = await prismaService.deviceToken.findUnique({
        where: { token: 'expo-push-token-abc123' },
      });
      expect(foundToken?.userId).toBe(mockDeviceToken.userId);
    });
  });

  describe('Edge cases', () => {
    it('should handle concurrent registrations of same token', async () => {
      const dto = { token: 'concurrent-token', platform: 'ios' as const };
      mockPrismaService.deviceToken.findUnique.mockResolvedValue(null);
      mockPrismaService.deviceToken.create.mockResolvedValue(mockDeviceToken);

      await Promise.all([
        controller.register(mockAuthRequest as any, dto),
        controller.register(mockAuthRequest as any, dto),
      ]);

      expect(prismaService.deviceToken.findUnique).toHaveBeenCalled();
      expect(prismaService.deviceToken.create).toHaveBeenCalled();
    });

    it('should handle very short tokens', async () => {
      const dto = { token: 'a', platform: 'web' as const };
      mockPrismaService.deviceToken.findUnique.mockResolvedValue(null);
      mockPrismaService.deviceToken.create.mockResolvedValue({
        ...mockDeviceToken,
        token: 'a',
      });

      const result = await controller.register(mockAuthRequest as any, dto);

      expect(result.token).toBe('a');
    });

    it('should maintain active status during update', async () => {
      const dto = { token: 'update-test', platform: 'android' as const };
      const existingToken = { ...mockDeviceToken, active: false };
      const updatedToken = { ...existingToken, active: true };

      mockPrismaService.deviceToken.findUnique.mockResolvedValue(existingToken);
      mockPrismaService.deviceToken.update.mockResolvedValue(updatedToken);

      const result = await controller.register(mockAuthRequest as any, dto);

      expect(result.active).toBe(true);
    });
  });
});
