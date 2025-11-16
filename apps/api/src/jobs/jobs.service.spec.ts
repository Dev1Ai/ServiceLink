import { Test, TestingModule } from '@nestjs/testing';
import { JobsService } from './jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { NotFoundException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';

describe('JobsService', () => {
  let service: JobsService;
  let prisma: PrismaService;
  let llm: LlmService;

  const prismaMock = {
    job: {
      create: jest.fn().mockImplementation(args => Promise.resolve({ id: 'job-1', ...args.data })),
      findUnique: jest.fn(),
    },
    provider: {
      findUnique: jest.fn(),
    },
  };

  const llmMock = {
    transcribeAudio: jest.fn().mockResolvedValue('I need a plumber to fix a leaky faucet in my kitchen.'),
    structureText: jest.fn().mockResolvedValue({
      title: 'Fix leaky faucet',
      description: 'The faucet in the kitchen is dripping constantly.',
      category: 'Plumbing',
    }),
    generateQuote: jest.fn().mockResolvedValue({
      lineItems: [{ name: 'Labor', quantity: 1, price: 100 }],
      total: 100,
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: LlmService, useValue: llmMock },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
    prisma = module.get<PrismaService>(PrismaService);
    llm = module.get<LlmService>(LlmService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createJobFromAudio', () => {
    it('should transcribe, structure, and create a job from an audio file', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'audio',
        originalname: 'audio.mp3',
        encoding: '7bit',
        mimetype: 'audio/mpeg',
        size: 12345,
        buffer: Buffer.from('mock audio data'),
        stream: jest.fn() as any,
        destination: '',
        filename: '',
        path: '',
      };
      const customerId = 'customer-1';

      const job = await service.createJobFromAudio(mockFile, customerId);

      expect(llm.transcribeAudio).toHaveBeenCalledWith(mockFile);
      expect(llm.structureText).toHaveBeenCalledWith('I need a plumber to fix a leaky faucet in my kitchen.', expect.any(Object));
      
      expect(prisma.job.create).toHaveBeenCalledWith({
        data: {
          key: expect.any(String),
          title: 'Fix leaky faucet',
          description: 'The faucet in the kitchen is dripping constantly.',
          customerId: customerId,
        },
      });

      expect(job.title).toBe('Fix leaky faucet');
    });
  });

  describe('draftQuote', () => {
    const jobId = 'job-1';
    const userId = 'provider-1';
    const job = { id: jobId, title: 'Test Job', description: 'Test Description', customerId: 'customer-1' };
    const provider = { id: 'provider-profile-1', userId };

    it('should generate a draft quote successfully', async () => {
      (prisma.provider.findUnique as jest.Mock).mockResolvedValue(provider);
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(job);

      const quote = await service.draftQuote(jobId, userId);

      expect(prisma.provider.findUnique).toHaveBeenCalledWith({ where: { userId } });
      expect(prisma.job.findUnique).toHaveBeenCalledWith({ where: { id: jobId } });
      expect(llm.generateQuote).toHaveBeenCalledWith(job.title, job.description);
      expect(quote.total).toBe(100);
    });

    it('should throw NotFoundException if provider not found', async () => {
      (prisma.provider.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.draftQuote(jobId, userId)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if job not found', async () => {
      (prisma.provider.findUnique as jest.Mock).mockResolvedValue(provider);
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.draftQuote(jobId, userId)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if provider is the customer', async () => {
      const selfJob = { ...job, customerId: userId };
      (prisma.provider.findUnique as jest.Mock).mockResolvedValue(provider);
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(selfJob);

      await expect(service.draftQuote(jobId, userId)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ServiceUnavailableException if quote generation fails', async () => {
      (prisma.provider.findUnique as jest.Mock).mockResolvedValue(provider);
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(job);
      (llm.generateQuote as jest.Mock).mockResolvedValue(null);

      await expect(service.draftQuote(jobId, userId)).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
