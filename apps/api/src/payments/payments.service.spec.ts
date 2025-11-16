import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockStripe = {
  paymentIntents: {
    create: jest.fn().mockResolvedValue({ id: 'pi_123', client_secret: 'cs_123', status: 'requires_payment_method' }),
    capture: jest.fn().mockResolvedValue({ id: 'pi_123', status: 'succeeded' }),
  },
  refunds: {
    create: jest.fn().mockResolvedValue({ id: 're_123', status: 'succeeded' }),
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
};

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => mockStripe);
});

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: PrismaService;

  const mockJob = {
    id: 'job-1',
    customerId: 'customer-1',
    payment: null,
  };

  const prismaMock = {
    job: {
      findUnique: jest.fn().mockResolvedValue(mockJob),
    },
    payment: {
      create: jest.fn().mockImplementation(args => Promise.resolve({ id: 'payment-1', ...args.data })),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    refund: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'STRIPE_SECRET_KEY') return 'sk_test_123';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPaymentIntent', () => {
    it('should create a payment intent and save payment record', async () => {
      const result = await service.createPaymentIntent('job-1', 5000, 'customer-1');

      expect(prisma.job.findUnique).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        select: { id: true, customerId: true, payment: { select: { id: true, stripePaymentIntentId: true } } },
      });
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 5000,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        capture_method: 'manual',
        metadata: { jobId: 'job-1', customerId: 'customer-1' },
      });
      expect(prisma.payment.create).toHaveBeenCalled();
      expect(result.clientSecret).toBe('cs_123');
    });

    it('should throw NotFoundException if job not found', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValueOnce(null);
      await expect(service.createPaymentIntent('job-dne', 5000, 'customer-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if job belongs to another customer', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValueOnce({ ...mockJob, customerId: 'another-customer' });
      await expect(service.createPaymentIntent('job-1', 5000, 'customer-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if payment already exists', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValueOnce({ ...mockJob, payment: { id: 'payment-1', stripePaymentIntentId: 'pi_old' } });
      await expect(service.createPaymentIntent('job-1', 5000, 'customer-1')).rejects.toThrow(BadRequestException);
    });
  });
});