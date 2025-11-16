import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let prisma: PrismaService;

  const mockJob = {
    id: 'job-1',
    customerId: 'customer-1',
    assignment: {
      providerId: 'provider-1',
    },
  };

  const mockCustomer = {
    id: 'customer-1',
    role: Role.CUSTOMER,
  };

  const mockProvider = {
    id: 'provider-1',
    role: Role.PROVIDER,
  };

  const prismaMock = {
    job: {
      findUnique: jest.fn().mockResolvedValue(mockJob),
    },
    user: {
      findUnique: jest.fn().mockImplementation((args) => {
        if (args.where.id === 'customer-1') return mockCustomer;
        if (args.where.id === 'provider-1') return mockProvider;
        return null;
      }),
    },
    review: {
      create: jest.fn().mockImplementation((args) => {
        // Return a simple, predictable object for the test
        return Promise.resolve({
          id: 'review-1',
          jobId: 'job-1',
          raterId: args.data.rater.connect.id,
          rateeId: args.data.ratee.connect.id,
          stars: 5,
          comment: 'Excellent service!',
        });
      }),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a review from a customer for a provider', async () => {
      const reviewDto = { stars: 5, comment: 'Excellent service!' };
      await service.create('job-1', 'customer-1', reviewDto);

      expect(prisma.review.create).toHaveBeenCalledWith({
        data: {
          job: { connect: { id: 'job-1' } },
          rater: { connect: { id: 'customer-1' } },
          ratee: { connect: { id: 'provider-1' } },
          stars: 5,
          comment: 'Excellent service!',
        },
      });
    });

    it('should create a review from a provider for a customer', async () => {
      const reviewDto = { stars: 5, comment: 'Great customer!' };
      await service.create('job-1', 'provider-1', reviewDto);

      expect(prisma.review.create).toHaveBeenCalledWith({
        data: {
          job: { connect: { id: 'job-1' } },
          rater: { connect: { id: 'provider-1' } },
          ratee: { connect: { id: 'customer-1' } },
          stars: 5,
          comment: 'Great customer!',
        },
      });
    });

    it('should throw NotFoundException if job does not exist', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValueOnce(null);
      const reviewDto = { stars: 5 };
      await expect(service.create('job-dne', 'customer-1', reviewDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw UnauthorizedException if rater is not part of the job', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'user-not-in-job', role: Role.CUSTOMER });
      const reviewDto = { stars: 5 };
      await expect(service.create('job-1', 'user-not-in-job', reviewDto)).rejects.toThrow(UnauthorizedException);
    });
  });
});
