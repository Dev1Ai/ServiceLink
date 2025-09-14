import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class SearchProvidersQueryDto {
  @ApiPropertyOptional({ description: 'Service name contains' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Exact service name (case-insensitive)' })
  @IsOptional()
  @IsString()
  service?: string;

  @ApiPropertyOptional({ description: 'Category slug (case-insensitive)' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }) => String(value).toLowerCase() === 'true')
  @IsBoolean()
  onlineOnly?: boolean;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minPrice?: number;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxPrice?: number;

  @ApiPropertyOptional({ enum: ['price', 'online'], default: 'price' })
  @IsOptional()
  @IsIn(['price', 'online'])
  sort?: 'price' | 'online' = 'price';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'asc';

  @ApiPropertyOptional({ type: Number, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ type: Number, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 50;

  // Optional geo for hybrid search
  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  radiusKm?: number;
}

export class NearProvidersQueryDto {
  @ApiPropertyOptional({ type: Number })
  @Type(() => Number)
  @IsNumber()
  lat!: number;

  @ApiPropertyOptional({ type: Number })
  @Type(() => Number)
  @IsNumber()
  lng!: number;

  @ApiPropertyOptional({ type: Number, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  radiusKm?: number = 25;

  @ApiPropertyOptional({ description: 'Service name contains' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Exact service name (case-insensitive)' })
  @IsOptional()
  @IsString()
  service?: string;

  @ApiPropertyOptional({ description: 'Category slug (case-insensitive)' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }) => String(value).toLowerCase() === 'true')
  @IsBoolean()
  onlineOnly?: boolean;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minPrice?: number;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxPrice?: number;

  @ApiPropertyOptional({ enum: ['distance', 'price', 'online', 'rank'], default: 'distance' })
  @IsOptional()
  @IsIn(['distance', 'price', 'online', 'rank'])
  sort?: 'distance' | 'price' | 'online' | 'rank' = 'distance';

  @ApiPropertyOptional({ enum: ['balanced', 'cheap', 'near', 'online'], default: 'balanced' })
  @IsOptional()
  @IsIn(['balanced', 'cheap', 'near', 'online'])
  rank?: 'balanced' | 'cheap' | 'near' | 'online' = 'balanced';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'asc';

  @ApiPropertyOptional({ type: Number, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ type: Number, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 50;
}

