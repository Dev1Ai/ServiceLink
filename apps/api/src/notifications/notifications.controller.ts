import { Controller, Post, Put, Get, Body, UseGuards, Req, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { NotificationsService } from './notifications.service';
import { RegisterTokenDto } from './dto/register-token.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('register-token')
  @UseGuards(JwtAuthGuard)
  async registerToken(@Req() req: any, @Body() dto: RegisterTokenDto) {
    const userId = req.user.userId;
    return this.notificationsService.registerToken(userId, dto);
  }

  @Put('preferences/:tokenId')
  @UseGuards(JwtAuthGuard)
  async updatePreferences(@Param('tokenId') tokenId: string, @Body() dto: UpdatePreferencesDto) {
    return this.notificationsService.updatePreferences(tokenId, dto);
  }

  @Get('tokens')
  @UseGuards(JwtAuthGuard)
  async getUserTokens(@Req() req: any) {
    const userId = req.user.userId;
    return this.notificationsService.getUserTokens(userId);
  }
}
