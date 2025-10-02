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
  });});
