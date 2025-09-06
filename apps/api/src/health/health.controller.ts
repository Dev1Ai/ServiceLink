import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';

class HealthDto {
  @ApiProperty()
  ok!: boolean;
  @ApiProperty({ type: String, format: 'date-time' })
  ts!: string;
}
@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Health check' })
  @ApiOkResponse({ type: HealthDto })
  get() {
    return { ok: true, ts: new Date().toISOString() };
  }
}
