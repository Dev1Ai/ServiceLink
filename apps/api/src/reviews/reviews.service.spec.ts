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
});
