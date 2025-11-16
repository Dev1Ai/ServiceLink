import { Test, TestingModule } from '@nestjs/testing';
import { JobsService } from './jobs.service';
import { PrismaService } from '../prisma/prisma.service';

describe('JobsService', () => {
  let service: JobsService;
  let prisma: PrismaService;

  const prismaMock = {
    job: {
      create: jest.fn().mockImplementation(args => Promise.resolve({ id: 'job-1', ...args.data })),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createJob', () => {
    it('should create a job with generated key', async () => {
      const dto = {
        title: 'Fix leaky faucet',
        description: 'The faucet in the kitchen is dripping constantly.',
      };
      const customerId = 'customer-1';

      const job = await service.createJob(dto, customerId);

      expect(prisma.job.create).toHaveBeenCalledWith({
        data: {
          key: expect.stringMatching(/^job_/),
          title: dto.title,
          description: dto.description,
          customerId: customerId,
        },
      });

      expect(job.title).toBe('Fix leaky faucet');
      expect(job.customerId).toBe(customerId);
    });

    it('should generate unique keys for each job', async () => {
      const dto = {
        title: 'Test Job',
        description: 'Test Description',
      };
      const customerId = 'customer-1';

      await service.createJob(dto, customerId);
      await service.createJob(dto, customerId);

      const calls = (prisma.job.create as jest.Mock).mock.calls;
      const key1 = calls[0][0].data.key;
      const key2 = calls[1][0].data.key;

      expect(key1).not.toBe(key2);
    });
  });
});
