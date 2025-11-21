import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';

describe('ReviewsController', () => {
  let controller: ReviewsController;
  let reviewsService: ReviewsService;

  const mockReviewsService = {
    createReview: jest.fn(),
    getReviewsForJob: jest.fn(),
    getReviewsForUser: jest.fn(),
    getAverageRatingForUser: jest.fn(),
  };

  const mockJwtAuthGuard = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const request = context.switchToHttp().getRequest();
      request.user = { userId: 'user-123', email: 'test@example.com', role: 'CUSTOMER' };
      return true;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        {
          provide: ReviewsService,
          useValue: mockReviewsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    controller = module.get<ReviewsController>(ReviewsController);
    reviewsService = module.get<ReviewsService>(ReviewsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createReview', () => {
    const mockRequest = {
      user: {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'CUSTOMER',
      },
    } as any;

    const reviewBody = {
      jobId: 'job-456',
      rateeUserId: 'provider-789',
      stars: 5,
      comment: 'Excellent service!',
    };

    const mockReview = {
      id: 'review-123',
      jobId: 'job-456',
      raterUserId: 'user-123',
      rateeUserId: 'provider-789',
      stars: 5,
      comment: 'Excellent service!',
      createdAt: new Date('2025-01-15'),
    };

    it('should call reviewsService.createReview with correct parameters', async () => {
      mockReviewsService.createReview.mockResolvedValue(mockReview);

      const result = await controller.createReview(mockRequest, reviewBody);

      expect(reviewsService.createReview).toHaveBeenCalledWith({
        jobId: 'job-456',
        raterUserId: 'user-123',
        rateeUserId: 'provider-789',
        stars: 5,
        comment: 'Excellent service!',
      });
      expect(result).toEqual(mockReview);
    });

    it('should return created review with all fields', async () => {
      mockReviewsService.createReview.mockResolvedValue(mockReview);

      const result = await controller.createReview(mockRequest, reviewBody);

      expect(result).toHaveProperty('id', 'review-123');
      expect(result).toHaveProperty('jobId', 'job-456');
      expect(result).toHaveProperty('raterUserId', 'user-123');
      expect(result).toHaveProperty('rateeUserId', 'provider-789');
      expect(result).toHaveProperty('stars', 5);
      expect(result).toHaveProperty('comment', 'Excellent service!');
    });

    it('should handle review without comment', async () => {
      const bodyWithoutComment = {
        jobId: 'job-456',
        rateeUserId: 'provider-789',
        stars: 4,
      };

      const reviewWithoutComment = {
        ...mockReview,
        comment: undefined,
        stars: 4,
      };

      mockReviewsService.createReview.mockResolvedValue(reviewWithoutComment);

      await controller.createReview(mockRequest, bodyWithoutComment);

      expect(reviewsService.createReview).toHaveBeenCalledWith({
        jobId: 'job-456',
        raterUserId: 'user-123',
        rateeUserId: 'provider-789',
        stars: 4,
        comment: undefined,
      });
    });

    it('should handle different star ratings', async () => {
      const ratings = [1, 2, 3, 4, 5];

      for (const stars of ratings) {
        mockReviewsService.createReview.mockResolvedValue({
          ...mockReview,
          stars,
        });

        await controller.createReview(mockRequest, { ...reviewBody, stars });

        expect(reviewsService.createReview).toHaveBeenCalledWith(
          expect.objectContaining({
            stars,
          }),
        );
      }
    });

    it('should use raterUserId from authenticated request', async () => {
      const differentUser = {
        user: { userId: 'different-user-456', email: 'other@example.com', role: 'CUSTOMER' },
      } as any;

      mockReviewsService.createReview.mockResolvedValue(mockReview);

      await controller.createReview(differentUser, reviewBody);

      expect(reviewsService.createReview).toHaveBeenCalledWith(
        expect.objectContaining({
          raterUserId: 'different-user-456',
        }),
      );
    });

    it('should propagate errors from reviewsService', async () => {
      mockReviewsService.createReview.mockRejectedValue(new Error('Job not found'));

      await expect(controller.createReview(mockRequest, reviewBody)).rejects.toThrow('Job not found');
    });

    it('should handle duplicate review error', async () => {
      mockReviewsService.createReview.mockRejectedValue(new Error('Review already exists'));

      await expect(controller.createReview(mockRequest, reviewBody)).rejects.toThrow(
        'Review already exists',
      );
    });
  });

  describe('getReviewsForJob', () => {
    const mockReviews = [
      {
        id: 'review-1',
        jobId: 'job-456',
        raterUserId: 'user-123',
        rateeUserId: 'provider-789',
        stars: 5,
        comment: 'Great service!',
        createdAt: new Date('2025-01-15'),
      },
      {
        id: 'review-2',
        jobId: 'job-456',
        raterUserId: 'provider-789',
        rateeUserId: 'user-123',
        stars: 4,
        comment: 'Good customer!',
        createdAt: new Date('2025-01-16'),
      },
    ];

    it('should call reviewsService.getReviewsForJob with jobId', async () => {
      mockReviewsService.getReviewsForJob.mockResolvedValue(mockReviews);

      const result = await controller.getReviewsForJob('job-456');

      expect(reviewsService.getReviewsForJob).toHaveBeenCalledWith('job-456');
      expect(result).toEqual(mockReviews);
    });

    it('should return array of reviews for job', async () => {
      mockReviewsService.getReviewsForJob.mockResolvedValue(mockReviews);

      const result = await controller.getReviewsForJob('job-456');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('jobId', 'job-456');
      expect(result[1]).toHaveProperty('jobId', 'job-456');
    });

    it('should handle empty reviews list', async () => {
      mockReviewsService.getReviewsForJob.mockResolvedValue([]);

      const result = await controller.getReviewsForJob('job-999');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle different job IDs', async () => {
      const jobIds = ['job-111', 'job-222', 'job-333'];

      for (const jobId of jobIds) {
        mockReviewsService.getReviewsForJob.mockResolvedValue([
          { ...mockReviews[0], jobId },
        ]);

        await controller.getReviewsForJob(jobId);

        expect(reviewsService.getReviewsForJob).toHaveBeenCalledWith(jobId);
      }
    });

    it('should propagate errors from reviewsService', async () => {
      mockReviewsService.getReviewsForJob.mockRejectedValue(new Error('Database error'));

      await expect(controller.getReviewsForJob('job-456')).rejects.toThrow('Database error');
    });
  });

  describe('getReviewsForUser', () => {
    const mockUserReviews = [
      {
        id: 'review-1',
        jobId: 'job-111',
        raterUserId: 'user-123',
        rateeUserId: 'provider-789',
        stars: 5,
        comment: 'Excellent!',
        createdAt: new Date('2025-01-10'),
      },
      {
        id: 'review-2',
        jobId: 'job-222',
        raterUserId: 'user-456',
        rateeUserId: 'provider-789',
        stars: 4,
        comment: 'Very good!',
        createdAt: new Date('2025-01-12'),
      },
      {
        id: 'review-3',
        jobId: 'job-333',
        raterUserId: 'user-789',
        rateeUserId: 'provider-789',
        stars: 5,
        comment: 'Outstanding!',
        createdAt: new Date('2025-01-14'),
      },
    ];

    it('should call reviewsService.getReviewsForUser with userId', async () => {
      mockReviewsService.getReviewsForUser.mockResolvedValue(mockUserReviews);

      const result = await controller.getReviewsForUser('provider-789');

      expect(reviewsService.getReviewsForUser).toHaveBeenCalledWith('provider-789');
      expect(result).toEqual(mockUserReviews);
    });

    it('should return array of reviews for user', async () => {
      mockReviewsService.getReviewsForUser.mockResolvedValue(mockUserReviews);

      const result = await controller.getReviewsForUser('provider-789');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
      expect(result.every((r) => r.rateeUserId === 'provider-789')).toBe(true);
    });

    it('should handle user with no reviews', async () => {
      mockReviewsService.getReviewsForUser.mockResolvedValue([]);

      const result = await controller.getReviewsForUser('new-user-999');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle different user IDs', async () => {
      const userIds = ['user-111', 'provider-222', 'admin-333'];

      for (const userId of userIds) {
        mockReviewsService.getReviewsForUser.mockResolvedValue([
          { ...mockUserReviews[0], rateeUserId: userId },
        ]);

        await controller.getReviewsForUser(userId);

        expect(reviewsService.getReviewsForUser).toHaveBeenCalledWith(userId);
      }
    });

    it('should propagate errors from reviewsService', async () => {
      mockReviewsService.getReviewsForUser.mockRejectedValue(new Error('User not found'));

      await expect(controller.getReviewsForUser('invalid-user')).rejects.toThrow('User not found');
    });
  });

  describe('getAverageRating', () => {
    it('should call reviewsService.getAverageRatingForUser with userId', async () => {
      mockReviewsService.getAverageRatingForUser.mockResolvedValue(4.5);

      const result = await controller.getAverageRating('provider-789');

      expect(reviewsService.getAverageRatingForUser).toHaveBeenCalledWith('provider-789');
      expect(result).toEqual({
        userId: 'provider-789',
        averageRating: 4.5,
      });
    });

    it('should return userId and averageRating in response', async () => {
      mockReviewsService.getAverageRatingForUser.mockResolvedValue(4.7);

      const result = await controller.getAverageRating('provider-123');

      expect(result).toHaveProperty('userId', 'provider-123');
      expect(result).toHaveProperty('averageRating', 4.7);
    });

    it('should handle perfect 5.0 rating', async () => {
      mockReviewsService.getAverageRatingForUser.mockResolvedValue(5.0);

      const result = await controller.getAverageRating('provider-456');

      expect(result.averageRating).toBe(5.0);
    });

    it('should handle low rating', async () => {
      mockReviewsService.getAverageRatingForUser.mockResolvedValue(2.3);

      const result = await controller.getAverageRating('provider-456');

      expect(result.averageRating).toBe(2.3);
    });

    it('should handle zero rating (no reviews)', async () => {
      mockReviewsService.getAverageRatingForUser.mockResolvedValue(0);

      const result = await controller.getAverageRating('new-provider-999');

      expect(result.averageRating).toBe(0);
    });

    it('should handle null rating (no reviews alternative)', async () => {
      mockReviewsService.getAverageRatingForUser.mockResolvedValue(null);

      const result = await controller.getAverageRating('new-provider-888');

      expect(result.averageRating).toBe(null);
    });

    it('should handle different user IDs', async () => {
      const userIds = ['user-111', 'provider-222', 'admin-333'];
      const ratings = [4.2, 3.8, 4.9];

      for (let i = 0; i < userIds.length; i++) {
        mockReviewsService.getAverageRatingForUser.mockResolvedValue(ratings[i]);

        const result = await controller.getAverageRating(userIds[i]);

        expect(reviewsService.getAverageRatingForUser).toHaveBeenCalledWith(userIds[i]);
        expect(result.userId).toBe(userIds[i]);
        expect(result.averageRating).toBe(ratings[i]);
      }
    });

    it('should propagate errors from reviewsService', async () => {
      mockReviewsService.getAverageRatingForUser.mockRejectedValue(new Error('Database error'));

      await expect(controller.getAverageRating('provider-123')).rejects.toThrow('Database error');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete review flow: create -> get for job -> get for user -> get average', async () => {
      const mockRequest = {
        user: { userId: 'user-123', email: 'customer@example.com', role: 'CUSTOMER' },
      } as any;

      const reviewBody = {
        jobId: 'job-456',
        rateeUserId: 'provider-789',
        stars: 5,
        comment: 'Excellent service!',
      };

      // Create review
      const createdReview = {
        id: 'review-123',
        jobId: 'job-456',
        raterUserId: 'user-123',
        rateeUserId: 'provider-789',
        stars: 5,
        comment: 'Excellent service!',
        createdAt: new Date(),
      };
      mockReviewsService.createReview.mockResolvedValue(createdReview);
      const createResult = await controller.createReview(mockRequest, reviewBody);
      expect(createResult.id).toBe('review-123');

      // Get reviews for job
      mockReviewsService.getReviewsForJob.mockResolvedValue([createdReview]);
      const jobReviews = await controller.getReviewsForJob('job-456');
      expect(jobReviews).toHaveLength(1);
      expect(jobReviews[0].id).toBe('review-123');

      // Get reviews for user
      mockReviewsService.getReviewsForUser.mockResolvedValue([createdReview]);
      const userReviews = await controller.getReviewsForUser('provider-789');
      expect(userReviews).toHaveLength(1);

      // Get average rating
      mockReviewsService.getAverageRatingForUser.mockResolvedValue(5.0);
      const avgResult = await controller.getAverageRating('provider-789');
      expect(avgResult.averageRating).toBe(5.0);
    });

    it('should handle multiple reviews affecting average rating', async () => {
      const mockRequest = {
        user: { userId: 'user-123', email: 'customer@example.com', role: 'CUSTOMER' },
      } as any;

      // Create first review (5 stars)
      mockReviewsService.createReview.mockResolvedValue({
        id: 'review-1',
        jobId: 'job-1',
        raterUserId: 'user-123',
        rateeUserId: 'provider-789',
        stars: 5,
        comment: 'Great!',
        createdAt: new Date(),
      });
      await controller.createReview(mockRequest, {
        jobId: 'job-1',
        rateeUserId: 'provider-789',
        stars: 5,
        comment: 'Great!',
      });

      // Create second review (4 stars)
      mockReviewsService.createReview.mockResolvedValue({
        id: 'review-2',
        jobId: 'job-2',
        raterUserId: 'user-123',
        rateeUserId: 'provider-789',
        stars: 4,
        comment: 'Good!',
        createdAt: new Date(),
      });
      await controller.createReview(mockRequest, {
        jobId: 'job-2',
        rateeUserId: 'provider-789',
        stars: 4,
        comment: 'Good!',
      });

      // Average should be 4.5
      mockReviewsService.getAverageRatingForUser.mockResolvedValue(4.5);
      const avgResult = await controller.getAverageRating('provider-789');
      expect(avgResult.averageRating).toBe(4.5);
    });
  });
});
