import { Test, TestingModule } from '@nestjs/testing';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyService } from './loyalty.service';
import { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from '../auth/jwt.guard';

describe('LoyaltyController', () => {
  let controller: LoyaltyController;
  let loyaltyService: LoyaltyService;

  const mockLoyaltyService = {
    getAccountSummary: jest.fn(),
    getAvailableRewards: jest.fn(),
    redeemReward: jest.fn(),
    applyReward: jest.fn(),
  };

  const mockJwtAuthGuard = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const request = context.switchToHttp().getRequest();
      request.user = { sub: 'user-123', email: 'test@example.com', role: 'CUSTOMER' };
      return true;
    }),
  };

  const mockRolesGuard = {
    canActivate: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LoyaltyController],
      providers: [
        {
          provide: LoyaltyService,
          useValue: mockLoyaltyService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<LoyaltyController>(LoyaltyController);
    loyaltyService = module.get<LoyaltyService>(LoyaltyService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAccount', () => {
    const mockRequest = {
      user: {
        sub: 'user-123',
        email: 'customer@example.com',
        role: 'CUSTOMER',
      },
    } as any;

    const mockAccountSummary = {
      userId: 'user-123',
      points: 1500,
      lifetimePoints: 3500,
      lifetimeSpent: 2000,
      tier: 'SILVER' as const,
      pointsToNextTier: 1500,
      tierBonus: 10,
      recentTransactions: [],
      activeRewards: [],
    };

    it('should call loyaltyService.getAccountSummary with user ID', async () => {
      mockLoyaltyService.getAccountSummary.mockResolvedValue(mockAccountSummary);

      const result = await controller.getAccount(mockRequest);

      expect(loyaltyService.getAccountSummary).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(mockAccountSummary);
    });

    it('should return account summary with tier information', async () => {
      mockLoyaltyService.getAccountSummary.mockResolvedValue(mockAccountSummary);

      const result = await controller.getAccount(mockRequest);

      expect(result).toHaveProperty('tier', 'SILVER');
      expect(result).toHaveProperty('points', 1500);
      expect(result).toHaveProperty('lifetimePoints', 3500);
    });

    it('should return tier bonus and progress information', async () => {
      mockLoyaltyService.getAccountSummary.mockResolvedValue(mockAccountSummary);

      const result = await controller.getAccount(mockRequest);

      expect(result).toHaveProperty('pointsToNextTier', 1500);
      expect(result).toHaveProperty('tierBonus', 10);
      expect(result).toHaveProperty('lifetimeSpent', 2000);
    });

    it('should propagate errors from loyaltyService', async () => {
      mockLoyaltyService.getAccountSummary.mockRejectedValue(new Error('Account not found'));

      await expect(controller.getAccount(mockRequest)).rejects.toThrow('Account not found');
    });
  });

  describe('getAvailableRewards', () => {
    const mockRequest = {
      user: {
        sub: 'user-123',
        email: 'customer@example.com',
        role: 'CUSTOMER',
      },
    } as any;

    const mockRewards = {
      tier: 'SILVER' as const,
      points: 1500,
      availableRewards: [
        {
          type: 'DISCOUNT_PERCENT' as const,
          value: 5,
          pointsCost: 500,
          description: '5% off next job',
        },
        {
          type: 'DISCOUNT_FIXED' as const,
          value: 2500,
          pointsCost: 1000,
          description: '$25 off next job',
        },
      ],
    };

    it('should call loyaltyService.getAvailableRewards with user ID', async () => {
      mockLoyaltyService.getAvailableRewards.mockResolvedValue(mockRewards);

      const result = await controller.getAvailableRewards(mockRequest);

      expect(loyaltyService.getAvailableRewards).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(mockRewards);
    });

    it('should return rewards catalog for user tier', async () => {
      mockLoyaltyService.getAvailableRewards.mockResolvedValue(mockRewards);

      const result = await controller.getAvailableRewards(mockRequest);

      expect(result).toHaveProperty('tier', 'SILVER');
      expect(result).toHaveProperty('points', 1500);
      expect(result).toHaveProperty('availableRewards');
    });

    it('should return list of available rewards', async () => {
      mockLoyaltyService.getAvailableRewards.mockResolvedValue(mockRewards);

      const result = await controller.getAvailableRewards(mockRequest);

      expect(result.availableRewards).toHaveLength(2);
      expect(result.availableRewards[0]).toHaveProperty('type', 'DISCOUNT_PERCENT');
      expect(result.availableRewards[1]).toHaveProperty('type', 'DISCOUNT_FIXED');
    });

    it('should return rewards with point costs', async () => {
      mockLoyaltyService.getAvailableRewards.mockResolvedValue(mockRewards);

      const result = await controller.getAvailableRewards(mockRequest);

      expect(result.availableRewards[0]).toHaveProperty('pointsCost', 500);
      expect(result.availableRewards[1]).toHaveProperty('pointsCost', 1000);
    });

    it('should handle empty rewards list', async () => {
      const emptyRewards = { tier: 'BRONZE' as const, points: 100, availableRewards: [] };
      mockLoyaltyService.getAvailableRewards.mockResolvedValue(emptyRewards);

      const result = await controller.getAvailableRewards(mockRequest);

      expect(result.availableRewards).toEqual([]);
      expect(result.availableRewards).toHaveLength(0);
    });

    it('should propagate errors from loyaltyService', async () => {
      mockLoyaltyService.getAvailableRewards.mockRejectedValue(new Error('Service error'));

      await expect(controller.getAvailableRewards(mockRequest)).rejects.toThrow('Service error');
    });
  });

  describe('redeemReward', () => {
    const mockRequest = {
      user: {
        sub: 'user-123',
        email: 'customer@example.com',
        role: 'CUSTOMER',
      },
    } as any;

    const redeemBody = {
      type: 'DISCOUNT_PERCENT' as const,
      value: 10,
      pointsCost: 500,
      description: '10% off next service',
    };

    const mockRedeemedReward = {
      id: 'reward-123',
      accountId: 'account-123',
      type: 'DISCOUNT_PERCENT',
      value: 10,
      description: '10% off next service',
      code: 'ABC12345',
      expiresAt: new Date('2025-12-31'),
      redeemedAt: null,
      jobId: null,
      createdAt: new Date(),
    };

    it('should call loyaltyService.redeemReward with correct parameters', async () => {
      mockLoyaltyService.redeemReward.mockResolvedValue(mockRedeemedReward);

      const result = await controller.redeemReward(mockRequest, redeemBody);

      expect(loyaltyService.redeemReward).toHaveBeenCalledWith(
        'user-123',
        'DISCOUNT_PERCENT',
        500,
        10,
        '10% off next service',
      );
      expect(result).toEqual(mockRedeemedReward);
    });

    it('should return redeemed reward with unique code', async () => {
      mockLoyaltyService.redeemReward.mockResolvedValue(mockRedeemedReward);

      const result = await controller.redeemReward(mockRequest, redeemBody);

      expect(result).toHaveProperty('code', 'ABC12345');
      expect(result).toHaveProperty('id', 'reward-123');
      expect(result).toHaveProperty('redeemedAt', null);
    });

    it('should handle DISCOUNT_FIXED type', async () => {
      const fixedDiscountBody = {
        type: 'DISCOUNT_FIXED' as const,
        value: 25,
        pointsCost: 1000,
        description: '$25 off next service',
      };

      const fixedReward = {
        ...mockRedeemedReward,
        type: 'DISCOUNT_FIXED',
        value: 25,
        description: '$25 off next service',
      };

      mockLoyaltyService.redeemReward.mockResolvedValue(fixedReward);

      await controller.redeemReward(mockRequest, fixedDiscountBody);

      expect(loyaltyService.redeemReward).toHaveBeenCalledWith(
        'user-123',
        'DISCOUNT_FIXED',
        1000,
        25,
        '$25 off next service',
      );
    });

    it('should handle FREE_SERVICE type', async () => {
      const freeServiceBody = {
        type: 'FREE_SERVICE' as const,
        value: 100,
        pointsCost: 2000,
        description: 'Free basic cleaning service',
      };

      const freeReward = {
        ...mockRedeemedReward,
        type: 'FREE_SERVICE',
        value: 100,
        description: 'Free basic cleaning service',
      };

      mockLoyaltyService.redeemReward.mockResolvedValue(freeReward);

      await controller.redeemReward(mockRequest, freeServiceBody);

      expect(loyaltyService.redeemReward).toHaveBeenCalledWith(
        'user-123',
        'FREE_SERVICE',
        2000,
        100,
        'Free basic cleaning service',
      );
    });

    it('should propagate insufficient points error', async () => {
      mockLoyaltyService.redeemReward.mockRejectedValue(new Error('Insufficient points'));

      await expect(controller.redeemReward(mockRequest, redeemBody)).rejects.toThrow(
        'Insufficient points',
      );
    });

    it('should propagate errors from loyaltyService', async () => {
      mockLoyaltyService.redeemReward.mockRejectedValue(new Error('Redemption failed'));

      await expect(controller.redeemReward(mockRequest, redeemBody)).rejects.toThrow(
        'Redemption failed',
      );
    });
  });

  describe('applyReward', () => {
    const mockRequest = {
      user: {
        sub: 'user-123',
        email: 'customer@example.com',
        role: 'CUSTOMER',
      },
    } as any;

    const mockAppliedReward = {
      id: 'reward-123',
      accountId: 'account-123',
      type: 'DISCOUNT_PERCENT',
      value: 10,
      description: '10% off',
      code: 'ABC12345',
      expiresAt: new Date('2025-12-31'),
      redeemedAt: new Date(),
      jobId: 'job-456',
      createdAt: new Date(),
    };

    it('should call loyaltyService.applyReward with correct parameters', async () => {
      mockLoyaltyService.applyReward.mockResolvedValue(mockAppliedReward);

      const result = await controller.applyReward(mockRequest, 'ABC12345', 'job-456');

      expect(loyaltyService.applyReward).toHaveBeenCalledWith('user-123', 'ABC12345', 'job-456');
      expect(result).toEqual(mockAppliedReward);
    });

    it('should return applied reward with redemption details', async () => {
      mockLoyaltyService.applyReward.mockResolvedValue(mockAppliedReward);

      const result = await controller.applyReward(mockRequest, 'ABC12345', 'job-456');

      expect(result).toHaveProperty('code', 'ABC12345');
      expect(result).toHaveProperty('jobId', 'job-456');
      expect(result).toHaveProperty('redeemedAt');
    });

    it('should handle different reward codes', async () => {
      const codes = ['CODE1234', 'XYZ98765', 'TEST0000'];

      for (const code of codes) {
        mockLoyaltyService.applyReward.mockResolvedValue({
          ...mockAppliedReward,
          code,
        });

        await controller.applyReward(mockRequest, code, 'job-456');

        expect(loyaltyService.applyReward).toHaveBeenCalledWith('user-123', code, 'job-456');
      }
    });

    it('should handle different job IDs', async () => {
      const jobIds = ['job-111', 'job-222', 'job-333'];

      for (const jobId of jobIds) {
        mockLoyaltyService.applyReward.mockResolvedValue({
          ...mockAppliedReward,
          jobId,
        });

        await controller.applyReward(mockRequest, 'ABC12345', jobId);

        expect(loyaltyService.applyReward).toHaveBeenCalledWith('user-123', 'ABC12345', jobId);
      }
    });

    it('should propagate reward not found error', async () => {
      mockLoyaltyService.applyReward.mockRejectedValue(new Error('Reward not found'));

      await expect(controller.applyReward(mockRequest, 'INVALID', 'job-456')).rejects.toThrow(
        'Reward not found',
      );
    });

    it('should propagate reward expired error', async () => {
      mockLoyaltyService.applyReward.mockRejectedValue(new Error('Reward expired'));

      await expect(controller.applyReward(mockRequest, 'EXPIRED', 'job-456')).rejects.toThrow(
        'Reward expired',
      );
    });

    it('should propagate errors from loyaltyService', async () => {
      mockLoyaltyService.applyReward.mockRejectedValue(new Error('Application failed'));

      await expect(controller.applyReward(mockRequest, 'ABC12345', 'job-456')).rejects.toThrow(
        'Application failed',
      );
    });
  });

  describe('Integration scenarios', () => {
    const mockRequest = {
      user: {
        sub: 'user-123',
        email: 'customer@example.com',
        role: 'CUSTOMER',
      },
    } as any;

    it('should handle complete loyalty flow: account -> rewards -> redeem -> apply', async () => {
      // Get account
      const accountSummary = {
        userId: 'user-123',
        points: 2000,
        lifetimePoints: 5000,
        lifetimeSpent: 3000,
        tier: 'GOLD' as const,
        pointsToNextTier: 5000,
        tierBonus: 20,
        recentTransactions: [],
        activeRewards: [],
      };
      mockLoyaltyService.getAccountSummary.mockResolvedValue(accountSummary);
      await controller.getAccount(mockRequest);

      // Get available rewards
      const rewards = {
        tier: 'GOLD' as const,
        points: 2000,
        availableRewards: [
          {
            type: 'DISCOUNT_PERCENT' as const,
            value: 15,
            pointsCost: 1000,
            description: '15% off next job',
          },
        ],
      };
      mockLoyaltyService.getAvailableRewards.mockResolvedValue(rewards);
      await controller.getAvailableRewards(mockRequest);

      // Redeem reward
      const redeemedReward = {
        id: 'reward-123',
        accountId: 'account-123',
        type: 'DISCOUNT_PERCENT',
        value: 15,
        description: '15% off',
        code: 'GOLD1234',
        expiresAt: new Date('2025-12-31'),
        redeemedAt: null,
        jobId: null,
        createdAt: new Date(),
      };
      mockLoyaltyService.redeemReward.mockResolvedValue(redeemedReward);
      const redeemBody = {
        type: 'DISCOUNT_PERCENT' as const,
        value: 15,
        pointsCost: 1000,
        description: '15% off',
      };
      await controller.redeemReward(mockRequest, redeemBody);

      // Apply reward
      const appliedReward = {
        id: 'reward-123',
        accountId: 'account-123',
        type: 'DISCOUNT_PERCENT',
        value: 15,
        description: '15% off',
        code: 'GOLD1234',
        expiresAt: new Date('2025-12-31'),
        redeemedAt: new Date(),
        jobId: 'job-456',
        createdAt: new Date(),
      };
      mockLoyaltyService.applyReward.mockResolvedValue(appliedReward);
      const result = await controller.applyReward(mockRequest, 'GOLD1234', 'job-456');

      expect(result.jobId).toBe('job-456');
      expect(result.code).toBe('GOLD1234');
    });
  });
});
