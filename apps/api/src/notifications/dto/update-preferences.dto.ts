import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePreferencesDto {
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
