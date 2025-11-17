import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type ProviderAnalytics = {
  totalJobs: number;
  completedJobs: number;
  activeJobs: number;
  totalRevenue: number;
  averageRating: number;
  reviewCount: number;
  responseTime: number; // in hours
  acceptanceRate: number; // percentage
  completionRate: number; // percentage
};

export type ProviderPerformanceMetrics = {
  period: 'week' | 'month' | 'year' | 'all';
  jobsByStatus: {
    pending: number;
    active: number;
    completed: number;
    rejected: number;
  };
  revenueByMonth: Array<{ month: string; revenue: number }>;
  topServices: Array<{ service: string; count: number; revenue: number }>;
  customerSatisfaction: {
    averageRating: number;
    totalReviews: number;
    ratingDistribution: { [rating: number]: number };
  };
};

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getProviderAnalytics(providerId: string): Promise<ProviderAnalytics> {
    // Get all assignments for this provider with quotes
    const assignments = await this.prisma.assignment.findMany({
      where: { providerId },
      include: {
        job: {
          include: {
            quotes: {
              where: { providerId, status: 'accepted' },
              take: 1,
            },
          },
        },
      },
    });

    const totalJobs = assignments.length;
    const completedJobs = assignments.filter((a) => a.status === 'customer_verified').length;
    const activeJobs = assignments.filter(
      (a) => a.status !== 'customer_verified' && a.status !== 'provider_rejected',
    ).length;

    // Calculate total revenue from completed jobs
    const totalRevenue = assignments
      .filter((a) => a.status === 'customer_verified')
      .reduce((sum, a) => sum + (a.job.quotes[0]?.total || 0), 0);

    // Get average rating from reviews
    const provider = await this.prisma.provider.findUnique({ where: { id: providerId }, select: { userId: true } });
    const reviews = await this.prisma.review.findMany({
      where: { rateeUserId: provider?.userId },
    });
    const averageRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.stars, 0) / reviews.length : 0;
    const reviewCount = reviews.length;

    // Calculate acceptance rate (accepted quotes / total quotes)
    const quotes = await this.prisma.quote.findMany({
      where: { providerId },
    });
    const acceptedQuotes = quotes.filter((q) => q.status === 'accepted').length;
    const acceptanceRate = quotes.length > 0 ? (acceptedQuotes / quotes.length) * 100 : 0;

    // Calculate completion rate (completed jobs / active + completed jobs)
    const totalActiveAndCompleted = completedJobs + activeJobs;
    const completionRate = totalActiveAndCompleted > 0 ? (completedJobs / totalActiveAndCompleted) * 100 : 0;

    // Calculate average response time (time from quote created to quote submitted)
    // For simplicity, using a placeholder value
    const responseTime = 2.5; // hours

    return {
      totalJobs,
      completedJobs,
      activeJobs,
      totalRevenue,
      averageRating,
      reviewCount,
      responseTime,
      acceptanceRate,
      completionRate,
    };
  }

  async getProviderPerformanceMetrics(
    providerId: string,
    period: 'week' | 'month' | 'year' | 'all' = 'month',
  ): Promise<ProviderPerformanceMetrics> {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0); // All time
    }

    // Get assignments within period
    const assignments = await this.prisma.assignment.findMany({
      where: {
        providerId,
        createdAt: { gte: startDate },
      },
      include: {
        job: {
          include: {
            quotes: {
              where: { providerId, status: 'accepted' },
              take: 1,
            },
          },
        },
      },
    });

    // Jobs by status
    const jobsByStatus = {
      pending: assignments.filter((a) => a.status === 'pending_schedule').length,
      active: assignments.filter((a) =>
        ['schedule_proposed_customer', 'schedule_proposed_provider', 'scheduled'].includes(a.status || ''),
      ).length,
      completed: assignments.filter((a) => a.status === 'customer_verified').length,
      rejected: assignments.filter((a) => a.status === 'provider_rejected').length,
    };

    // Revenue by month (last 6 months)
    const revenueByMonth: Array<{ month: string; revenue: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

      const monthAssignments = assignments.filter(
        (a) =>
          a.status === 'customer_verified' &&
          a.createdAt &&
          a.createdAt >= monthStart &&
          a.createdAt <= monthEnd,
      );

      const revenue = monthAssignments.reduce((sum, a) => sum + (a.job.quotes[0]?.total || 0), 0);

      revenueByMonth.push({
        month: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        revenue,
      });
    }

    // Top services by job title (simplified - no category in schema)
    const serviceMap = new Map<string, { count: number; revenue: number }>();
    assignments.forEach((a) => {
      const service = a.job?.title || 'Other';
      const current = serviceMap.get(service) || { count: 0, revenue: 0 };
      serviceMap.set(service, {
        count: current.count + 1,
        revenue: current.revenue + (a.status === 'customer_verified' ? a.job.quotes[0]?.total || 0 : 0),
      });
    });

    const topServices = Array.from(serviceMap.entries())
      .map(([service, data]) => ({ service, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Customer satisfaction metrics
    const provider = await this.prisma.provider.findUnique({ where: { id: providerId }, select: { userId: true } });
    const reviews = await this.prisma.review.findMany({
      where: { rateeUserId: provider?.userId, createdAt: { gte: startDate } },
    });

    const ratingDistribution: { [rating: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((r) => {
      ratingDistribution[r.stars] = (ratingDistribution[r.stars] || 0) + 1;
    });

    const averageRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.stars, 0) / reviews.length : 0;

    return {
      period,
      jobsByStatus,
      revenueByMonth,
      topServices,
      customerSatisfaction: {
        averageRating,
        totalReviews: reviews.length,
        ratingDistribution,
      },
    };
  }
}
