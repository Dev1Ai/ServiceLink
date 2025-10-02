import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AssignmentPayoutStatus } from '@prisma/client';

const PLACEHOLDER_KEYS = /sk_(?:test|live)_or_test|replace|changeme/i;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private hasRealStripeKeys() {
    const secret = this.config.get<string>('STRIPE_SECRET_KEY') || this.config.get<string>('STRIPE_SECRET');
    if (!secret) return false;
    return !PLACEHOLDER_KEYS.test(secret);
  }

  async handleCustomerVerification(jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        customerId: true,
        assignment: { select: { id: true } },
      },
    });
    if (!job) {
      this.logger.warn(`handleCustomerVerification: job ${jobId} not found`);
      return { mode: 'none' } as const;
    }

    const stripeReady = this.hasRealStripeKeys();
    const paymentStatus = stripeReady ? 'capture_pending' : 'manual_review';

    const paymentDelegate = this.prisma.payment;

    await paymentDelegate.upsert({
      where: { jobId: job.id },
      update: {
        status: paymentStatus,
      },
      create: {
        jobId: job.id,
        customerId: job.customerId,
        amount: 0,
        currency: 'usd',
        status: paymentStatus,
      },
    });

    if (job.assignment) {
      await this.prisma.assignment.update({
        where: { id: job.assignment.id },
        data: {
          payoutStatus: stripeReady ? 'PENDING' : 'AWAITING_APPROVAL',
        },
      });
    }

    if (stripeReady) {
      this.logger.log(`Stripe capture placeholder queued for job ${jobId}`);
      return { mode: 'stripe' } as const;
    }

    this.logger.warn(`Stripe keys missing or placeholder; manual payout review required for job ${jobId}`);
    return { mode: 'manual' } as const;
  }

  async listPendingPayouts() {
    return this.prisma.assignment.findMany({
      where: { payoutStatus: 'AWAITING_APPROVAL' },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        jobId: true,
        payoutApprovedAt: true,
        payoutApprovedBy: true,
        payoutStatus: true,
        status: true,
        customerVerifiedAt: true,
        scheduledStart: true,
        scheduledEnd: true,
        reminderStatus: true,
        job: {
          select: {
            id: true,
            title: true,
            description: true,
            customer: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
          },
        },
        provider: {
          select: {
            id: true,
            user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    });
  }

  async approvePayout(assignmentId: string, adminUserId: string) {
    return this.setPayoutStatus(assignmentId, 'APPROVED', adminUserId);
  }

  async denyPayout(assignmentId: string, adminUserId: string) {
    return this.setPayoutStatus(assignmentId, 'BLOCKED', adminUserId);
  }

  private async setPayoutStatus(assignmentId: string, status: AssignmentPayoutStatus, adminUserId: string) {
    const updated = await this.prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        payoutStatus: status,
        payoutApprovedBy: adminUserId,
        payoutApprovedAt: new Date(),
      },
      select: {
        id: true,
        payoutStatus: true,
        payoutApprovedBy: true,
        payoutApprovedAt: true,
      },
    });
    this.logger.log(`Payout ${status.toLowerCase()} for assignment ${assignmentId} by ${adminUserId}`);
    return updated;
  }
}
