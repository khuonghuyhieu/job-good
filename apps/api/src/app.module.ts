import { type DynamicModule, Module } from '@nestjs/common';

import type { ServerConfig } from '@good-job/config';

import { AuthModule } from './auth/auth.module.js';
import { CONFIG } from './config.js';
import { DatabaseService } from './database.service.js';
import { HealthController } from './health.controller.js';
import { RedisService } from './redis.service.js';

@Module({})
export class AppModule {
  static register(config: ServerConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [AuthModule.register(config)],
      controllers: [HealthController],
      providers: [
        { provide: CONFIG, useValue: config },
        DatabaseService,
        RedisService,
      ],
    };
  }
}
