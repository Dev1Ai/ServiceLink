import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { JobsController } from "./jobs.controller";
import { PrismaService } from "../prisma/prisma.service";
import { MetricsService } from "../metrics/metrics.service";
import { JwtAuthGuard, RolesGuard } from "../auth/jwt.guard";
import { QuotesRoleLimitGuard } from "../common/guards/quotes-role-limit.guard";
import { JobsRoleLimitGuard } from "../common/guards/jobs-role-limit.guard";
import { NotificationsService } from "../notifications/notifications.service";
import { QuotesService } from "./quotes.service";
import { JobsService } from "./jobs.service";
import { AssignmentsService } from "./assignments.service";
import { PaymentsService } from "../payments/payments.service";
import type { AuthedRequest } from "../common/types/request";

describe("Jobs/Quotes HTTP (E2E-lite)", () => {
  let app: INestApplication;
  let controller: JobsController;
  const prisma: any = {
    job: { findUnique: jest.fn() },
    quote: {
      count: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    assignment: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest
      .fn()
      .mockImplementation(async (fn: any) => await fn(prisma)),
  };
  const metrics = { incPaymentInitiate: jest.fn() };
  const paymentsImpl = {
    handleCustomerVerification: jest.fn().mockResolvedValue({ mode: "manual" }),
  };
  const payments = paymentsImpl as unknown as PaymentsService;
  const jobsMock = {
    createJob: jest.fn(),
    createJobFromAudio: jest.fn(),
  } as unknown as JobsService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: MetricsService, useValue: metrics },
        NotificationsService,
        {
          provide: AssignmentsService,
          useValue: { proposeScheduleAsCustomer: jest.fn() },
        },
        { provide: PaymentsService, useValue: payments },
        { provide: JobsService, useValue: jobsMock },
        QuotesService,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          // default to CUSTOMER; tests can override per-case by changing return
          req.user = { sub: "cust1", role: "CUSTOMER" };
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
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    controller = app.get(JobsController);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.clearAllMocks());

  it("POST /jobs/:id/quotes/:quoteId/accept accepts a pending quote", async () => {
    prisma.job.findUnique.mockResolvedValue({
      id: "job1",
      customerId: "cust1",
      assignment: null,
    });
    prisma.quote.count.mockResolvedValue(0);
    prisma.quote.findUnique
      .mockResolvedValueOnce({
        id: "q1",
        jobId: "job1",
        status: "pending",
        providerId: "prov1",
      })
      .mockResolvedValueOnce({ id: "q1", jobId: "job1", status: "accepted" });
    prisma.quote.updateMany
      .mockResolvedValueOnce({ count: 1 }) // accept target
      .mockResolvedValueOnce({ count: 1 }); // decline others
    prisma.assignment.upsert.mockResolvedValue({ id: "a1" });

    const req = { user: { sub: "cust1" } } as AuthedRequest;
    const result = await controller.acceptQuote("job1", "q1", req);
    expect(result?.id).toBe("q1");
  });

  it("POST /jobs/:id/quotes/revoke revokes accepted quote", async () => {
    prisma.job.findUnique.mockResolvedValue({
      id: "job1",
      customerId: "cust1",
    });
    prisma.quote.findFirst.mockResolvedValue({
      id: "q1",
      jobId: "job1",
      status: "accepted",
    });
    prisma.assignment.findUnique = jest
      .fn()
      .mockResolvedValue({ id: "a1", jobId: "job1" });
    prisma.$transaction.mockImplementation(async (fn: any) => await fn(prisma));
    prisma.quote.update.mockResolvedValue({});
    prisma.assignment.delete.mockResolvedValue({});
    prisma.quote.updateMany.mockResolvedValue({ count: 1 });

    const req = { user: { sub: "cust1" } } as AuthedRequest;
    const result = await controller.revokeAccepted("job1", req);
    expect(result.ok).toBe(true);
  });

  it("POST /jobs/:id/quotes/:quoteId/accept returns 400 when assignment exists", async () => {
    prisma.job.findUnique.mockResolvedValue({
      id: "job1",
      customerId: "cust1",
      assignment: { id: "a1" },
    });

    const req = { user: { sub: "cust1" } } as AuthedRequest;
    await expect(controller.acceptQuote("job1", "q1", req)).rejects.toThrow(
      "Assignment already exists",
    );

    expect(prisma.quote.count).not.toHaveBeenCalled();
    expect(prisma.quote.findUnique).not.toHaveBeenCalled();
  });

  it("POST /jobs/:id/quotes/:quoteId/accept returns 400 when quote is not pending", async () => {
    prisma.job.findUnique.mockResolvedValue({
      id: "job1",
      customerId: "cust1",
      assignment: null,
    });
    prisma.quote.count.mockResolvedValue(0);
    prisma.quote.findUnique.mockResolvedValue({
      id: "q1",
      jobId: "job1",
      status: "accepted",
      providerId: "prov1",
    });

    const req = { user: { sub: "cust1" } } as AuthedRequest;
    await expect(controller.acceptQuote("job1", "q1", req)).rejects.toThrow(
      "Quote is not pending",
    );

    expect(prisma.assignment.upsert).not.toHaveBeenCalled();
  });

  it("POST /jobs/:id/quotes/revoke returns 400 when no acceptance exists", async () => {
    prisma.job.findUnique.mockResolvedValue({
      id: "job1",
      customerId: "cust1",
    });
    prisma.quote.findFirst.mockResolvedValue(null);
    prisma.assignment.findUnique = jest.fn().mockResolvedValue(null);

    const req = { user: { sub: "cust1" } } as AuthedRequest;
    await expect(controller.revokeAccepted("job1", req)).rejects.toThrow(
      "No active acceptance",
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("POST /jobs/:id/complete verifies completion and updates assignment", async () => {
    prisma.job.findUnique.mockResolvedValue({
      id: "job1",
      customerId: "cust1",
      assignment: { id: "assign1", status: "accepted" },
    });
    const updatedAssignment = {
      id: "assign1",
      status: "customer_verified",
      customerVerifiedAt: new Date().toISOString(),
    };
    prisma.assignment.update.mockResolvedValue(updatedAssignment);

    const req = { user: { sub: "cust1" } } as AuthedRequest;
    const result = await controller.customerComplete("job1", req);
    expect(result.status).toBe("customer_verified");

    expect(prisma.assignment.update).toHaveBeenCalledWith({
      where: { id: "assign1" },
      data: expect.objectContaining({ status: "customer_verified" }),
    });
    expect(metrics.incPaymentInitiate).toHaveBeenCalledWith("job_complete");
    expect(paymentsImpl.handleCustomerVerification).toHaveBeenCalledWith(
      "job1",
    );
  });
});
