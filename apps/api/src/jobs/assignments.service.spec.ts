import "reflect-metadata";
import { AssignmentsService, ASSIGNMENT_STATUS } from "./assignments.service";
import { ScheduleProposedBy } from "@prisma/client";
import { ConflictException, ForbiddenException } from "@nestjs/common";

const mockDate = (value: string) => new Date(value);

describe("AssignmentsService", () => {
  const notifications = {
    notifyScheduleProposed: jest.fn(),
    notifyScheduleConfirmed: jest.fn(),
    notifyAssignmentRejected: jest.fn(),
  };

  const prisma: any = {
    job: { findUnique: jest.fn(), update: jest.fn() },
    assignment: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    quote: { updateMany: jest.fn() },
    $transaction: jest.fn().mockImplementation(async (fn: any) => fn(prisma)),
  };

  const service = new AssignmentsService(prisma, notifications as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("proposes schedule as customer and bumps version", async () => {
    const start = mockDate("2025-01-01T09:00:00Z");
    const end = mockDate("2025-01-01T11:00:00Z");

    prisma.job.findUnique.mockResolvedValue({
      id: "job1",
      customerId: "cust1",
      assignment: {
        id: "assign1",
        scheduleVersion: 0,
        status: ASSIGNMENT_STATUS.PENDING_SCHEDULE,
      },
    });
    prisma.assignment.updateMany.mockResolvedValue({ count: 1 });
    prisma.assignment.findUnique.mockResolvedValue({
      id: "assign1",
      scheduleVersion: 1,
      scheduledStart: start,
      scheduledEnd: end,
      scheduleProposedBy: ScheduleProposedBy.CUSTOMER,
      status: ASSIGNMENT_STATUS.CUSTOMER_PROPOSED,
    });

    const result = await service.proposeScheduleAsCustomer("job1", "cust1", {
      start,
      end,
      version: 0,
      notes: "See you soon",
    });

    expect(result.scheduleVersion).toBe(1);
    expect(prisma.assignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "assign1", scheduleVersion: 0 },
        data: expect.objectContaining({
          scheduledStart: start,
          scheduledEnd: end,
          scheduleProposedBy: ScheduleProposedBy.CUSTOMER,
          status: ASSIGNMENT_STATUS.CUSTOMER_PROPOSED,
        }),
      }),
    );
    expect(notifications.notifyScheduleProposed).toHaveBeenCalledWith(
      expect.objectContaining({
        assignmentId: "assign1",
        jobId: "job1",
        proposedBy: "customer",
      }),
    );
  });

  it("throws Conflict when schedule version mismatches", async () => {
    const start = mockDate("2025-01-01T09:00:00Z");
    const end = mockDate("2025-01-01T10:00:00Z");

    prisma.job.findUnique.mockResolvedValue({
      id: "job1",
      customerId: "cust1",
      assignment: {
        id: "assign1",
        scheduleVersion: 3,
        status: ASSIGNMENT_STATUS.PENDING_SCHEDULE,
      },
    });
    prisma.assignment.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.proposeScheduleAsCustomer("job1", "cust1", {
        start,
        end,
        version: 2,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("prevents provider confirmation when not assigned to them", async () => {
    const start = mockDate("2025-01-01T09:00:00Z");
    const end = mockDate("2025-01-01T10:00:00Z");
    prisma.assignment.findUnique.mockResolvedValue({
      id: "assign1",
      jobId: "job1",
      scheduleVersion: 1,
      scheduledStart: start,
      scheduledEnd: end,
      scheduleNotes: null,
      provider: { userId: "provider-123", id: "prov1" },
      job: { customerId: "cust1" },
    });

    await expect(
      service.confirmSchedule(
        "assign1",
        { userId: "wrong-provider", role: "PROVIDER" },
        { version: 1 },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("confirms schedule and marks assignment scheduled", async () => {
    const start = mockDate("2025-01-02T09:00:00Z");
    const end = mockDate("2025-01-02T10:30:00Z");

    prisma.assignment.findUnique
      .mockResolvedValueOnce({
        id: "assign1",
        jobId: "job1",
        scheduleVersion: 2,
        scheduledStart: start,
        scheduledEnd: end,
        scheduleNotes: null,
        provider: { userId: "provider-123", id: "prov1" },
        job: { customerId: "cust1" },
      })
      .mockResolvedValueOnce({
        id: "assign1",
        status: ASSIGNMENT_STATUS.SCHEDULED,
        scheduleVersion: 3,
        scheduledStart: start,
        scheduledEnd: end,
      });
    prisma.assignment.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.confirmSchedule(
      "assign1",
      { userId: "provider-123", role: "PROVIDER" },
      { version: 2 },
    );

    expect(result.status).toBe(ASSIGNMENT_STATUS.SCHEDULED);
    expect(prisma.assignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "assign1", scheduleVersion: 2 } }),
    );
    expect(notifications.notifyScheduleConfirmed).toHaveBeenCalledWith(
      expect.objectContaining({
        assignmentId: "assign1",
        confirmedBy: "provider",
      }),
    );
  });

  it("rejects assignment and requeues job", async () => {
    prisma.assignment.findUnique.mockResolvedValue({
      id: "assign1",
      jobId: "job1",
      providerId: "prov1",
      scheduleVersion: 2,
      provider: { userId: "provider-123" },
    });
    prisma.assignment.update.mockResolvedValue({
      id: "assign1",
      status: ASSIGNMENT_STATUS.PROVIDER_REJECTED,
    });

    const result = await service.rejectAssignment("assign1", "provider-123", {
      reason: "Conflict",
    });

    expect(result.status).toBe(ASSIGNMENT_STATUS.PROVIDER_REJECTED);
    expect(prisma.quote.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { jobId: "job1", status: "accepted" } }),
    );
    expect(notifications.notifyAssignmentRejected).toHaveBeenCalledWith(
      expect.objectContaining({
        assignmentId: "assign1",
        jobId: "job1",
        reason: "Conflict",
      }),
    );
  });

  it("prevents rejecting assignment when provider does not own it", async () => {
    prisma.assignment.findUnique.mockResolvedValue({
      id: "assign1",
      jobId: "job1",
      providerId: "prov1",
      scheduleVersion: 1,
      provider: { userId: "provider-123" },
    });

    await expect(
      service.rejectAssignment("assign1", "wrong-user", {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("marks assignment complete for provider", async () => {
    prisma.assignment.findUnique.mockResolvedValue({
      id: "assign1",
      status: ASSIGNMENT_STATUS.SCHEDULED,
      provider: { userId: "provider-123" },
    });
    prisma.assignment.update.mockResolvedValue({
      id: "assign1",
      status: ASSIGNMENT_STATUS.COMPLETED,
    });

    const result = await service.completeAssignmentAsProvider(
      "assign1",
      "provider-123",
    );

    expect(result).toBeTruthy();
    expect(result!.status).toBe(ASSIGNMENT_STATUS.COMPLETED);
    expect(prisma.assignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "assign1" },
        data: expect.objectContaining({
          status: ASSIGNMENT_STATUS.COMPLETED,
          completedAt: expect.any(Date),
        }),
      }),
    );
  });
});
