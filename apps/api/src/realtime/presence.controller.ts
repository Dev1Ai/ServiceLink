import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { RealtimeService } from './realtime.service';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard, Roles, RolesGuard } from '../auth/jwt.guard';

class PresenceDto {
  online!: string[];
  count!: number;
}

@ApiTags('presence')
@Controller('presence')
export class PresenceController {
  constructor(private readonly realtime: RealtimeService, private readonly config: ConfigService) {}

  @Get()
  @ApiOperation({ summary: 'List online userIds' })
  @ApiOkResponse({ type: PresenceDto })
  @ApiTooManyRequestsResponse({ description: 'Too many requests' })
  async getPresence() {
    const online = await this.realtime.listOnline();
    return { online, count: online.length };
  }

  @Get('config')
  @ApiOperation({ summary: 'Presence configuration' })
  @ApiOkResponse({ schema: { properties: { ttlSeconds: { type: 'number' } } } })
  getConfig() {
    const ttl = Number(this.config.get<string>('PRESENCE_TTL') || '60');
    return { ttlSeconds: ttl };
  }

  @Post('reconcile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Force reconcile presence (admin)' })
  @ApiOkResponse({ schema: { properties: { ok: { type: 'boolean' }, online: { type: 'array', items: { type: 'string' } } } } })
  async reconcile() {
    const ttl = Number(this.config.get<string>('PRESENCE_TTL') || '60');
    await this.realtime.reconcile(ttl);
    const online = await this.realtime.listOnline();
    return { ok: true, online };
  }
}
