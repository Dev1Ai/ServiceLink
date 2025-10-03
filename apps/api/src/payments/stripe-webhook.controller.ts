import { Controller, Post, Headers, RawBodyRequest, Req, Logger, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Request } from 'express';

@ApiTags('webhooks')
@Controller('webhooks/stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);
  private stripe: any;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const stripeKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (stripeKey && !stripeKey.includes('test_or_replace')) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Stripe = require('stripe');
      this.stripe = new Stripe(stripeKey, {
        apiVersion: '2024-11-20.acacia',
      });
    }
  }

  @Post()
  @ApiOperation({ summary: 'Handle Stripe webhook events' })
  async handleWebhook(@Headers('stripe-signature') signature: string, @Req() req: RawBodyRequest<Request>) {
    if (!this.stripe) {
      this.logger.warn('Stripe not configured, ignoring webhook');
      return { received: false };
    }

    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      this.logger.warn('STRIPE_WEBHOOK_SECRET not configured');
      return { received: false };
    }

    let event: any;

    try {
      event = this.stripe.webhooks.constructEvent(req.rawBody, signature, webhookSecret);
    } catch (err: any) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    this.logger.log(`Processing Stripe event: ${event.type}`);

    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event.data.object);
          break;

        case 'charge.dispute.created':
          await this.handleDisputeCreated(event.data.object);
          break;

        case 'charge.dispute.closed':
          await this.handleDisputeClosed(event.data.object);
          break;

        case 'transfer.paid':
          await this.handleTransferPaid(event.data.object);
          break;

        case 'transfer.failed':
          await this.handleTransferFailed(event.data.object);
          break;

        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error: any) {
      this.logger.error(`Error processing webhook: ${error.message}`);
      throw error;
    }

    return { received: true };
  }

  private async handlePaymentIntentSucceeded(paymentIntent: any) {
    const payment = await this.prisma.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (payment) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'succeeded',
          capturedAt: new Date(),
        },
      });
      this.logger.log(`Payment ${payment.id} succeeded`);
    }
  }

  private async handlePaymentIntentFailed(paymentIntent: any) {
    const payment = await this.prisma.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (payment) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'failed' },
      });
      this.logger.warn(`Payment ${payment.id} failed`);
    }
  }

  private async handleDisputeCreated(dispute: any) {
    this.logger.warn(`Dispute created: ${dispute.id} for charge ${dispute.charge}`);

    // Find payment by charge ID
    const paymentIntent = await this.stripe.paymentIntents.retrieve(dispute.payment_intent);
    const payment = await this.prisma.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (payment) {
      // Mark payment as disputed
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'disputed' },
      });
    }
  }

  private async handleDisputeClosed(dispute: any) {
    const status = dispute.status; // 'won' | 'lost'
    this.logger.log(`Dispute ${dispute.id} closed with status: ${status}`);

    const paymentIntent = await this.stripe.paymentIntents.retrieve(dispute.payment_intent);
    const payment = await this.prisma.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (payment) {
      const newStatus = status === 'won' ? 'succeeded' : 'dispute_lost';
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: newStatus },
      });
    }
  }

  private async handleTransferPaid(transfer: any) {
    const payout = await this.prisma.payout.findFirst({
      where: { stripeTransferId: transfer.id },
    });

    if (payout) {
      await this.prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: 'paid',
          processedAt: new Date(),
        },
      });
      this.logger.log(`Payout ${payout.id} completed`);
    }
  }

  private async handleTransferFailed(transfer: any) {
    const payout = await this.prisma.payout.findFirst({
      where: { stripeTransferId: transfer.id },
    });

    if (payout) {
      await this.prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: 'failed',
          failureReason: transfer.failure_message || 'Transfer failed',
        },
      });
      this.logger.error(`Payout ${payout.id} failed: ${transfer.failure_message}`);
    }
  }
}
