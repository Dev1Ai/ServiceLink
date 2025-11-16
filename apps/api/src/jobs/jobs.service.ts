import { Injectable, Logger, NotFoundException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { CreateJobDto, CreateQuoteDto } from './dto/job.dto';
import { Readable } from 'stream';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  async createJob(dto: CreateJobDto, customerId: string) {
    const key = `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const job = await this.prisma.job.create({
      data: {
        key,
        title: dto.title,
        description: dto.description,
        customerId: customerId,
      },
    });
    return job;
  }

  async createJobFromAudio(file: Express.Multer.File, customerId: string) {
    this.logger.log(`Processing audio file for user ${customerId}`);
    
    const transcribedText = await this.llm.transcribeAudio(file);

    if (!transcribedText) {
      throw new Error('Failed to transcribe audio.');
    }

    // Define the schema for the LLM
    const schema = {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'A short, descriptive title for the job.' },
        description: { type: 'string', description: 'A detailed description of the job.' },
        category: { type: 'string', description: 'A relevant category for the job, e.g., "Plumbing", "Electrical", "Lawn Care".' },
      },
      required: ['title', 'description', 'category'],
    };

    // Structure the text using the LLM service
    const structuredJob = await this.llm.structureText(transcribedText, schema);

    if (!structuredJob) {
      throw new Error('Failed to structure job from audio.');
    }

    // Create the job using the structured data
    const createJobDto: CreateJobDto = {
      title: structuredJob.title,
      description: structuredJob.description,
    };

    return this.createJob(createJobDto, customerId);
  }

  async draftQuote(jobId: string, userId: string): Promise<CreateQuoteDto> {
    const provider = await this.prisma.provider.findUnique({
      where: { userId },
    });
    if (!provider) {
      throw new NotFoundException('Provider profile not found');
    }

    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.customerId === userId) {
      throw new ForbiddenException('You cannot quote your own job.');
    }

    const quote = await this.llm.generateQuote(job.title, job.description);
    if (!quote) {
      throw new ServiceUnavailableException('Failed to generate quote.');
    }
    return quote;
  }
}
