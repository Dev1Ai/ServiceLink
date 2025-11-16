import { Controller, Get } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";

class HealthDto {
  @ApiProperty()
  ok!: boolean;
  @ApiProperty({ type: String, format: "date-time" })
  ts!: string;
  @ApiPropertyOptional()
  usingRedis?: boolean;
  @ApiPropertyOptional()
  hits?: number;
}
@ApiTags("health")
@Controller("health")
export class HealthController {
  private redis: { incr: (key: string) => Promise<number> } | null = null;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>("REDIS_URL");
    if (url) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const IORedis = require("ioredis");
        this.redis = new IORedis(url);
      } catch {
        this.redis = null;
      }
    }
  }
  @Get()
  @ApiOperation({ summary: "Health check" })
  @ApiOkResponse({ type: HealthDto })
  async get() {
    const ts = new Date().toISOString();
    if (!this.redis) return { ok: true, ts, usingRedis: false };
    try {
      const key = "metrics:health:hits";
      const hits = await this.redis.incr(key);
      return { ok: true, ts, usingRedis: true, hits };
    } catch {
      return { ok: true, ts, usingRedis: false };
    }
  }
}
