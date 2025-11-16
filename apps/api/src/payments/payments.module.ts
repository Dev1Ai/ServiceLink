import { Module } from "@nestjs/common";
import { StripeWebhookController } from "./stripe.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { ConfigModule } from "@nestjs/config";
import { PaymentsService } from "./payments.service";
import {
  PaymentsController,
  PaymentsWebhookController,
} from "./payments.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [PrismaModule, ConfigModule, AuthModule],
  controllers: [
    StripeWebhookController,
    PaymentsController,
    PaymentsWebhookController,
  ],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
