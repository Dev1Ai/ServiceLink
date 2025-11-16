import { Module } from "@nestjs/common";
import { ProvidersController } from "./providers.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { ProvidersService } from "./providers.service";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule } from "@nestjs/config";
import { AssignmentsService } from "../jobs/assignments.service";
import { MetricsModule } from "../metrics/metrics.module";
import { NotificationsService } from "../notifications/notifications.service";

@Module({
  imports: [PrismaModule, JwtModule, ConfigModule, MetricsModule],
  controllers: [ProvidersController],
  providers: [ProvidersService, AssignmentsService, NotificationsService],
})
export class ProvidersModule {}
