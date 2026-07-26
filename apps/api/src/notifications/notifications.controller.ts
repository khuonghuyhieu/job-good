import {
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  MarkNotificationReadResponse,
  NotificationListResponse,
  NotificationUnreadCountResponse,
} from '@good-job/contracts';

import type { AuthenticatedPrincipal } from '../auth/authenticated-principal.js';
import { CurrentPrincipal } from '../auth/current-principal.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { ApiException } from '../http/api.exception.js';
import { NotificationRepository } from './notification.repository.js';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

@Controller('notifications')
@UseGuards(SessionAuthGuard)
export class NotificationsController {
  constructor(
    @Inject(NotificationRepository)
    private readonly notifications: NotificationRepository,
  ) {}

  @Get()
  list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('cursor') cursor?: string,
    @Query('limit') rawLimit?: string,
  ): Promise<NotificationListResponse> {
    const limit = rawLimit === undefined ? 20 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new ApiException(400, {
        code: 'VALIDATION_ERROR',
        message: 'The notification page size is invalid.',
      });
    }
    return this.notifications.list(principal, cursor, limit);
  }

  @Get('unread-count')
  unreadCount(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<NotificationUnreadCountResponse> {
    return this.notifications.unreadCount(principal);
  }

  @Patch(':notificationId/read')
  markRead(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('notificationId') notificationId: string,
  ): Promise<MarkNotificationReadResponse> {
    if (!uuidPattern.test(notificationId)) {
      throw new ApiException(400, {
        code: 'VALIDATION_ERROR',
        message: 'The notification identifier is invalid.',
      });
    }
    return this.notifications.markRead(principal, notificationId);
  }
}
