import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobDto } from './dto/job.dto';
import { PiiService } from '../pii/pii.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.types';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pii: PiiService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Creates a new job with PII-redacted description for safety
   * @param dto Job creation data
   * @param customerId User ID of the customer creating the job
   * @returns Created job with unique key
   */
  async createJob(dto: CreateJobDto, customerId: string) {
    const key = this.generateJobKey();

    // Redact PII from description to prevent accidental exposure
    const redactedDescription = this.pii.redact(dto.description);

    // Log if PII was detected and redacted
    if (redactedDescription !== dto.description) {
      this.logger.warn(`PII detected and redacted in job description for customer ${customerId}`);
    }

    const job = await this.prisma.job.create({
      data: {
        key,
        title: dto.title,
        description: redactedDescription,
        customerId: customerId,
      },
    });

    this.logger.log(`Created job ${job.id} (${job.key}) for customer ${customerId}`);

    // Notify all online providers about new job opportunity
    const providers = await this.prisma.provider.findMany({
      where: { online: true },
      include: { user: true },
    });

    for (const provider of providers) {
      await this.notifications.sendNotification(
        provider.userId,
        NotificationType.JOB_CREATED,
        'New Job Available',
        `${dto.title} - Check out this new job opportunity`,
        {
          jobId: job.id,
          jobKey: job.key,
          jobTitle: dto.title,
        }
      ).catch(err => {
        this.logger.error(`Failed to send JOB_CREATED notification to provider ${provider.id}:`, err);
      });
    }

    return job;
  }

  /**
   * Generates a unique job key using timestamp and random suffix
   * Format: job_<timestamp_base36>_<random_4chars>
   * @returns Unique job key string
   */
  private generateJobKey(): string {
    return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }
}
