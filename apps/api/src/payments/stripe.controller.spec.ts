import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StripeWebhookController } from './stripe.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('StripeWebhookController (stripe.controller)', () => {
  let controller: StripeWebhookController;
  let prisma: PrismaService;
  let config: ConfigService;

  const mockPrismaService = {
    provider: {
      updateMany: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  // Mock Stripe module
  const mockStripe = {
    webhooks: {
      constructEvent: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();

    // Mock Stripe require
    jest.mock('stripe', () => {
      return jest.fn().mockImplementation(() => mockStripe);
    });

    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'STRIPE_SECRET_KEY') return 'sk_test_mock';
      if (key === 'STRIPE_SECRET') return 'sk_test_fallback';
      if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_test';
      return null;
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StripeWebhookController],
      providers: [
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<StripeWebhookController>(StripeWebhookController);
    prisma = module.get<PrismaService>(PrismaService);
    config = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleWebhook', () => {
    const mockRequest = {
      rawBody: Buffer.from('test-body'),
      body: {},
    } as any;

    it('should accept event in dev mode without secret', async () => {
      mockConfigService.get.mockReturnValue(null);

      const body = {
        type: 'account.updated',
        data: {
          object: {
            id: 'acct_123',
            requirements: {
              past_due: [],
              disabled_reason: null,
            },
          },
        },
      };

      mockPrismaService.provider.updateMany.mockResolvedValue({ count: 1 });

      const result = await controller.handleWebhook(mockRequest, body, undefined);

      expect(result).toEqual({ received: true });
      expect(prisma.provider.updateMany).toHaveBeenCalledWith({
        where: { stripeAccountId: 'acct_123' },
        data: { kycStatus: 'verified' },
      });
    });

    it('should verify signature when secret is configured', async () => {
      const mockEvent = {
        type: 'account.updated',
        data: {
          object: {
            id: 'acct_456',
            requirements: {
              past_due: [],
              disabled_reason: null,
            },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockPrismaService.provider.updateMany.mockResolvedValue({ count: 1 });

      const result = await controller.handleWebhook(mockRequest, {}, 'sig_123');

      expect(result).toEqual({ received: true });
      expect(prisma.provider.updateMany).toHaveBeenCalledWith({
        where: { stripeAccountId: 'acct_456' },
        data: { kycStatus: 'verified' },
      });
    });

    it('should return received:true on signature verification failure', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const result = await controller.handleWebhook(mockRequest, {}, 'invalid-sig');

      expect(result).toEqual({ received: true });
      expect(prisma.provider.updateMany).not.toHaveBeenCalled();
    });

    it('should set kycStatus to pending when past_due requirements exist', async () => {
      const body = {
        type: 'account.updated',
        data: {
          object: {
            id: 'acct_789',
            requirements: {
              past_due: ['individual.id_number'],
              disabled_reason: null,
            },
          },
        },
      };

      mockConfigService.get.mockReturnValue(null);
      mockPrismaService.provider.updateMany.mockResolvedValue({ count: 1 });

      const result = await controller.handleWebhook(mockRequest, body, undefined);

      expect(result).toEqual({ received: true });
      expect(prisma.provider.updateMany).toHaveBeenCalledWith({
        where: { stripeAccountId: 'acct_789' },
        data: { kycStatus: 'pending' },
      });
    });

    it('should set kycStatus to verified when no past_due requirements', async () => {
      const body = {
        type: 'account.updated',
        data: {
          object: {
            id: 'acct_verified',
            requirements: {
              past_due: [],
              disabled_reason: null,
            },
          },
        },
      };

      mockConfigService.get.mockReturnValue(null);
      mockPrismaService.provider.updateMany.mockResolvedValue({ count: 1 });

      const result = await controller.handleWebhook(mockRequest, body, undefined);

      expect(result).toEqual({ received: true });
      expect(prisma.provider.updateMany).toHaveBeenCalledWith({
        where: { stripeAccountId: 'acct_verified' },
        data: { kycStatus: 'verified' },
      });
    });

    it('should ignore non-account.updated events', async () => {
      const body = {
        type: 'payment_intent.succeeded',
        data: {
          object: { id: 'pi_123' },
        },
      };

      mockConfigService.get.mockReturnValue(null);

      const result = await controller.handleWebhook(mockRequest, body, undefined);

      expect(result).toEqual({ received: true });
      expect(prisma.provider.updateMany).not.toHaveBeenCalled();
    });

    it('should handle event without data object', async () => {
      const body = {
        type: 'account.updated',
      };

      mockConfigService.get.mockReturnValue(null);

      const result = await controller.handleWebhook(mockRequest, body, undefined);

      expect(result).toEqual({ received: true });
      expect(prisma.provider.updateMany).not.toHaveBeenCalled();
    });

    it('should handle account without requirements', async () => {
      const body = {
        type: 'account.updated',
        data: {
          object: {
            id: 'acct_no_reqs',
            requirements: null,
          },
        },
      };

      mockConfigService.get.mockReturnValue(null);
      mockPrismaService.provider.updateMany.mockResolvedValue({ count: 1 });

      const result = await controller.handleWebhook(mockRequest, body, undefined);

      expect(result).toEqual({ received: true });
      expect(prisma.provider.updateMany).toHaveBeenCalledWith({
        where: { stripeAccountId: 'acct_no_reqs' },
        data: { kycStatus: 'verified' },
      });
    });

    it('should use rawBody when available', async () => {
      const mockEvent = {
        type: 'account.updated',
        data: {
          object: {
            id: 'acct_raw',
            requirements: { past_due: [], disabled_reason: null },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockImplementation((raw, sig, secret) => {
        expect(raw).toEqual(mockRequest.rawBody);
        return mockEvent;
      });
      mockPrismaService.provider.updateMany.mockResolvedValue({ count: 1 });

      await controller.handleWebhook(mockRequest, {}, 'sig_raw');

      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        mockRequest.rawBody,
        'sig_raw',
        'whsec_test',
      );
    });

    it('should fallback to body when rawBody not available', async () => {
      const requestWithoutRaw = { body: {} } as any;
      const mockEvent = {
        type: 'account.updated',
        data: {
          object: {
            id: 'acct_fallback',
            requirements: { past_due: [], disabled_reason: null },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockImplementation((raw, sig, secret) => {
        expect(raw).toEqual(requestWithoutRaw.body);
        return mockEvent;
      });
      mockPrismaService.provider.updateMany.mockResolvedValue({ count: 1 });

      await controller.handleWebhook(requestWithoutRaw, {}, 'sig_fallback');

      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        requestWithoutRaw.body,
        'sig_fallback',
        'whsec_test',
      );
    });

    it('should use STRIPE_SECRET as fallback', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'STRIPE_SECRET_KEY') return null;
        if (key === 'STRIPE_SECRET') return 'sk_test_fallback_key';
        if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_test';
        return null;
      });

      const mockEvent = {
        type: 'account.updated',
        data: {
          object: {
            id: 'acct_fallback_secret',
            requirements: { past_due: [], disabled_reason: null },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockPrismaService.provider.updateMany.mockResolvedValue({ count: 1 });

      const result = await controller.handleWebhook(mockRequest, {}, 'sig_fallback');

      expect(result).toEqual({ received: true });
    });

    it('should handle disabled_reason in requirements', async () => {
      const body = {
        type: 'account.updated',
        data: {
          object: {
            id: 'acct_disabled',
            requirements: {
              past_due: [],
              disabled_reason: 'requirements.past_due',
            },
          },
        },
      };

      mockConfigService.get.mockReturnValue(null);
      mockPrismaService.provider.updateMany.mockResolvedValue({ count: 1 });

      const result = await controller.handleWebhook(mockRequest, body, undefined);

      expect(result).toEqual({ received: true });
      // Still verifies because no past_due items (naive implementation)
      expect(prisma.provider.updateMany).toHaveBeenCalledWith({
        where: { stripeAccountId: 'acct_disabled' },
        data: { kycStatus: 'verified' },
      });
    });

    it('should update multiple providers with same stripeAccountId', async () => {
      const body = {
        type: 'account.updated',
        data: {
          object: {
            id: 'acct_shared',
            requirements: { past_due: [], disabled_reason: null },
          },
        },
      };

      mockConfigService.get.mockReturnValue(null);
      mockPrismaService.provider.updateMany.mockResolvedValue({ count: 3 });

      const result = await controller.handleWebhook(mockRequest, body, undefined);

      expect(result).toEqual({ received: true });
      expect(prisma.provider.updateMany).toHaveBeenCalledWith({
        where: { stripeAccountId: 'acct_shared' },
        data: { kycStatus: 'verified' },
      });
    });
  });
});
