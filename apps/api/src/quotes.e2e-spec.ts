import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { JobsController } from "./jobs/jobs.controller";
import { PrismaService } from "./prisma/prisma.service";
import { MetricsService } from "./metrics/metrics.service";
import { JwtAuthGuard, RolesGuard } from "./auth/jwt.guard";
import { QuotesService } from "./jobs/quotes.service";
import { NotificationsService } from "./notifications/notifications.service";

describe("Quotes E2E (HTTP)", () => {
  let app: INestApplication;
  const prisma = {
    provider: { findUnique: jest.fn() },
    job: { findUnique: jest.fn() },
    quote: { findFirst: jest.fn(), create: jest.fn() },
  } as any;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        {
          provide: MetricsService,
          useValue: { incPaymentInitiate: jest.fn() },
        },
        NotificationsService,
        QuotesService,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = { sub: "user-prov-1", role: "PROVIDER" };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
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
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("400 on invalid body", async () => {
    prisma.provider.findUnique.mockResolvedValue({
      id: "prov1",
      userId: "user-prov-1",
    });
    prisma.job.findUnique.mockResolvedValue({ id: "job1" });
    await request(app.getHttpServer())
      .post("/jobs/job1/quotes")
      .send({ total: 0 })
      .expect(400);
  });

  it("404 when job missing", async () => {
    prisma.provider.findUnique.mockResolvedValue({
      id: "prov1",
      userId: "user-prov-1",
    });
    prisma.job.findUnique.mockResolvedValue(null);
    await request(app.getHttpServer())
      .post("/jobs/job-missing/quotes")
      .send({ total: 100 })
      .expect(404);
  });

  it("201 on success", async () => {
    prisma.provider.findUnique.mockResolvedValue({
      id: "prov1",
      userId: "user-prov-1",
    });
    prisma.job.findUnique.mockResolvedValue({ id: "job1" });
    prisma.quote.findFirst.mockResolvedValue(null);
    prisma.quote.create.mockResolvedValue({
      id: "q1",
      jobId: "job1",
      providerId: "prov1",
      total: 150,
      status: "pending",
    });
    await request(app.getHttpServer())
      .post("/jobs/job1/quotes")
      .send({ total: 150 })
      .expect(201)
      .expect(({ body }) =>
        expect(body).toMatchObject({ id: "q1", total: 150 }),
      );
  });
});
