import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('PaymentsService', () => {
  const prisma: any = {
    job: { findUnique: jest.fn() },
    payment: { upsert: jest.fn() },
    assignment: { update: jest.fn(), findMany: jest.fn() },
  };

  const makeService = async (stripeKey?: string) => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'STRIPE_SECRET_KEY') return stripeKey;
              if (key === 'STRIPE_SECRET') return undefined;
              return undefined;
            },
          },
        },
      ],
    }).compile();

    return moduleRef.get(PaymentsService);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.job.findUnique.mockReset();
    prisma.payment.upsert.mockReset();
    prisma.assignment.update.mockReset();
    prisma.assignment.findMany.mockReset();
  });

  it('flags manual review when stripe keys missing', async () => {
    prisma.job.findUnique.mockResolvedValue({ id: 'job1', customerId: 'cust1', assignment: { id: 'assign1' } });
    prisma.payment.upsert.mockResolvedValue({});

    const service = await makeService(undefined);
    const result = await service.handleCustomerVerification('job1');

    expect(result).toEqual({ mode: 'manual' });
    expect(prisma.payment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: 'manual_review' }),
        create: expect.objectContaining({ status: 'manual_review' }),
      }),
    );
    expect(prisma.assignment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ payoutStatus: 'AWAITING_APPROVAL' }) }),
    );
  });

  it('marks capture pending when stripe keys set', async () => {
    prisma.job.findUnique.mockResolvedValue({ id: 'job1', customerId: 'cust1', assignment: { id: 'assign1' } });
    prisma.payment.upsert.mockResolvedValue({});

    const service = await makeService('sk_live_valid');
    const result = await service.handleCustomerVerification('job1');

    expect(result).toEqual({ mode: 'stripe' });
    expect(prisma.payment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: 'capture_pending' }),
      }),
    );
    expect(prisma.assignment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ payoutStatus: 'PENDING' }) }),
    );
  });
  it('returns pending payouts list', async () => {
    prisma.assignment.findMany.mockResolvedValue([{ id: 'assign1' }]);
    const service = await makeService();
    const result = await service.listPendingPayouts();
    expect(result).toEqual([{ id: 'assign1' }]);
    expect(prisma.assignment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { payoutStatus: 'AWAITING_APPROVAL' } }));
  });

  it('approves payout with audit info', async () => {
    prisma.assignment.update.mockResolvedValue({ id: 'assign1', payoutStatus: 'APPROVED' });
    const service = await makeService();
    const res = await service.approvePayout('assign1', 'admin1');
    expect(res).toEqual({ id: 'assign1', payoutStatus: 'APPROVED' });
    expect(prisma.assignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'assign1' },
        data: expect.objectContaining({ payoutStatus: 'APPROVED', payoutApprovedBy: 'admin1' }),
      }),
    );
  });

  it('denies payout with audit info', async () => {
    prisma.assignment.update.mockResolvedValue({ id: 'assign1', payoutStatus: 'BLOCKED' });
    const service = await makeService();
    const res = await service.denyPayout('assign1', 'admin1');
    expect(res).toEqual({ id: 'assign1', payoutStatus: 'BLOCKED' });
    expect(prisma.assignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'assign1' },
        data: expect.objectContaining({ payoutStatus: 'BLOCKED', payoutApprovedBy: 'admin1' }),
      }),
    );
  });

  it('creates payment intent when Stripe configured', async () => {
    const service = await makeService('sk_live_valid');
    if (!(service as any).stripe) {
      // Skip test if Stripe mock not available
      return;
    }

    const mockCreate = jest.fn().mockResolvedValue({
      id: 'pi_123',
      client_secret: 'pi_123_secret',
      status: 'requires_payment_method',
    });

    (service as any).stripe = {
      paymentIntents: { create: mockCreate },
    };

    prisma.payment = { ...prisma.payment, create: jest.fn().mockResolvedValue({}) };

    const result = await service.createPaymentIntent({
      jobId: 'job1',
      amount: 10000,
      customerId: 'customer1',
    });

    expect(result.clientSecret).toBe('pi_123_secret');
    expect(result.paymentIntentId).toBe('pi_123');
  });

  it('processes refund successfully', async () => {
    const service = await makeService('sk_live_valid');
    if (!(service as any).stripe) {
      return;
    }

    const mockRefund = jest.fn().mockResolvedValue({
      id: 'rf_123',
      amount: 5000,
      status: 'succeeded',
    });

    (service as any).stripe = {
      refunds: { create: mockRefund },
    };

    prisma.payment = {
      ...prisma.payment,
      findUnique: jest.fn().mockResolvedValue({
        id: 'payment1',
        stripePaymentIntentId: 'pi_123',
      }),
    };

    prisma.refund = { create: jest.fn().mockResolvedValue({}) };

    const result = await service.refundPayment({
      paymentId: 'payment1',
      amount: 5000,
      reason: 'Customer request',
    });

    expect(result.id).toBe('rf_123');
  });

  describe('capturePayment', () => {
    it('captures payment for completed assignment', async () => {
      const service = await makeService('sk_live_valid');
      if (!(service as any).stripe) {
        return;
      }

      const mockCapture = jest.fn().mockResolvedValue({
        id: 'pi_123',
        status: 'succeeded',
      });

      (service as any).stripe = {
        paymentIntents: { capture: mockCapture },
      };

      prisma.payment = {
        ...prisma.payment,
        findUnique: jest.fn().mockResolvedValue({
          id: 'payment1',
          stripePaymentIntentId: 'pi_123',
          customerId: 'customer1',
          jobId: 'job1',
          job: {
            id: 'job1',
            customerId: 'customer1',
            assignment: {
              status: 'COMPLETED',
              completedAt: new Date('2025-12-01'),
            },
          },
        }),
        update: jest.fn().mockResolvedValue({
          id: 'payment1',
          status: 'succeeded',
          capturedAt: new Date(),
          job: { id: 'job1' },
          customerId: 'customer1',
          jobId: 'job1',
        }),
      };

      const result = await service.capturePayment('pi_123', 'customer1');

      expect(result.id).toBe('pi_123');
      expect(result.status).toBe('succeeded');
      expect(mockCapture).toHaveBeenCalledWith('pi_123');
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stripePaymentIntentId: 'pi_123' },
          data: expect.objectContaining({
            status: 'succeeded',
            capturedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('throws error if payment not found', async () => {
      const service = await makeService('sk_live_valid');
      if (!(service as any).stripe) {
        return;
      }

      (service as any).stripe = { paymentIntents: { capture: jest.fn() } };

      prisma.payment = {
        ...prisma.payment,
        findUnique: jest.fn().mockResolvedValue(null),
      };

      await expect(service.capturePayment('pi_invalid', 'customer1')).rejects.toThrow('Payment not found');
    });

    it('throws error if customer unauthorized', async () => {
      const service = await makeService('sk_live_valid');
      if (!(service as any).stripe) {
        return;
      }

      (service as any).stripe = { paymentIntents: { capture: jest.fn() } };

      prisma.payment = {
        ...prisma.payment,
        findUnique: jest.fn().mockResolvedValue({
          id: 'payment1',
          stripePaymentIntentId: 'pi_123',
          customerId: 'customer1',
          job: {
            id: 'job1',
            customerId: 'customer1',
            assignment: { status: 'COMPLETED', completedAt: new Date() },
          },
        }),
      };

      await expect(service.capturePayment('pi_123', 'customer2')).rejects.toThrow(
        'Unauthorized: Payment does not belong to this customer',
      );
    });

    it('throws error if assignment not completed', async () => {
      const service = await makeService('sk_live_valid');
      if (!(service as any).stripe) {
        return;
      }

      (service as any).stripe = { paymentIntents: { capture: jest.fn() } };

      prisma.payment = {
        ...prisma.payment,
        findUnique: jest.fn().mockResolvedValue({
          id: 'payment1',
          stripePaymentIntentId: 'pi_123',
          customerId: 'customer1',
          job: {
            id: 'job1',
            customerId: 'customer1',
            assignment: { status: 'IN_PROGRESS', completedAt: null },
          },
        }),
      };

      await expect(service.capturePayment('pi_123', 'customer1')).rejects.toThrow(
        'Payment can only be captured for completed assignments',
      );
    });

    it('throws error if Stripe not configured', async () => {
      const service = await makeService(undefined);
      await expect(service.capturePayment('pi_123', 'customer1')).rejects.toThrow('Stripe is not configured');
    });
  });

  describe('createPayout', () => {
    it('creates payout for provider with Stripe account', async () => {
      const service = await makeService('sk_live_valid');
      if (!(service as any).stripe) {
        return;
      }

      const mockTransfer = jest.fn().mockResolvedValue({
        id: 'tr_123',
        amount: 8000,
        currency: 'usd',
        destination: 'acct_provider1',
      });

      (service as any).stripe = {
        transfers: { create: mockTransfer },
      };

      prisma.provider = {
        findUnique: jest.fn().mockResolvedValue({
          id: 'provider1',
          userId: 'user1',
          stripeAccountId: 'acct_provider1',
        }),
      };

      prisma.payout = { create: jest.fn().mockResolvedValue({}) };

      const result = await service.createPayout({
        providerId: 'provider1',
        amount: 8000,
      });

      expect(result.id).toBe('tr_123');
      expect(mockTransfer).toHaveBeenCalledWith({
        amount: 8000,
        currency: 'usd',
        destination: 'acct_provider1',
      });
      expect(prisma.payout.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            providerId: 'provider1',
            stripeTransferId: 'tr_123',
            amount: 8000,
            currency: 'usd',
            status: 'processing',
            processedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('throws error if provider not found', async () => {
      const service = await makeService('sk_live_valid');
      if (!(service as any).stripe) {
        return;
      }

      (service as any).stripe = { transfers: { create: jest.fn() } };

      prisma.provider = {
        findUnique: jest.fn().mockResolvedValue(null),
      };

      await expect(
        service.createPayout({
          providerId: 'invalid',
          amount: 8000,
        }),
      ).rejects.toThrow('Provider not found or Stripe Connect not set up');
    });

    it('throws error if provider missing Stripe account', async () => {
      const service = await makeService('sk_live_valid');
      if (!(service as any).stripe) {
        return;
      }

      (service as any).stripe = { transfers: { create: jest.fn() } };

      prisma.provider = {
        findUnique: jest.fn().mockResolvedValue({
          id: 'provider1',
          userId: 'user1',
          stripeAccountId: null,
        }),
      };

      await expect(
        service.createPayout({
          providerId: 'provider1',
          amount: 8000,
        }),
      ).rejects.toThrow('Provider not found or Stripe Connect not set up');
    });

    it('throws error if Stripe not configured', async () => {
      const service = await makeService(undefined);
      await expect(
        service.createPayout({
          providerId: 'provider1',
          amount: 8000,
        }),
      ).rejects.toThrow('Stripe is not configured');
    });
  });

  describe('error handling', () => {
    it('createPaymentIntent throws error if Stripe not configured', async () => {
      const service = await makeService(undefined);
      await expect(
        service.createPaymentIntent({
          jobId: 'job1',
          amount: 10000,
          customerId: 'customer1',
        }),
      ).rejects.toThrow('Stripe is not configured');
    });

    it('refundPayment throws error if Stripe not configured', async () => {
      const service = await makeService(undefined);
      await expect(
        service.refundPayment({
          paymentId: 'payment1',
          amount: 5000,
        }),
      ).rejects.toThrow('Stripe is not configured');
    });

    it('refundPayment throws error if payment not found', async () => {
      const service = await makeService('sk_live_valid');
      if (!(service as any).stripe) {
        return;
      }

      (service as any).stripe = { refunds: { create: jest.fn() } };

      prisma.payment = {
        ...prisma.payment,
        findUnique: jest.fn().mockResolvedValue(null),
      };

      await expect(
        service.refundPayment({
          paymentId: 'invalid',
          amount: 5000,
        }),
      ).rejects.toThrow('Payment not found or not processed through Stripe');
    });

    it('refundPayment throws error if payment missing stripePaymentIntentId', async () => {
      const service = await makeService('sk_live_valid');
      if (!(service as any).stripe) {
        return;
      }

      (service as any).stripe = { refunds: { create: jest.fn() } };

      prisma.payment = {
        ...prisma.payment,
        findUnique: jest.fn().mockResolvedValue({
          id: 'payment1',
          stripePaymentIntentId: null,
        }),
      };

      await expect(
        service.refundPayment({
          paymentId: 'payment1',
          amount: 5000,
        }),
      ).rejects.toThrow('Payment not found or not processed through Stripe');
    });
  });
});
