import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { AuthRateLimitGuard } from '../common/guards/auth-rate-limit.guard';
import { JwtAuthGuard } from './jwt.guard';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    signup: jest.fn(),
    login: jest.fn(),
    me: jest.fn(),
  };

  const mockAuthRateLimitGuard = {
    canActivate: jest.fn().mockReturnValue(true),
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
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    })
      .overrideGuard(AuthRateLimitGuard)
      .useValue(mockAuthRateLimitGuard)
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('signup', () => {
    const signupDto = {
      email: 'test@example.com',
      password: 'password123',
      name: 'John Doe',
      role: 'CUSTOMER' as const,
    };

    const mockToken = { access_token: 'jwt-token-123' };

    it('should call authService.signup with correct parameters', async () => {
      mockAuthService.signup.mockResolvedValue(mockToken);

      const result = await controller.signup(signupDto);

      expect(authService.signup).toHaveBeenCalledWith(
        signupDto.email,
        signupDto.password,
        signupDto.name,
        signupDto.role,
      );
      expect(result).toEqual(mockToken);
    });

    it('should handle signup with minimal data (no role)', async () => {
      const minimalDto = {
        email: 'minimal@example.com',
        password: 'password123',
        name: 'Jane Smith',
      };

      mockAuthService.signup.mockResolvedValue(mockToken);

      const result = await controller.signup(minimalDto as any);

      expect(authService.signup).toHaveBeenCalledWith(
        minimalDto.email,
        minimalDto.password,
        minimalDto.name,
        undefined,
      );
      expect(result).toEqual(mockToken);
    });

    it('should handle signup for PROVIDER role', async () => {
      const providerDto = { ...signupDto, role: 'PROVIDER' as const };
      mockAuthService.signup.mockResolvedValue(mockToken);

      await controller.signup(providerDto);

      expect(authService.signup).toHaveBeenCalledWith(
        providerDto.email,
        providerDto.password,
        providerDto.name,
        'PROVIDER',
      );
    });

    it('should handle signup for ADMIN role', async () => {
      const adminDto = { ...signupDto, role: 'ADMIN' as const };
      mockAuthService.signup.mockResolvedValue(mockToken);

      await controller.signup(adminDto);

      expect(authService.signup).toHaveBeenCalledWith(
        adminDto.email,
        adminDto.password,
        adminDto.name,
        'ADMIN',
      );
    });

    it('should propagate errors from authService', async () => {
      mockAuthService.signup.mockRejectedValue(new Error('Email already exists'));

      await expect(controller.signup(signupDto)).rejects.toThrow('Email already exists');
    });

    it('should return token on successful signup', async () => {
      const expectedToken = { access_token: 'new-jwt-token' };
      mockAuthService.signup.mockResolvedValue(expectedToken);

      const result = await controller.signup(signupDto);

      expect(result).toEqual(expectedToken);
      expect(result.access_token).toBe('new-jwt-token');
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    const mockToken = { access_token: 'jwt-token-123' };

    it('should call authService.login with correct parameters', async () => {
      mockAuthService.login.mockResolvedValue(mockToken);

      const result = await controller.login(loginDto);

      expect(authService.login).toHaveBeenCalledWith(loginDto.email, loginDto.password);
      expect(result).toEqual(mockToken);
    });

    it('should return token on successful login', async () => {
      const expectedToken = { access_token: 'login-jwt-token' };
      mockAuthService.login.mockResolvedValue(expectedToken);

      const result = await controller.login(loginDto);

      expect(result).toEqual(expectedToken);
      expect(result.access_token).toBe('login-jwt-token');
    });

    it('should propagate UnauthorizedException for invalid credentials', async () => {
      mockAuthService.login.mockRejectedValue(new UnauthorizedException('Invalid credentials'));

      await expect(controller.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(controller.login(loginDto)).rejects.toThrow('Invalid credentials');
    });

    it('should propagate errors from authService', async () => {
      mockAuthService.login.mockRejectedValue(new Error('Database connection failed'));

      await expect(controller.login(loginDto)).rejects.toThrow('Database connection failed');
    });

    it('should handle login with different email formats', async () => {
      const emailVariants = [
        'user@domain.com',
        'user.name@domain.co.uk',
        'user+tag@domain.com',
      ];

      for (const email of emailVariants) {
        mockAuthService.login.mockResolvedValue(mockToken);

        await controller.login({ email, password: 'password123' });

        expect(authService.login).toHaveBeenCalledWith(email, 'password123');
      }
    });
  });

  describe('me', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'John Doe',
      role: 'CUSTOMER',
      createdAt: new Date('2025-01-01'),
      profile: {
        firstName: 'John',
        lastName: 'Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
      },
      provider: null,
    };

    const mockRequest = {
      user: {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'CUSTOMER',
      },
    } as any;

    it('should call authService.me with user ID from request', async () => {
      mockAuthService.me.mockResolvedValue(mockUser);

      const result = await controller.me(mockRequest);

      expect(authService.me).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(mockUser);
    });

    it('should return user details for CUSTOMER role', async () => {
      mockAuthService.me.mockResolvedValue(mockUser);

      const result = await controller.me(mockRequest);

      expect(result).toHaveProperty('id', 'user-123');
      expect(result).toHaveProperty('email', 'test@example.com');
      expect(result).toHaveProperty('role', 'CUSTOMER');
      expect(result).toHaveProperty('profile');
      expect(result?.profile).toHaveProperty('firstName', 'John');
      expect(result?.profile).toHaveProperty('lastName', 'Doe');
    });

    it('should return user details with provider data for PROVIDER role', async () => {
      const providerUser = {
        ...mockUser,
        role: 'PROVIDER',
        provider: {
          id: 'provider-123',
          kycStatus: 'APPROVED',
          stripeAccountId: 'acct_123',
          online: true,
          serviceRadiusKm: 50,
        },
      };

      mockAuthService.me.mockResolvedValue(providerUser);

      const providerRequest = {
        user: {
          sub: 'user-123',
          email: 'provider@example.com',
          role: 'PROVIDER',
        },
      } as any;

      const result = await controller.me(providerRequest);

      expect(result).toHaveProperty('provider');
      expect(result?.provider).toHaveProperty('id', 'provider-123');
      expect(result?.provider).toHaveProperty('kycStatus', 'APPROVED');
      expect(result?.provider).toHaveProperty('stripeAccountId', 'acct_123');
      expect(result?.provider).toHaveProperty('online', true);
      expect(result?.provider).toHaveProperty('serviceRadiusKm', 50);
    });

    it('should handle user without profile data', async () => {
      const userWithoutProfile = {
        ...mockUser,
        profile: null,
      };

      mockAuthService.me.mockResolvedValue(userWithoutProfile);

      const result = await controller.me(mockRequest);

      expect(result).toHaveProperty('profile', null);
    });

    it('should propagate errors from authService', async () => {
      mockAuthService.me.mockRejectedValue(new Error('User not found'));

      await expect(controller.me(mockRequest)).rejects.toThrow('User not found');
    });

    it('should handle different user IDs', async () => {
      const userIds = ['user-abc', 'user-xyz', 'user-123'];

      for (const userId of userIds) {
        const request = {
          user: { sub: userId, email: 'test@example.com', role: 'CUSTOMER' },
        } as any;

        mockAuthService.me.mockResolvedValue({ ...mockUser, id: userId });

        await controller.me(request);

        expect(authService.me).toHaveBeenCalledWith(userId);
      }
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete signup and login flow', async () => {
      const signupDto = {
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User',
        role: 'CUSTOMER' as const,
      };

      const loginDto = {
        email: 'newuser@example.com',
        password: 'password123',
      };

      const mockToken = { access_token: 'jwt-token-123' };

      // Signup
      mockAuthService.signup.mockResolvedValue(mockToken);
      const signupResult = await controller.signup(signupDto);
      expect(signupResult).toEqual(mockToken);

      // Login
      mockAuthService.login.mockResolvedValue(mockToken);
      const loginResult = await controller.login(loginDto);
      expect(loginResult).toEqual(mockToken);
    });

    it('should handle signup, login, and me flow', async () => {
      const signupDto = {
        email: 'user@example.com',
        password: 'password123',
        name: 'Test User',
        role: 'CUSTOMER' as const,
      };

      const mockToken = { access_token: 'jwt-token-123' };
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
        role: 'CUSTOMER',
        createdAt: new Date(),
        profile: { firstName: 'Test', lastName: 'User', avatarUrl: null },
        provider: null,
      };

      // Signup
      mockAuthService.signup.mockResolvedValue(mockToken);
      await controller.signup(signupDto);

      // Login
      mockAuthService.login.mockResolvedValue(mockToken);
      await controller.login({ email: signupDto.email, password: signupDto.password });

      // Get user details
      mockAuthService.me.mockResolvedValue(mockUser);
      const userDetails = await controller.me({
        user: { sub: 'user-123', email: 'user@example.com', role: 'CUSTOMER' },
      } as any);

      expect(userDetails).toEqual(mockUser);
    });
  });
});
