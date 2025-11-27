import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.types';
import {
  CancelBookingDto,
  CancellationFeeResult,
  CancellationResult,
  CancelledBy,
} from './dto/cancel-booking.dto';

/**
 * Cancellation Service
 *
 * Fee Structure (based on hours until scheduled start):
 * - Before quote accepted: Free, no penalty
 * - >48h before: Free, -25 loyalty points
 * - 24-48h before: Platform fee ($5), -50 loyalty points, 50% fee to provider
 * - 12-24h before: 25% of job value, -100 loyalty points, 15% to provider
 * - <12h before: 50% of job value, -200 loyalty points, 30% to provider
 * - No-show: 100% charged, -500 loyalty points, full payout to provider
 *
 * Provider cancellations incur rating penalties instead of fees.
 */
@Injectable()
export class CancellationsService {
  private readonly logger = new Logger(CancellationsService.name);

  // Platform fee in cents ($5.00)
  private readonly PLATFORM_FEE = 500;

  // Payment processing fee percentage (to cover Stripe fees on refunds)
  private readonly PROCESSING_FEE_PERCENT = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly loyalty: LoyaltyService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Calculate cancellation fees based on timing and job value
   */
  calculateCancellationFee(
    scheduledStart: Date | null,
    jobAmountCents: number,
    cancelledBy: CancelledBy,
  ): CancellationFeeResult {
    const now = new Date();
    let hoursUntilScheduled = Infinity;

    if (scheduledStart) {
      hoursUntilScheduled = (scheduledStart.getTime() - now.getTime()) / (1000 * 60 * 60);
    }

    // Provider cancellations don't incur monetary fees (only rating penalties)
    if (cancelledBy === CancelledBy.PROVIDER) {
      return {
        feeAmount: 0,
        feePercentage: 0,
        loyaltyPointsDeducted: 0,
        providerCompensation: 0,
        refundAmount: jobAmountCents,
        hoursUntilScheduled,
        tier: 'free',
      };
    }

    // No scheduled time yet or very far out (>48h)
    if (hoursUntilScheduled > 48) {
      return {
        feeAmount: 0,
        feePercentage: 0,
        loyaltyPointsDeducted: 25,
        providerCompensation: 0,
        refundAmount: jobAmountCents,
        hoursUntilScheduled,
        tier: 'free',
      };
    }

    // 24-48h before: Platform fee
    if (hoursUntilScheduled > 24) {
      const fee = this.PLATFORM_FEE;
      return {
        feeAmount: fee,
        feePercentage: Math.round((fee / jobAmountCents) * 100),
        loyaltyPointsDeducted: 50,
        providerCompensation: Math.round(fee * 0.5),
        refundAmount: Math.max(0, jobAmountCents - fee),
        hoursUntilScheduled,
        tier: 'low',
      };
    }

    // 12-24h before: 25% of job value
    if (hoursUntilScheduled > 12) {
      const fee = Math.round(jobAmountCents * 0.25);
      return {
        feeAmount: fee,
        feePercentage: 25,
        loyaltyPointsDeducted: 100,
        providerCompensation: Math.round(jobAmountCents * 0.15),
        refundAmount: Math.max(0, jobAmountCents - fee),
        hoursUntilScheduled,
        tier: 'medium',
      };
    }

    // <12h before: 50% of job value
    if (hoursUntilScheduled > 0) {
      const fee = Math.round(jobAmountCents * 0.50);
      return {
        feeAmount: fee,
        feePercentage: 50,
        loyaltyPointsDeducted: 200,
        providerCompensation: Math.round(jobAmountCents * 0.30),
        refundAmount: Math.max(0, jobAmountCents - fee),
        hoursUntilScheduled,
        tier: 'high',
      };
    }

    // Past scheduled time (no-show): 100% charged
    return {
      feeAmount: jobAmountCents,
      feePercentage: 100,
      loyaltyPointsDeducted: 500,
      providerCompensation: jobAmountCents,
      refundAmount: 0,
      hoursUntilScheduled,
      tier: 'no_refund',
    };
  }

  /**
   * Preview cancellation fees without actually cancelling
   */
  async previewCancellation(
    assignmentId: string,
    cancelledBy: CancelledBy,
  ): Promise<CancellationFeeResult> {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        job: {
          include: { payment: true },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException(`Assignment ${assignmentId} not found`);
    }

    if (assignment.status === 'cancelled') {
      throw new BadRequestException('This booking has already been cancelled');
    }

    if (assignment.status === 'completed') {
      throw new BadRequestException('Cannot cancel a completed booking');
    }

    const jobAmount = assignment.job.payment?.amount || 0;

    return this.calculateCancellationFee(
      assignment.scheduledStart,
      jobAmount,
      cancelledBy,
    );
  }

  /**
   * Cancel a booking/assignment
   */
  async cancelBooking(
    assignmentId: string,
    userId: string,
    dto: CancelBookingDto,
  ): Promise<CancellationResult> {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        job: {
          include: {
            payment: true,
            customer: true,
          },
        },
        provider: {
          include: { user: true },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException(`Assignment ${assignmentId} not found`);
    }

    if (assignment.status === 'cancelled') {
      throw new BadRequestException('This booking has already been cancelled');
    }

    if (assignment.status === 'completed') {
      throw new BadRequestException('Cannot cancel a completed booking');
    }

    // Verify user has permission to cancel
    const isCustomer = assignment.job.customerId === userId;
    const isProvider = assignment.provider.userId === userId;

    if (!isCustomer && !isProvider) {
      throw new BadRequestException('You do not have permission to cancel this booking');
    }

    // Verify cancelledBy matches the user's role
    if (dto.cancelledBy === CancelledBy.CUSTOMER && !isCustomer) {
      throw new BadRequestException('Only the customer can cancel as customer');
    }
    if (dto.cancelledBy === CancelledBy.PROVIDER && !isProvider) {
      throw new BadRequestException('Only the provider can cancel as provider');
    }

    const jobAmount = assignment.job.payment?.amount || 0;
    const fee = this.calculateCancellationFee(
      assignment.scheduledStart,
      jobAmount,
      dto.cancelledBy,
    );

    // Start transaction for all cancellation operations
    const result = await this.prisma.$transaction(async (tx) => {
      // Update assignment status
      await tx.assignment.update({
        where: { id: assignmentId },
        data: {
          status: 'cancelled',
          rejectedAt: new Date(),
        },
      });

      // Handle customer cancellation penalties
      if (dto.cancelledBy === CancelledBy.CUSTOMER && fee.loyaltyPointsDeducted > 0) {
        try {
          await this.loyalty.deductPointsForCancellation(
            assignment.job.customerId,
            fee.loyaltyPointsDeducted,
            assignmentId,
            dto.reason,
          );
        } catch (err: unknown) {
          this.logger.warn(`Failed to deduct loyalty points: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Create refund record if there's a payment
      let refundId: string | undefined;
      if (assignment.job.payment && fee.refundAmount > 0) {
        const refund = await tx.refund.create({
          data: {
            paymentId: assignment.job.payment.id,
            amount: fee.refundAmount,
            reason: `Cancellation: ${dto.reason}${dto.notes ? ` - ${dto.notes}` : ''}`,
            status: 'pending',
          },
        });
        refundId = refund.id;
      }

      return { refundId };
    });

    // Send notifications (outside transaction)
    const notifyCustomer = dto.cancelledBy === CancelledBy.PROVIDER;
    const notifyProvider = dto.cancelledBy === CancelledBy.CUSTOMER;

    if (notifyCustomer) {
      await this.notifications.sendNotification(
        assignment.job.customerId,
        NotificationType.JOB_CANCELLED,
        'Booking Cancelled',
        `Your booking "${assignment.job.title}" has been cancelled by the provider.`,
        {
          assignmentId,
          jobId: assignment.job.id,
          reason: dto.reason,
        },
      ).catch((err) => this.logger.error('Failed to notify customer:', err));
    }

    if (notifyProvider) {
      await this.notifications.sendNotification(
        assignment.provider.userId,
        NotificationType.JOB_CANCELLED,
        'Booking Cancelled',
        `The customer has cancelled the booking "${assignment.job.title}".`,
        {
          assignmentId,
          jobId: assignment.job.id,
          reason: dto.reason,
          compensation: fee.providerCompensation,
        },
      ).catch((err) => this.logger.error('Failed to notify provider:', err));
    }

    this.logger.log(
      `Booking ${assignmentId} cancelled by ${dto.cancelledBy}. ` +
      `Fee: $${(fee.feeAmount / 100).toFixed(2)}, ` +
      `Points deducted: ${fee.loyaltyPointsDeducted}, ` +
      `Provider compensation: $${(fee.providerCompensation / 100).toFixed(2)}`,
    );

    return {
      success: true,
      assignmentId,
      status: 'cancelled',
      fee,
      refundId: result.refundId,
      message: this.getCancellationMessage(fee, dto.cancelledBy),
    };
  }

  /**
   * Get user-friendly cancellation message
   */
  private getCancellationMessage(
    fee: CancellationFeeResult,
    cancelledBy: CancelledBy,
  ): string {
    if (cancelledBy === CancelledBy.PROVIDER) {
      return 'The provider has cancelled this booking. You will receive a full refund.';
    }

    switch (fee.tier) {
      case 'free':
        return fee.loyaltyPointsDeducted > 0
          ? `Booking cancelled. ${fee.loyaltyPointsDeducted} loyalty points have been deducted.`
          : 'Booking cancelled successfully with no penalty.';
      case 'low':
        return `Booking cancelled. A $${(fee.feeAmount / 100).toFixed(2)} platform fee applies. ` +
          `${fee.loyaltyPointsDeducted} loyalty points have been deducted.`;
      case 'medium':
        return `Booking cancelled. A ${fee.feePercentage}% cancellation fee ($${(fee.feeAmount / 100).toFixed(2)}) applies. ` +
          `${fee.loyaltyPointsDeducted} loyalty points have been deducted.`;
      case 'high':
        return `Booking cancelled. A ${fee.feePercentage}% cancellation fee ($${(fee.feeAmount / 100).toFixed(2)}) applies. ` +
          `${fee.loyaltyPointsDeducted} loyalty points have been deducted.`;
      case 'no_refund':
        return 'This booking was past the scheduled time. No refund will be issued. ' +
          `${fee.loyaltyPointsDeducted} loyalty points have been deducted.`;
      default:
        return 'Booking cancelled.';
    }
  }

  /**
   * Get cancellation history for a user
   */
  async getCancellationHistory(userId: string) {
    const assignments = await this.prisma.assignment.findMany({
      where: {
        status: 'cancelled',
        OR: [
          { job: { customerId: userId } },
          { provider: { userId } },
        ],
      },
      include: {
        job: {
          include: {
            customer: { select: { name: true, email: true } },
            payment: true,
          },
        },
        provider: {
          include: { user: { select: { name: true } } },
        },
      },
      orderBy: { rejectedAt: 'desc' },
      take: 50,
    });

    return assignments;
  }

  /**
   * Get user's cancellation rate
   */
  async getCancellationRate(userId: string): Promise<{
    totalBookings: number;
    cancelledBookings: number;
    cancellationRate: number;
  }> {
    const [total, cancelled] = await Promise.all([
      this.prisma.assignment.count({
        where: {
          OR: [
            { job: { customerId: userId } },
            { provider: { userId } },
          ],
        },
      }),
      this.prisma.assignment.count({
        where: {
          status: 'cancelled',
          OR: [
            { job: { customerId: userId } },
            { provider: { userId } },
          ],
        },
      }),
    ]);

    return {
      totalBookings: total,
      cancelledBookings: cancelled,
      cancellationRate: total > 0 ? Math.round((cancelled / total) * 100) : 0,
    };
  }
}
