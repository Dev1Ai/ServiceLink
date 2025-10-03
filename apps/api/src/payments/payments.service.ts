import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AssignmentPayoutStatus } from '@prisma/client';

const PLACEHOLDER_KEYS = /sk_(?:test|live)_or_test|replace|changeme/i;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private stripe: any;

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {
    if (this.hasRealStripeKeys()) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Stripe = require('stripe');
      this.stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY'), {
        apiVersion: '2024-11-20.acacia',
      });
    }
  }

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

  async createPaymentIntent(data: { jobId: string; amount: number; customerId: string }) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: data.amount,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        jobId: data.jobId,
        customerId: data.customerId,
      },
    });

    await this.prisma.payment.create({
      data: {
        jobId: data.jobId,
        customerId: data.customerId,
        amount: data.amount,
        currency: 'usd',
        stripePaymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
      },
    });

    return { clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id };
  }

  async capturePayment(paymentIntentId: string) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    const paymentIntent = await this.stripe.paymentIntents.capture(paymentIntentId);

    await this.prisma.payment.update({
      where: { stripePaymentIntentId: paymentIntentId },
      data: {
        status: paymentIntent.status,
        capturedAt: new Date(),
      },
    });

    return paymentIntent;
  }

  async refundPayment(data: { paymentId: string; amount?: number; reason?: string }) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    const payment = await this.prisma.payment.findUnique({
      where: { id: data.paymentId },
    });

    if (!payment || !payment.stripePaymentIntentId) {
      throw new BadRequestException('Payment not found or not processed through Stripe');
    }

    const refund = await this.stripe.refunds.create({
      payment_intent: payment.stripePaymentIntentId,
      amount: data.amount,
      reason: data.reason,
    });

    await this.prisma.refund.create({
      data: {
        paymentId: payment.id,
        stripeRefundId: refund.id,
        amount: refund.amount,
        reason: data.reason,
        status: refund.status,
      },
    });

    return refund;
  }

  async createPayout(data: { providerId: string; amount: number }) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    const provider = await this.prisma.provider.findUnique({
      where: { id: data.providerId },
    });

    if (!provider || !provider.stripeAccountId) {
      throw new BadRequestException('Provider not found or Stripe Connect not set up');
    }

    const transfer = await this.stripe.transfers.create({
      amount: data.amount,
      currency: 'usd',
      destination: provider.stripeAccountId,
    });

    await this.prisma.payout.create({
      data: {
        providerId: data.providerId,
        stripeTransferId: transfer.id,
        amount: data.amount,
        currency: 'usd',
        status: 'processing',
        processedAt: new Date(),
      },
    });

    return transfer;
  }
}
