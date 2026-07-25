import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { HealthResponse } from '@good-job/contracts';

import { DatabaseService } from './database.service.js';
import { RedisService } from './redis.service.js';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  @Get('live')
  live(): HealthResponse {
    return {
      service: 'api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async ready(): Promise<HealthResponse> {
    const dependencies = {
      postgres: await this.check(() => this.database.ping()),
      redis: await this.check(() => this.redis.ping()),
    };
    const isReady = Object.values(dependencies).every(
      ({ status }) => status === 'up',
    );
    const response: HealthResponse = {
      service: 'api',
      status: isReady ? 'ok' : 'not_ready',
      timestamp: new Date().toISOString(),
      dependencies,
    };

    if (!isReady) {
      throw new ServiceUnavailableException(response);
    }
    return response;
  }

  private async check(
    operation: () => Promise<void>,
  ): Promise<{ status: 'up' | 'down'; latencyMs: number }> {
    const startedAt = performance.now();
    try {
      await operation();
      return { status: 'up', latencyMs: performance.now() - startedAt };
    } catch {
      return { status: 'down', latencyMs: performance.now() - startedAt };
    }
  }
}
