import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "../prisma/prisma.module";
import { ReminderQueueProvider } from "./reminders.queue";
import { RemindersService } from "./reminders.service";
import { NotificationsService } from "../notifications/notifications.service";
import { MetricsModule } from "../metrics/metrics.module";

@Module({
  imports: [ConfigModule, PrismaModule, MetricsModule],
  providers: [ReminderQueueProvider, RemindersService, NotificationsService],
  exports: [RemindersService],
})
export class RemindersModule {}
