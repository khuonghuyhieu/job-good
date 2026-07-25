import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { HealthResponse } from '@good-job/contracts';

import { QueueHealthService } from './queue-health.service.js';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(QueueHealthService) private readonly queue: QueueHealthService,
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
    try {
      await this.queue.ping();
      return {
        service: 'worker',
        status: 'ok',
        timestamp: new Date().toISOString(),
        dependencies: {
          queue: { status: 'up', latencyMs: performance.now() - startedAt },
        },
      };
    } catch {
      const response: HealthResponse = {
        service: 'worker',
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        dependencies: {
          queue: { status: 'down', latencyMs: performance.now() - startedAt },
        },
      };
      throw new ServiceUnavailableException(response);
    }
  }
}
