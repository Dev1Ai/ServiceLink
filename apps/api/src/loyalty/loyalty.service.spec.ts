import { Test, TestingModule } from '@nestjs/testing';
import { LoyaltyService } from './loyalty.service';
import { PrismaService } from '../prisma/prisma.service';

describe('LoyaltyService', () => {
  let service: LoyaltyService;
  let prisma: PrismaService;

  const mockPrismaService = {
    loyaltyAccount: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    loyaltyTransaction: {
      create: jest.fn(),
    },
    loyaltyReward: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoyaltyService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<LoyaltyService>(LoyaltyService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrCreateAccount', () => {
    it('should return existing account', async () => {
      const mockAccount = {
        id: 'account1',
        userId: 'user1',
        points: 500,
        tier: 'BRONZE',
        lifetimePoints: 500,
        lifetimeSpent: 5000,
        transactions: [],
        rewards: [],
      };

      mockPrismaService.loyaltyAccount.findUnique.mockResolvedValue(mockAccount);

      const result = await service.getOrCreateAccount('user1');

      expect(result).toEqual(mockAccount);
      expect(mockPrismaService.loyaltyAccount.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user1' },
        include: {
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          rewards: {
            where: { redeemedAt: null },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    });

    it('should create new account if not exists', async () => {
      const mockNewAccount = {
        id: 'account1',
        userId: 'user1',
        points: 0,
        tier: 'BRONZE',
        lifetimePoints: 0,
        lifetimeSpent: 0,
        transactions: [],
        rewards: [],
      };

      mockPrismaService.loyaltyAccount.findUnique.mockResolvedValue(null);
      mockPrismaService.loyaltyAccount.create.mockResolvedValue(mockNewAccount);

      const result = await service.getOrCreateAccount('user1');

      expect(result).toEqual(mockNewAccount);
      expect(mockPrismaService.loyaltyAccount.create).toHaveBeenCalledWith({
        data: { userId: 'user1' },
        include: {
          transactions: true,
          rewards: true,
        },
      });
    });
  });

  describe('awardPointsForJob', () => {
    it('should award points with bronze tier bonus', async () => {
      const mockAccount = {
        id: 'account1',
        userId: 'user1',
        points: 100,
        tier: 'BRONZE',
        lifetimePoints: 100,
        lifetimeSpent: 1000,
        transactions: [],
        rewards: [],
      };

      mockPrismaService.loyaltyAccount.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.loyaltyTransaction.create.mockResolvedValue({});
      mockPrismaService.loyaltyAccount.update.mockResolvedValue({});

      // Award points for $50 job
      const points = await service.awardPointsForJob('user1', 'job1', 5000);

      expect(points).toBe(50); // 1:1 ratio for bronze, no bonus
      expect(mockPrismaService.loyaltyTransaction.create).toHaveBeenCalled();
      expect(mockPrismaService.loyaltyAccount.update).toHaveBeenCalledWith({
        where: { id: 'account1' },
        data: {
          points: 150, // 100 + 50
          lifetimePoints: 150,
          lifetimeSpent: 6000,
          tier: 'BRONZE', // Still bronze
        },
      });
    });

    it('should award points with silver tier bonus', async () => {
      const mockAccount = {
        id: 'account1',
        userId: 'user1',
        points: 1000,
        tier: 'SILVER',
        lifetimePoints: 1000,
        lifetimeSpent: 10000,
        transactions: [],
        rewards: [],
      };

      mockPrismaService.loyaltyAccount.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.loyaltyTransaction.create.mockResolvedValue({});
      mockPrismaService.loyaltyAccount.update.mockResolvedValue({});

      // Award points for $100 job with 10% silver bonus
      const points = await service.awardPointsForJob('user1', 'job1', 10000);

      expect(points).toBe(110); // 100 * 1.10 = 110
    });

    it('should upgrade tier when reaching threshold', async () => {
      const mockAccount = {
        id: 'account1',
        userId: 'user1',
        points: 900,
        tier: 'BRONZE',
        lifetimePoints: 900,
        lifetimeSpent: 9000,
        transactions: [],
        rewards: [],
      };

      mockPrismaService.loyaltyAccount.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.loyaltyTransaction.create.mockResolvedValue({});
      mockPrismaService.loyaltyAccount.update.mockResolvedValue({});

      // Award 200 points to push over silver threshold (1000)
      await service.awardPointsForJob('user1', 'job1', 20000);

      expect(mockPrismaService.loyaltyAccount.update).toHaveBeenCalledWith({
        where: { id: 'account1' },
        data: {
          points: 1100, // 900 + 200
          lifetimePoints: 1100,
          lifetimeSpent: 29000,
          tier: 'SILVER', // Upgraded!
        },
      });
    });
  });

  describe('redeemReward', () => {
    it('should redeem reward successfully', async () => {
      const mockAccount = {
        id: 'account1',
        userId: 'user1',
        points: 1000,
        tier: 'SILVER',
        lifetimePoints: 1000,
        lifetimeSpent: 10000,
        transactions: [],
        rewards: [],
      };

      const mockReward = {
        id: 'reward1',
        accountId: 'account1',
        type: 'DISCOUNT_PERCENT',
        value: 10,
        description: '10% off next job',
        code: 'ABC12345',
      };

      mockPrismaService.loyaltyAccount.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.loyaltyTransaction.create.mockResolvedValue({});
      mockPrismaService.loyaltyReward.create.mockResolvedValue(mockReward);
      mockPrismaService.loyaltyAccount.update.mockResolvedValue({});

      const reward = await service.redeemReward('user1', 'DISCOUNT_PERCENT', 500, 10, '10% off');

      expect(reward).toEqual(mockReward);
      expect(mockPrismaService.loyaltyAccount.update).toHaveBeenCalledWith({
        where: { id: 'account1' },
        data: { points: 500 }, // 1000 - 500
      });
    });

    it('should throw error for insufficient points', async () => {
      const mockAccount = {
        id: 'account1',
        userId: 'user1',
        points: 100,
        tier: 'BRONZE',
        lifetimePoints: 100,
        lifetimeSpent: 1000,
        transactions: [],
        rewards: [],
      };

      mockPrismaService.loyaltyAccount.findUnique.mockResolvedValue(mockAccount);

      await expect(
        service.redeemReward('user1', 'DISCOUNT_PERCENT', 500, 10, '10% off'),
      ).rejects.toThrow('Insufficient points');
    });
  });

  describe('getAvailableRewards', () => {
    it('should return bronze tier rewards', async () => {
      const mockAccount = {
        id: 'account1',
        userId: 'user1',
        points: 500,
        tier: 'BRONZE',
        lifetimePoints: 500,
        lifetimeSpent: 5000,
        transactions: [],
        rewards: [],
      };

      mockPrismaService.loyaltyAccount.findUnique.mockResolvedValue(mockAccount);

      const result = await service.getAvailableRewards('user1');

      expect(result.tier).toBe('BRONZE');
      expect(result.points).toBe(500);
      expect(result.availableRewards).toHaveLength(1);
      expect(result.availableRewards[0]).toMatchObject({
        type: 'DISCOUNT_PERCENT',
        value: 5,
        pointsCost: 500,
      });
    });

    it('should return platinum tier rewards', async () => {
      const mockAccount = {
        id: 'account1',
        userId: 'user1',
        points: 15000,
        tier: 'PLATINUM',
        lifetimePoints: 15000,
        lifetimeSpent: 150000,
        transactions: [],
        rewards: [],
      };

      mockPrismaService.loyaltyAccount.findUnique.mockResolvedValue(mockAccount);

      const result = await service.getAvailableRewards('user1');

      expect(result.tier).toBe('PLATINUM');
      expect(result.availableRewards).toHaveLength(4); // Platinum has most rewards
      expect(result.availableRewards.some((r) => r.type === 'FREE_SERVICE')).toBe(true);
    });
  });
});
