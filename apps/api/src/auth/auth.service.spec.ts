import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../metrics/metrics.service';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let metricsService: MetricsService;

  const mockPrismaService = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockMetricsService = {
    incSignup: jest.fn(),
    incLogin: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    metricsService = module.get<MetricsService>(MetricsService);

    jest.clearAllMocks();
    delete process.env.POSTHOG_API_KEY;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signup', () => {
    it('should create a new customer user with default role', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const name = 'John Doe';
      const hashedPassword = 'hashed_password';
      const mockUser = {
        id: 'user-123',
        email,
        name,
        password: hashedPassword,
        role: 'CUSTOMER',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('jwt_token');

      const result = await service.signup(email, password, name);

      expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email,
          name,
          password: hashedPassword,
          role: 'CUSTOMER',
          profile: {
            create: {
              firstName: 'John',
              lastName: 'Doe',
            },
          },
        },
      });
      expect(mockMetricsService.incSignup).toHaveBeenCalledWith('CUSTOMER');
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
      expect(result).toEqual({ access_token: 'jwt_token' });
    });

    it('should create a provider user when role is specified', async () => {
      const email = 'provider@example.com';
      const password = 'password123';
      const name = 'Jane Smith';
      const role = 'provider';
      const hashedPassword = 'hashed_password';
      const mockUser = {
        id: 'user-456',
        email,
        name,
        password: hashedPassword,
        role: 'PROVIDER',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('jwt_token');

      const result = await service.signup(email, password, name, role);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email,
          name,
          password: hashedPassword,
          role: 'PROVIDER',
          profile: {
            create: {
              firstName: 'Jane',
              lastName: 'Smith',
            },
          },
        },
      });
      expect(mockMetricsService.incSignup).toHaveBeenCalledWith('PROVIDER');
      expect(result).toEqual({ access_token: 'jwt_token' });
    });

    it('should create an admin user when role is admin', async () => {
      const email = 'admin@example.com';
      const password = 'password123';
      const name = 'Admin User';
      const role = 'ADMIN';
      const hashedPassword = 'hashed_password';
      const mockUser = {
        id: 'user-789',
        email,
        name,
        password: hashedPassword,
        role: 'ADMIN',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('jwt_token');

      const result = await service.signup(email, password, name, role);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email,
          name,
          password: hashedPassword,
          role: 'ADMIN',
          profile: {
            create: {
              firstName: 'Admin',
              lastName: 'User',
            },
          },
        },
      });
      expect(mockMetricsService.incSignup).toHaveBeenCalledWith('ADMIN');
    });

    it('should default to CUSTOMER role for invalid role values', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const name = 'Test User';
      const role = 'INVALID_ROLE';
      const hashedPassword = 'hashed_password';
      const mockUser = {
        id: 'user-999',
        email,
        name,
        password: hashedPassword,
        role: 'CUSTOMER',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('jwt_token');

      const result = await service.signup(email, password, name, role);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email,
          name,
          password: hashedPassword,
          role: 'CUSTOMER',
          profile: {
            create: {
              firstName: 'Test',
              lastName: 'User',
            },
          },
        },
      });
    });

    it('should handle single word names', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const name = 'Madonna';
      const hashedPassword = 'hashed_password';
      const mockUser = {
        id: 'user-single',
        email,
        name,
        password: hashedPassword,
        role: 'CUSTOMER',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('jwt_token');

      await service.signup(email, password, name);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email,
          name,
          password: hashedPassword,
          role: 'CUSTOMER',
          profile: {
            create: {
              firstName: 'Madonna',
              lastName: '',
            },
          },
        },
      });
    });

    it('should handle multi-word last names', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const name = 'John Van Der Berg';
      const hashedPassword = 'hashed_password';
      const mockUser = {
        id: 'user-multi',
        email,
        name,
        password: hashedPassword,
        role: 'CUSTOMER',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('jwt_token');

      await service.signup(email, password, name);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email,
          name,
          password: hashedPassword,
          role: 'CUSTOMER',
          profile: {
            create: {
              firstName: 'John',
              lastName: 'Van Der Berg',
            },
          },
        },
      });
    });

    it('should handle empty or whitespace names', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const name = '   ';
      const hashedPassword = 'hashed_password';
      const mockUser = {
        id: 'user-empty',
        email,
        name,
        password: hashedPassword,
        role: 'CUSTOMER',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('jwt_token');

      await service.signup(email, password, name);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email,
          name,
          password: hashedPassword,
          role: 'CUSTOMER',
          profile: {
            create: {
              firstName: '',
              lastName: '',
            },
          },
        },
      });
    });
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const mockUser = {
        id: 'user-123',
        email,
        password: 'hashed_password',
        role: 'CUSTOMER',
        name: 'Test User',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('jwt_token');

      const result = await service.login(email, password);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(password, mockUser.password);
      expect(mockMetricsService.incLogin).toHaveBeenCalledWith('CUSTOMER');
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
      expect(result).toEqual({ access_token: 'jwt_token' });
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      const email = 'nonexistent@example.com';
      const password = 'password123';

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(email, password)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(email, password)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should throw UnauthorizedException when password is incorrect', async () => {
      const email = 'test@example.com';
      const password = 'wrong_password';
      const mockUser = {
        id: 'user-123',
        email,
        password: 'hashed_password',
        role: 'CUSTOMER',
        name: 'Test User',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(email, password)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(email, password)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should login provider users', async () => {
      const email = 'provider@example.com';
      const password = 'password123';
      const mockUser = {
        id: 'provider-123',
        email,
        password: 'hashed_password',
        role: 'PROVIDER',
        name: 'Provider User',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('jwt_token');

      const result = await service.login(email, password);

      expect(mockMetricsService.incLogin).toHaveBeenCalledWith('PROVIDER');
      expect(result).toEqual({ access_token: 'jwt_token' });
    });

    it('should login admin users', async () => {
      const email = 'admin@example.com';
      const password = 'password123';
      const mockUser = {
        id: 'admin-123',
        email,
        password: 'hashed_password',
        role: 'ADMIN',
        name: 'Admin User',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('jwt_token');

      const result = await service.login(email, password);

      expect(mockMetricsService.incLogin).toHaveBeenCalledWith('ADMIN');
      expect(result).toEqual({ access_token: 'jwt_token' });
    });
  });

  describe('me', () => {
    it('should return user profile for customer', async () => {
      const userId = 'user-123';
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'CUSTOMER',
        createdAt: new Date(),
        profile: {
          firstName: 'Test',
          lastName: 'User',
          avatarUrl: 'https://example.com/avatar.jpg',
        },
        provider: null,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.me(userId);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
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

    it('should return user profile with provider data for providers', async () => {
      const userId = 'provider-123';
      const mockUser = {
        id: userId,
        email: 'provider@example.com',
        name: 'Provider User',
        role: 'PROVIDER',
        createdAt: new Date(),
        profile: {
          firstName: 'Provider',
          lastName: 'User',
          avatarUrl: null,
        },
        provider: {
          id: 'provider-data-123',
          kycStatus: 'APPROVED',
          stripeAccountId: 'acct_123',
          online: true,
          serviceRadiusKm: 50,
        },
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.me(userId);

      expect(result).toEqual(mockUser);
      expect(result?.provider).toBeDefined();
      expect(result?.provider?.kycStatus).toBe('APPROVED');
    });

    it('should handle users with no avatar', async () => {
      const userId = 'user-no-avatar';
      const mockUser = {
        id: userId,
        email: 'noavatar@example.com',
        name: 'No Avatar User',
        role: 'CUSTOMER',
        createdAt: new Date(),
        profile: {
          firstName: 'No',
          lastName: 'Avatar',
          avatarUrl: null,
        },
        provider: null,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.me(userId);

      expect(result?.profile?.avatarUrl).toBeNull();
    });
  });
});
