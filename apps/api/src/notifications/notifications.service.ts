import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async notifyQuoteCreated(jobId: string, quoteId: string, providerId: string) {
    this.logger.log(
      `Quote created: job=${jobId} quote=${quoteId} provider=${providerId}`,
    );
  }

  async notifyQuoteAccepted(
    jobId: string,
    quoteId: string,
    providerId: string,
  ) {
    this.logger.log(
      `Quote accepted: job=${jobId} quote=${quoteId} provider=${providerId}`,
    );
  }

  async notifyAcceptanceRevoked(jobId: string, quoteId: string) {
    this.logger.log(`Acceptance revoked: job=${jobId} quote=${quoteId}`);
  }

  async notifyScheduleProposed(payload: {
    jobId: string;
    assignmentId: string;
    proposedBy: "customer" | "provider";
    start: Date;
    end: Date;
  }) {
    this.logger.log(
      `Schedule proposed: job=${payload.jobId} assignment=${payload.assignmentId} by=${payload.proposedBy} window=${payload.start.toISOString()}-${payload.end.toISOString()}`,
    );
  }

  async notifyScheduleConfirmed(payload: {
    jobId: string;
    assignmentId: string;
    confirmedBy: "customer" | "provider";
    start: Date | null;
    end: Date | null;
  }) {
    this.logger.log(
      `Schedule confirmed: job=${payload.jobId} assignment=${payload.assignmentId} by=${payload.confirmedBy} window=${payload.start?.toISOString()}-${payload.end?.toISOString()}`,
    );
  }

  async notifyAssignmentRejected(payload: {
    jobId: string;
    assignmentId: string;
    providerId: string;
    reason?: string;
  }) {
    this.logger.warn(
      `Assignment rejected: job=${payload.jobId} assignment=${payload.assignmentId} provider=${payload.providerId} reason=${payload.reason || "n/a"}`,
    );
  }

  async notifyAssignmentReminder(payload: {
    assignmentId: string;
    jobId: string;
    providerId: string | null;
    customerId: string | null;
    scheduledStart: Date | null;
    scheduleNotes?: string;
    leadMinutes: number;
  }) {
    this.logger.log(
      `Assignment reminder: job=${payload.jobId} assignment=${payload.assignmentId} provider=${payload.providerId ?? "unknown"} ` +
        `customer=${payload.customerId ?? "unknown"} scheduledStart=${payload.scheduledStart?.toISOString() ?? "n/a"} lead=${payload.leadMinutes}m notes=${payload.scheduleNotes ?? ""}`,
    );
  }
}
