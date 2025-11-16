import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobDto } from './dto/job.dto';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
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
}
