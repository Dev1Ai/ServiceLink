import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LoyaltyTier } from '@prisma/client';

/**
 * Loyalty Program Service
 *
 * Tier Requirements:
 * - BRONZE: 0-999 lifetime points
 * - SILVER: 1000-4999 lifetime points
 * - GOLD: 5000-9999 lifetime points
 * - PLATINUM: 10000+ lifetime points
 *
 * Points Earning:
 * - 1 point per $1 spent on completed jobs
 * - Bonus points for tier: Bronze +0%, Silver +10%, Gold +20%, Platinum +30%
 *
 * Rewards:
 * - BRONZE: 5% discount on next job (500 points)
 * - SILVER: 10% discount on next job (800 points) or $25 off (1000 points)
 * - GOLD: 15% discount (1000 points) or $50 off (1500 points)
 * - PLATINUM: 20% discount (1200 points) or $100 off (2000 points) or Free Service (3000 points)
 */
@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get or create loyalty account for a user
   */
  async getOrCreateAccount(userId: string) {
    let account = await this.prisma.loyaltyAccount.findUnique({
      where: { userId },
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

    if (!account) {
      account = await this.prisma.loyaltyAccount.create({
        data: { userId },
        include: {
          transactions: true,
          rewards: true,
        },
      });
    }

    return account;
  }

  /**
   * Calculate tier based on lifetime points
   */
  private calculateTier(lifetimePoints: number): LoyaltyTier {
    if (lifetimePoints >= 10000) return 'PLATINUM';
    if (lifetimePoints >= 5000) return 'GOLD';
    if (lifetimePoints >= 1000) return 'SILVER';
    return 'BRONZE';
  }

  /**
   * Get tier bonus multiplier
   */
  private getTierBonus(tier: LoyaltyTier): number {
    switch (tier) {
      case 'PLATINUM': return 1.30; // +30%
      case 'GOLD': return 1.20; // +20%
      case 'SILVER': return 1.10; // +10%
      case 'BRONZE': return 1.00; // +0%
    }
  }

  /**
   * Award points for a completed job
   */
  async awardPointsForJob(userId: string, jobId: string, amountCents: number): Promise<number> {
    const account = await this.getOrCreateAccount(userId);

    // Calculate base points (1 point per dollar)
    const basePoints = Math.floor(amountCents / 100);

    // Apply tier bonus
    const bonus = this.getTierBonus(account.tier);
    const totalPoints = Math.floor(basePoints * bonus);

    // Create transaction
    await this.prisma.loyaltyTransaction.create({
      data: {
        accountId: account.id,
        points: totalPoints,
        type: 'EARN',
        description: `Earned ${totalPoints} points from completed job (${account.tier} tier bonus applied)`,
        jobId,
      },
    });

    // Update account
    const newLifetimePoints = account.lifetimePoints + totalPoints;
    const newTier = this.calculateTier(newLifetimePoints);

    await this.prisma.loyaltyAccount.update({
      where: { id: account.id },
      data: {
        points: account.points + totalPoints,
        lifetimePoints: newLifetimePoints,
        lifetimeSpent: account.lifetimeSpent + amountCents,
        tier: newTier,
      },
    });

    return totalPoints;
  }

  /**
   * Redeem points for a reward
   */
  async redeemReward(
    userId: string,
    rewardType: 'DISCOUNT_PERCENT' | 'DISCOUNT_FIXED' | 'FREE_SERVICE',
    pointsCost: number,
    value: number,
    description: string,
  ) {
    const account = await this.getOrCreateAccount(userId);

    if (account.points < pointsCost) {
      throw new Error(`Insufficient points. Required: ${pointsCost}, Available: ${account.points}`);
    }

    // Deduct points
    await this.prisma.loyaltyTransaction.create({
      data: {
        accountId: account.id,
        points: -pointsCost,
        type: 'REDEEM',
        description: `Redeemed ${pointsCost} points for ${description}`,
      },
    });

    // Create reward
    const reward = await this.prisma.loyaltyReward.create({
      data: {
        accountId: account.id,
        type: rewardType,
        value,
        description,
        code: this.generateRewardCode(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      },
    });

    // Update account points
    await this.prisma.loyaltyAccount.update({
      where: { id: account.id },
      data: { points: account.points - pointsCost },
    });

    return reward;
  }

  /**
   * Apply reward to a job
   */
  async applyReward(userId: string, rewardCode: string, jobId: string) {
    const account = await this.getOrCreateAccount(userId);

    const reward = await this.prisma.loyaltyReward.findFirst({
      where: {
        accountId: account.id,
        code: rewardCode,
        redeemedAt: null,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    if (!reward) {
      throw new NotFoundException('Reward not found or already redeemed');
    }

    await this.prisma.loyaltyReward.update({
      where: { id: reward.id },
      data: {
        redeemedAt: new Date(),
        jobId,
      },
    });

    return reward;
  }

  /**
   * Get available rewards for user's tier
   */
  async getAvailableRewards(userId: string) {
    const account = await this.getOrCreateAccount(userId);

    const rewardCatalog = {
      BRONZE: [
        { type: 'DISCOUNT_PERCENT' as const, value: 5, pointsCost: 500, description: '5% off next job' },
      ],
      SILVER: [
        { type: 'DISCOUNT_PERCENT' as const, value: 5, pointsCost: 500, description: '5% off next job' },
        { type: 'DISCOUNT_PERCENT' as const, value: 10, pointsCost: 800, description: '10% off next job' },
        { type: 'DISCOUNT_FIXED' as const, value: 2500, pointsCost: 1000, description: '$25 off next job' },
      ],
      GOLD: [
        { type: 'DISCOUNT_PERCENT' as const, value: 10, pointsCost: 800, description: '10% off next job' },
        { type: 'DISCOUNT_PERCENT' as const, value: 15, pointsCost: 1000, description: '15% off next job' },
        { type: 'DISCOUNT_FIXED' as const, value: 5000, pointsCost: 1500, description: '$50 off next job' },
      ],
      PLATINUM: [
        { type: 'DISCOUNT_PERCENT' as const, value: 15, pointsCost: 1000, description: '15% off next job' },
        { type: 'DISCOUNT_PERCENT' as const, value: 20, pointsCost: 1200, description: '20% off next job' },
        { type: 'DISCOUNT_FIXED' as const, value: 10000, pointsCost: 2000, description: '$100 off next job' },
        { type: 'FREE_SERVICE' as const, value: 0, pointsCost: 3000, description: 'Free service (up to $150)' },
      ],
    };

    return {
      tier: account.tier,
      points: account.points,
      availableRewards: rewardCatalog[account.tier],
    };
  }

  /**
   * Generate unique reward code
   */
  private generateRewardCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Get loyalty account summary
   */
  async getAccountSummary(userId: string) {
    const account = await this.getOrCreateAccount(userId);

    const pointsToNextTier = this.getPointsToNextTier(account.lifetimePoints);

    return {
      userId: account.userId,
      points: account.points,
      tier: account.tier,
      lifetimePoints: account.lifetimePoints,
      lifetimeSpent: account.lifetimeSpent,
      pointsToNextTier,
      tierBonus: this.getTierBonus(account.tier),
      recentTransactions: account.transactions,
      activeRewards: account.rewards,
    };
  }

  /**
   * Calculate points needed to reach next tier
   */
  private getPointsToNextTier(lifetimePoints: number): number | null {
    if (lifetimePoints >= 10000) return null; // Already at max tier
    if (lifetimePoints >= 5000) return 10000 - lifetimePoints; // Points to PLATINUM
    if (lifetimePoints >= 1000) return 5000 - lifetimePoints; // Points to GOLD
    return 1000 - lifetimePoints; // Points to SILVER
  }
}
