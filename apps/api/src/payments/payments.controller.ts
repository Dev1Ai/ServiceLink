import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard, Roles, RolesGuard } from '../auth/jwt.guard';
import type { AuthedRequest } from '../common/types/request';

@ApiTags('payments')
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('bearer')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('payouts/pending')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List assignments awaiting manual payout approval' })
  @ApiOkResponse({ description: 'Assignments awaiting approval', schema: { type: 'array', items: { type: 'object' } } })
  async pending() {
    return this.payments.listPendingPayouts();
  }

  @Post('payouts/:id/approve')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Approve payout for assignment' })
  async approve(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.payments.approvePayout(id, req.user.sub);
  }

  @Post('payouts/:id/deny')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Deny payout for assignment' })
  async deny(@Param('id') id: string, @Req() req: AuthedRequest, @Body() body: { reason?: string }) {
    if (body?.reason) {
      // TODO: Persist denial reasons when audit log model is added
    }
    return this.payments.denyPayout(id, req.user.sub);
  }

  @Post('intents')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a Stripe PaymentIntent for a job' })
  async createIntent(@Req() req: AuthedRequest, @Body() body: { jobId: string; amount: number }) {
    return this.payments.createPaymentIntent({
      jobId: body.jobId,
      amount: body.amount,
      customerId: req.user.sub,
    });
  }

  @Post('intents/:id/capture')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Capture a Stripe PaymentIntent' })
  async captureIntent(@Param('id') paymentIntentId: string) {
    return this.payments.capturePayment(paymentIntentId);
  }

  @Post('refunds')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Refund a payment' })
  async refund(@Body() body: { paymentId: string; amount?: number; reason?: string }) {
    return this.payments.refundPayment(body);
  }

  @Post('payouts')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a payout to a provider via Stripe Connect' })
  async createPayout(@Body() body: { providerId: string; amount: number }) {
    return this.payments.createPayout(body);
  }
}
