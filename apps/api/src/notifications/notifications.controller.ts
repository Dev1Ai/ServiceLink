import { Controller, Get, Patch, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { NotificationsService } from './notifications.service';

interface AuthenticatedRequest {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Get notification history for the authenticated user
   * @param req Express request with authenticated user
   * @param limit Maximum number of notifications to return
   * @param unreadOnly Only return unread notifications
   */
  @Get()
  async getNotifications(
    @Request() req: AuthenticatedRequest,
    @Query('limit') limit?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    const userId = req.user.userId;
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const parsedUnreadOnly = unreadOnly === 'true';

    return this.notificationsService.getNotifications(userId, parsedLimit, parsedUnreadOnly);
  }

  /**
   * Get unread notification count for the authenticated user
   * @param req Express request with authenticated user
   */
  @Get('unread-count')
  async getUnreadCount(@Request() req: AuthenticatedRequest) {
    const userId = req.user.userId;
    const count = await this.notificationsService.getUnreadCount(userId);
    return { count };
  }

  /**
   * Mark a notification as read
   * @param req Express request with authenticated user
   * @param id Notification ID
   */
  @Patch(':id/read')
  async markAsRead(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    const userId = req.user.userId;
    return this.notificationsService.markAsRead(id, userId);
  }

  /**
   * Mark all notifications as read for the authenticated user
   * @param req Express request with authenticated user
   */
  @Patch('read-all')
  async markAllAsRead(@Request() req: AuthenticatedRequest) {
    const userId = req.user.userId;
    return this.notificationsService.markAllAsRead(userId);
  }
}
