import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssignmentReminderStatus } from '@prisma/client';
import { Queue, Worker, JobsOptions } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MetricsService } from '../metrics/metrics.service';
import { REMINDER_QUEUE_NAME, REMINDER_QUEUE_PROVIDER, ReminderQueueResources } from './reminders.queue';

export type ReminderJobData = {
  assignmentId: string;
  jobId: string;
  scheduleVersion: number;
};

@Injectable()
export class RemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RemindersService.name);
  private readonly leadMinutes: number;
  private readonly lookaheadMinutes: number;
  private readonly overdueMinutes: number;
  private readonly pollIntervalMs: number;
  private readonly concurrency: number;
  private readonly enabled: boolean;

  private readonly queue: Queue | null;
  private worker?: Worker;
  private pollTimer?: NodeJS.Timeout;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly metrics: MetricsService,
    @Inject(REMINDER_QUEUE_PROVIDER) private readonly resources: ReminderQueueResources | null,
  ) {
    this.leadMinutes = Number(this.config.get<string>('REMINDER_LEAD_MINUTES') ?? 30);
    this.lookaheadMinutes = Math.max(this.leadMinutes, Number(this.config.get<string>('REMINDER_LOOKAHEAD_MINUTES') ?? 120));
    this.overdueMinutes = Number(this.config.get<string>('REMINDER_OVERDUE_MINUTES') ?? 30);
    this.pollIntervalMs = Number(this.config.get<string>('REMINDER_POLL_INTERVAL_MS') ?? 300000);
    this.concurrency = Number(this.config.get<string>('REMINDER_WORKER_CONCURRENCY') ?? 2);
    const enabledFlag = (this.config.get<string>('REMINDER_WORKER_ENABLED') ?? 'true').toLowerCase() !== 'false';
    this.enabled = enabledFlag && !!this.resources?.queue;
    this.queue = this.resources?.queue ?? null;

    if (!this.enabled) {
      this.logger.warn('Assignment reminder worker disabled (set REMINDER_WORKER_ENABLED=true and ensure REDIS_URL is configured).');
    }
  }

  isEnabled() {
    return this.enabled;
  }

  async onModuleInit() {
    if (!this.enabled || !this.resources || !this.queue) return;

    this.worker = new Worker<ReminderJobData>(
      REMINDER_QUEUE_NAME,
      async (job) => this.handleReminder(job.data),
      {
        connection: this.resources.connection,
        concurrency: this.concurrency,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.debug(`Reminder job ${job.id as string} completed`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Reminder job ${job?.id as string} failed`, err as Error);
      this.metrics.incReminderFailed('worker');
    });

    await this.scanAndEnqueue().catch((err) => {
      this.logger.error('Initial reminder scan failed', err as Error);
    });
    await this.markOverdue().catch((err) => {
      this.logger.error('Initial overdue marking failed', err as Error);
    });

    this.pollTimer = setInterval(() => {
      this.scanAndEnqueue().catch((err) => this.logger.error('Reminder scan failed', err as Error));
      this.markOverdue().catch((err) => this.logger.error('Mark overdue failed', err as Error));
    }, this.pollIntervalMs);
    this.pollTimer.unref();
  }

  async onModuleDestroy() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    await this.worker?.close().catch(() => undefined);
    await this.queue?.close().catch(() => undefined);
    await this.resources?.connection.quit().catch(() => undefined);
  }

  async scanAndEnqueue() {
    if (!this.enabled || !this.queue) return 0;

    const now = new Date();
    const lookahead = new Date(now.getTime() + this.lookaheadMinutes * 60 * 1000);
    const leadMs = this.leadMinutes * 60 * 1000;

    const assignments = await this.prisma.assignment.findMany({
      where: {
        status: 'scheduled',
        reminderStatus: AssignmentReminderStatus.NONE,
        scheduledStart: {
          not: null,
          gte: now,
          lte: lookahead,
        },
      },
      select: {
        id: true,
        jobId: true,
        scheduleVersion: true,
        scheduledStart: true,
      },
    });

    let queued = 0;

    for (const assignment of assignments) {
      if (!assignment.scheduledStart) continue;
      const remindAt = new Date(assignment.scheduledStart.getTime() - leadMs);
      const delay = Math.max(0, remindAt.getTime() - Date.now());
      const jobOptions: JobsOptions = {
        jobId: `assignment:${assignment.id}:v${assignment.scheduleVersion}`,
        delay,
        removeOnComplete: true,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 60_000,
        },
      };

      try {
        await this.queue.add('assignment-reminder', {
          assignmentId: assignment.id,
          jobId: assignment.jobId,
          scheduleVersion: assignment.scheduleVersion,
        }, jobOptions);

        await this.prisma.assignment.update({
          where: { id: assignment.id },
          data: { reminderStatus: AssignmentReminderStatus.QUEUED },
        });
        queued += 1;
        this.logger.log(`Queued reminder for assignment ${assignment.id} (delay=${Math.round(delay / 1000)}s).`);
      } catch (err) {
        this.logger.error(`Failed to queue reminder for assignment ${assignment.id}`, err as Error);
        this.metrics.incReminderFailed('enqueue');
      }
    }

    return queued;
  }

  private async handleReminder(data: ReminderJobData) {
    if (!this.enabled) return;

    const assignment = await this.prisma.assignment.findUnique({
      where: { id: data.assignmentId },
      select: {
        id: true,
        jobId: true,
        status: true,
        scheduleVersion: true,
        scheduledStart: true,
        scheduleNotes: true,
        reminderStatus: true,
        provider: { select: { userId: true } },
        job: { select: { customerId: true } },
      },
    });

    if (!assignment) {
      this.logger.warn(`Reminder job skipped — assignment ${data.assignmentId} not found`);
      return;
    }

    if (assignment.scheduleVersion !== data.scheduleVersion) {
      this.logger.log(`Reminder job skipped — assignment ${assignment.id} schedule version changed`);
      return;
    }

    if (assignment.status !== 'scheduled') {
      this.logger.log(`Reminder job skipped — assignment ${assignment.id} status is ${assignment.status}`);
      return;
    }

    if (assignment.reminderStatus === AssignmentReminderStatus.SENT) {
      this.logger.log(`Reminder job skipped — assignment ${assignment.id} already reminded`);
      return;
    }

    const scheduledStart = assignment.scheduledStart ? new Date(assignment.scheduledStart) : null;

    await this.notifications.notifyAssignmentReminder({
      assignmentId: assignment.id,
      jobId: assignment.jobId,
      providerId: assignment.provider?.userId ?? null,
      customerId: assignment.job?.customerId ?? null,
      scheduledStart,
      scheduleNotes: assignment.scheduleNotes ?? undefined,
      leadMinutes: this.leadMinutes,
    });

    await this.prisma.assignment.update({
      where: { id: assignment.id },
      data: {
        reminderStatus: AssignmentReminderStatus.SENT,
        reminderLastSentAt: new Date(),
        reminderCount: { increment: 1 },
      },
    });

    this.metrics.incReminderSent(assignment.status);
  }

  private async markOverdue() {
    if (!this.enabled) return;

    const threshold = new Date(Date.now() - this.overdueMinutes * 60 * 1000);

    await this.prisma.assignment.updateMany({
      where: {
        status: 'scheduled',
        scheduledStart: { not: null, lt: threshold },
        reminderStatus: { not: AssignmentReminderStatus.OVERDUE },
      },
      data: { reminderStatus: AssignmentReminderStatus.OVERDUE },
    });
  }
}
