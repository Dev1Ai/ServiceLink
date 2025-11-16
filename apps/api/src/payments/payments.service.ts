import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { AssignmentPayoutStatus } from "@prisma/client";

const PLACEHOLDER_KEYS = /sk_(?:test|live)_or_test|replace|changeme/i;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private stripe: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    if (this.hasRealStripeKeys()) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Stripe = require("stripe");
        const secret =
          this.config.get<string>("STRIPE_SECRET_KEY") ||
          this.config.get<string>("STRIPE_SECRET");
        this.stripe = new Stripe(secret, { apiVersion: "2023-10-16" });
        this.logger.log("Stripe client initialized");
      } catch (err) {
        this.logger.warn(
          "Stripe package not installed or initialization failed",
        );
      }
    }
  }

  private hasRealStripeKeys() {
    const secret =
      this.config.get<string>("STRIPE_SECRET_KEY") ||
      this.config.get<string>("STRIPE_SECRET");
    if (!secret) return false;
    return !PLACEHOLDER_KEYS.test(secret);
  }

  async createPaymentIntent(jobId: string, amount: number, customerId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        customerId: true,
        payment: { select: { id: true, stripePaymentIntentId: true } },
      },
    });

    if (!job) throw new NotFoundException("Job not found");
    if (job.customerId !== customerId)
      throw new BadRequestException("Not your job");
    if (job.payment)
      throw new BadRequestException("Payment already exists for this job");

    if (!this.stripe) {
      this.logger.warn(
        `Stripe not configured; creating placeholder payment for job ${jobId}`,
      );
      const payment = await this.prisma.payment.create({
        data: {
          jobId,
          customerId,
          amount,
          currency: "usd",
          status: "requires_payment_method",
        },
      });
      return { payment, clientSecret: null };
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        capture_method: "manual",
        metadata: { jobId, customerId },
      });

      const payment = await this.prisma.payment.create({
        data: {
          jobId,
          customerId,
          amount,
          currency: "usd",
          stripePaymentIntentId: paymentIntent.id,
          status: paymentIntent.status,
        },
      });

      this.logger.log(
        `PaymentIntent ${paymentIntent.id} created for job ${jobId}, amount ${amount}`,
      );

      return { payment, clientSecret: paymentIntent.client_secret };
    } catch (error) {
      this.logger.error(
        `Stripe PaymentIntent creation failed for job ${jobId}`,
        error as Error,
      );
      throw new BadRequestException("Failed to create payment intent");
    }
  }

  async capturePayment(jobId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { jobId },
      include: { job: { include: { assignment: true } } },
    });

    if (!payment) throw new NotFoundException("Payment not found");
    if (!payment.stripePaymentIntentId) {
      this.logger.warn(
        `Cannot capture payment without Stripe PaymentIntent ID for job ${jobId}`,
      );
      throw new BadRequestException("Payment method not supported for capture");
    }
    if (payment.status === "succeeded") {
      throw new BadRequestException("Payment already captured");
    }

    if (!this.stripe) {
      throw new BadRequestException("Stripe not configured");
    }

    try {
      const captured = await this.stripe.paymentIntents.capture(
        payment.stripePaymentIntentId,
      );

      const updated = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: captured.status,
          capturedAt: new Date(),
        },
      });

      this.logger.log(
        `PaymentIntent ${payment.stripePaymentIntentId} captured for job ${jobId}`,
      );

      return updated;
    } catch (error) {
      this.logger.error(
        `Stripe capture failed for job ${jobId}`,
        error as Error,
      );
      throw new BadRequestException("Failed to capture payment");
    }
  }

  async createRefund(
    paymentId: string,
    amount: number,
    reason: string,
    requestedBy: string,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { refunds: true },
    });

    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.status !== "succeeded") {
      throw new BadRequestException("Can only refund succeeded payments");
    }

    const totalRefunded = payment.refunds.reduce(
      (sum, r) => (r.status === "succeeded" ? sum + r.amount : sum),
      0,
    );
    if (totalRefunded + amount > payment.amount) {
      throw new BadRequestException("Refund amount exceeds available balance");
    }

    if (!payment.stripePaymentIntentId) {
      const refund = await this.prisma.refund.create({
        data: {
          paymentId,
          amount,
          currency: payment.currency,
          reason,
          requestedBy,
          status: "manual_review",
        },
      });
      this.logger.warn(
        `Manual refund created for payment ${paymentId} (no Stripe PaymentIntent)`,
      );
      return refund;
    }

    if (!this.stripe) {
      throw new BadRequestException("Stripe not configured");
    }

    try {
      const stripeRefund = await this.stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount,
        reason: reason === "duplicate" ? "duplicate" : "requested_by_customer",
        metadata: { requestedBy, reason },
      });

      const refund = await this.prisma.refund.create({
        data: {
          paymentId,
          amount,
          currency: payment.currency,
          reason,
          stripeRefundId: stripeRefund.id,
          status: stripeRefund.status,
          requestedBy,
          processedAt: stripeRefund.status === "succeeded" ? new Date() : null,
        },
      });

      this.logger.log(
        `Refund ${stripeRefund.id} created for payment ${paymentId}, amount ${amount}`,
      );

      return refund;
    } catch (error) {
      this.logger.error(
        `Stripe refund creation failed for payment ${paymentId}`,
        error as Error,
      );
      throw new BadRequestException("Failed to create refund");
    }
  }

  async handleWebhook(rawBody: string, signature: string) {
    if (!this.stripe) {
      this.logger.warn("Stripe webhook received but Stripe not configured");
      return { received: true };
    }

    const webhookSecret = this.config.get<string>("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      this.logger.warn("Stripe webhook secret not configured");
      throw new BadRequestException("Webhook secret not configured");
    }

    try {
      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );

      this.logger.log(`Stripe webhook received: ${event.type}`);

      switch (event.type) {
        case "payment_intent.succeeded":
          await this.handlePaymentIntentSucceeded(event.data.object);
          break;
        case "payment_intent.payment_failed":
          await this.handlePaymentIntentFailed(event.data.object);
          break;
        case "charge.refunded":
          await this.handleChargeRefunded(event.data.object);
          break;
        default:
          this.logger.log(`Unhandled webhook event type: ${event.type}`);
      }

      return { received: true };
    } catch (error) {
      this.logger.error(
        "Webhook signature verification failed",
        error as Error,
      );
      throw new BadRequestException("Invalid webhook signature");
    }
  }

  private async handlePaymentIntentSucceeded(paymentIntent: any) {
    const payment = await this.prisma.payment.findFirst({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (!payment) {
      this.logger.warn(
        `Payment not found for PaymentIntent ${paymentIntent.id}`,
      );
      return;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: paymentIntent.status,
        capturedAt: new Date(),
      },
    });

    this.logger.log(`Payment ${payment.id} updated to succeeded via webhook`);
  }

  private async handlePaymentIntentFailed(paymentIntent: any) {
    const payment = await this.prisma.payment.findFirst({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (!payment) {
      this.logger.warn(
        `Payment not found for PaymentIntent ${paymentIntent.id}`,
      );
      return;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: "failed" },
    });

    this.logger.log(`Payment ${payment.id} marked as failed via webhook`);
  }

  private async handleChargeRefunded(charge: any) {
    const payment = await this.prisma.payment.findFirst({
      where: { stripePaymentIntentId: charge.payment_intent },
      include: { refunds: true },
    });

    if (!payment) {
      this.logger.warn(`Payment not found for charge ${charge.id}`);
      return;
    }

    for (const stripeRefund of charge.refunds.data) {
      const existingRefund = payment.refunds.find(
        (r) => r.stripeRefundId === stripeRefund.id,
      );

      if (existingRefund) {
        await this.prisma.refund.update({
          where: { id: existingRefund.id },
          data: {
            status: stripeRefund.status,
            processedAt:
              stripeRefund.status === "succeeded" ? new Date() : null,
          },
        });
        this.logger.log(`Refund ${existingRefund.id} updated via webhook`);
      }
    }
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
      return { mode: "none" } as const;
    }

    const stripeReady = this.hasRealStripeKeys();
    const paymentStatus = stripeReady ? "capture_pending" : "manual_review";

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
        currency: "usd",
        status: paymentStatus,
      },
    });

    if (job.assignment) {
      await this.prisma.assignment.update({
        where: { id: job.assignment.id },
        data: {
          payoutStatus: stripeReady ? "PENDING" : "AWAITING_APPROVAL",
        },
      });
    }

    if (stripeReady) {
      this.logger.log(`Stripe capture placeholder queued for job ${jobId}`);
      return { mode: "stripe" } as const;
    }

    this.logger.warn(
      `Stripe keys missing or placeholder; manual payout review required for job ${jobId}`,
    );
    return { mode: "manual" } as const;
  }

  async listPendingPayouts() {
    return this.prisma.assignment.findMany({
      where: { payoutStatus: "AWAITING_APPROVAL" },
      orderBy: { updatedAt: "desc" },
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
            customer: {
              select: {
                id: true,
                email: true,
                profile: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
        provider: {
          select: {
            id: true,
            user: {
              select: {
                email: true,
                profile: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });
  }

  async approvePayout(assignmentId: string, adminUserId: string) {
    return this.setPayoutStatus(assignmentId, "APPROVED", adminUserId);
  }

  async denyPayout(assignmentId: string, adminUserId: string) {
    return this.setPayoutStatus(assignmentId, "BLOCKED", adminUserId);
  }

  private async setPayoutStatus(
    assignmentId: string,
    status: AssignmentPayoutStatus,
    adminUserId: string,
  ) {
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
    this.logger.log(
      `Payout ${status.toLowerCase()} for assignment ${assignmentId} by ${adminUserId}`,
    );
    return updated;
  }

  async createConnectAccount(providerId: string, email: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
    });
    if (!provider) throw new NotFoundException("Provider not found");

    if (provider.stripeAccountId) {
      return { accountId: provider.stripeAccountId, alreadyExists: true };
    }

    if (!this.stripe) {
      this.logger.warn("Stripe not configured; cannot create Connect account");
      throw new BadRequestException("Stripe not configured");
    }

    try {
      const account = await this.stripe.accounts.create({
        type: "express",
        email,
        capabilities: {
          transfers: { requested: true },
        },
        metadata: { providerId },
      });

      await this.prisma.provider.update({
        where: { id: providerId },
        data: { stripeAccountId: account.id },
      });

      this.logger.log(
        `Stripe Connect account ${account.id} created for provider ${providerId}`,
      );

      return { accountId: account.id, alreadyExists: false };
    } catch (error) {
      this.logger.error(
        `Failed to create Stripe Connect account for provider ${providerId}`,
        error as Error,
      );
      throw new BadRequestException("Failed to create Connect account");
    }
  }

  async createAccountLink(
    providerId: string,
    refreshUrl: string,
    returnUrl: string,
  ) {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
    });
    if (!provider) throw new NotFoundException("Provider not found");
    if (!provider.stripeAccountId) {
      throw new BadRequestException("Provider has no Stripe Connect account");
    }

    if (!this.stripe) {
      this.logger.warn("Stripe not configured; returning mock onboarding URL");
      return { url: "https://mock-stripe-onboarding.example.com" };
    }

    try {
      const accountLink = await this.stripe.accountLinks.create({
        account: provider.stripeAccountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: "account_onboarding",
      });

      this.logger.log(`Account link created for provider ${providerId}`);

      return { url: accountLink.url };
    } catch (error) {
      this.logger.error(
        `Failed to create account link for provider ${providerId}`,
        error as Error,
      );
      throw new BadRequestException("Failed to create onboarding link");
    }
  }

  async getConnectAccountStatus(providerId: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
    });
    if (!provider) throw new NotFoundException("Provider not found");
    if (!provider.stripeAccountId) {
      return {
        hasAccount: false,
        chargesEnabled: false,
        payoutsEnabled: false,
      };
    }

    if (!this.stripe) {
      return {
        hasAccount: true,
        chargesEnabled: false,
        payoutsEnabled: false,
        accountId: provider.stripeAccountId,
      };
    }

    try {
      const account = await this.stripe.accounts.retrieve(
        provider.stripeAccountId,
      );

      return {
        hasAccount: true,
        accountId: account.id,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
      };
    } catch (error) {
      this.logger.error(
        `Failed to retrieve Connect account for provider ${providerId}`,
        error as Error,
      );
      throw new BadRequestException("Failed to retrieve account status");
    }
  }

  async createPayout(assignmentId: string, adminUserId: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        provider: true,
        job: { include: { payment: true } },
      },
    });

    if (!assignment) throw new NotFoundException("Assignment not found");
    if (!assignment.provider.stripeAccountId) {
      throw new BadRequestException("Provider has no Stripe Connect account");
    }
    if (assignment.payoutStatus !== "APPROVED") {
      throw new BadRequestException("Assignment payout not approved");
    }

    const payment = assignment.job.payment;
    if (!payment || payment.status !== "succeeded") {
      throw new BadRequestException("Job payment not completed");
    }

    if (!this.stripe) {
      this.logger.warn("Stripe not configured; marking payout as manual");
      await this.prisma.assignment.update({
        where: { id: assignmentId },
        data: { payoutStatus: "AWAITING_APPROVAL" },
      });
      throw new BadRequestException("Stripe not configured");
    }

    try {
      const payoutAmount = Math.floor(payment.amount * 0.85);

      const transfer = await this.stripe.transfers.create({
        amount: payoutAmount,
        currency: "usd",
        destination: assignment.provider.stripeAccountId,
        metadata: {
          assignmentId,
          jobId: assignment.jobId,
          approvedBy: adminUserId,
        },
      });

      await this.prisma.assignment.update({
        where: { id: assignmentId },
        data: {
          payoutStatus: "PAID",
          payoutApprovedBy: adminUserId,
          payoutApprovedAt: new Date(),
        },
      });

      this.logger.log(
        `Transfer ${transfer.id} created for assignment ${assignmentId}, amount ${payoutAmount}`,
      );

      return { transfer, payoutAmount };
    } catch (error) {
      this.logger.error(
        `Failed to create payout for assignment ${assignmentId}`,
        error as Error,
      );
      throw new BadRequestException("Failed to create payout");
    }
  }
}
