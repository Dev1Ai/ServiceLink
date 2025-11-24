import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StripeWebhookController } from './stripe-webhook.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('StripeWebhookController', () => {
  let controller: StripeWebhookController;
  let prisma: PrismaService;
  let config: ConfigService;

  const mockPrismaService = {
    payment: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    payout: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  // Mock Stripe instance
  const mockStripe = {
    webhooks: {
      constructEvent: jest.fn(),
    },
    paymentIntents: {
      retrieve: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();

    // Mock Stripe module
    jest.mock('stripe', () => {
      return jest.fn().mockImplementation(() => mockStripe);
    });

    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'STRIPE_SECRET_KEY') return 'sk_test_mock_key';
      if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_mock_secret';
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

    // Inject mock Stripe instance
    (controller as any).stripe = mockStripe;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleWebhook', () => {
    const mockRequest = {
      rawBody: Buffer.from('mock-raw-body'),
    } as any;

    it('should return received:false when Stripe not configured', async () => {
      (controller as any).stripe = null;

      const result = await controller.handleWebhook('sig', mockRequest);

      expect(result).toEqual({ received: false });
    });

    it('should return received:false when webhook secret not configured', async () => {
      mockConfigService.get.mockReturnValue(null);

      const result = await controller.handleWebhook('sig', mockRequest);

      expect(result).toEqual({ received: false });
    });

    it('should throw BadRequestException on signature verification failure', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await expect(controller.handleWebhook('invalid-sig', mockRequest)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.handleWebhook('invalid-sig', mockRequest)).rejects.toThrow(
        'Webhook Error: Invalid signature',
      );
    });

    it('should process payment_intent.succeeded event', async () => {
      const mockEvent = {
        type: 'payment_intent.succeeded',
        data: {
          object: { id: 'pi_123' },
        },
      };
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockPrismaService.payment.findUnique.mockResolvedValue({ id: 'payment-1' });
      mockPrismaService.payment.update.mockResolvedValue({});

      const result = await controller.handleWebhook('sig', mockRequest);

      expect(result).toEqual({ received: true });
      expect(prisma.payment.findUnique).toHaveBeenCalledWith({
        where: { stripePaymentIntentId: 'pi_123' },
      });
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-1' },
        data: {
          status: 'succeeded',
          capturedAt: expect.any(Date),
        },
      });
    });

    it('should process payment_intent.payment_failed event', async () => {
      const mockEvent = {
        type: 'payment_intent.payment_failed',
        data: {
          object: { id: 'pi_456' },
        },
      };
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockPrismaService.payment.findUnique.mockResolvedValue({ id: 'payment-2' });
      mockPrismaService.payment.update.mockResolvedValue({});

      const result = await controller.handleWebhook('sig', mockRequest);

      expect(result).toEqual({ received: true });
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-2' },
        data: { status: 'failed' },
      });
    });

    it('should process charge.dispute.created event', async () => {
      const mockEvent = {
        type: 'charge.dispute.created',
        data: {
          object: {
            id: 'dp_789',
            charge: 'ch_123',
            payment_intent: 'pi_123',
          },
        },
      };
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockStripe.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_123' });
      mockPrismaService.payment.findUnique.mockResolvedValue({ id: 'payment-3' });
      mockPrismaService.payment.update.mockResolvedValue({});

      const result = await controller.handleWebhook('sig', mockRequest);

      expect(result).toEqual({ received: true });
      expect(mockStripe.paymentIntents.retrieve).toHaveBeenCalledWith('pi_123');
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-3' },
        data: { status: 'disputed' },
      });
    });

    it('should process charge.dispute.closed event with won status', async () => {
      const mockEvent = {
        type: 'charge.dispute.closed',
        data: {
          object: {
            id: 'dp_789',
            status: 'won',
            payment_intent: 'pi_123',
          },
        },
      };
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockStripe.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_123' });
      mockPrismaService.payment.findUnique.mockResolvedValue({ id: 'payment-4' });
      mockPrismaService.payment.update.mockResolvedValue({});

      const result = await controller.handleWebhook('sig', mockRequest);

      expect(result).toEqual({ received: true });
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-4' },
        data: { status: 'succeeded' },
      });
    });

    it('should process charge.dispute.closed event with lost status', async () => {
      const mockEvent = {
        type: 'charge.dispute.closed',
        data: {
          object: {
            id: 'dp_789',
            status: 'lost',
            payment_intent: 'pi_123',
          },
        },
      };
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockStripe.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_123' });
      mockPrismaService.payment.findUnique.mockResolvedValue({ id: 'payment-5' });
      mockPrismaService.payment.update.mockResolvedValue({});

      const result = await controller.handleWebhook('sig', mockRequest);

      expect(result).toEqual({ received: true });
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-5' },
        data: { status: 'dispute_lost' },
      });
    });

    it('should process transfer.paid event', async () => {
      const mockEvent = {
        type: 'transfer.paid',
        data: {
          object: { id: 'tr_123' },
        },
      };
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockPrismaService.payout.findFirst.mockResolvedValue({ id: 'payout-1' });
      mockPrismaService.payout.update.mockResolvedValue({});

      const result = await controller.handleWebhook('sig', mockRequest);

      expect(result).toEqual({ received: true });
      expect(prisma.payout.findFirst).toHaveBeenCalledWith({
        where: { stripeTransferId: 'tr_123' },
      });
      expect(prisma.payout.update).toHaveBeenCalledWith({
        where: { id: 'payout-1' },
        data: {
          status: 'paid',
          processedAt: expect.any(Date),
        },
      });
    });

    it('should process transfer.failed event', async () => {
      const mockEvent = {
        type: 'transfer.failed',
        data: {
          object: {
            id: 'tr_456',
            failure_message: 'Insufficient funds',
          },
        },
      };
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockPrismaService.payout.findFirst.mockResolvedValue({ id: 'payout-2' });
      mockPrismaService.payout.update.mockResolvedValue({});

      const result = await controller.handleWebhook('sig', mockRequest);

      expect(result).toEqual({ received: true });
      expect(prisma.payout.update).toHaveBeenCalledWith({
        where: { id: 'payout-2' },
        data: {
          status: 'failed',
          failureReason: 'Insufficient funds',
        },
      });
    });

    it('should handle unhandled event types', async () => {
      const mockEvent = {
        type: 'customer.created',
        data: { object: {} },
      };
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const result = await controller.handleWebhook('sig', mockRequest);

      expect(result).toEqual({ received: true });
    });

    it('should not update payment if not found for payment_intent.succeeded', async () => {
      const mockEvent = {
        type: 'payment_intent.succeeded',
        data: {
          object: { id: 'pi_nonexistent' },
        },
      };
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockPrismaService.payment.findUnique.mockResolvedValue(null);

      const result = await controller.handleWebhook('sig', mockRequest);

      expect(result).toEqual({ received: true });
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('should not update payout if not found for transfer.paid', async () => {
      const mockEvent = {
        type: 'transfer.paid',
        data: {
          object: { id: 'tr_nonexistent' },
        },
      };
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockPrismaService.payout.findFirst.mockResolvedValue(null);

      const result = await controller.handleWebhook('sig', mockRequest);

      expect(result).toEqual({ received: true });
      expect(prisma.payout.update).not.toHaveBeenCalled();
    });

    it('should handle transfer.failed with missing failure_message', async () => {
      const mockEvent = {
        type: 'transfer.failed',
        data: {
          object: {
            id: 'tr_789',
            failure_message: null,
          },
        },
      };
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockPrismaService.payout.findFirst.mockResolvedValue({ id: 'payout-3' });
      mockPrismaService.payout.update.mockResolvedValue({});

      const result = await controller.handleWebhook('sig', mockRequest);

      expect(result).toEqual({ received: true });
      expect(prisma.payout.update).toHaveBeenCalledWith({
        where: { id: 'payout-3' },
        data: {
          status: 'failed',
          failureReason: 'Transfer failed',
        },
      });
    });

    it('should throw error if event processing fails', async () => {
      const mockEvent = {
        type: 'payment_intent.succeeded',
        data: {
          object: { id: 'pi_error' },
        },
      };
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockPrismaService.payment.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(controller.handleWebhook('sig', mockRequest)).rejects.toThrow('Database error');
    });
  });

  describe('Constructor', () => {
    it('should not initialize Stripe if key not configured', () => {
      mockConfigService.get.mockReturnValue(null);

      const module = Test.createTestingModule({
        controllers: [StripeWebhookController],
        providers: [
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      expect(module).toBeDefined();
    });

    it('should not initialize Stripe if key contains test_or_replace', () => {
      mockConfigService.get.mockReturnValue('sk_test_or_replace_me');

      const module = Test.createTestingModule({
        controllers: [StripeWebhookController],
        providers: [
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      expect(module).toBeDefined();
    });
  });
});
