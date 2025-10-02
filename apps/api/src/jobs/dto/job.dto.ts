import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Min, MinLength } from 'class-validator';

export class CreateJobDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  title!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  description!: string;
}

export class JobDto {
  @ApiProperty() id!: string;
  @ApiProperty() key!: string;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty() customerId!: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: Date;
}

export class QuoteDto {
  @ApiProperty() id!: string;
  @ApiProperty() jobId!: string;
  @ApiProperty() providerId!: string;
  @ApiProperty() total!: number;
  @ApiProperty() status!: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: Date;
}

export class QuoteProviderUserDto {
  @ApiProperty() name!: string;
  @ApiProperty() email!: string;
}

export class QuoteProviderDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: QuoteProviderUserDto }) user!: QuoteProviderUserDto;
}

export class QuoteWithProviderDto extends QuoteDto {
  @ApiProperty({ type: QuoteProviderDto })
  provider!: QuoteProviderDto;
}

export class CreateQuoteDto {
  @ApiProperty({ type: Number, minimum: 1, example: 150, description: 'Total quote amount (integer, in smallest currency unit or dollars as per UI)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  total!: number;
}
