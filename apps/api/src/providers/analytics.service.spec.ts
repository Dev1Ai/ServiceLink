import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    assignment: {
      findMany: jest.fn(),
    },
    provider: {
      findUnique: jest.fn(),
    },
    review: {
      findMany: jest.fn(),
    },
    quote: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProviderAnalytics', () => {
    it('should return analytics with no jobs', async () => {
      mockPrismaService.assignment.findMany.mockResolvedValue([]);
      mockPrismaService.provider.findUnique.mockResolvedValue({ userId: 'user1' });
      mockPrismaService.review.findMany.mockResolvedValue([]);
      mockPrismaService.quote.findMany.mockResolvedValue([]);

      const result = await service.getProviderAnalytics('provider1');

      expect(result).toEqual({
        totalJobs: 0,
        completedJobs: 0,
        activeJobs: 0,
        totalRevenue: 0,
        averageRating: 0,
        reviewCount: 0,
        responseTime: 2.5,
        acceptanceRate: 0,
        completionRate: 0,
      });
    });

    it('should calculate correct metrics with multiple jobs', async () => {
      const mockAssignments = [
        {
          id: 'a1',
          status: 'customer_verified',
          job: { id: 'j1', title: 'Plumbing', quotes: [{ id: 'q1', total: 10000, status: 'accepted' }] },
        },
        {
          id: 'a2',
          status: 'customer_verified',
          job: { id: 'j2', title: 'Electrical', quotes: [{ id: 'q2', total: 15000, status: 'accepted' }] },
        },
        {
          id: 'a3',
          status: 'scheduled',
          job: { id: 'j3', title: 'Carpentry', quotes: [{ id: 'q3', total: 20000, status: 'accepted' }] },
        },
        {
          id: 'a4',
          status: 'provider_rejected',
          job: { id: 'j4', title: 'Painting', quotes: [] },
        },
      ];

      const mockReviews = [
        { id: 'r1', stars: 5, rateeUserId: 'user1' },
        { id: 'r2', stars: 4, rateeUserId: 'user1' },
        { id: 'r3', stars: 5, rateeUserId: 'user1' },
      ];

      const mockQuotes = [
        { id: 'q1', status: 'accepted', providerId: 'provider1' },
        { id: 'q2', status: 'accepted', providerId: 'provider1' },
        { id: 'q3', status: 'accepted', providerId: 'provider1' },
        { id: 'q4', status: 'pending', providerId: 'provider1' },
        { id: 'q5', status: 'rejected', providerId: 'provider1' },
      ];

      mockPrismaService.assignment.findMany.mockResolvedValue(mockAssignments);
      mockPrismaService.provider.findUnique.mockResolvedValue({ userId: 'user1' });
      mockPrismaService.review.findMany.mockResolvedValue(mockReviews);
      mockPrismaService.quote.findMany.mockResolvedValue(mockQuotes);

      const result = await service.getProviderAnalytics('provider1');

      expect(result.totalJobs).toBe(4);
      expect(result.completedJobs).toBe(2);
      expect(result.activeJobs).toBe(1); // scheduled, not completed or rejected
      expect(result.totalRevenue).toBe(25000); // 10000 + 15000 from completed jobs
      expect(result.averageRating).toBe(4.666666666666667); // (5+4+5)/3
      expect(result.reviewCount).toBe(3);
      expect(result.acceptanceRate).toBe(60); // 3 accepted / 5 total quotes * 100
      expect(result.completionRate).toBe(66.66666666666666); // 2 completed / (2 completed + 1 active) * 100
    });

    it('should handle missing quote data gracefully', async () => {
      const mockAssignments = [
        {
          id: 'a1',
          status: 'customer_verified',
          job: { id: 'j1', title: 'Service', quotes: [] }, // No quotes
        },
      ];

      mockPrismaService.assignment.findMany.mockResolvedValue(mockAssignments);
      mockPrismaService.provider.findUnique.mockResolvedValue({ userId: 'user1' });
      mockPrismaService.review.findMany.mockResolvedValue([]);
      mockPrismaService.quote.findMany.mockResolvedValue([]);

      const result = await service.getProviderAnalytics('provider1');

      expect(result.totalRevenue).toBe(0); // Should handle missing quote gracefully
      expect(result.completedJobs).toBe(1);
    });

    it('should calculate acceptance rate with no quotes', async () => {
      mockPrismaService.assignment.findMany.mockResolvedValue([]);
      mockPrismaService.provider.findUnique.mockResolvedValue({ userId: 'user1' });
      mockPrismaService.review.findMany.mockResolvedValue([]);
      mockPrismaService.quote.findMany.mockResolvedValue([]);

      const result = await service.getProviderAnalytics('provider1');

      expect(result.acceptanceRate).toBe(0);
    });

    it('should calculate completion rate with no active or completed jobs', async () => {
      const mockAssignments = [
        {
          id: 'a1',
          status: 'provider_rejected',
          job: { id: 'j1', title: 'Service', quotes: [] },
        },
      ];

      mockPrismaService.assignment.findMany.mockResolvedValue(mockAssignments);
      mockPrismaService.provider.findUnique.mockResolvedValue({ userId: 'user1' });
      mockPrismaService.review.findMany.mockResolvedValue([]);
      mockPrismaService.quote.findMany.mockResolvedValue([]);

      const result = await service.getProviderAnalytics('provider1');

      expect(result.completionRate).toBe(0);
      expect(result.activeJobs).toBe(0);
      expect(result.completedJobs).toBe(0);
    });
  });

  describe('getProviderPerformanceMetrics', () => {
    const mockDate = new Date('2025-11-17T12:00:00Z');

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return performance metrics for month period', async () => {
      const mockAssignments = [
        {
          id: 'a1',
          status: 'customer_verified',
          createdAt: new Date('2025-11-10'),
          job: { id: 'j1', title: 'Plumbing', quotes: [{ id: 'q1', total: 10000, status: 'accepted' }] },
        },
        {
          id: 'a2',
          status: 'scheduled',
          createdAt: new Date('2025-11-12'),
          job: { id: 'j2', title: 'Electrical', quotes: [{ id: 'q2', total: 15000, status: 'accepted' }] },
        },
        {
          id: 'a3',
          status: 'pending_schedule',
          createdAt: new Date('2025-11-15'),
          job: { id: 'j3', title: 'Carpentry', quotes: [{ id: 'q3', total: 20000, status: 'accepted' }] },
        },
        {
          id: 'a4',
          status: 'provider_rejected',
          createdAt: new Date('2025-11-16'),
          job: { id: 'j4', title: 'Painting', quotes: [] },
        },
      ];

      const mockReviews = [
        { id: 'r1', stars: 5, rateeUserId: 'user1', createdAt: new Date('2025-11-11') },
        { id: 'r2', stars: 4, rateeUserId: 'user1', createdAt: new Date('2025-11-13') },
        { id: 'r3', stars: 3, rateeUserId: 'user1', createdAt: new Date('2025-11-14') },
      ];

      mockPrismaService.assignment.findMany.mockResolvedValue(mockAssignments);
      mockPrismaService.provider.findUnique.mockResolvedValue({ userId: 'user1' });
      mockPrismaService.review.findMany.mockResolvedValue(mockReviews);

      const result = await service.getProviderPerformanceMetrics('provider1', 'month');

      expect(result.period).toBe('month');
      expect(result.jobsByStatus.pending).toBe(1);
      expect(result.jobsByStatus.active).toBe(1);
      expect(result.jobsByStatus.completed).toBe(1);
      expect(result.jobsByStatus.rejected).toBe(1);
      expect(result.revenueByMonth).toHaveLength(6);
      expect(result.customerSatisfaction.averageRating).toBe(4);
      expect(result.customerSatisfaction.totalReviews).toBe(3);
      expect(result.customerSatisfaction.ratingDistribution).toEqual({
        1: 0,
        2: 0,
        3: 1,
        4: 1,
        5: 1,
      });
    });

    it('should calculate top services by revenue', async () => {
      const mockAssignments = [
        {
          id: 'a1',
          status: 'customer_verified',
          createdAt: new Date('2025-11-10'),
          job: { id: 'j1', title: 'Plumbing', quotes: [{ id: 'q1', total: 30000, status: 'accepted' }] },
        },
        {
          id: 'a2',
          status: 'customer_verified',
          createdAt: new Date('2025-11-11'),
          job: { id: 'j2', title: 'Plumbing', quotes: [{ id: 'q2', total: 25000, status: 'accepted' }] },
        },
        {
          id: 'a3',
          status: 'customer_verified',
          createdAt: new Date('2025-11-12'),
          job: { id: 'j3', title: 'Electrical', quotes: [{ id: 'q3', total: 40000, status: 'accepted' }] },
        },
        {
          id: 'a4',
          status: 'scheduled',
          createdAt: new Date('2025-11-13'),
          job: { id: 'j4', title: 'Carpentry', quotes: [{ id: 'q4', total: 15000, status: 'accepted' }] },
        },
      ];

      mockPrismaService.assignment.findMany.mockResolvedValue(mockAssignments);
      mockPrismaService.provider.findUnique.mockResolvedValue({ userId: 'user1' });
      mockPrismaService.review.findMany.mockResolvedValue([]);

      const result = await service.getProviderPerformanceMetrics('provider1', 'month');

      expect(result.topServices).toHaveLength(3);
      expect(result.topServices[0]).toEqual({ service: 'Plumbing', count: 2, revenue: 55000 });
      expect(result.topServices[1]).toEqual({ service: 'Electrical', count: 1, revenue: 40000 });
      expect(result.topServices[2]).toEqual({ service: 'Carpentry', count: 1, revenue: 0 }); // Not completed
    });

    it('should limit top services to 5', async () => {
      const mockAssignments = [
        { id: 'a1', status: 'customer_verified', createdAt: new Date('2025-11-10'), job: { title: 'Service A', quotes: [{ total: 10000, status: 'accepted' }] } },
        { id: 'a2', status: 'customer_verified', createdAt: new Date('2025-11-10'), job: { title: 'Service B', quotes: [{ total: 9000, status: 'accepted' }] } },
        { id: 'a3', status: 'customer_verified', createdAt: new Date('2025-11-10'), job: { title: 'Service C', quotes: [{ total: 8000, status: 'accepted' }] } },
        { id: 'a4', status: 'customer_verified', createdAt: new Date('2025-11-10'), job: { title: 'Service D', quotes: [{ total: 7000, status: 'accepted' }] } },
        { id: 'a5', status: 'customer_verified', createdAt: new Date('2025-11-10'), job: { title: 'Service E', quotes: [{ total: 6000, status: 'accepted' }] } },
        { id: 'a6', status: 'customer_verified', createdAt: new Date('2025-11-10'), job: { title: 'Service F', quotes: [{ total: 5000, status: 'accepted' }] } },
        { id: 'a7', status: 'customer_verified', createdAt: new Date('2025-11-10'), job: { title: 'Service G', quotes: [{ total: 4000, status: 'accepted' }] } },
      ];

      mockPrismaService.assignment.findMany.mockResolvedValue(mockAssignments);
      mockPrismaService.provider.findUnique.mockResolvedValue({ userId: 'user1' });
      mockPrismaService.review.findMany.mockResolvedValue([]);

      const result = await service.getProviderPerformanceMetrics('provider1', 'all');

      expect(result.topServices).toHaveLength(5);
      expect(result.topServices[0].service).toBe('Service A');
      expect(result.topServices[4].service).toBe('Service E');
    });

    it('should handle "Other" for jobs with no title', async () => {
      const mockAssignments = [
        {
          id: 'a1',
          status: 'customer_verified',
          createdAt: new Date('2025-11-10'),
          job: { id: 'j1', title: null, quotes: [{ id: 'q1', total: 5000, status: 'accepted' }] },
        },
      ];

      mockPrismaService.assignment.findMany.mockResolvedValue(mockAssignments);
      mockPrismaService.provider.findUnique.mockResolvedValue({ userId: 'user1' });
      mockPrismaService.review.findMany.mockResolvedValue([]);

      const result = await service.getProviderPerformanceMetrics('provider1', 'week');

      expect(result.topServices[0].service).toBe('Other');
      expect(result.topServices[0].revenue).toBe(5000);
    });

    it('should filter by week period correctly', async () => {
      const weekAgo = new Date(mockDate);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const twoWeeksAgo = new Date(mockDate);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      const mockAssignments = [
        {
          id: 'a1',
          status: 'customer_verified',
          createdAt: new Date(mockDate.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          job: { title: 'Recent', quotes: [{ total: 10000, status: 'accepted' }] },
        },
      ];

      mockPrismaService.assignment.findMany.mockResolvedValue(mockAssignments);
      mockPrismaService.provider.findUnique.mockResolvedValue({ userId: 'user1' });
      mockPrismaService.review.findMany.mockResolvedValue([]);

      const result = await service.getProviderPerformanceMetrics('provider1', 'week');

      expect(result.period).toBe('week');
      expect(result.jobsByStatus.completed).toBe(1);
    });

    it('should handle empty datasets gracefully', async () => {
      mockPrismaService.assignment.findMany.mockResolvedValue([]);
      mockPrismaService.provider.findUnique.mockResolvedValue({ userId: 'user1' });
      mockPrismaService.review.findMany.mockResolvedValue([]);

      const result = await service.getProviderPerformanceMetrics('provider1', 'all');

      expect(result.jobsByStatus).toEqual({ pending: 0, active: 0, completed: 0, rejected: 0 });
      expect(result.revenueByMonth).toHaveLength(6);
      expect(result.topServices).toEqual([]);
      expect(result.customerSatisfaction).toEqual({
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      });
    });

    it('should filter by year period correctly', async () => {
      const mockAssignments = [
        {
          id: 'a1',
          status: 'customer_verified',
          createdAt: new Date('2025-01-15'),
          job: { title: 'Recent', quotes: [{ total: 10000, status: 'accepted' }] },
        },
      ];

      mockPrismaService.assignment.findMany.mockResolvedValue(mockAssignments);
      mockPrismaService.provider.findUnique.mockResolvedValue({ userId: 'user1' });
      mockPrismaService.review.findMany.mockResolvedValue([]);

      const result = await service.getProviderPerformanceMetrics('provider1', 'year');

      expect(result.period).toBe('year');
      expect(result.jobsByStatus.completed).toBe(1);
    });

    it('should handle "all" period with old data', async () => {
      const mockAssignments = [
        {
          id: 'a1',
          status: 'customer_verified',
          createdAt: new Date('2020-01-01'),
          job: { title: 'Old Job', quotes: [{ total: 5000, status: 'accepted' }] },
        },
      ];

      mockPrismaService.assignment.findMany.mockResolvedValue(mockAssignments);
      mockPrismaService.provider.findUnique.mockResolvedValue({ userId: 'user1' });
      mockPrismaService.review.findMany.mockResolvedValue([]);

      const result = await service.getProviderPerformanceMetrics('provider1', 'all');

      expect(result.period).toBe('all');
      expect(result.jobsByStatus.completed).toBe(1);
    });

    it('should handle schedule_proposed_customer status as active', async () => {
      const mockAssignments = [
        {
          id: 'a1',
          status: 'schedule_proposed_customer',
          createdAt: new Date('2025-11-10'),
          job: { title: 'Service', quotes: [{ total: 10000, status: 'accepted' }] },
        },
      ];

      mockPrismaService.assignment.findMany.mockResolvedValue(mockAssignments);
      mockPrismaService.provider.findUnique.mockResolvedValue({ userId: 'user1' });
      mockPrismaService.review.findMany.mockResolvedValue([]);

      const result = await service.getProviderPerformanceMetrics('provider1', 'month');

      expect(result.jobsByStatus.active).toBe(1);
      expect(result.jobsByStatus.pending).toBe(0);
    });

    it('should handle schedule_proposed_provider status as active', async () => {
      const mockAssignments = [
        {
          id: 'a1',
          status: 'schedule_proposed_provider',
          createdAt: new Date('2025-11-10'),
          job: { title: 'Service', quotes: [{ total: 10000, status: 'accepted' }] },
        },
      ];

      mockPrismaService.assignment.findMany.mockResolvedValue(mockAssignments);
      mockPrismaService.provider.findUnique.mockResolvedValue({ userId: 'user1' });
      mockPrismaService.review.findMany.mockResolvedValue([]);

      const result = await service.getProviderPerformanceMetrics('provider1', 'month');

      expect(result.jobsByStatus.active).toBe(1);
    });

    it('should calculate revenue by month with data across multiple months', async () => {
      const mockAssignments = [
        {
          id: 'a1',
          status: 'customer_verified',
          createdAt: new Date('2025-11-10'),
          job: { title: 'Nov Job', quotes: [{ total: 10000, status: 'accepted' }] },
        },
        {
          id: 'a2',
          status: 'customer_verified',
          createdAt: new Date('2025-10-15'),
          job: { title: 'Oct Job', quotes: [{ total: 20000, status: 'accepted' }] },
        },
        {
          id: 'a3',
          status: 'customer_verified',
          createdAt: new Date('2025-09-20'),
          job: { title: 'Sep Job', quotes: [{ total: 15000, status: 'accepted' }] },
        },
      ];

      mockPrismaService.assignment.findMany.mockResolvedValue(mockAssignments);
      mockPrismaService.provider.findUnique.mockResolvedValue({ userId: 'user1' });
      mockPrismaService.review.findMany.mockResolvedValue([]);

      const result = await service.getProviderPerformanceMetrics('provider1', 'year');

      expect(result.revenueByMonth).toHaveLength(6);
      const novRevenue = result.revenueByMonth.find((m) => m.month.includes('Nov'));
      const octRevenue = result.revenueByMonth.find((m) => m.month.includes('Oct'));
      const sepRevenue = result.revenueByMonth.find((m) => m.month.includes('Sep'));

      expect(novRevenue?.revenue).toBe(10000);
      expect(octRevenue?.revenue).toBe(20000);
      expect(sepRevenue?.revenue).toBe(15000);
    });

    it('should handle rating distribution with all 5-star reviews', async () => {
      const mockReviews = [
        { id: 'r1', stars: 5, rateeUserId: 'user1', createdAt: new Date('2025-11-11') },
        { id: 'r2', stars: 5, rateeUserId: 'user1', createdAt: new Date('2025-11-12') },
        { id: 'r3', stars: 5, rateeUserId: 'user1', createdAt: new Date('2025-11-13') },
      ];

      mockPrismaService.assignment.findMany.mockResolvedValue([]);
      mockPrismaService.provider.findUnique.mockResolvedValue({ userId: 'user1' });
      mockPrismaService.review.findMany.mockResolvedValue(mockReviews);

      const result = await service.getProviderPerformanceMetrics('provider1', 'month');

      expect(result.customerSatisfaction.averageRating).toBe(5);
      expect(result.customerSatisfaction.ratingDistribution).toEqual({
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 3,
      });
    });

    it('should handle rating distribution with all low ratings', async () => {
      const mockReviews = [
        { id: 'r1', stars: 1, rateeUserId: 'user1', createdAt: new Date('2025-11-11') },
        { id: 'r2', stars: 2, rateeUserId: 'user1', createdAt: new Date('2025-11-12') },
        { id: 'r3', stars: 1, rateeUserId: 'user1', createdAt: new Date('2025-11-13') },
      ];

      mockPrismaService.assignment.findMany.mockResolvedValue([]);
      mockPrismaService.provider.findUnique.mockResolvedValue({ userId: 'user1' });
      mockPrismaService.review.findMany.mockResolvedValue(mockReviews);

      const result = await service.getProviderPerformanceMetrics('provider1', 'month');

      expect(result.customerSatisfaction.averageRating).toBeCloseTo(1.33, 2);
      expect(result.customerSatisfaction.ratingDistribution).toEqual({
        1: 2,
        2: 1,
        3: 0,
        4: 0,
        5: 0,
      });
    });

    it('should handle jobs with missing quote data in revenue calculation', async () => {
      const mockAssignments = [
        {
          id: 'a1',
          status: 'customer_verified',
          createdAt: new Date('2025-11-10'),
          job: { title: 'Service A', quotes: [] }, // No quotes
        },
        {
          id: 'a2',
          status: 'customer_verified',
          createdAt: new Date('2025-11-11'),
          job: { title: 'Service B', quotes: [{ total: 10000, status: 'accepted' }] },
        },
      ];

      mockPrismaService.assignment.findMany.mockResolvedValue(mockAssignments);
      mockPrismaService.provider.findUnique.mockResolvedValue({ userId: 'user1' });
      mockPrismaService.review.findMany.mockResolvedValue([]);

      const result = await service.getProviderPerformanceMetrics('provider1', 'month');

      expect(result.topServices[0].service).toBe('Service B');
      expect(result.topServices[0].revenue).toBe(10000);
      expect(result.topServices[1].service).toBe('Service A');
      expect(result.topServices[1].revenue).toBe(0);
    });

    it('should aggregate duplicate services correctly', async () => {
      const mockAssignments = [
        {
          id: 'a1',
          status: 'customer_verified',
          createdAt: new Date('2025-11-10'),
          job: { title: 'Plumbing', quotes: [{ total: 10000, status: 'accepted' }] },
        },
        {
          id: 'a2',
          status: 'customer_verified',
          createdAt: new Date('2025-11-11'),
          job: { title: 'Plumbing', quotes: [{ total: 15000, status: 'accepted' }] },
        },
        {
          id: 'a3',
          status: 'customer_verified',
          createdAt: new Date('2025-11-12'),
          job: { title: 'Plumbing', quotes: [{ total: 20000, status: 'accepted' }] },
        },
      ];

      mockPrismaService.assignment.findMany.mockResolvedValue(mockAssignments);
      mockPrismaService.provider.findUnique.mockResolvedValue({ userId: 'user1' });
      mockPrismaService.review.findMany.mockResolvedValue([]);

      const result = await service.getProviderPerformanceMetrics('provider1', 'month');

      expect(result.topServices).toHaveLength(1);
      expect(result.topServices[0].service).toBe('Plumbing');
      expect(result.topServices[0].count).toBe(3);
      expect(result.topServices[0].revenue).toBe(45000);
    });

    it('should handle mixed completed and non-completed assignments in service aggregation', async () => {
      const mockAssignments = [
        {
          id: 'a1',
          status: 'customer_verified',
          createdAt: new Date('2025-11-10'),
          job: { title: 'Plumbing', quotes: [{ total: 10000, status: 'accepted' }] },
        },
        {
          id: 'a2',
          status: 'scheduled',
          createdAt: new Date('2025-11-11'),
          job: { title: 'Plumbing', quotes: [{ total: 15000, status: 'accepted' }] },
        },
      ];

      mockPrismaService.assignment.findMany.mockResolvedValue(mockAssignments);
      mockPrismaService.provider.findUnique.mockResolvedValue({ userId: 'user1' });
      mockPrismaService.review.findMany.mockResolvedValue([]);

      const result = await service.getProviderPerformanceMetrics('provider1', 'month');

      expect(result.topServices[0].service).toBe('Plumbing');
      expect(result.topServices[0].count).toBe(2);
      expect(result.topServices[0].revenue).toBe(10000); // Only completed jobs count toward revenue
    });
  });

  describe('getProviderAnalytics edge cases', () => {
    it('should handle provider with null userId', async () => {
      mockPrismaService.assignment.findMany.mockResolvedValue([]);
      mockPrismaService.provider.findUnique.mockResolvedValue({ userId: null });
      mockPrismaService.review.findMany.mockResolvedValue([]);
      mockPrismaService.quote.findMany.mockResolvedValue([]);

      const result = await service.getProviderAnalytics('provider1');

      expect(result.reviewCount).toBe(0);
      expect(result.averageRating).toBe(0);
    });

    it('should calculate acceptance rate with all accepted quotes', async () => {
      const mockQuotes = [
        { id: 'q1', status: 'accepted', providerId: 'provider1' },
        { id: 'q2', status: 'accepted', providerId: 'provider1' },
        { id: 'q3', status: 'accepted', providerId: 'provider1' },
      ];

      mockPrismaService.assignment.findMany.mockResolvedValue([]);
      mockPrismaService.provider.findUnique.mockResolvedValue({ userId: 'user1' });
      mockPrismaService.review.findMany.mockResolvedValue([]);
      mockPrismaService.quote.findMany.mockResolvedValue(mockQuotes);

      const result = await service.getProviderAnalytics('provider1');

      expect(result.acceptanceRate).toBe(100);
    });

    it('should calculate acceptance rate with all rejected quotes', async () => {
      const mockQuotes = [
        { id: 'q1', status: 'rejected', providerId: 'provider1' },
        { id: 'q2', status: 'rejected', providerId: 'provider1' },
      ];

      mockPrismaService.assignment.findMany.mockResolvedValue([]);
      mockPrismaService.provider.findUnique.mockResolvedValue({ userId: 'user1' });
      mockPrismaService.review.findMany.mockResolvedValue([]);
      mockPrismaService.quote.findMany.mockResolvedValue(mockQuotes);

      const result = await service.getProviderAnalytics('provider1');

      expect(result.acceptanceRate).toBe(0);
    });

    it('should calculate completion rate with all completed jobs', async () => {
      const mockAssignments = [
        {
          id: 'a1',
          status: 'customer_verified',
          job: { id: 'j1', title: 'Service', quotes: [{ total: 10000, status: 'accepted' }] },
        },
        {
          id: 'a2',
          status: 'customer_verified',
          job: { id: 'j2', title: 'Service', quotes: [{ total: 15000, status: 'accepted' }] },
        },
      ];

      mockPrismaService.assignment.findMany.mockResolvedValue(mockAssignments);
      mockPrismaService.provider.findUnique.mockResolvedValue({ userId: 'user1' });
      mockPrismaService.review.findMany.mockResolvedValue([]);
      mockPrismaService.quote.findMany.mockResolvedValue([]);

      const result = await service.getProviderAnalytics('provider1');

      expect(result.completionRate).toBe(100);
      expect(result.activeJobs).toBe(0);
      expect(result.completedJobs).toBe(2);
    });

    it('should handle average rating with single review', async () => {
      const mockReviews = [{ id: 'r1', stars: 4, rateeUserId: 'user1' }];

      mockPrismaService.assignment.findMany.mockResolvedValue([]);
      mockPrismaService.provider.findUnique.mockResolvedValue({ userId: 'user1' });
      mockPrismaService.review.findMany.mockResolvedValue(mockReviews);
      mockPrismaService.quote.findMany.mockResolvedValue([]);

      const result = await service.getProviderAnalytics('provider1');

      expect(result.averageRating).toBe(4);
      expect(result.reviewCount).toBe(1);
    });
  });
});
