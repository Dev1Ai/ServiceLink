import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum CancellationReason {
  SCHEDULE_CONFLICT = 'schedule_conflict',
  FOUND_ALTERNATIVE = 'found_alternative',
  PRICE_CONCERN = 'price_concern',
  CHANGE_OF_PLANS = 'change_of_plans',
  PROVIDER_UNAVAILABLE = 'provider_unavailable',
  CUSTOMER_UNRESPONSIVE = 'customer_unresponsive',
  EMERGENCY = 'emergency',
  OTHER = 'other',
}

export enum CancelledBy {
  CUSTOMER = 'customer',
  PROVIDER = 'provider',
  SYSTEM = 'system',
}

export class CancelBookingDto {
  @IsEnum(CancellationReason)
  @IsNotEmpty()
  reason!: CancellationReason;

  @IsEnum(CancelledBy)
  @IsNotEmpty()
  cancelledBy!: CancelledBy;

  @IsString()
  @IsOptional()
  notes?: string;
}

export interface CancellationFeeResult {
  feeAmount: number; // in cents
  feePercentage: number; // 0-100
  loyaltyPointsDeducted: number;
  providerCompensation: number; // in cents
  refundAmount: number; // in cents
  hoursUntilScheduled: number;
  tier: 'free' | 'low' | 'medium' | 'high' | 'no_refund';
}

export interface CancellationResult {
  success: boolean;
  assignmentId: string;
  status: string;
  fee: CancellationFeeResult;
  refundId?: string;
  message: string;
}
