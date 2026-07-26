import { type DynamicModule, Module } from '@nestjs/common';

import type { ServerConfig } from '@good-job/config';

import { AuthModule } from './auth/auth.module.js';
import { CONFIG } from './config.js';
import { DatabaseService } from './database.service.js';
import { HealthController } from './health.controller.js';
import { MediaModule } from './media/media.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { RecognitionModule } from './recognition/recognition.module.js';
import { RedisService } from './redis.service.js';
import { RewardsModule } from './rewards/rewards.module.js';
import { WalletModule } from './wallet/wallet.module.js';

@Module({})
export class AppModule {
  static register(config: ServerConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        AuthModule.register(config),
        RecognitionModule,
        WalletModule,
        RewardsModule,
        MediaModule.register(config),
        RealtimeModule.register(config),
        NotificationsModule,
      ],
      controllers: [HealthController],
      providers: [
        { provide: CONFIG, useValue: config },
        DatabaseService,
        RedisService,
      ],
    };
  }
}
