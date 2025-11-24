import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    review: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    job: {
      findUnique: jest.fn(),
    },
    provider: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createReview', () => {
    it('should create a review successfully', async () => {
      const reviewData = {
        jobId: 'job1',
        raterUserId: 'customer1',
        rateeUserId: 'provider1',
        stars: 5,
        comment: 'Great service!',
      };

      const mockJob = {
        id: 'job1',
        customerId: 'customer1',
        assignment: {
          providerId: 'provider1',
          provider: { id: 'provider1' },
        },
      };

      const mockReview = { id: 'review1', ...reviewData };
      const mockProvider = { id: 'provider1', userId: 'provider1' };

      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.review.create.mockResolvedValue(mockReview);
      mockPrismaService.provider.findUnique.mockResolvedValue(mockProvider);
      mockPrismaService.review.findMany.mockResolvedValue([{ stars: 5 }]);
      mockPrismaService.provider.update.mockResolvedValue({ ...mockProvider, averageRating: 5, reviewCount: 1 });

      const result = await service.createReview(reviewData);

      expect(result).toEqual(mockReview);
      expect(mockPrismaService.review.create).toHaveBeenCalledWith({
        data: reviewData,
      });
      expect(mockPrismaService.provider.update).toHaveBeenCalledWith({
        where: { id: 'provider1' },
        data: { averageRating: 5, reviewCount: 1 },
      });
    });

    it('should throw BadRequestException for invalid stars', async () => {
      const reviewData = {
        jobId: 'job1',
        raterUserId: 'customer1',
        rateeUserId: 'provider1',
        stars: 6,
      };

      await expect(service.createReview(reviewData)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if job not found', async () => {
      const reviewData = {
        jobId: 'job1',
        raterUserId: 'customer1',
        rateeUserId: 'provider1',
        stars: 5,
      };

      mockPrismaService.job.findUnique.mockResolvedValue(null);

      await expect(service.createReview(reviewData)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user not authorized', async () => {
      const reviewData = {
        jobId: 'job1',
        raterUserId: 'unauthorized',
        rateeUserId: 'provider1',
        stars: 5,
      };

      const mockJob = {
        id: 'job1',
        customerId: 'customer1',
        assignment: {
          providerId: 'provider1',
        },
      };

      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);

      await expect(service.createReview(reviewData)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAverageRatingForUser', () => {
    it('should calculate average rating correctly', async () => {
      const reviews = [{ stars: 5 }, { stars: 4 }, { stars: 3 }];

      mockPrismaService.review.findMany.mockResolvedValue(reviews);

      const result = await service.getAverageRatingForUser('user1');

      expect(result).toBe(4);
    });

    it('should return 0 if no reviews', async () => {
      mockPrismaService.review.findMany.mockResolvedValue([]);

      const result = await service.getAverageRatingForUser('user1');

      expect(result).toBe(0);
    });
  });

  describe('getReviewsForJob', () => {
    it('should return reviews for a specific job', async () => {
      const mockReviews = [
        {
          id: 'review1',
          jobId: 'job1',
          raterUserId: 'user1',
          rateeUserId: 'user2',
          stars: 5,
          comment: 'Excellent work',
          createdAt: new Date('2025-12-01'),
        },
        {
          id: 'review2',
          jobId: 'job1',
          raterUserId: 'user2',
          rateeUserId: 'user1',
          stars: 4,
          comment: 'Good communication',
          createdAt: new Date('2025-12-02'),
        },
      ];

      mockPrismaService.review.findMany.mockResolvedValue(mockReviews);

      const result = await service.getReviewsForJob('job1');

      expect(result).toEqual(mockReviews);
      expect(mockPrismaService.review.findMany).toHaveBeenCalledWith({
        where: { jobId: 'job1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array if no reviews for job', async () => {
      mockPrismaService.review.findMany.mockResolvedValue([]);

      const result = await service.getReviewsForJob('job1');

      expect(result).toEqual([]);
      expect(mockPrismaService.review.findMany).toHaveBeenCalledWith({
        where: { jobId: 'job1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should order reviews by createdAt descending', async () => {
      const mockReviews = [
        { id: 'review3', createdAt: new Date('2025-12-03') },
        { id: 'review2', createdAt: new Date('2025-12-02') },
        { id: 'review1', createdAt: new Date('2025-12-01') },
      ];

      mockPrismaService.review.findMany.mockResolvedValue(mockReviews);

      await service.getReviewsForJob('job1');

      expect(mockPrismaService.review.findMany).toHaveBeenCalledWith({
        where: { jobId: 'job1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getReviewsForUser', () => {
    it('should return all reviews for a user', async () => {
      const mockReviews = [
        {
          id: 'review1',
          jobId: 'job1',
          raterUserId: 'customer1',
          rateeUserId: 'provider1',
          stars: 5,
          comment: 'Great service',
          createdAt: new Date('2025-12-01'),
        },
        {
          id: 'review2',
          jobId: 'job2',
          raterUserId: 'customer2',
          rateeUserId: 'provider1',
          stars: 4,
          comment: 'Good job',
          createdAt: new Date('2025-12-02'),
        },
      ];

      mockPrismaService.review.findMany.mockResolvedValue(mockReviews);

      const result = await service.getReviewsForUser('provider1');

      expect(result).toEqual(mockReviews);
      expect(mockPrismaService.review.findMany).toHaveBeenCalledWith({
        where: { rateeUserId: 'provider1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array if user has no reviews', async () => {
      mockPrismaService.review.findMany.mockResolvedValue([]);

      const result = await service.getReviewsForUser('provider1');

      expect(result).toEqual([]);
    });

    it('should order reviews by createdAt descending', async () => {
      mockPrismaService.review.findMany.mockResolvedValue([]);

      await service.getReviewsForUser('provider1');

      expect(mockPrismaService.review.findMany).toHaveBeenCalledWith({
        where: { rateeUserId: 'provider1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('provider rating cache updates', () => {
    it('should update provider rating cache after creating review', async () => {
      const reviewData = {
        jobId: 'job1',
        raterUserId: 'customer1',
        rateeUserId: 'provider1',
        stars: 4,
        comment: 'Good work',
      };

      const mockJob = {
        id: 'job1',
        customerId: 'customer1',
        assignment: {
          providerId: 'provider1',
          provider: { id: 'provider1' },
        },
      };

      const mockProvider = { id: 'provider1', userId: 'provider1' };
      const existingReviews = [{ stars: 5 }, { stars: 3 }];

      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.review.create.mockResolvedValue({ id: 'review1', ...reviewData });
      mockPrismaService.provider.findUnique.mockResolvedValue(mockProvider);
      mockPrismaService.review.findMany.mockResolvedValue([...existingReviews, { stars: 4 }]);

      await service.createReview(reviewData);

      expect(mockPrismaService.provider.update).toHaveBeenCalledWith({
        where: { id: 'provider1' },
        data: {
          averageRating: 4, // (5 + 3 + 4) / 3 = 4
          reviewCount: 3,
        },
      });
    });

    it('should not update cache if ratee is not a provider', async () => {
      const reviewData = {
        jobId: 'job1',
        raterUserId: 'provider1',
        rateeUserId: 'customer1',
        stars: 5,
      };

      const mockJob = {
        id: 'job1',
        customerId: 'customer1',
        assignment: {
          providerId: 'provider1',
          provider: { id: 'provider1' },
        },
      };

      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.review.create.mockResolvedValue({ id: 'review1', ...reviewData });
      mockPrismaService.provider.findUnique.mockResolvedValue(null); // Customer is not a provider

      await service.createReview(reviewData);

      expect(mockPrismaService.provider.update).not.toHaveBeenCalled();
    });

    it('should set averageRating to 0 and reviewCount to 0 for provider with no reviews', async () => {
      const reviewData = {
        jobId: 'job1',
        raterUserId: 'customer1',
        rateeUserId: 'provider1',
        stars: 5,
      };

      const mockJob = {
        id: 'job1',
        customerId: 'customer1',
        assignment: {
          providerId: 'provider1',
          provider: { id: 'provider1' },
        },
      };

      const mockProvider = { id: 'provider1', userId: 'provider1' };

      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.review.create.mockResolvedValue({ id: 'review1', ...reviewData });
      mockPrismaService.provider.findUnique.mockResolvedValue(mockProvider);
      mockPrismaService.review.findMany.mockResolvedValue([]); // No reviews found

      await service.createReview(reviewData);

      expect(mockPrismaService.provider.update).toHaveBeenCalledWith({
        where: { id: 'provider1' },
        data: {
          averageRating: 0,
          reviewCount: 0,
        },
      });
    });

    it('should correctly calculate average with multiple reviews', async () => {
      const reviewData = {
        jobId: 'job1',
        raterUserId: 'customer1',
        rateeUserId: 'provider1',
        stars: 3,
      };

      const mockJob = {
        id: 'job1',
        customerId: 'customer1',
        assignment: {
          providerId: 'provider1',
          provider: { id: 'provider1' },
        },
      };

      const mockProvider = { id: 'provider1', userId: 'provider1' };
      const existingReviews = [
        { stars: 5 },
        { stars: 4 },
        { stars: 5 },
        { stars: 2 },
        { stars: 3 },
      ];

      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.review.create.mockResolvedValue({ id: 'review1', ...reviewData });
      mockPrismaService.provider.findUnique.mockResolvedValue(mockProvider);
      mockPrismaService.review.findMany.mockResolvedValue(existingReviews);

      await service.createReview(reviewData);

      expect(mockPrismaService.provider.update).toHaveBeenCalledWith({
        where: { id: 'provider1' },
        data: {
          averageRating: 3.8, // (5 + 4 + 5 + 2 + 3) / 5 = 3.8
          reviewCount: 5,
        },
      });
    });
  });
});
