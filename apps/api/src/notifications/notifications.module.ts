import { Module } from '@nestjs/common';

import { NotificationRepository } from './notification.repository.js';
import { NotificationsController } from './notifications.controller.js';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationRepository],
})
export class NotificationsModule {}
