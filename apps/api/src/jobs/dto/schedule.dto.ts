import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDate,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class ProposeScheduleDto {
  @ApiProperty({
    description: "Preferred visit start time",
    type: String,
    format: "date-time",
  })
  @Type(() => Date)
  @IsDate()
  start!: Date;

  @ApiProperty({
    description: "Preferred visit end time",
    type: String,
    format: "date-time",
  })
  @Type(() => Date)
  @IsDate()
  end!: Date;

  @ApiPropertyOptional({
    description: "Current schedule version for optimistic locking",
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  version?: number;

  @ApiPropertyOptional({
    description: "Optional notes/context for the proposed window",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ConfirmScheduleDto {
  @ApiProperty({
    description: "Expected schedule version when confirming",
    minimum: 0,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  version!: number;

  @ApiPropertyOptional({
    description: "Optional confirmation notes",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class RejectAssignmentDto {
  @ApiPropertyOptional({
    description: "Optional reason for rejecting the assignment",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AssignmentDto {
  @ApiProperty() id!: string;
  @ApiProperty() jobId!: string;
  @ApiProperty() providerId!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ type: String, format: "date-time" }) acceptedAt!: Date;
  @ApiProperty({
    type: String,
    format: "date-time",
    required: false,
    nullable: true,
  })
  scheduledStart!: Date | null;
  @ApiProperty({
    type: String,
    format: "date-time",
    required: false,
    nullable: true,
  })
  scheduledEnd!: Date | null;
  @ApiPropertyOptional({
    enum: ["CUSTOMER", "PROVIDER", "SYSTEM"],
    nullable: true,
  })
  scheduleProposedBy?: string | null;
  @ApiProperty({
    type: String,
    format: "date-time",
    required: false,
    nullable: true,
  })
  scheduleProposedAt!: Date | null;
  @ApiProperty({ description: "Current schedule version" })
  scheduleVersion!: number;
  @ApiPropertyOptional({
    description: "Optional notes for the scheduled visit",
    nullable: true,
  })
  scheduleNotes?: string | null;
  @ApiProperty({
    type: String,
    format: "date-time",
    required: false,
    nullable: true,
  })
  completedAt!: Date | null;
  @ApiProperty({
    type: String,
    format: "date-time",
    required: false,
    nullable: true,
  })
  customerVerifiedAt!: Date | null;
  @ApiProperty({
    type: String,
    format: "date-time",
    required: false,
    nullable: true,
  })
  rejectedAt!: Date | null;
  @ApiPropertyOptional({ enum: ["NONE", "QUEUED", "SENT", "OVERDUE"] })
  reminderStatus!: string;
  @ApiProperty({
    type: String,
    format: "date-time",
    required: false,
    nullable: true,
  })
  reminderLastSentAt!: Date | null;
  @ApiProperty({
    description: "How many reminders have been sent for this assignment",
  })
  reminderCount!: number;
  @ApiPropertyOptional({
    enum: ["PENDING", "AWAITING_APPROVAL", "APPROVED", "PAID", "BLOCKED"],
  })
  payoutStatus!: string;
  @ApiProperty({
    type: String,
    format: "date-time",
    required: false,
    nullable: true,
  })
  payoutApprovedAt!: Date | null;
  @ApiPropertyOptional({
    description: "User id or email that approved payout",
    nullable: true,
  })
  payoutApprovedBy!: string | null;
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: Date;
  @ApiProperty({ type: String, format: "date-time" }) updatedAt!: Date;
}
