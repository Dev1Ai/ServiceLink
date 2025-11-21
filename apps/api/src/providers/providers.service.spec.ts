import { Test, TestingModule } from '@nestjs/testing';
import { ProvidersService } from './providers.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AnalyticsService } from './analytics.service';

// Create shared Stripe mock
const mockStripeAccounts = {
  create: jest.fn(),
};
const mockStripeAccountLinks = {
  create: jest.fn(),
};

// Mock Stripe module
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    accounts: mockStripeAccounts,
    accountLinks: mockStripeAccountLinks,
  }));
});

describe('ProvidersService', () => {
  let service: ProvidersService;
  let prismaService: PrismaService;
  let configService: ConfigService;

  const mockPrismaService = {
    provider: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockStripeAccounts.create.mockClear();
    mockStripeAccountLinks.create.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProvidersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ProvidersService>(ProvidersService);
    prismaService = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('ensureProviderProfile', () => {
    it('should return existing provider profile', async () => {
      const userId = 'user-123';
      const mockProvider = {
        id: 'provider-123',
        userId,
        kycStatus: 'PENDING',
        stripeAccountId: null,
        online: false,
        serviceRadiusKm: 25,
        lat: null,
        lng: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.provider.findUnique.mockResolvedValue(mockProvider);

      const result = await service.ensureProviderProfile(userId);

      expect(mockPrismaService.provider.findUnique).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(mockPrismaService.provider.create).not.toHaveBeenCalled();
      expect(result).toEqual(mockProvider);
    });

    it('should create provider profile if it does not exist', async () => {
      const userId = 'user-456';
      const mockNewProvider = {
        id: 'provider-456',
        userId,
        kycStatus: 'PENDING',
        stripeAccountId: null,
        online: false,
        serviceRadiusKm: 25,
        lat: null,
        lng: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.provider.findUnique.mockResolvedValue(null);
      mockPrismaService.provider.create.mockResolvedValue(mockNewProvider);

      const result = await service.ensureProviderProfile(userId);

      expect(mockPrismaService.provider.findUnique).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(mockPrismaService.provider.create).toHaveBeenCalledWith({
        data: { userId },
      });
      expect(result).toEqual(mockNewProvider);
    });
  });

  describe('createOnboardingLink', () => {
    it('should return mock URL when Stripe key is not set', async () => {
      const userId = 'user-123';
      const mockProvider = {
        id: 'provider-123',
        userId,
        stripeAccountId: null,
      };

      mockConfigService.get.mockReturnValue(undefined);
      mockPrismaService.provider.findUnique.mockResolvedValue(mockProvider);

      const result = await service.createOnboardingLink(userId);

      expect(result).toEqual({ url: 'https://connect.stripe.com/setup/mock' });
    });

    it('should return mock URL when Stripe key is placeholder with asterisks', async () => {
      const userId = 'user-123';
      const mockProvider = {
        id: 'provider-123',
        userId,
        stripeAccountId: null,
      };

      mockConfigService.get.mockReturnValue('sk_test_****');
      mockPrismaService.provider.findUnique.mockResolvedValue(mockProvider);

      const result = await service.createOnboardingLink(userId);

      expect(result).toEqual({ url: 'https://connect.stripe.com/setup/mock' });
    });

    it('should return mock URL when Stripe key is placeholder text', async () => {
      const userId = 'user-123';
      const mockProvider = {
        id: 'provider-123',
        userId,
        stripeAccountId: null,
      };

      mockConfigService.get.mockReturnValue('sk_live_or_test');
      mockPrismaService.provider.findUnique.mockResolvedValue(mockProvider);

      const result = await service.createOnboardingLink(userId);

      expect(result).toEqual({ url: 'https://connect.stripe.com/setup/mock' });
    });

    it('should create Stripe account and return onboarding link for new provider', async () => {
      const userId = 'user-123';
      const mockProvider = {
        id: 'provider-123',
        userId,
        stripeAccountId: null,
      };

      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'STRIPE_SECRET_KEY' || key === 'STRIPE_SECRET') {
          return 'sk_test_validkey123';
        }
        if (key === 'STRIPE_RETURN_URL') {
          return 'http://localhost:3000/provider/onboarding/completed';
        }
        if (key === 'STRIPE_REFRESH_URL') {
          return 'http://localhost:3000/provider/onboarding/refresh';
        }
        return undefined;
      });

      mockPrismaService.provider.findUnique.mockResolvedValue(mockProvider);

      mockStripeAccounts.create.mockResolvedValue({
        id: 'acct_123456',
      });
      mockStripeAccountLinks.create.mockResolvedValue({
        url: 'https://connect.stripe.com/setup/s/123456',
      });

      mockPrismaService.provider.update.mockResolvedValue({
        ...mockProvider,
        stripeAccountId: 'acct_123456',
      });

      const result = await service.createOnboardingLink(userId);

      expect(mockStripeAccounts.create).toHaveBeenCalledWith({
        type: 'express',
      });
      expect(mockPrismaService.provider.update).toHaveBeenCalledWith({
        where: { id: 'provider-123' },
        data: { stripeAccountId: 'acct_123456' },
      });
      expect(mockStripeAccountLinks.create).toHaveBeenCalledWith({
        account: 'acct_123456',
        refresh_url: 'http://localhost:3000/provider/onboarding/refresh',
        return_url: 'http://localhost:3000/provider/onboarding/completed',
        type: 'account_onboarding',
      });
      expect(result).toEqual({
        url: 'https://connect.stripe.com/setup/s/123456',
      });
    });

    it('should reuse existing Stripe account if already exists', async () => {
      const userId = 'user-123';
      const mockProvider = {
        id: 'provider-123',
        userId,
        stripeAccountId: 'acct_existing',
      };

      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'STRIPE_SECRET_KEY' || key === 'STRIPE_SECRET') {
          return 'sk_test_validkey123';
        }
        return undefined;
      });

      mockPrismaService.provider.findUnique.mockResolvedValue(mockProvider);

      mockStripeAccountLinks.create.mockResolvedValue({
        url: 'https://connect.stripe.com/setup/s/existing',
      });

      const result = await service.createOnboardingLink(userId);

      expect(mockStripeAccounts.create).not.toHaveBeenCalled();
      expect(mockPrismaService.provider.update).not.toHaveBeenCalled();
      expect(mockStripeAccountLinks.create).toHaveBeenCalledWith({
        account: 'acct_existing',
        refresh_url: 'http://localhost:3000/provider/onboarding/refresh',
        return_url: 'http://localhost:3000/provider/onboarding/completed',
        type: 'account_onboarding',
      });
      expect(result).toEqual({
        url: 'https://connect.stripe.com/setup/s/existing',
      });
    });

    it('should return mock URL when Stripe accountLinks.create fails', async () => {
      const userId = 'user-123';
      const mockProvider = {
        id: 'provider-123',
        userId,
        stripeAccountId: 'acct_123',
      };

      mockConfigService.get.mockReturnValue('sk_test_validkey123');
      mockPrismaService.provider.findUnique.mockResolvedValue(mockProvider);

      mockStripeAccountLinks.create.mockRejectedValue(
        new Error('Stripe API error'),
      );

      const result = await service.createOnboardingLink(userId);

      expect(result).toEqual({ url: 'https://connect.stripe.com/setup/mock' });
    });

    it('should use default URLs when STRIPE_RETURN_URL and STRIPE_REFRESH_URL are not set', async () => {
      const userId = 'user-123';
      const mockProvider = {
        id: 'provider-123',
        userId,
        stripeAccountId: 'acct_123',
      };

      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'STRIPE_SECRET_KEY' || key === 'STRIPE_SECRET') {
          return 'sk_test_validkey123';
        }
        return undefined; // Return undefined for STRIPE_RETURN_URL and STRIPE_REFRESH_URL
      });

      mockPrismaService.provider.findUnique.mockResolvedValue(mockProvider);

      mockStripeAccountLinks.create.mockResolvedValue({
        url: 'https://connect.stripe.com/setup/s/defaults',
      });

      await service.createOnboardingLink(userId);

      expect(mockStripeAccountLinks.create).toHaveBeenCalledWith({
        account: 'acct_123',
        refresh_url: 'http://localhost:3000/provider/onboarding/refresh',
        return_url: 'http://localhost:3000/provider/onboarding/completed',
        type: 'account_onboarding',
      });
    });
  });

  describe('getMe', () => {
    it('should return user profile with provider data', async () => {
      const userId = 'user-123';
      const mockProvider = {
        id: 'provider-123',
        userId,
      };
      const mockUser = {
        id: userId,
        email: 'provider@example.com',
        name: 'Provider User',
        role: 'PROVIDER',
        createdAt: new Date(),
        profile: {
          firstName: 'Provider',
          lastName: 'User',
          avatarUrl: 'https://example.com/avatar.jpg',
        },
        provider: {
          id: 'provider-123',
          kycStatus: 'APPROVED',
          stripeAccountId: 'acct_123',
          online: true,
          serviceRadiusKm: 50,
          lat: 37.7749,
          lng: -122.4194,
        },
      };

      mockPrismaService.provider.findUnique.mockResolvedValue(mockProvider);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getMe(userId);

      expect(mockPrismaService.provider.findUnique).toHaveBeenCalled();
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
              lat: true,
              lng: true,
            },
          },
        },
      });
      expect(result).toEqual(mockUser);
    });

    it('should create provider profile if it does not exist before getting user', async () => {
      const userId = 'user-456';
      const mockNewProvider = {
        id: 'provider-456',
        userId,
      };

      mockPrismaService.provider.findUnique.mockResolvedValue(null);
      mockPrismaService.provider.create.mockResolvedValue(mockNewProvider);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'newprovider@example.com',
        name: 'New Provider',
        role: 'PROVIDER',
        createdAt: new Date(),
        profile: null,
        provider: {
          id: 'provider-456',
          kycStatus: 'PENDING',
          stripeAccountId: null,
          online: false,
          serviceRadiusKm: 25,
          lat: null,
          lng: null,
        },
      });

      const result = await service.getMe(userId);

      expect(mockPrismaService.provider.findUnique).toHaveBeenCalled();
      expect(mockPrismaService.provider.create).toHaveBeenCalledWith({
        data: { userId },
      });
      expect(result).toBeDefined();
    });
  });

  describe('getAnalytics', () => {
    it('should delegate to AnalyticsService', async () => {
      const providerId = 'provider-123';
      const mockAnalytics = {
        totalJobs: 10,
        completedJobs: 8,
        activeJobs: 2,
        totalRevenue: 5000,
        averageRating: 4.5,
        reviewCount: 15,
        responseTime: 2.5,
        acceptanceRate: 80,
        completionRate: 90,
      };

      // Mock the analytics service method
      jest.spyOn(AnalyticsService.prototype, 'getProviderAnalytics').mockResolvedValue(mockAnalytics);

      const result = await service.getAnalytics(providerId);

      expect(result).toEqual(mockAnalytics);
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should delegate to AnalyticsService with default period', async () => {
      const providerId = 'provider-123';
      const mockMetrics = {
        period: 'month' as const,
        jobsByStatus: { pending: 5, active: 3, completed: 15, rejected: 2 },
        revenueByMonth: [
          { month: '2025-01', revenue: 1000 },
          { month: '2025-02', revenue: 1200 },
        ],
        topServices: [
          { service: 'Plumbing', count: 10, revenue: 2500 },
        ],
        customerSatisfaction: {
          averageRating: 4.7,
          totalReviews: 20,
          ratingDistribution: { 5: 15, 4: 3, 3: 2, 2: 0, 1: 0 },
        },
      };

      jest.spyOn(AnalyticsService.prototype, 'getProviderPerformanceMetrics').mockResolvedValue(mockMetrics);

      const result = await service.getPerformanceMetrics(providerId);

      expect(AnalyticsService.prototype.getProviderPerformanceMetrics).toHaveBeenCalledWith(providerId, 'month');
      expect(result).toEqual(mockMetrics);
    });

    it('should delegate to AnalyticsService with custom period', async () => {
      const providerId = 'provider-123';
      const mockMetrics = {
        period: 'year' as const,
        jobsByStatus: { pending: 2, active: 5, completed: 50, rejected: 5 },
        revenueByMonth: [
          { month: '2024-01', revenue: 1000 },
          { month: '2024-02', revenue: 1200 },
          { month: '2024-03', revenue: 1100 },
          { month: '2024-04', revenue: 1300 },
        ],
        topServices: [
          { service: 'Electrical', count: 25, revenue: 5000 },
        ],
        customerSatisfaction: {
          averageRating: 4.8,
          totalReviews: 45,
          ratingDistribution: { 5: 35, 4: 7, 3: 2, 2: 1, 1: 0 },
        },
      };

      jest.spyOn(AnalyticsService.prototype, 'getProviderPerformanceMetrics').mockResolvedValue(mockMetrics);

      const result = await service.getPerformanceMetrics(providerId, 'year');

      expect(AnalyticsService.prototype.getProviderPerformanceMetrics).toHaveBeenCalledWith(providerId, 'year');
      expect(result).toEqual(mockMetrics);
    });
  });
});
