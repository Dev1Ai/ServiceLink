import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterTokenDto } from './dto/register-token.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly expo = new Expo();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Register a push notification token for a user
   */
  async registerToken(userId: string, dto: RegisterTokenDto) {
    // Check if token already exists
    const existing = await this.prisma.notificationToken.findUnique({
      where: { token: dto.token },
    });

    if (existing) {
      // Update existing token
      return this.prisma.notificationToken.update({
        where: { id: existing.id },
        data: {
          platform: dto.platform,
          notifyNewJobs: dto.notifyNewJobs ?? existing.notifyNewJobs,
          notifyNewQuotes: dto.notifyNewQuotes ?? existing.notifyNewQuotes,
          notifyQuoteAccepted: dto.notifyQuoteAccepted ?? existing.notifyQuoteAccepted,
          notifyJobCompleted: dto.notifyJobCompleted ?? existing.notifyJobCompleted,
          notifyPaymentReceived: dto.notifyPaymentReceived ?? existing.notifyPaymentReceived,
          notifyReminders: dto.notifyReminders ?? existing.notifyReminders,
        },
      });
    }

    // Create new token
    return this.prisma.notificationToken.create({
      data: {
        userId,
        token: dto.token,
        platform: dto.platform,
        notifyNewJobs: dto.notifyNewJobs ?? true,
        notifyNewQuotes: dto.notifyNewQuotes ?? true,
        notifyQuoteAccepted: dto.notifyQuoteAccepted ?? true,
        notifyJobCompleted: dto.notifyJobCompleted ?? true,
        notifyPaymentReceived: dto.notifyPaymentReceived ?? true,
        notifyReminders: dto.notifyReminders ?? true,
      },
    });
  }

  /**
   * Update notification preferences for a token
   */
  async updatePreferences(tokenId: string, dto: UpdatePreferencesDto) {
    return this.prisma.notificationToken.update({
      where: { id: tokenId },
      data: dto,
    });
  }

  /**
   * Get user's notification tokens
   */
  async getUserTokens(userId: string) {
    return this.prisma.notificationToken.findMany({
      where: { userId },
    });
  }

  /**
   * Send push notification to specific tokens
   */
  async sendPushNotification(tokens: string[], title: string, body: string, data?: Record<string, any>) {
    const messages: ExpoPushMessage[] = tokens
      .filter((token) => Expo.isExpoPushToken(token))
      .map((token) => ({
        to: token,
        sound: 'default',
        title,
        body,
        data,
      }));

    if (messages.length === 0) {
      this.logger.warn('No valid Expo push tokens to send notification');
      return;
    }

    const chunks = this.expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
        this.logger.log(`Sent ${chunk.length} push notifications`, ticketChunk);
      } catch (error) {
        this.logger.error('Error sending push notifications:', error);
      }
    }
  }

  async notifyQuoteCreated(jobId: string, quoteId: string, providerId: string) {
    this.logger.log(`Quote created: job=${jobId} quote=${quoteId} provider=${providerId}`);
  }

  async notifyQuoteAccepted(jobId: string, quoteId: string, providerId: string) {
    this.logger.log(`Quote accepted: job=${jobId} quote=${quoteId} provider=${providerId}`);
  }

  async notifyAcceptanceRevoked(jobId: string, quoteId: string) {
    this.logger.log(`Acceptance revoked: job=${jobId} quote=${quoteId}`);
  }

  async notifyScheduleProposed(payload: {
    jobId: string;
    assignmentId: string;
    proposedBy: 'customer' | 'provider';
    start: Date;
    end: Date;
  }) {
    this.logger.log(
      `Schedule proposed: job=${payload.jobId} assignment=${payload.assignmentId} by=${payload.proposedBy} window=${payload.start.toISOString()}-${payload.end.toISOString()}`,
    );
  }

  async notifyScheduleConfirmed(payload: {
    jobId: string;
    assignmentId: string;
    confirmedBy: 'customer' | 'provider';
    start: Date | null;
    end: Date | null;
  }) {
    this.logger.log(
      `Schedule confirmed: job=${payload.jobId} assignment=${payload.assignmentId} by=${payload.confirmedBy} window=${payload.start?.toISOString()}-${payload.end?.toISOString()}`,
    );
  }

  async notifyAssignmentRejected(payload: { jobId: string; assignmentId: string; providerId: string; reason?: string }) {
    this.logger.warn(
      `Assignment rejected: job=${payload.jobId} assignment=${payload.assignmentId} provider=${payload.providerId} reason=${payload.reason || 'n/a'}`,
    );
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
    this.logger.log(
      `Assignment reminder: job=${payload.jobId} assignment=${payload.assignmentId} provider=${payload.providerId ?? 'unknown'} ` +
        `customer=${payload.customerId ?? 'unknown'} scheduledStart=${payload.scheduledStart?.toISOString() ?? 'n/a'} lead=${payload.leadMinutes}m notes=${payload.scheduleNotes ?? ''}`,
    );
  }
}
