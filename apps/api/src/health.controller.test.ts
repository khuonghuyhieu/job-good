import { describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from './database.service.js';
import { HealthController } from './health.controller.js';
import type { RedisService } from './redis.service.js';

describe('API readiness failures', () => {
  it('returns not_ready when PostgreSQL is unavailable', async () => {
    const controller = new HealthController(
      {
        ping: vi.fn().mockRejectedValue(new Error('database unavailable')),
      } as unknown as DatabaseService,
      { ping: vi.fn().mockResolvedValue(undefined) } as unknown as RedisService,
    );

    await expect(controller.ready()).rejects.toMatchObject({
      response: {
        status: 'not_ready',
        dependencies: {
          postgres: { status: 'down' },
          redis: { status: 'up' },
        },
      },
    });
  });

  it('returns not_ready when Redis is unavailable', async () => {
    const controller = new HealthController(
      {
        ping: vi.fn().mockResolvedValue(undefined),
      } as unknown as DatabaseService,
      {
        ping: vi.fn().mockRejectedValue(new Error('redis unavailable')),
      } as unknown as RedisService,
    );

    await expect(controller.ready()).rejects.toMatchObject({
      response: {
        status: 'not_ready',
        dependencies: {
          postgres: { status: 'up' },
          redis: { status: 'down' },
        },
      },
    });
  });
});
