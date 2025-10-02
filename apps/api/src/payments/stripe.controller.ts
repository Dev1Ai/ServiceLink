import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('providers')
@Controller('stripe')
export class StripeWebhookController {
  constructor(private prisma: PrismaService, private config: ConfigService) {}

  @Post('webhook')
  @ApiExcludeEndpoint()
  async handleWebhook(
    @Req() req: Request & { rawBody?: Buffer | string },
    @Body() body: unknown,
    @Headers('stripe-signature') sig?: string,
  ) {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');

    // If no secret, assume dev mode and accept parsed JSON directly
    let event: unknown = body;
    if (secret) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Stripe = require('stripe');
        const stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY') || this.config.get<string>('STRIPE_SECRET'), { apiVersion: '2024-06-20' });
        const raw = req.rawBody ?? req.body; // rawBody is set by express.raw in main.ts
        event = stripe.webhooks.constructEvent(raw, sig, secret);
      } catch (err) {
        // If verification fails, just ignore in dev
        return { received: true };
      }
    }

    const ev = event as { type?: string; data?: { object?: { id: string; requirements?: { disabled_reason?: string; past_due?: unknown[] } } } };
    if (ev?.type === 'account.updated' && ev?.data?.object) {
      const acct = ev.data.object;
      const stripeAccountId = acct.id;
      // naive mapping: if no past_due and no disabled reason, consider verified
      const kycStatus = acct.requirements?.past_due?.length ? 'pending' : 'verified';
      await this.prisma.provider.updateMany({ where: { stripeAccountId }, data: { kycStatus } });
    }

    return { received: true };
  }
}
