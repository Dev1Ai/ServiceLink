import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Role } from '@prisma/client';

describe('UsersController', () => {
  let controller: UsersController;
  let prismaService: PrismaService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockJwtAuthGuard = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const request = context.switchToHttp().getRequest();
      request.user = { sub: 'user-123', email: 'test@example.com', role: 'CUSTOMER' };
      return true;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    controller = module.get<UsersController>(UsersController);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('me', () => {
    const mockRequest = {
      user: {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'CUSTOMER',
      },
    } as any;

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'John Doe',
      role: 'CUSTOMER' as Role,
      createdAt: new Date('2025-01-01'),
      profile: {
        firstName: 'John',
        lastName: 'Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
      },
      provider: null,
    };

    it('should call prisma.user.findUnique with user ID from request', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await controller.me(mockRequest);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
          provider: {
            select: {
              id: true,
              kycStatus: true,
              stripeAccountId: true,
              online: true,
              serviceRadiusKm: true,
            },
          },
        },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return user with profile data', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await controller.me(mockRequest);

      expect(result).toHaveProperty('id', 'user-123');
      expect(result).toHaveProperty('email', 'test@example.com');
      expect(result).toHaveProperty('profile');
      expect(result?.profile).toHaveProperty('firstName', 'John');
      expect(result?.profile).toHaveProperty('lastName', 'Doe');
    });

    it('should return provider data for PROVIDER role', async () => {
      const providerUser = {
        ...mockUser,
        role: 'PROVIDER' as Role,
        provider: {
          id: 'provider-123',
          kycStatus: 'APPROVED' as const,
          stripeAccountId: 'acct_123',
          online: true,
          serviceRadiusKm: 50,
        },
      };

      mockPrismaService.user.findUnique.mockResolvedValue(providerUser);

      const providerRequest = {
        user: { sub: 'user-123', email: 'provider@example.com', role: 'PROVIDER' },
      } as any;

      const result = await controller.me(providerRequest);

      expect(result).toHaveProperty('provider');
      expect(result?.provider).toHaveProperty('id', 'provider-123');
      expect(result?.provider).toHaveProperty('kycStatus', 'APPROVED');
      expect(result?.provider).toHaveProperty('online', true);
    });

    it('should handle user without profile', async () => {
      const userWithoutProfile = {
        ...mockUser,
        profile: null,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(userWithoutProfile);

      const result = await controller.me(mockRequest);

      expect(result).toHaveProperty('profile', null);
    });
  });

  describe('list', () => {
    const getMockUsers = () => [
      {
        id: 'user-1',
        email: 'user1@example.com',
        name: 'User One',
        role: 'CUSTOMER' as Role,
        createdAt: new Date('2025-01-01'),
      },
      {
        id: 'user-2',
        email: 'user2@example.com',
        name: 'User Two',
        role: 'PROVIDER' as Role,
        createdAt: new Date('2025-01-02'),
      },
    ];

    it('should return paginated users with default take of 20', async () => {
      mockPrismaService.user.findMany.mockResolvedValue(getMockUsers());

      const result = await controller.list();

      expect(prismaService.user.findMany).toHaveBeenCalledWith({
        where: {},
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        cursor: undefined,
        skip: 0,
        take: 21, // take + 1 for next cursor detection
      });
      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBeUndefined();
    });

    it('should respect custom take parameter', async () => {
      mockPrismaService.user.findMany.mockResolvedValue(getMockUsers());

      await controller.list('10');

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 11, // 10 + 1
        }),
      );
    });

    it('should default to 20 when take is 0 (falsy value)', async () => {
      mockPrismaService.user.findMany.mockResolvedValue(getMockUsers());

      await controller.list('0');

      // parseInt('0', 10) = 0, which is falsy, so || 20 kicks in
      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 21, // default 20 + 1
        }),
      );
    });

    it('should enforce minimum take of 1 for negative values', async () => {
      mockPrismaService.user.findMany.mockResolvedValue(getMockUsers());

      await controller.list('-5');

      // parseInt('-5', 10) = -5, Math.max(1, Math.min(100, -5)) = Math.max(1, -5) = 1
      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 2, // 1 + 1
        }),
      );
    });

    it('should enforce maximum take of 100', async () => {
      mockPrismaService.user.findMany.mockResolvedValue(getMockUsers());

      await controller.list('150');

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 101, // Math.min(100, 150) = 100, then +1 = 101
        }),
      );
    });

    it('should handle cursor-based pagination', async () => {
      mockPrismaService.user.findMany.mockResolvedValue(getMockUsers());

      await controller.list('10', 'user-cursor-id');

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'user-cursor-id' },
          skip: 1,
          take: 11,
        }),
      );
    });

    it('should filter by role', async () => {
      const users = getMockUsers();
      mockPrismaService.user.findMany.mockResolvedValue([users[1]]);

      await controller.list(undefined, undefined, 'PROVIDER');

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: 'PROVIDER' },
        }),
      );
    });

    it('should filter by email query (case-insensitive)', async () => {
      const users = getMockUsers();
      mockPrismaService.user.findMany.mockResolvedValue([users[0]]);

      await controller.list(undefined, undefined, undefined, 'user1');

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: { contains: 'user1', mode: 'insensitive' } },
        }),
      );
    });

    it('should combine role and email filters', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);

      await controller.list(undefined, undefined, 'CUSTOMER', 'test');

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            role: 'CUSTOMER',
            email: { contains: 'test', mode: 'insensitive' },
          },
        }),
      );
    });

    it('should calculate nextCursor when more items exist', async () => {
      const manyUsers = [
        { id: 'user-1', email: 'u1@e.com', name: 'U1', role: 'CUSTOMER' as Role, createdAt: new Date() },
        { id: 'user-2', email: 'u2@e.com', name: 'U2', role: 'CUSTOMER' as Role, createdAt: new Date() },
        { id: 'user-3', email: 'u3@e.com', name: 'U3', role: 'CUSTOMER' as Role, createdAt: new Date() },
      ];
      mockPrismaService.user.findMany.mockResolvedValueOnce(manyUsers);

      const result = await controller.list('2');

      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBe('user-3');
    });

    it('should not set nextCursor when no more items', async () => {
      mockPrismaService.user.findMany.mockResolvedValueOnce(getMockUsers());

      const result = await controller.list('10');

      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBeUndefined();
    });

    it('should handle empty results', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);

      const result = await controller.list();

      expect(result).toEqual({ items: [], nextCursor: undefined });
    });
  });

  describe('getById', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'John Doe',
      role: 'CUSTOMER' as Role,
      createdAt: new Date('2025-01-01'),
      profile: {
        firstName: 'John',
        lastName: 'Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
      },
    };

    it('should call prisma.user.findUnique with correct ID', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await controller.getById('user-123');

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          profile: {
            select: {
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return user with profile data', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await controller.getById('user-123');

      expect(result).toHaveProperty('id', 'user-123');
      expect(result).toHaveProperty('email', 'test@example.com');
      expect(result).toHaveProperty('profile');
      expect(result.profile).toHaveProperty('firstName', 'John');
      expect(result.profile).toHaveProperty('lastName', 'Doe');
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(controller.getById('nonexistent')).rejects.toThrow(NotFoundException);
      await expect(controller.getById('nonexistent')).rejects.toThrow('User not found');
    });

    it('should handle different user IDs', async () => {
      const userIds = ['user-abc', 'user-xyz', 'user-123'];

      for (const userId of userIds) {
        mockPrismaService.user.findUnique.mockResolvedValue({
          ...mockUser,
          id: userId,
        });

        await controller.getById(userId);

        expect(prismaService.user.findUnique).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: userId },
          }),
        );
      }
    });

    it('should handle user without profile', async () => {
      const userWithoutProfile = {
        ...mockUser,
        profile: null,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(userWithoutProfile);

      const result = await controller.getById('user-123');

      expect(result).toHaveProperty('profile', null);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete user flow: me -> list -> getById', async () => {
      const currentUser = {
        id: 'user-123',
        email: 'current@example.com',
        name: 'Current User',
        role: 'CUSTOMER' as Role,
        createdAt: new Date(),
        profile: { firstName: 'Current', lastName: 'User', avatarUrl: null },
        provider: null,
      };

      // Get current user
      mockPrismaService.user.findUnique.mockResolvedValue(currentUser);
      const meResult = await controller.me({
        user: { sub: 'user-123', email: 'current@example.com', role: 'CUSTOMER' },
      } as any);
      expect(meResult).toEqual(currentUser);

      // List users
      const users = [
        { id: 'user-1', email: 'u1@e.com', name: 'U1', role: 'CUSTOMER' as Role, createdAt: new Date() },
        { id: 'user-2', email: 'u2@e.com', name: 'U2', role: 'PROVIDER' as Role, createdAt: new Date() },
      ];
      mockPrismaService.user.findMany.mockResolvedValue(users);
      const listResult = await controller.list();
      expect(listResult.items).toHaveLength(2);

      // Get specific user
      const targetUser = {
        id: 'user-1',
        email: 'u1@e.com',
        name: 'U1',
        role: 'CUSTOMER' as Role,
        createdAt: new Date(),
        profile: { firstName: 'User', lastName: 'One', avatarUrl: null },
      };
      mockPrismaService.user.findUnique.mockResolvedValue(targetUser);
      const getResult = await controller.getById('user-1');
      expect(getResult).toEqual(targetUser);
    });
  });
});
