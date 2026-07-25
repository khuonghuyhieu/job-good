import { describe, expect, it, vi } from 'vitest';

import { HealthController } from './health.controller.js';
import type { QueueHealthService } from './queue-health.service.js';

describe('Worker readiness failures', () => {
  it('returns not_ready when the BullMQ queue is unavailable', async () => {
    const controller = new HealthController({
      ping: vi.fn().mockRejectedValue(new Error('queue unavailable')),
    } as unknown as QueueHealthService);

    await expect(controller.ready()).rejects.toMatchObject({
      response: {
        status: 'not_ready',
        dependencies: { queue: { status: 'down' } },
      },
    });
  });
});
