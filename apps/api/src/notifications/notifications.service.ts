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
  }

  async notifyQuoteAccepted(jobId: string, quoteId: string, providerId: string) {
    this.logger.log('Quote accepted: job=' + jobId + ' quote=' + quoteId + ' provider=' + providerId);
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
}
