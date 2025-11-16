import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateQuoteDto } from "./dto/job.dto";
import { NotificationsService } from "../notifications/notifications.service";
import {
  AssignmentReminderStatus,
  AssignmentPayoutStatus,
} from "@prisma/client";
import { ASSIGNMENT_STATUS } from "./assignments.service";

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async createQuote(jobId: string, userId: string, dto: CreateQuoteDto) {
    const provider = await this.prisma.provider.findUnique({
      where: { userId },
    });
    if (!provider) throw new ForbiddenException("Provider profile not found");
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true },
    });
    if (!job) throw new NotFoundException("Job not found");
    const existing = await this.prisma.quote.findFirst({
      where: { jobId, providerId: provider.id },
    });
    if (existing)
      throw new BadRequestException(
        "You already submitted a quote for this job",
      );
    try {
      const created = await this.prisma.quote.create({
        data: { jobId, providerId: provider.id, total: dto.total },
      });
      await this.notifications.notifyQuoteCreated(
        jobId,
        created.id,
        provider.id,
      );
      return created;
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err?.code === "P2002") {
        throw new BadRequestException(
          "You already submitted a quote for this job",
        );
      }
      throw e;
    }
  }

  async listQuotes(jobId: string, userId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, customerId: true },
    });
    if (!job) return [];
    if (job.customerId === userId) {
      return this.prisma.quote.findMany({
        where: { jobId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          jobId: true,
          providerId: true,
          total: true,
          status: true,
          createdAt: true,
          provider: {
            select: { id: true, user: { select: { name: true, email: true } } },
          },
        },
      });
    }
    const provider = await this.prisma.provider.findUnique({
      where: { userId },
    });
    if (!provider) return [];
    return this.prisma.quote.findMany({
      where: { jobId, providerId: provider.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        jobId: true,
        providerId: true,
        total: true,
        status: true,
        createdAt: true,
        provider: {
          select: { id: true, user: { select: { name: true, email: true } } },
        },
      },
    });
  }

  async acceptQuote(jobId: string, quoteId: string, userId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        customerId: true,
        assignment: { select: { id: true, status: true } },
      },
    });
    if (!job || job.customerId !== userId) {
      throw new ForbiddenException("Not allowed");
    }
    if (
      job.assignment &&
      job.assignment.status !== ASSIGNMENT_STATUS.PROVIDER_REJECTED
    ) {
      throw new BadRequestException("Assignment already exists for this job");
    }
    // Ensure there isn't an already accepted quote lingering (safety)
    const acceptedCount = await this.prisma.quote.count({
      where: { jobId: job.id, status: "accepted" },
    });
    if (acceptedCount > 0) {
      throw new BadRequestException(
        "A quote has already been accepted for this job",
      );
    }
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      select: { id: true, jobId: true, status: true, providerId: true },
    });
    if (!quote || quote.jobId !== job.id) {
      throw new BadRequestException("Invalid quote");
    }
    if (quote.status !== "pending") {
      throw new BadRequestException("Quote is not pending");
    }
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.quote.updateMany({
        where: { id: quoteId, jobId: job.id, status: "pending" },
        data: { status: "accepted" },
      });
      if (updated.count !== 1) {
        throw new BadRequestException("Unable to accept quote");
      }
      await tx.quote.updateMany({
        where: { jobId: job.id, NOT: { id: quoteId } },
        data: { status: "declined" },
      });
      await tx.assignment.upsert({
        where: { jobId: job.id },
        update: {
          providerId: quote.providerId,
          acceptedAt: new Date(),
          status: ASSIGNMENT_STATUS.PENDING_SCHEDULE,
          scheduleVersion: 0,
          scheduledStart: null,
          scheduledEnd: null,
          scheduleProposedBy: null,
          scheduleProposedAt: null,
          scheduleNotes: null,
          completedAt: null,
          customerVerifiedAt: null,
          rejectedAt: null,
          reminderStatus: AssignmentReminderStatus.NONE,
          reminderLastSentAt: null,
          reminderCount: 0,
          payoutStatus: AssignmentPayoutStatus.PENDING,
          payoutApprovedAt: null,
          payoutApprovedBy: null,
        },
        create: { jobId: job.id, providerId: quote.providerId },
      });
    });
    await this.notifications.notifyQuoteAccepted(
      jobId,
      quoteId,
      quote.providerId,
    );
    return this.prisma.quote.findUnique({ where: { id: quoteId } });
  }

  async revokeAcceptance(jobId: string, userId: string) {
    // Only the customer owner can revoke
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, customerId: true },
    });
    if (!job || job.customerId !== userId)
      throw new ForbiddenException("Not allowed");
    // Find accepted quote and assignment
    const accepted = await this.prisma.quote.findFirst({
      where: { jobId, status: "accepted" },
    });
    const assignment = await this.prisma.assignment.findUnique({
      where: { jobId },
    });
    if (!accepted || !assignment)
      throw new BadRequestException("No active acceptance to revoke");
    // Revoke within a transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.quote.update({
        where: { id: accepted.id },
        data: { status: "pending" },
      });
      await tx.assignment.delete({ where: { jobId } });
      await tx.quote.updateMany({
        where: { jobId, status: "declined" },
        data: { status: "pending" },
      });
    });
    await this.notifications.notifyAcceptanceRevoked(jobId, accepted.id);
    return { ok: true };
  }
}
