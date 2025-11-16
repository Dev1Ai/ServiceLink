import { Controller, Get, Header } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { register } from "prom-client";
import { PrismaService } from "../prisma/prisma.service";

type FulfillmentSummary = {
  awaitingSchedule: number;
  scheduled: number;
  reminderOverdue: number;
  payoutPending: number;
};

@ApiExcludeController()
@Controller("metrics")
export class MetricsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Header("Content-Type", register.contentType)
  async metrics() {
    return register.metrics();
  }

  @Get("fulfillment-summary")
  async fulfillmentSummary(): Promise<FulfillmentSummary> {
    const awaitingSchedule = await this.prisma.assignment.count({
      where: {
        status: {
          in: [
            "pending_schedule",
            "schedule_proposed_customer",
            "schedule_proposed_provider",
          ],
        },
        rejectedAt: null,
      },
    });

    const scheduled = await this.prisma.assignment.count({
      where: { status: "scheduled" },
    });

    const reminderOverdue = await this.prisma.assignment.count({
      where: { reminderStatus: "OVERDUE" },
    });

    const payoutPending = await this.prisma.assignment.count({
      where: {
        payoutStatus: {
          in: ["AWAITING_APPROVAL", "PENDING"],
        },
      },
    });

    return { awaitingSchedule, scheduled, reminderOverdue, payoutPending };
  }
}
