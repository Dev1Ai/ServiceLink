import { IsNotEmpty, IsNumber, IsOptional, IsString, IsDateString } from 'class-validator';

export class CreateCheckpointDto {
  @IsNotEmpty()
  @IsNumber()
  latitude!: number;

  @IsNotEmpty()
  @IsNumber()
  longitude!: number;

  @IsOptional()
  @IsNumber()
  accuracy?: number;

  @IsNotEmpty()
  @IsDateString()
  timestamp!: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CheckInDto extends CreateCheckpointDto {
  // Check-in specific fields can be added here if needed
}

export class CheckOutDto extends CreateCheckpointDto {
  // Check-out specific fields can be added here if needed
}

export class CreateLocationUpdateDto {
  @IsNotEmpty()
  @IsNumber()
  latitude!: number;

  @IsNotEmpty()
  @IsNumber()
  longitude!: number;

  @IsNotEmpty()
  @IsNumber()
  accuracy!: number;

  @IsNotEmpty()
  @IsDateString()
  timestamp!: string;
}

export class UpdateLocationSharingDto {
  @IsNotEmpty()
  enabled!: boolean;
}
