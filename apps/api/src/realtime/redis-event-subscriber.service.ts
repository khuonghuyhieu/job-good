import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import type { ServerConfig } from '@good-job/config';
import {
  realtimeEventEnvelopeSchema,
  realtimeRedisChannel,
} from '@good-job/contracts';
import { Redis } from 'ioredis';

import { AuthenticatedSocketService } from '../auth/authenticated-socket.service.js';
import { CONFIG } from '../config.js';

@Injectable()
export class RedisEventSubscriberService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(RedisEventSubscriberService.name);
  private readonly subscriber: Redis;

  constructor(
    @Inject(CONFIG) config: ServerConfig,
    @Inject(AuthenticatedSocketService)
    private readonly sockets: AuthenticatedSocketService,
  ) {
    this.subscriber = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  }

  async onModuleInit(): Promise<void> {
    this.subscriber.on('message', (_channel, raw) => {
      try {
        const parsed = realtimeEventEnvelopeSchema.safeParse(JSON.parse(raw));
        if (parsed.success) this.sockets.emitEvent(parsed.data);
        else this.logger.warn('Ignored an invalid realtime event envelope.');
      } catch {
        this.logger.warn('Ignored a malformed realtime message.');
      }
    });
    await this.subscriber.subscribe(realtimeRedisChannel);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.subscriber.unsubscribe(realtimeRedisChannel).catch(() => 0);
    this.subscriber.disconnect();
  }
}
