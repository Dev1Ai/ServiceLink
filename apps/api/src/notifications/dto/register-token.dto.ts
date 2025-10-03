import { IsString, IsIn, IsOptional, IsBoolean } from 'class-validator';

export class RegisterTokenDto {
  @IsString()
  token!: string;

  @IsString()
  @IsIn(['ios', 'android', 'web'])
  platform!: string;

  @IsOptional()
  @IsBoolean()
  notifyNewJobs?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyNewQuotes?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyQuoteAccepted?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyJobCompleted?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyPaymentReceived?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyReminders?: boolean;
}
