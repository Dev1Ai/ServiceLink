import "reflect-metadata";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { QuotesService } from "./quotes.service";

describe("QuotesService", () => {
  let service: QuotesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      provider: { findUnique: jest.fn() },
      job: { findUnique: jest.fn() },
      quote: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      assignment: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn().mockResolvedValue(undefined),
    };
    const notifications = {
      notifyQuoteCreated: jest.fn(),
      notifyQuoteAccepted: jest.fn(),
      notifyAcceptanceRevoked: jest.fn(),
    };
    service = new QuotesService(prisma, notifications as any);
  });

  it("createQuote: forbids when provider missing", async () => {
    prisma.provider.findUnique.mockResolvedValue(null);
    await expect(
      service.createQuote("job1", "user1", { total: 100 } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("createQuote: 404 when job missing", async () => {
    prisma.provider.findUnique.mockResolvedValue({ id: "prov1" });
    prisma.job.findUnique.mockResolvedValue(null);
    await expect(
      service.createQuote("job-miss", "user1", { total: 100 } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("createQuote: duplicate pre-check bad request", async () => {
    prisma.provider.findUnique.mockResolvedValue({ id: "prov1" });
    prisma.job.findUnique.mockResolvedValue({ id: "job1" });
    prisma.quote.findFirst.mockResolvedValue({ id: "q1" });
    await expect(
      service.createQuote("job1", "user1", { total: 100 } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("createQuote: unique violation P2002 -> bad request", async () => {
    prisma.provider.findUnique.mockResolvedValue({ id: "prov1" });
    prisma.job.findUnique.mockResolvedValue({ id: "job1" });
    prisma.quote.findFirst.mockResolvedValue(null);
    prisma.quote.create.mockRejectedValue({ code: "P2002" });
    await expect(
      service.createQuote("job1", "user1", { total: 100 } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("acceptQuote: forbids when not job owner", async () => {
    prisma.job.findUnique.mockResolvedValue({
      id: "job1",
      customerId: "other",
    });
    await expect(
      service.acceptQuote("job1", "q1", "user1"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("acceptQuote: bad request when quote not in job", async () => {
    prisma.job.findUnique.mockResolvedValue({
      id: "job1",
      customerId: "user1",
      assignment: null,
    });
    prisma.quote.count.mockResolvedValue(0);
    prisma.quote.findUnique.mockResolvedValueOnce({
      id: "q1",
      jobId: "otherJob",
      status: "pending",
      providerId: "prov",
    });
    await expect(
      service.acceptQuote("job1", "q1", "user1"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("acceptQuote: success updates and returns quote", async () => {
    prisma.job.findUnique.mockResolvedValue({
      id: "job1",
      customerId: "user1",
      assignment: null,
    });
    prisma.quote.count = jest.fn().mockResolvedValue(0);
    prisma.quote.findUnique
      .mockResolvedValueOnce({
        id: "q1",
        jobId: "job1",
        status: "pending",
        providerId: "prov1",
      })
      .mockResolvedValueOnce({ id: "q1", jobId: "job1", status: "accepted" });
    prisma.quote.updateMany = jest
      .fn()
      .mockResolvedValueOnce({ count: 1 }) // accept target
      .mockResolvedValueOnce({ count: 1 }); // decline others
    prisma.assignment.upsert.mockResolvedValue({});

    const result = await service.acceptQuote("job1", "q1", "user1");
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result).toMatchObject({ id: "q1", jobId: "job1" });
  });

  it("acceptQuote: fails when another accepted quote exists", async () => {
    prisma.job.findUnique.mockResolvedValue({
      id: "job1",
      customerId: "user1",
      assignment: null,
    });
    prisma.quote.count = jest.fn().mockResolvedValue(1);
    await expect(
      service.acceptQuote("job1", "q1", "user1"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("acceptQuote: fails when target quote is not pending", async () => {
    prisma.job.findUnique.mockResolvedValue({
      id: "job1",
      customerId: "user1",
      assignment: null,
    });
    prisma.quote.count = jest.fn().mockResolvedValue(0);
    prisma.quote.findUnique.mockResolvedValue({
      id: "q1",
      jobId: "job1",
      status: "declined",
      providerId: "prov1",
    });
    await expect(
      service.acceptQuote("job1", "q1", "user1"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("revokeAcceptance: returns ok when accepted + assignment exist", async () => {
    prisma.job.findUnique.mockResolvedValue({
      id: "job1",
      customerId: "user1",
    });
    prisma.quote.findFirst.mockResolvedValue({ id: "q1" });
    prisma.assignment.findUnique = jest
      .fn()
      .mockResolvedValue({ id: "a1", jobId: "job1" });
    prisma.$transaction.mockImplementation(async (fn: any) => {
      await fn({ quote: prisma.quote, assignment: prisma.assignment });
    });
    const res = await service.revokeAcceptance("job1", "user1");
    expect(res).toEqual({ ok: true });
  });

  it("revokeAcceptance: bad request when nothing to revoke", async () => {
    prisma.job.findUnique.mockResolvedValue({
      id: "job1",
      customerId: "user1",
    });
    prisma.quote.findFirst.mockResolvedValue(null);
    prisma.assignment.findUnique = jest.fn().mockResolvedValue(null);
    await expect(
      service.revokeAcceptance("job1", "user1"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("acceptQuote: prevents re-accept when assignment exists", async () => {
    prisma.job.findUnique.mockResolvedValue({
      id: "job1",
      customerId: "user1",
      assignment: { id: "a1", status: "active" },
    });
    await expect(
      service.acceptQuote("job1", "q1", "user1"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("listQuotes: returns all for customer owner", async () => {
    prisma.job.findUnique.mockResolvedValue({
      id: "job1",
      customerId: "user1",
    });
    prisma.quote.findMany.mockResolvedValue([
      { id: "q1", jobId: "job1" },
      { id: "q2", jobId: "job1" },
    ]);
    const rows = await service.listQuotes("job1", "user1");
    expect(rows).toHaveLength(2);
    expect(prisma.quote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { jobId: "job1" } }),
    );
  });

  it("listQuotes: returns provider-only quotes when not owner", async () => {
    prisma.job.findUnique.mockResolvedValue({
      id: "job1",
      customerId: "cust1",
    });
    prisma.provider.findUnique.mockResolvedValue({
      id: "prov1",
      userId: "user-prov",
    });
    prisma.quote.findMany.mockResolvedValue([
      { id: "q1", jobId: "job1", providerId: "prov1" },
    ]);
    const rows = await service.listQuotes("job1", "user-prov");
    expect(rows).toHaveLength(1);
    expect(prisma.quote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { jobId: "job1", providerId: "prov1" },
      }),
    );
  });
});
