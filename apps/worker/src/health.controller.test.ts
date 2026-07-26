import { describe, expect, it, vi } from 'vitest';

import { HealthController } from './health.controller.js';
import type { QueueHealthService } from './queue-health.service.js';
import type { MediaWorkerService } from './media/media-worker.service.js';
import type { OutboxPublisherService } from './outbox/outbox-publisher.service.js';

describe('Worker readiness failures', () => {
  it('returns not_ready when the BullMQ queue is unavailable', async () => {
    const controller = new HealthController(
      {
        ping: vi.fn().mockRejectedValue(new Error('queue unavailable')),
      } as unknown as QueueHealthService,
      {
        ping: vi.fn().mockResolvedValue(undefined),
      } as unknown as MediaWorkerService,
      {
        ping: vi.fn().mockResolvedValue(undefined),
      } as unknown as OutboxPublisherService,
    );

    await expect(controller.ready()).rejects.toMatchObject({
      response: {
        status: 'not_ready',
        dependencies: { queue: { status: 'down' } },
      },
    });
  });

  it('reports not_ready when failed public outbox events require review', async () => {
    const controller = new HealthController(
      {
        ping: vi.fn().mockResolvedValue(undefined),
      } as unknown as QueueHealthService,
      {
        ping: vi.fn().mockResolvedValue(undefined),
      } as unknown as MediaWorkerService,
      {
        ping: vi
          .fn()
          .mockRejectedValue(new Error('failed public outbox event')),
      } as unknown as OutboxPublisherService,
    );

    await expect(controller.ready()).rejects.toMatchObject({
      response: {
        status: 'not_ready',
        dependencies: { outbox: { status: 'down' } },
      },
    });
  });
});
