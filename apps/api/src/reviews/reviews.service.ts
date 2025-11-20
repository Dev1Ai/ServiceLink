import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async createReview(data: {
    jobId: string;
    raterUserId: string;
    rateeUserId: string;
    stars: number;
    comment?: string;
  }) {
    // Validate stars is between 1-5
    if (data.stars < 1 || data.stars > 5) {
      throw new BadRequestException('Stars must be between 1 and 5');
    }

    // Verify job exists and involves both users
    const job = await this.prisma.job.findUnique({
      where: { id: data.jobId },
      include: {
        assignment: {
          include: {
            provider: true,
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    // Verify rater is either customer or provider
    const isCustomerReview = job.customerId === data.raterUserId;
    const isProviderReview = job.assignment?.providerId === data.raterUserId;

    if (!isCustomerReview && !isProviderReview) {
      throw new BadRequestException('User is not authorized to review this job');
    }

    // Create review
    const review = await this.prisma.review.create({
      data: {
        jobId: data.jobId,
        raterUserId: data.raterUserId,
        rateeUserId: data.rateeUserId,
        stars: data.stars,
        comment: data.comment,
      },
    });

    // Update provider rating cache if the ratee is a provider
    await this.updateProviderRatingCache(data.rateeUserId);

    return review;
  }

  /**
   * Update the cached average rating and review count for a provider
   */
  private async updateProviderRatingCache(userId: string): Promise<void> {
    const provider = await this.prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider) return;

    const reviews = await this.prisma.review.findMany({
      where: { rateeUserId: userId },
      select: { stars: true },
    });

    const reviewCount = reviews.length;
    const averageRating = reviewCount > 0
      ? reviews.reduce((acc, r) => acc + r.stars, 0) / reviewCount
      : 0;

    await this.prisma.provider.update({
      where: { id: provider.id },
      data: {
        averageRating,
        reviewCount,
      },
    });
  }

  async getReviewsForJob(jobId: string) {
    return this.prisma.review.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getReviewsForUser(userId: string) {
    return this.prisma.review.findMany({
      where: { rateeUserId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAverageRatingForUser(userId: string): Promise<number> {
    const reviews = await this.prisma.review.findMany({
      where: { rateeUserId: userId },
      select: { stars: true },
    });

    if (reviews.length === 0) return 0;

    const sum = reviews.reduce((acc, review) => acc + review.stars, 0);
    return sum / reviews.length;
  }
}
