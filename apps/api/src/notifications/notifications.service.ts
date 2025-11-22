import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType, NotificationTemplate } from './notification.types';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private firebaseApp: admin.app.App | null = null;
  private readonly enabled: boolean;

  constructor(private prisma: PrismaService) {
    // Firebase is optional - only enable if credentials are configured
    this.enabled = !!process.env.FIREBASE_SERVICE_ACCOUNT;
  }

  onModuleInit() {
    if (this.enabled && !this.firebaseApp) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!);
        this.firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        this.logger.log('Firebase Admin SDK initialized successfully');
      } catch (error) {
        this.logger.error('Failed to initialize Firebase:', error);
        // Continue without Firebase - fall back to logging only
      }
    } else {
      this.logger.log('Firebase notifications disabled - FIREBASE_SERVICE_ACCOUNT not configured');
    }
  }

  async notifyQuoteCreated(jobId: string, quoteId: string, providerId: string) {
    this.logger.log('Quote created: job=' + jobId + ' quote=' + quoteId + ' provider=' + providerId);

    // Get job details to notify customer
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { customer: true },
    });

    if (!job) {
      this.logger.warn(`Job ${jobId} not found for QUOTE_RECEIVED notification`);
      return;
    }

    // Get provider details
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      include: { user: true },
    });

    if (!provider) {
      this.logger.warn(`Provider ${providerId} not found for QUOTE_RECEIVED notification`);
      return;
    }

    // Notify customer about quote received
    await this.sendNotification(
      job.customerId,
      NotificationType.QUOTE_RECEIVED,
      'New Quote Received',
      `${provider.user.name} has submitted a quote for "${job.title}"`,
      {
        jobId,
        quoteId,
        providerId,
        providerName: provider.user.name,
      }
    ).catch(err => {
      this.logger.error(`Failed to send QUOTE_RECEIVED notification:`, err);
    });
  }

  async notifyQuoteAccepted(jobId: string, quoteId: string, providerId: string) {
    this.logger.log('Quote accepted: job=' + jobId + ' quote=' + quoteId + ' provider=' + providerId);

    // Get job details
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { customer: true },
    });

    if (!job) {
      this.logger.warn(`Job ${jobId} not found for QUOTE_ACCEPTED notification`);
      return;
    }

    // Get provider details to notify them
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      include: { user: true },
    });

    if (!provider) {
      this.logger.warn(`Provider ${providerId} not found for QUOTE_ACCEPTED notification`);
      return;
    }

    // Notify provider their quote was accepted
    await this.sendNotification(
      provider.userId,
      NotificationType.QUOTE_ACCEPTED,
      'Quote Accepted!',
      `Your quote for "${job.title}" has been accepted by ${job.customer.name}`,
      {
        jobId,
        quoteId,
        providerId,
        jobTitle: job.title,
      }
    ).catch(err => {
      this.logger.error(`Failed to send QUOTE_ACCEPTED notification:`, err);
    });
  }

  async notifyAcceptanceRevoked(jobId: string, quoteId: string) {
    this.logger.log('Acceptance revoked: job=' + jobId + ' quote=' + quoteId);
  }

  async notifyScheduleProposed(payload: {
    jobId: string;
    assignmentId: string;
    proposedBy: 'customer' | 'provider';
    start: Date;
    end: Date;
  }) {
    this.logger.log(
      'Schedule proposed: job=' + payload.jobId + ' assignment=' + payload.assignmentId + ' by=' + payload.proposedBy,
    );
  }

  async notifyScheduleConfirmed(payload: {
    jobId: string;
    assignmentId: string;
    confirmedBy: 'customer' | 'provider';
    start: Date | null;
    end: Date | null;
  }) {
    this.logger.log('Schedule confirmed: job=' + payload.jobId + ' assignment=' + payload.assignmentId);

    // Get assignment with job and participants
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: payload.assignmentId },
      include: {
        job: { include: { customer: true } },
        provider: { include: { user: true } },
      },
    });

    if (!assignment) {
      this.logger.warn(`Assignment ${payload.assignmentId} not found for JOB_SCHEDULED notification`);
      return;
    }

    const scheduleTime = payload.start
      ? payload.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : 'TBD';

    // Notify both customer and provider about confirmed schedule
    const customerPromise = this.sendNotification(
      assignment.job.customerId,
      NotificationType.JOB_SCHEDULED,
      'Job Scheduled',
      `Your job "${assignment.job.title}" with ${assignment.provider.user.name} is scheduled for ${scheduleTime}`,
      {
        jobId: payload.jobId,
        assignmentId: payload.assignmentId,
        providerId: assignment.providerId,
        start: payload.start?.toISOString() ?? '',
      }
    ).catch(err => {
      this.logger.error(`Failed to send JOB_SCHEDULED notification to customer:`, err);
    });

    const providerPromise = this.sendNotification(
      assignment.provider.userId,
      NotificationType.JOB_SCHEDULED,
      'Job Scheduled',
      `Your job "${assignment.job.title}" with ${assignment.job.customer.name} is scheduled for ${scheduleTime}`,
      {
        jobId: payload.jobId,
        assignmentId: payload.assignmentId,
        customerId: assignment.job.customerId,
        start: payload.start?.toISOString() ?? '',
      }
    ).catch(err => {
      this.logger.error(`Failed to send JOB_SCHEDULED notification to provider:`, err);
    });

    await Promise.all([customerPromise, providerPromise]);
  }

  async notifyAssignmentRejected(payload: { jobId: string; assignmentId: string; providerId: string; reason?: string }) {
    this.logger.warn('Assignment rejected: job=' + payload.jobId + ' provider=' + payload.providerId);
  }

  async notifyAssignmentReminder(payload: {
    assignmentId: string;
    jobId: string;
    providerId: string | null;
    customerId: string | null;
    scheduledStart: Date | null;
    scheduleNotes?: string;
    leadMinutes: number;
  }) {
    this.logger.log('Assignment reminder: job=' + payload.jobId + ' assignment=' + payload.assignmentId);
  }

  async registerDeviceToken(userId: string, token: string, platform: 'ios' | 'android' | 'web'): Promise<void> {
    this.logger.log('Register device token for user ' + userId);
  }

  async unregisterDeviceToken(token: string): Promise<void> {
    this.logger.log('Unregister device token: ' + token);
  }

  /**
   * Send a push notification to a user's active device tokens
   * @param userId User ID to send notification to
   * @param type Notification type
   * @param title Notification title
   * @param body Notification body
   * @param data Additional data payload
   */
  async sendNotification(userId: string, type: NotificationType, title: string, body: string, data?: Record<string, unknown>) {
    // Store notification in database
    // TODO: Re-enable once Prisma Client is regenerated with Notification model
    // await this.prisma.notification.create({
    //   data: {
    //     userId,
    //     type,
    //     title,
    //     body,
    //     data: data ?? {},
    //   },
    // });

    // Get active device tokens for user
    const deviceTokens = await this.prisma.deviceToken.findMany({
      where: {
        userId,
        active: true,
      },
    });

    if (deviceTokens.length === 0) {
      this.logger.debug(`No active device tokens for user ${userId}`);
      return;
    }

    // Send push notification via Firebase if enabled
    if (this.enabled && this.firebaseApp) {
      const tokens = deviceTokens.map(dt => dt.token);

      try {
        const message = {
          notification: {
            title,
            body,
          },
          data: data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : {},
          tokens,
        };

        const response = await admin.messaging(this.firebaseApp).sendEachForMulticast(message);

        this.logger.log(`Sent notification to ${response.successCount}/${tokens.length} devices for user ${userId}`);

        // Handle failed tokens
        if (response.failureCount > 0) {
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              this.logger.warn(`Failed to send to token ${tokens[idx]}: ${resp.error?.message}`);

              // Deactivate invalid tokens
              if (resp.error?.code === 'messaging/invalid-registration-token' ||
                  resp.error?.code === 'messaging/registration-token-not-registered') {
                this.prisma.deviceToken.update({
                  where: { token: tokens[idx] },
                  data: { active: false },
                }).catch(err => this.logger.error('Failed to deactivate token:', err));
              }
            }
          });
        }
      } catch (error) {
        this.logger.error('Failed to send push notification:', error);
      }
    } else {
      this.logger.log(`[DRY RUN] Would send "${title}" to ${deviceTokens.length} devices for user ${userId}`);
    }
  }
}
