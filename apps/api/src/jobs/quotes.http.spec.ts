import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JobsController } from './jobs.controller';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../metrics/metrics.service';
import { JwtAuthGuard, RolesGuard } from '../auth/jwt.guard';
import { QuotesRoleLimitGuard } from '../common/guards/quotes-role-limit.guard';
import { JobsRoleLimitGuard } from '../common/guards/jobs-role-limit.guard';
import { NotificationsService } from '../notifications/notifications.service';
import { QuotesService } from './quotes.service';

describe('Jobs/Quotes HTTP (E2E-lite)', () => {
  let app: INestApplication;
  const prisma: any = {
    job: { findUnique: jest.fn() },
    quote: { count: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
    assignment: { upsert: jest.fn(), findUnique: jest.fn(), delete: jest.fn(), update: jest.fn() },
    $transaction: jest.fn().mockImplementation(async (fn: any) => await fn(prisma)),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: MetricsService, useValue: { incPaymentInitiate: jest.fn() } },
        NotificationsService,
        QuotesService,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          // default to CUSTOMER; tests can override per-case by changing return
          req.user = { sub: 'cust1', role: 'CUSTOMER' };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(QuotesRoleLimitGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JobsRoleLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.clearAllMocks());

  it('POST /jobs/:id/quotes/:quoteId/accept accepts a pending quote', async () => {
    prisma.job.findUnique.mockResolvedValue({ id: 'job1', customerId: 'cust1', assignment: null });
    prisma.quote.count.mockResolvedValue(0);
    prisma.quote.findUnique.mockResolvedValueOnce({ id: 'q1', jobId: 'job1', status: 'pending', providerId: 'prov1' })
      .mockResolvedValueOnce({ id: 'q1', jobId: 'job1', status: 'accepted' });
    prisma.quote.updateMany
      .mockResolvedValueOnce({ count: 1 }) // accept target
      .mockResolvedValueOnce({ count: 1 }); // decline others
    prisma.assignment.upsert.mockResolvedValue({ id: 'a1' });

    await request(app.getHttpServer())
      .post('/jobs/job1/quotes/q1/accept')
      .expect(201)
      .expect(({ body }) => {
        expect(body.id).toBe('q1');
      });
  });

  it('POST /jobs/:id/quotes/revoke revokes accepted quote', async () => {
    prisma.job.findUnique.mockResolvedValue({ id: 'job1', customerId: 'cust1' });
    prisma.quote.findFirst.mockResolvedValue({ id: 'q1', jobId: 'job1', status: 'accepted' });
    prisma.assignment.findUnique = jest.fn().mockResolvedValue({ id: 'a1', jobId: 'job1' });
    prisma.$transaction.mockImplementation(async (fn: any) => await fn(prisma));
    prisma.quote.update.mockResolvedValue({});
    prisma.assignment.delete.mockResolvedValue({});
    prisma.quote.updateMany.mockResolvedValue({ count: 1 });

    await request(app.getHttpServer())
      .post('/jobs/job1/quotes/revoke')
      .expect(201)
      .expect(({ body }) => {
        expect(body.ok).toBe(true);
      });
  });
});

