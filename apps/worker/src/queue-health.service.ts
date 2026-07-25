import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import type { ServerConfig } from '@good-job/config';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

import { CONFIG } from './config.js';

@Injectable()
export class QueueHealthService implements OnApplicationShutdown {
  private readonly client: Redis;
  private readonly queue: Queue;

  constructor(@Inject(CONFIG) config: ServerConfig) {
    this.client = new Redis(config.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      retryStrategy: () => null,
    });
    this.queue = new Queue('foundation-health', { connection: this.client });
  }

  async ping(): Promise<void> {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }
    await this.queue.getJobCounts(
      'active',
      'completed',
      'delayed',
      'failed',
      'paused',
      'prioritized',
      'waiting',
      'waiting-children',
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await this.queue.close();
    if (this.client.status !== 'end') {
      this.client.disconnect();
    }
  }
}
