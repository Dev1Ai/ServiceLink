import { Controller, Post, Delete, Body, Param, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import type { AuthedRequest } from '../common/types/request';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { DeviceTokenDto } from './dto/device-token.dto';

@ApiTags('device-tokens')
@Controller('device-tokens')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
export class DeviceTokensController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @ApiOperation({ summary: 'Register a device token for push notifications' })
  @ApiOkResponse({ type: DeviceTokenDto })
  async register(@Req() req: AuthedRequest, @Body() dto: RegisterDeviceTokenDto) {
    const { token, platform } = dto;

    if (!['ios', 'android', 'web'].includes(platform)) {
      throw new BadRequestException('Platform must be ios, android, or web');
    }

    const existing = await this.prisma.deviceToken.findUnique({
      where: { token },
    });

    if (existing) {
      const updated = await this.prisma.deviceToken.update({
        where: { token },
        data: {
          userId: req.user.sub,
          active: true,
        },
      });
      return updated;
    }

    const deviceToken = await this.prisma.deviceToken.create({
      data: {
        userId: req.user.sub,
        token,
        platform,
        active: true,
      },
    });

    return deviceToken;
  }

  @Delete(':token')
  @ApiOperation({ summary: 'Unregister a device token' })
  @ApiOkResponse({ description: 'Device token deactivated successfully' })
  async unregister(@Req() req: AuthedRequest, @Param('token') token: string) {
    const deviceToken = await this.prisma.deviceToken.findUnique({
      where: { token },
    });

    if (!deviceToken || deviceToken.userId !== req.user.sub) {
      throw new BadRequestException('Device token not found or does not belong to user');
    }

    await this.prisma.deviceToken.update({
      where: { token },
      data: { active: false },
    });

    return { message: 'Device token deactivated successfully' };
  }
}
