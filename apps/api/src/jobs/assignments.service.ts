import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  AssignmentReminderStatus,
  AssignmentPayoutStatus,
  ScheduleProposedBy,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import {
  ProposeScheduleDto,
  ConfirmScheduleDto,
  RejectAssignmentDto,
} from "./dto/schedule.dto";

export const ASSIGNMENT_STATUS = {
  PENDING_SCHEDULE: "pending_schedule",
  CUSTOMER_PROPOSED: "schedule_proposed_customer",
  PROVIDER_PROPOSED: "schedule_proposed_provider",
  SCHEDULED: "scheduled",
  PROVIDER_REJECTED: "provider_rejected",
  COMPLETED: "completed",
  CUSTOMER_VERIFIED: "customer_verified",
} as const;

@Injectable()
export class AssignmentsService {
  private readonly logger = new Logger(AssignmentsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async proposeScheduleAsCustomer(
    jobId: string,
    customerId: string,
    dto: ProposeScheduleDto,
  ) {
    const { start, end, version, notes } = dto;
    this.ensureWindow(start, end);
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        customerId: true,
        assignment: {
          select: {
            id: true,
            scheduleVersion: true,
            status: true,
          },
        },
      },
    });
    if (!job) throw new NotFoundException("Job not found");
    if (job.customerId !== customerId)
      throw new ForbiddenException("Not allowed");
    if (!job.assignment)
      throw new BadRequestException("Job has no active assignment");
    if (job.assignment.status === ASSIGNMENT_STATUS.PROVIDER_REJECTED) {
      throw new BadRequestException("Assignment has been rejected by provider");
    }
    const result = await this.updateAssignmentSchedule(
      job.assignment.id,
      job.assignment.scheduleVersion,
      version,
      {
        scheduledStart: start,
        scheduledEnd: end,
        scheduleProposedBy: ScheduleProposedBy.CUSTOMER,
        scheduleNotes: notes ?? null,
        status: ASSIGNMENT_STATUS.CUSTOMER_PROPOSED,
      },
    );
    await this.notifications.notifyScheduleProposed({
      jobId,
      assignmentId: result.id,
      proposedBy: "customer",
      start,
      end,
    });
    return result;
  }

  async proposeScheduleAsProvider(
    assignmentId: string,
    providerUserId: string,
    dto: ProposeScheduleDto,
  ) {
    const { start, end, version, notes } = dto;
    this.ensureWindow(start, end);
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        scheduleVersion: true,
        status: true,
        provider: { select: { userId: true, id: true } },
        jobId: true,
      },
    });
    if (!assignment) throw new NotFoundException("Assignment not found");
    if (assignment.provider.userId !== providerUserId)
      throw new ForbiddenException("Not allowed");
    if (assignment.status === ASSIGNMENT_STATUS.PROVIDER_REJECTED) {
      throw new BadRequestException("Assignment already rejected");
    }
    const result = await this.updateAssignmentSchedule(
      assignment.id,
      assignment.scheduleVersion,
      version,
      {
        scheduledStart: start,
        scheduledEnd: end,
        scheduleProposedBy: ScheduleProposedBy.PROVIDER,
        scheduleNotes: notes ?? null,
        status: ASSIGNMENT_STATUS.PROVIDER_PROPOSED,
      },
    );
    await this.notifications.notifyScheduleProposed({
      jobId: assignment.jobId,
      assignmentId: result.id,
      proposedBy: "provider",
      start,
      end,
    });
    return result;
  }

  async confirmSchedule(
    assignmentId: string,
    actor: { userId: string; role: "CUSTOMER" | "PROVIDER" },
    dto: ConfirmScheduleDto,
  ) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        jobId: true,
        scheduleVersion: true,
        scheduledStart: true,
        scheduledEnd: true,
        scheduleNotes: true,
        provider: { select: { userId: true, id: true } },
        job: { select: { customerId: true } },
      },
    });
    if (!assignment) throw new NotFoundException("Assignment not found");
    if (!assignment.scheduledStart || !assignment.scheduledEnd) {
      throw new BadRequestException("No schedule to confirm");
    }
    if (
      actor.role === "CUSTOMER" &&
      assignment.job.customerId !== actor.userId
    ) {
      throw new ForbiddenException("Not allowed");
    }
    if (
      actor.role === "PROVIDER" &&
      assignment.provider.userId !== actor.userId
    ) {
      throw new ForbiddenException("Not allowed");
    }
    const result = await this.updateAssignmentSchedule(
      assignment.id,
      assignment.scheduleVersion,
      dto.version,
      {
        scheduleNotes: dto.notes ?? assignment.scheduleNotes,
        scheduleProposedBy: ScheduleProposedBy.SYSTEM,
        status: ASSIGNMENT_STATUS.SCHEDULED,
      },
    );
    const confirmedBy = actor.role === "CUSTOMER" ? "customer" : "provider";
    await this.notifications.notifyScheduleConfirmed({
      jobId: assignment.jobId,
      assignmentId: result.id,
      confirmedBy,
      start: result.scheduledStart,
      end: result.scheduledEnd,
    });
    return result;
  }

  async completeAssignmentAsProvider(
    assignmentId: string,
    providerUserId: string,
  ) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        status: true,
        provider: { select: { userId: true } },
      },
    });
    if (!assignment) throw new NotFoundException("Assignment not found");
    if (assignment.provider.userId !== providerUserId)
      throw new ForbiddenException("Not allowed");
    if (assignment.status === ASSIGNMENT_STATUS.CUSTOMER_VERIFIED) {
      return this.prisma.assignment.findUnique({
        where: { id: assignment.id },
      });
    }
    const now = new Date();
    const updated = await this.prisma.assignment.update({
      where: { id: assignment.id },
      data: {
        status: ASSIGNMENT_STATUS.COMPLETED,
        completedAt: now,
      },
    });
    this.logger.log(
      `Assignment ${assignmentId} marked complete by provider ${providerUserId}`,
    );
    return updated;
  }

  async rejectAssignment(
    assignmentId: string,
    providerUserId: string,
    dto: RejectAssignmentDto,
  ) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        jobId: true,
        providerId: true,
        scheduleVersion: true,
        provider: { select: { userId: true } },
      },
    });
    if (!assignment) throw new NotFoundException("Assignment not found");
    if (assignment.provider.userId !== providerUserId)
      throw new ForbiddenException("Not allowed");
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.assignment.update({
        where: { id: assignment.id },
        data: {
          status: ASSIGNMENT_STATUS.PROVIDER_REJECTED,
          rejectedAt: now,
          scheduleNotes: dto.reason ?? null,
          scheduledStart: null,
          scheduledEnd: null,
          scheduleVersion: { increment: 1 },
          scheduleProposedBy: ScheduleProposedBy.PROVIDER,
          scheduleProposedAt: now,
          reminderStatus: AssignmentReminderStatus.NONE,
          reminderLastSentAt: null,
          reminderCount: 0,
          payoutStatus: AssignmentPayoutStatus.PENDING,
          payoutApprovedAt: null,
          payoutApprovedBy: null,
        },
      });
      await tx.quote.updateMany({
        where: { jobId: assignment.jobId, status: "accepted" },
        data: { status: "withdrawn_by_provider" },
      });
      await tx.quote.updateMany({
        where: { jobId: assignment.jobId, status: "declined" },
        data: { status: "pending" },
      });
      return updateResult;
    });
    await this.notifications.notifyAssignmentRejected({
      jobId: assignment.jobId,
      assignmentId: assignment.id,
      providerId: assignment.providerId,
      reason: dto.reason,
    });
    return updated;
  }

  private ensureWindow(start: Date, end: Date) {
    if (
      !(start instanceof Date) ||
      !(end instanceof Date) ||
      Number.isNaN(start.valueOf()) ||
      Number.isNaN(end.valueOf())
    ) {
      throw new BadRequestException("Invalid schedule window");
    }
    if (end <= start) {
      throw new BadRequestException("Scheduled end must be after start");
    }
    const maxDurationMs = 1000 * 60 * 60 * 12; // 12 hours
    if (end.getTime() - start.getTime() > maxDurationMs) {
      throw new BadRequestException("Scheduled window exceeds 12 hours");
    }
  }

  private async updateAssignmentSchedule(
    assignmentId: string,
    currentVersion: number,
    expectedVersion: number | undefined,
    data: {
      scheduledStart?: Date | null;
      scheduledEnd?: Date | null;
      scheduleProposedBy?: ScheduleProposedBy | null;
      scheduleNotes?: string | null;
      status?: string;
    },
  ) {
    const now = new Date();
    const targetVersion = expectedVersion ?? currentVersion;
    const update = await this.prisma.assignment.updateMany({
      where: { id: assignmentId, scheduleVersion: targetVersion },
      data: {
        ...data,
        scheduleVersion: { increment: 1 },
        scheduleProposedAt: now,
        reminderStatus: AssignmentReminderStatus.NONE,
        reminderLastSentAt: null,
        reminderCount: 0,
        updatedAt: now,
      },
    });
    if (update.count === 0) {
      throw new ConflictException(
        "Schedule was updated by another action. Refresh and retry.",
      );
    }
    const refreshed = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
    });
    if (!refreshed) {
      throw new NotFoundException("Assignment not found after update");
    }
    return refreshed;
  }
}
