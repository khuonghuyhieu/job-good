import { type DynamicModule, Module } from '@nestjs/common';
import type { ServerConfig } from '@good-job/config';

import { CONFIG } from '../config.js';
import { RedisEventSubscriberService } from './redis-event-subscriber.service.js';

@Module({})
export class RealtimeModule {
  static register(config: ServerConfig): DynamicModule {
    return {
      module: RealtimeModule,
      providers: [
        { provide: CONFIG, useValue: config },
        RedisEventSubscriberService,
      ],
    };
  }
}
