import 'reflect-metadata';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JobsController } from './jobs.controller';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../metrics/metrics.service';
import { JwtAuthGuard, RolesGuard } from '../auth/jwt.guard';
import { QuotesRoleLimitGuard } from '../common/guards/quotes-role-limit.guard';
import { JobsRoleLimitGuard } from '../common/guards/jobs-role-limit.guard';
import { QuotesService } from './quotes.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AssignmentsService } from './assignments.service';
import { PaymentsService } from '../payments/payments.service';
import type { AuthedRequest } from '../common/types/request';

describe('JobsController - quotes', () => {
  let controller: JobsController;
  let prisma: {
    provider: { findUnique: jest.Mock };
    job: { findUnique: jest.Mock };
    quote: { findFirst: jest.Mock; create: jest.Mock };
    assignment: { upsert: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };

  const metricsMock = { incPaymentInitiate: jest.fn() } as unknown as MetricsService;
  const paymentsMockImpl = { handleCustomerVerification: jest.fn().mockResolvedValue({ mode: 'manual' }) };
  const paymentsMock = paymentsMockImpl as unknown as PaymentsService;

  beforeEach(async () => {
    prisma = {
      provider: { findUnique: jest.fn() },
      job: { findUnique: jest.fn() },
      quote: { findFirst: jest.fn(), create: jest.fn() },
      assignment: { upsert: jest.fn(), update: jest.fn() },
      $transaction: jest.fn(),
    } as any;

    const moduleRef = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: MetricsService, useValue: metricsMock },
        NotificationsService,
        { provide: AssignmentsService, useValue: { proposeScheduleAsCustomer: jest.fn() } },
        { provide: PaymentsService, useValue: paymentsMock },
        QuotesService,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(QuotesRoleLimitGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JobsRoleLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(JobsController);
  });

  const reqWithUser = (sub: string): AuthedRequest => ({
    user: { sub },
  }) as unknown as AuthedRequest;

  it('throws Forbidden when provider profile missing', async () => {
    prisma.provider.findUnique.mockResolvedValue(null);
    await expect(
      controller.createQuote('job1', reqWithUser('user1'), { total: 100 } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws NotFound when job does not exist', async () => {
    prisma.provider.findUnique.mockResolvedValue({ id: 'prov1', userId: 'user1' });
    prisma.job.findUnique.mockResolvedValue(null);
    await expect(
      controller.createQuote('job-missing', reqWithUser('user1'), { total: 120 } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws BadRequest on duplicate quote (pre-check)', async () => {
    prisma.provider.findUnique.mockResolvedValue({ id: 'prov1', userId: 'user1' });
    prisma.job.findUnique.mockResolvedValue({ id: 'job1' });
    prisma.quote.findFirst.mockResolvedValue({ id: 'q1' });
    await expect(
      controller.createQuote('job1', reqWithUser('user1'), { total: 150 } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws BadRequest on Prisma unique violation (race)', async () => {
    prisma.provider.findUnique.mockResolvedValue({ id: 'prov1', userId: 'user1' });
    prisma.job.findUnique.mockResolvedValue({ id: 'job1' });
    prisma.quote.findFirst.mockResolvedValue(null);
    prisma.quote.create.mockRejectedValue({ code: 'P2002' });
    await expect(
      controller.createQuote('job1', reqWithUser('user1'), { total: 200 } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates quote on happy path', async () => {
    prisma.provider.findUnique.mockResolvedValue({ id: 'prov1', userId: 'user1' });
    prisma.job.findUnique.mockResolvedValue({ id: 'job1' });
    prisma.quote.findFirst.mockResolvedValue(null);
    prisma.quote.create.mockResolvedValue({ id: 'q-new', jobId: 'job1', providerId: 'prov1', total: 300, status: 'pending' });
    const result = await controller.createQuote('job1', reqWithUser('user1'), { total: 300 } as any);
    expect(result).toMatchObject({ id: 'q-new', total: 300 });
    expect(prisma.quote.create).toHaveBeenCalledWith({
      data: { jobId: 'job1', providerId: 'prov1', total: 300 },
    });
  });

  it('calls payments service when customer verifies completion', async () => {
    prisma.job.findUnique.mockResolvedValue({
      id: 'job1',
      customerId: 'cust1',
      assignment: { id: 'assign1', status: 'scheduled' },
    });
    prisma.assignment.update.mockResolvedValue({ id: 'assign1', status: 'customer_verified', customerVerifiedAt: new Date().toISOString() });

    const result = await controller.customerComplete('job1', reqWithUser('cust1'));
    expect(result.status).toBe('customer_verified');
    expect(metricsMock.incPaymentInitiate).toHaveBeenCalledWith('job_complete');
    expect(paymentsMockImpl.handleCustomerVerification).toHaveBeenCalledWith('job1');
  });
});
