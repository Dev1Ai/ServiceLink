import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/jwt.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { CreateReviewDto } from './dto/review.dto';
import { User, Role } from '@prisma/client';

describe('ReviewsController', () => {
  let controller: ReviewsController;
  let service: ReviewsService;

  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    password: 'password',
    role: Role.CUSTOMER,
    status: 'active',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        {
          provide: ReviewsService,
          useValue: {
            create: jest.fn().mockResolvedValue({}),
            findAll: jest.fn().mockResolvedValue([]),
            findAllByJobId: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ReviewsController>(ReviewsController);
    service = module.get<ReviewsService>(ReviewsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call reviewsService.create with correct params', async () => {
      const jobId = 'job-1';
      const createReviewDto: CreateReviewDto = { stars: 5, comment: 'Great!' };
      await controller.create(jobId, createReviewDto, mockUser);
      expect(service.create).toHaveBeenCalledWith(jobId, mockUser.id, createReviewDto);
    });
  });

  describe('findAll', () => {
    it('should call reviewsService.findAll when no jobId is provided', async () => {
      await controller.findAll();
      expect(service.findAll).toHaveBeenCalled();
    });

    it('should call reviewsService.findAllByJobId when a jobId is provided', async () => {
      const jobId = 'job-1';
      await controller.findAll(jobId);
      expect(service.findAllByJobId).toHaveBeenCalledWith(jobId);
    });
  });
});
