import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AnalyticsService } from './analytics.service';

@Injectable()
export class ProvidersService {
  private readonly logger = new Logger(ProvidersService.name);
  private readonly analytics: AnalyticsService;

  constructor(private prisma: PrismaService, private config: ConfigService) {
    this.analytics = new AnalyticsService(prisma);
  }

  async ensureProviderProfile(userId: string) {
    let provider = await this.prisma.provider.findUnique({ where: { userId } });
    if (!provider) {
      provider = await this.prisma.provider.create({ data: { userId } });
    }
    return provider;
  }

  async createOnboardingLink(userId: string) {
    const stripeSecret = this.config.get<string>('STRIPE_SECRET_KEY') || this.config.get<string>('STRIPE_SECRET');

    const provider = await this.ensureProviderProfile(userId);

    const looksPlaceholder = !stripeSecret || /\*/.test(String(stripeSecret)) || /sk_live_or_test/.test(String(stripeSecret));
    if (looksPlaceholder) {
      this.logger.warn('STRIPE_SECRET_KEY not set. Returning mock onboarding URL.');
      return { url: 'https://connect.stripe.com/setup/mock' };
    }

    // Lazy import to avoid requiring stripe in environments without it
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Stripe = require('stripe');
    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' });

    // Create or reuse a Connect account
    let accountId = provider.stripeAccountId;
    if (!accountId) {
      const acct = await stripe.accounts.create({ type: 'express' });
      accountId = acct.id;
      await this.prisma.provider.update({ where: { id: provider.id }, data: { stripeAccountId: accountId } });
    }

    const returnUrl = this.config.get<string>('STRIPE_RETURN_URL') || 'http://localhost:3000/provider/onboarding/completed';
    const refreshUrl = this.config.get<string>('STRIPE_REFRESH_URL') || 'http://localhost:3000/provider/onboarding/refresh';
    try {
      const link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      });
      return { url: link.url };
    } catch (err) {
      this.logger.warn(`Stripe error creating account link; returning mock. ${String(err)}`);
      return { url: 'https://connect.stripe.com/setup/mock' };
    }
  }

  async getMe(userId: string) {
    await this.ensureProviderProfile(userId);
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
        provider: {
          select: {
            id: true,
            kycStatus: true,
            stripeAccountId: true,
            online: true,
            serviceRadiusKm: true,
            lat: true,
            lng: true,
          },
        },
      },
    });
  }

  async getAnalytics(providerId: string) {
    return this.analytics.getProviderAnalytics(providerId);
  }

  async getPerformanceMetrics(providerId: string, period: 'week' | 'month' | 'year' | 'all' = 'month') {
    return this.analytics.getProviderPerformanceMetrics(providerId, period);
  }
}
