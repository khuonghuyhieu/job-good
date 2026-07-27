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

  async consumeRateLimit(
    key: string,
    windowSeconds: number,
  ): Promise<{ count: number; retryAfterSeconds: number }> {
    if (this.client.status === 'wait') await this.client.connect();
    const result = (await this.client.eval(
      `
        local count = redis.call('INCR', KEYS[1])
        if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
        local ttl = redis.call('TTL', KEYS[1])
        return { count, ttl }
      `,
      1,
      key,
      windowSeconds,
    )) as [number, number];
    return {
      count: Number(result[0]),
      retryAfterSeconds: Math.max(1, Number(result[1])),
    };
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client.status !== 'end') {
      this.client.disconnect();
    }
  }
}
