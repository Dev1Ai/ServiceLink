import { Test, TestingModule } from '@nestjs/testing';
import { JobsService } from './jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { PiiService } from '../pii/pii.service';

describe('JobsService', () => {
  let service: JobsService;
  let prisma: PrismaService;
  let pii: PiiService;

  const prismaMock = {
    job: {
      create: jest.fn().mockImplementation(args => Promise.resolve({ id: 'job-1', ...args.data })),
    },
  };

  const piiMock = {
    redact: jest.fn().mockImplementation((text: string) => text), // By default, no redaction
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PiiService, useValue: piiMock },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
    prisma = module.get<PrismaService>(PrismaService);
    pii = module.get<PiiService>(PiiService);
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

      expect(pii.redact).toHaveBeenCalledWith(dto.description);
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

    it('should redact PII from job description', async () => {
      const dto = {
        title: 'Fix my toilet',
        description: 'Please call me at 555-123-4567 or email john@example.com',
      };
      const customerId = 'customer-1';

      // Mock PII service to redact email and phone
      piiMock.redact.mockReturnValueOnce('Please call me at [REDACTED_PHONE] or email [REDACTED_EMAIL]');

      const job = await service.createJob(dto, customerId);

      expect(pii.redact).toHaveBeenCalledWith(dto.description);
      expect(prisma.job.create).toHaveBeenCalledWith({
        data: {
          key: expect.stringMatching(/^job_/),
          title: dto.title,
          description: 'Please call me at [REDACTED_PHONE] or email [REDACTED_EMAIL]',
          customerId: customerId,
        },
      });

      expect(job.description).toBe('Please call me at [REDACTED_PHONE] or email [REDACTED_EMAIL]');
    });

    it('should handle descriptions with no PII', async () => {
      const dto = {
        title: 'Paint living room',
        description: 'Need two coats of white paint on all walls',
      };
      const customerId = 'customer-1';

      const job = await service.createJob(dto, customerId);

      expect(pii.redact).toHaveBeenCalledWith(dto.description);
      expect(job.description).toBe(dto.description);
    });
  });
});
