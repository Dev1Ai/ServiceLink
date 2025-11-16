import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ErrorDto {
  @ApiProperty()
  statusCode!: number;

  @ApiProperty()
  message!: string | string[];

  @ApiPropertyOptional()
  error?: string;

  @ApiPropertyOptional()
  path?: string;

  @ApiPropertyOptional({ type: String, format: "date-time" })
  timestamp?: string;
}
