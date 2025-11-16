import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { PaymentsService } from "./payments.service";
import { JwtAuthGuard, Roles, RolesGuard } from "../auth/jwt.guard";
import type { AuthedRequest } from "../common/types/request";
import {
  CreatePaymentIntentDto,
  CapturePaymentDto,
  CreateRefundDto,
} from "./dto/payment.dto";

@ApiTags("payments")
@Controller("payments")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("bearer")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get("payouts/pending")
  @Roles("ADMIN")
  @ApiOperation({ summary: "List assignments awaiting manual payout approval" })
  @ApiOkResponse({
    description: "Assignments awaiting approval",
    schema: { type: "array", items: { type: "object" } },
  })
  async pending() {
    return this.payments.listPendingPayouts();
  }

  @Post("payouts/:id/approve")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Approve payout for assignment" })
  async approve(@Param("id") id: string, @Req() req: AuthedRequest) {
    return this.payments.approvePayout(id, req.user.sub);
  }

  @Post("payouts/:id/deny")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Deny payout for assignment" })
  async deny(
    @Param("id") id: string,
    @Req() req: AuthedRequest,
    @Body() body: { reason?: string },
  ) {
    if (body?.reason) {
      // TODO: Persist denial reasons when audit log model is added
    }
    return this.payments.denyPayout(id, req.user.sub);
  }

  @Post("jobs/:jobId/intent")
  @Roles("CUSTOMER")
  @ApiOperation({ summary: "Create payment intent for a job" })
  @ApiOkResponse({ description: "Payment intent created with client secret" })
  async createIntent(
    @Param("jobId") jobId: string,
    @Req() req: AuthedRequest,
    @Body() dto: CreatePaymentIntentDto,
  ) {
    return this.payments.createPaymentIntent(jobId, dto.amount, req.user.sub);
  }

  @Post("jobs/:jobId/capture")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Capture authorized payment for a job" })
  @ApiOkResponse({ description: "Payment captured successfully" })
  async capture(@Param("jobId") jobId: string) {
    return this.payments.capturePayment(jobId);
  }

  @Post(":paymentId/refund")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Create refund for a payment" })
  @ApiOkResponse({ description: "Refund created successfully" })
  async refund(
    @Param("paymentId") paymentId: string,
    @Req() req: AuthedRequest,
    @Body() dto: CreateRefundDto,
  ) {
    return this.payments.createRefund(
      paymentId,
      dto.amount,
      dto.reason || "requested_by_customer",
      req.user.sub,
    );
  }

  @Post("connect/providers/:providerId/account")
  @Roles("PROVIDER", "ADMIN")
  @ApiOperation({ summary: "Create Stripe Connect account for provider" })
  @ApiOkResponse({ description: "Connect account created" })
  async createConnectAccount(
    @Param("providerId") providerId: string,
    @Body() body: { email: string },
  ) {
    return this.payments.createConnectAccount(providerId, body.email);
  }

  @Post("connect/providers/:providerId/onboarding")
  @Roles("PROVIDER", "ADMIN")
  @ApiOperation({ summary: "Create Stripe Connect onboarding link" })
  @ApiOkResponse({ description: "Onboarding link created" })
  async createAccountLink(
    @Param("providerId") providerId: string,
    @Body() body: { refreshUrl: string; returnUrl: string },
  ) {
    return this.payments.createAccountLink(
      providerId,
      body.refreshUrl,
      body.returnUrl,
    );
  }

  @Get("connect/providers/:providerId/status")
  @Roles("PROVIDER", "ADMIN")
  @ApiOperation({ summary: "Get Stripe Connect account status" })
  @ApiOkResponse({ description: "Account status retrieved" })
  async getConnectAccountStatus(@Param("providerId") providerId: string) {
    return this.payments.getConnectAccountStatus(providerId);
  }

  @Post("payouts/:assignmentId")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Create payout for approved assignment" })
  @ApiOkResponse({ description: "Payout created successfully" })
  async createPayout(
    @Param("assignmentId") assignmentId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.payments.createPayout(assignmentId, req.user.sub);
  }
}

@ApiTags("payments")
@Controller("payments/webhook")
export class PaymentsWebhookController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  @ApiOperation({ summary: "Handle Stripe webhook events" })
  @ApiOkResponse({ description: "Webhook processed successfully" })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature: string,
  ) {
    const rawBody = req.rawBody?.toString("utf8") || "";
    return this.payments.handleWebhook(rawBody, signature);
  }
}
