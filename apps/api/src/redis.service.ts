import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import type { ServerConfig } from '@good-job/config';
import { Redis } from 'ioredis';

import { CONFIG } from './config.js';

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly client: Redis;

  constructor(@Inject(CONFIG) config: ServerConfig) {
    this.client = new Redis(config.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
  }

  async ping(): Promise<void> {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }
    await this.client.ping();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client.status !== 'end') {
      this.client.disconnect();
    }
  }
}
