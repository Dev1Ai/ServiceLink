import { IsNotEmpty, IsString, IsEnum, IsOptional, IsNumber } from 'class-validator';
import { PhotoContextType } from '@prisma/client';

export class GenerateUploadUrlDto {
  @IsNotEmpty()
  @IsString()
  filename!: string;

  @IsNotEmpty()
  @IsString()
  contentType!: string;

  @IsNotEmpty()
  @IsEnum(PhotoContextType)
  contextType!: PhotoContextType;

  @IsNotEmpty()
  @IsString()
  contextId!: string;
}

export class ConfirmUploadDto {
  @IsOptional()
  @IsNumber()
  size?: number;

  @IsOptional()
  @IsNumber()
  width?: number;

  @IsOptional()
  @IsNumber()
  height?: number;
}
