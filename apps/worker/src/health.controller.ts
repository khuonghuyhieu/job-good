import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { HealthResponse } from '@good-job/contracts';

import { QueueHealthService } from './queue-health.service.js';
import { MediaWorkerService } from './media/media-worker.service.js';
import { OutboxPublisherService } from './outbox/outbox-publisher.service.js';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(QueueHealthService) private readonly queue: QueueHealthService,
    @Inject(MediaWorkerService) private readonly media: MediaWorkerService,
    @Inject(OutboxPublisherService)
    private readonly outbox: OutboxPublisherService,
  ) {}

  @Get('live')
  live(): HealthResponse {
    return {
      service: 'worker',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async ready(): Promise<HealthResponse> {
    const startedAt = performance.now();
    const [queue, media, outbox] = await Promise.allSettled([
      this.queue.ping(),
      this.media.ping(),
      this.outbox.ping(),
    ]);
    const dependencies = {
      queue: {
        status:
          queue.status === 'fulfilled' ? ('up' as const) : ('down' as const),
        latencyMs: performance.now() - startedAt,
      },
      media: {
        status:
          media.status === 'fulfilled' ? ('up' as const) : ('down' as const),
        latencyMs: performance.now() - startedAt,
      },
      outbox: {
        status:
          outbox.status === 'fulfilled' ? ('up' as const) : ('down' as const),
        latencyMs: performance.now() - startedAt,
      },
    };
    if (
      queue.status === 'fulfilled' &&
      media.status === 'fulfilled' &&
      outbox.status === 'fulfilled'
    ) {
      return {
        service: 'worker',
        status: 'ok',
        timestamp: new Date().toISOString(),
        dependencies,
      };
    }
    const response: HealthResponse = {
      service: 'worker',
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      dependencies,
    };
    throw new ServiceUnavailableException(response);
  }
}
