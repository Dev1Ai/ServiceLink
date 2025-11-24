import { Test, TestingModule } from '@nestjs/testing';
import { StripeWebhookController } from './stripe-webhook.controller';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { Request } from 'express';

describe('StripeWebhookController', () => {
  let controller: StripeWebhookController;
  let prisma: PrismaService;
  let configService: ConfigService;

  const mockStripe = {
    webhooks: {
      constructEvent: jest.fn(),
    },
    paymentIntents: {
      retrieve: jest.fn(),
    },
  };

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
    get: jest.fn((key: string) => {
      if (key === 'STRIPE_SECRET_KEY') return 'sk_test_valid_key';
      if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_test_secret';
      return null;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock require for Stripe
    jest.mock('stripe', () => {
      return jest.fn().mockImplementation(() => mockStripe);
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
    configService = module.get<ConfigService>(ConfigService);

    // Replace stripe instance with mock
    (controller as any).stripe = mockStripe;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleWebhook - Configuration', () => {
    it('should return received:false if Stripe not configured', async () => {
      (controller as any).stripe = null;

      const result = await controller.handleWebhook('sig_test', {
        rawBody: Buffer.from('test'),
      } as any);

      expect(result).toEqual({ received: false });
    });

    it('should return received:false if webhook secret not configured', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'STRIPE_WEBHOOK_SECRET') return null;
        if (key === 'STRIPE_SECRET_KEY') return 'sk_test_valid_key';
        return null;
      });

      const result = await controller.handleWebhook('sig_test', {
        rawBody: Buffer.from('test'),
      } as any);

      expect(result).toEqual({ received: false });
    });

    it('should throw BadRequestException on signature verification failure', async () => {
      // Reset config to return webhook secret
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'STRIPE_SECRET_KEY') return 'sk_test_valid_key';
        if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_test_secret';
        return null;
      });

      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await expect(
        controller.handleWebhook('invalid_sig', {
          rawBody: Buffer.from('test'),
        } as any),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.handleWebhook('invalid_sig', {
          rawBody: Buffer.from('test'),
        } as any),
      ).rejects.toThrow('Webhook Error: Invalid signature');
    });
  });

  describe('handleWebhook - payment_intent.succeeded', () => {
    beforeEach(() => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'STRIPE_SECRET_KEY') return 'sk_test_valid_key';
        if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_test_secret';
        return null;
      });
    });

    it('should handle payment_intent.succeeded event', async () => {
      const paymentIntent = { id: 'pi_test123' };
      const mockPayment = { id: 'payment-1', stripePaymentIntentId: 'pi_test123' };

      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: { object: paymentIntent },
      });
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrismaService.payment.update.mockResolvedValue({
        ...mockPayment,
        status: 'succeeded',
      });

      const result = await controller.handleWebhook('sig_test', {
        rawBody: Buffer.from('test'),
      } as any);

      expect(result).toEqual({ received: true });
      expect(prisma.payment.findUnique).toHaveBeenCalledWith({
        where: { stripePaymentIntentId: 'pi_test123' },
      });
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-1' },
        data: {
          status: 'succeeded',
          capturedAt: expect.any(Date),
        },
      });
    });

    it('should handle payment_intent.succeeded when payment not found', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_unknown' } },
      });
      mockPrismaService.payment.findUnique.mockResolvedValue(null);

      const result = await controller.handleWebhook('sig_test', {
        rawBody: Buffer.from('test'),
      } as any);

      expect(result).toEqual({ received: true });
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhook - payment_intent.payment_failed', () => {
    it('should handle payment_intent.payment_failed event', async () => {
      const paymentIntent = { id: 'pi_failed123' };
      const mockPayment = { id: 'payment-2', stripePaymentIntentId: 'pi_failed123' };

      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'payment_intent.payment_failed',
        data: { object: paymentIntent },
      });
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrismaService.payment.update.mockResolvedValue({ ...mockPayment, status: 'failed' });

      const result = await controller.handleWebhook('sig_test', {
        rawBody: Buffer.from('test'),
      } as any);

      expect(result).toEqual({ received: true });
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-2' },
        data: { status: 'failed' },
      });
    });

    it('should handle payment_failed when payment not found', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'payment_intent.payment_failed',
        data: { object: { id: 'pi_unknown' } },
      });
      mockPrismaService.payment.findUnique.mockResolvedValue(null);

      const result = await controller.handleWebhook('sig_test', {
        rawBody: Buffer.from('test'),
      } as any);

      expect(result).toEqual({ received: true });
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhook - charge.dispute.created', () => {
    it('should handle dispute created event', async () => {
      const dispute = { id: 'dp_test', charge: 'ch_test', payment_intent: 'pi_test' };
      const mockPayment = { id: 'payment-3', stripePaymentIntentId: 'pi_test' };

      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'charge.dispute.created',
        data: { object: dispute },
      });
      mockStripe.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_test' });
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrismaService.payment.update.mockResolvedValue({ ...mockPayment, status: 'disputed' });

      const result = await controller.handleWebhook('sig_test', {
        rawBody: Buffer.from('test'),
      } as any);

      expect(result).toEqual({ received: true });
      expect(mockStripe.paymentIntents.retrieve).toHaveBeenCalledWith('pi_test');
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-3' },
        data: { status: 'disputed' },
      });
    });

    it('should handle dispute created when payment not found', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'charge.dispute.created',
        data: { object: { id: 'dp_test', payment_intent: 'pi_unknown' } },
      });
      mockStripe.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_unknown' });
      mockPrismaService.payment.findUnique.mockResolvedValue(null);

      const result = await controller.handleWebhook('sig_test', {
        rawBody: Buffer.from('test'),
      } as any);

      expect(result).toEqual({ received: true });
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhook - charge.dispute.closed', () => {
    it('should handle dispute won', async () => {
      const dispute = { id: 'dp_won', status: 'won', payment_intent: 'pi_test' };
      const mockPayment = { id: 'payment-4', stripePaymentIntentId: 'pi_test' };

      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'charge.dispute.closed',
        data: { object: dispute },
      });
      mockStripe.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_test' });
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrismaService.payment.update.mockResolvedValue({
        ...mockPayment,
        status: 'succeeded',
      });

      const result = await controller.handleWebhook('sig_test', {
        rawBody: Buffer.from('test'),
      } as any);

      expect(result).toEqual({ received: true });
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-4' },
        data: { status: 'succeeded' },
      });
    });

    it('should handle dispute lost', async () => {
      const dispute = { id: 'dp_lost', status: 'lost', payment_intent: 'pi_test' };
      const mockPayment = { id: 'payment-5', stripePaymentIntentId: 'pi_test' };

      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'charge.dispute.closed',
        data: { object: dispute },
      });
      mockStripe.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_test' });
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrismaService.payment.update.mockResolvedValue({
        ...mockPayment,
        status: 'dispute_lost',
      });

      const result = await controller.handleWebhook('sig_test', {
        rawBody: Buffer.from('test'),
      } as any);

      expect(result).toEqual({ received: true });
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-5' },
        data: { status: 'dispute_lost' },
      });
    });

    it('should handle dispute closed when payment not found', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'charge.dispute.closed',
        data: { object: { id: 'dp_test', status: 'won', payment_intent: 'pi_unknown' } },
      });
      mockStripe.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_unknown' });
      mockPrismaService.payment.findUnique.mockResolvedValue(null);

      const result = await controller.handleWebhook('sig_test', {
        rawBody: Buffer.from('test'),
      } as any);

      expect(result).toEqual({ received: true });
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhook - transfer.paid', () => {
    it('should handle transfer paid event', async () => {
      const transfer = { id: 'tr_test' };
      const mockPayout = { id: 'payout-1', stripeTransferId: 'tr_test' };

      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'transfer.paid',
        data: { object: transfer },
      });
      mockPrismaService.payout.findFirst.mockResolvedValue(mockPayout);
      mockPrismaService.payout.update.mockResolvedValue({ ...mockPayout, status: 'paid' });

      const result = await controller.handleWebhook('sig_test', {
        rawBody: Buffer.from('test'),
      } as any);

      expect(result).toEqual({ received: true });
      expect(prisma.payout.findFirst).toHaveBeenCalledWith({
        where: { stripeTransferId: 'tr_test' },
      });
      expect(prisma.payout.update).toHaveBeenCalledWith({
        where: { id: 'payout-1' },
        data: {
          status: 'paid',
          processedAt: expect.any(Date),
        },
      });
    });

    it('should handle transfer paid when payout not found', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'transfer.paid',
        data: { object: { id: 'tr_unknown' } },
      });
      mockPrismaService.payout.findFirst.mockResolvedValue(null);

      const result = await controller.handleWebhook('sig_test', {
        rawBody: Buffer.from('test'),
      } as any);

      expect(result).toEqual({ received: true });
      expect(prisma.payout.update).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhook - transfer.failed', () => {
    it('should handle transfer failed event', async () => {
      const transfer = { id: 'tr_failed', failure_message: 'Insufficient funds' };
      const mockPayout = { id: 'payout-2', stripeTransferId: 'tr_failed' };

      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'transfer.failed',
        data: { object: transfer },
      });
      mockPrismaService.payout.findFirst.mockResolvedValue(mockPayout);
      mockPrismaService.payout.update.mockResolvedValue({ ...mockPayout, status: 'failed' });

      const result = await controller.handleWebhook('sig_test', {
        rawBody: Buffer.from('test'),
      } as any);

      expect(result).toEqual({ received: true });
      expect(prisma.payout.update).toHaveBeenCalledWith({
        where: { id: 'payout-2' },
        data: {
          status: 'failed',
          failureReason: 'Insufficient funds',
        },
      });
    });

    it('should handle transfer failed with default failure message', async () => {
      const transfer = { id: 'tr_failed' };
      const mockPayout = { id: 'payout-3', stripeTransferId: 'tr_failed' };

      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'transfer.failed',
        data: { object: transfer },
      });
      mockPrismaService.payout.findFirst.mockResolvedValue(mockPayout);
      mockPrismaService.payout.update.mockResolvedValue({ ...mockPayout, status: 'failed' });

      const result = await controller.handleWebhook('sig_test', {
        rawBody: Buffer.from('test'),
      } as any);

      expect(result).toEqual({ received: true });
      expect(prisma.payout.update).toHaveBeenCalledWith({
        where: { id: 'payout-3' },
        data: {
          status: 'failed',
          failureReason: 'Transfer failed',
        },
      });
    });

    it('should handle transfer failed when payout not found', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'transfer.failed',
        data: { object: { id: 'tr_unknown' } },
      });
      mockPrismaService.payout.findFirst.mockResolvedValue(null);

      const result = await controller.handleWebhook('sig_test', {
        rawBody: Buffer.from('test'),
      } as any);

      expect(result).toEqual({ received: true });
      expect(prisma.payout.update).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhook - Unhandled events', () => {
    it('should handle unhandled event types', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'customer.created',
        data: { object: {} },
      });

      const result = await controller.handleWebhook('sig_test', {
        rawBody: Buffer.from('test'),
      } as any);

      expect(result).toEqual({ received: true });
    });

    it('should throw error on webhook processing failure', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test' } },
      });
      mockPrismaService.payment.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(
        controller.handleWebhook('sig_test', {
          rawBody: Buffer.from('test'),
        } as any),
      ).rejects.toThrow('Database error');
    });
  });
});
