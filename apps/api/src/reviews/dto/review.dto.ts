import { IsInt, IsString, Max, Min, IsOptional } from 'class-validator';

export class CreateReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  stars!: number;

  @IsString()
  @IsOptional()
  comment?: string;
}