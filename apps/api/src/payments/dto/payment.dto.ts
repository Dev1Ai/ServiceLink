import { IsInt, IsString, Min, IsOptional } from 'class-validator';

export class CreatePaymentIntentDto {
  @IsInt()
  @Min(1)
  amount!: number;
}

export class CreateRefundDto {
  @IsInt()
  @Min(1)
  amount!: number;

  @IsString()
  @IsOptional()
  reason?: string;
}

// This DTO is not currently used in the controller but is defined for completeness.
export class CapturePaymentDto {
  @IsString()
  paymentIntentId!: string;
}