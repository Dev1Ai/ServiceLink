import { Module } from "@nestjs/common";
import { JobsController } from "./jobs.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule } from "@nestjs/config";
import { MetricsModule } from "../metrics/metrics.module";
import { QuotesService } from "./quotes.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AssignmentsService } from "./assignments.service";
import { AssignmentsController } from "./assignments.controller";
import { PaymentsModule } from "../payments/payments.module";
import { JobsService } from "./jobs.service";
import { LlmModule } from "../llm/llm.module";

@Module({
  imports: [
    PrismaModule,
    JwtModule,
    ConfigModule,
    MetricsModule,
    PaymentsModule,
    LlmModule,
  ],
  controllers: [JobsController, AssignmentsController],
  providers: [JobsService, QuotesService, AssignmentsService, NotificationsService],
  exports: [JobsService],
})
export class JobsModule {}
