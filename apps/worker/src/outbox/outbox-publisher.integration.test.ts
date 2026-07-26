import { randomUUID } from 'node:crypto';

import { parseServerConfig } from '@good-job/config';
import {
  realtimeEventEnvelopeSchema,
  realtimeRedisChannel,
} from '@good-job/contracts';
import { database, OutboxStatus } from '@good-job/database';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { OutboxPublisherService } from './outbox-publisher.service.js';

describe('Phase 8 transactional outbox publisher', () => {
  const organizationId = randomUUID();
  const eventId = randomUUID();
  const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  const subscriber = new Redis(redisUrl);
  const publisher = new OutboxPublisherService(
    parseServerConfig({
      NODE_ENV: 'test',
      LOG_LEVEL: 'error',
      API_PORT: '3000',
      WORKER_HEALTH_PORT: '3001',
      WEB_ORIGIN: 'http://localhost:8080',
      DATABASE_URL:
        process.env['DATABASE_URL'] ??
        'postgresql://good_job:local-development-only@localhost:5432/good_job',
      REDIS_URL: redisUrl,
      SESSION_SECRET: 'test-session-secret-at-least-32-characters',
      OBJECT_STORAGE_ENDPOINT: 'http://localhost:9000',
      OBJECT_STORAGE_REGION: 'us-east-1',
      OBJECT_STORAGE_BUCKET: 'good-job-media',
      OBJECT_STORAGE_ACCESS_KEY: 'test',
      OBJECT_STORAGE_SECRET_KEY: 'test-secret',
      OBJECT_STORAGE_FORCE_PATH_STYLE: 'true',
      MEDIA_MAX_IMAGE_BYTES: '10485760',
      MEDIA_MAX_VIDEO_BYTES: '209715200',
      MEDIA_MAX_VIDEO_DURATION_SECONDS: '180',
      WEBSOCKET_PATH: '/socket.io',
      ORGANIZATION_TIMEZONE: 'Asia/Ho_Chi_Minh',
      SEED_BUSINESS_MONTH: '2026-07',
    }),
  );

  beforeAll(async () => {
    await database.organization.create({
      data: {
        id: organizationId,
        name: 'Outbox publisher test',
        slug: `outbox-${organizationId}`,
        timezone: 'Asia/Ho_Chi_Minh',
      },
    });
    await subscriber.subscribe(realtimeRedisChannel);
  });

  afterAll(async () => {
    await publisher.onApplicationShutdown();
    subscriber.disconnect();
  });

  it('publishes a committed row and safely repeats the stable event id', async () => {
    const envelope = {
      eventId,
      type: 'kudo.committed' as const,
      organizationId,
      occurredAt: new Date().toISOString(),
      payload: {
        kudoId: randomUUID(),
        senderId: randomUUID(),
        receiverId: randomUUID(),
        coreValueId: randomUUID(),
        points: 20,
        description: 'Published after commit.',
      },
    };
    await database.transactionalOutbox.create({
      data: {
        id: eventId,
        organizationId,
        eventType: envelope.type,
        aggregateType: 'kudo',
        aggregateId: envelope.payload.kudoId,
        payload: envelope,
      },
    });
    const messages: string[] = [];
    subscriber.on('message', (_channel, message) => messages.push(message));

    await invokeUntilPublished(publisher, eventId);
    await waitFor(() => matchingMessages(messages, eventId).length === 1);
    expect(
      realtimeEventEnvelopeSchema.parse(
        JSON.parse(matchingMessages(messages, eventId)[0]!),
      ),
    ).toEqual(envelope);
    expect(
      await database.transactionalOutbox.findUniqueOrThrow({
        where: { id: eventId },
      }),
    ).toMatchObject({ status: OutboxStatus.published, attempts: 1 });

    await database.transactionalOutbox.update({
      where: { id: eventId },
      data: { status: OutboxStatus.pending, availableAt: new Date() },
    });
    await invokeUntilPublished(publisher, eventId);
    await waitFor(() => matchingMessages(messages, eventId).length === 2);
    expect(JSON.parse(matchingMessages(messages, eventId)[1]!).eventId).toBe(
      eventId,
    );
  });

  it('keeps a failed publication retryable with the same envelope', async () => {
    const retryEventId = randomUUID();
    const envelope = {
      eventId: retryEventId,
      type: 'notification.created' as const,
      organizationId,
      recipientUserIds: [randomUUID()],
      occurredAt: new Date().toISOString(),
      payload: { notificationId: randomUUID() },
    };
    await database.transactionalOutbox.create({
      data: {
        id: retryEventId,
        organizationId,
        eventType: envelope.type,
        aggregateType: 'notification',
        aggregateId: envelope.payload.notificationId,
        payload: envelope,
        attempts: 1,
        availableAt: new Date(Date.now() + 60_000),
      },
    });
    const internals = publisher as unknown as {
      claim: () => Promise<{
        id: string;
        organizationId: string;
        eventType: string;
        payload: unknown;
      } | null>;
      redis: { publish: (channel: string, message: string) => Promise<number> };
    };
    const claim = vi.spyOn(internals, 'claim').mockResolvedValue({
      id: retryEventId,
      organizationId,
      eventType: envelope.type,
      payload: envelope,
    });
    const publish = vi
      .spyOn(internals.redis, 'publish')
      .mockRejectedValueOnce(new Error('temporary Redis failure'));

    await invokePublisher(publisher);
    claim.mockRestore();
    publish.mockRestore();

    const failedAttempt = await database.transactionalOutbox.findUniqueOrThrow({
      where: { id: retryEventId },
    });
    expect(failedAttempt).toMatchObject({
      status: OutboxStatus.pending,
      attempts: 1,
      lastError: 'temporary Redis failure',
      payload: envelope,
    });

    await database.transactionalOutbox.update({
      where: { id: retryEventId },
      data: { availableAt: new Date() },
    });
    await invokeUntilPublished(publisher, retryEventId);
    expect(
      await database.transactionalOutbox.findUniqueOrThrow({
        where: { id: retryEventId },
      }),
    ).toMatchObject({
      status: OutboxStatus.published,
      payload: envelope,
    });
  });

  it('quarantines a row whose canonical columns disagree with its envelope', async () => {
    const rowId = randomUUID();
    const embeddedEventId = randomUUID();
    const envelope = {
      eventId: embeddedEventId,
      type: 'notification.created' as const,
      organizationId,
      recipientUserIds: [randomUUID()],
      occurredAt: new Date().toISOString(),
      payload: { notificationId: randomUUID() },
    };
    const messages: string[] = [];
    subscriber.on('message', (_channel, message) => messages.push(message));
    await database.transactionalOutbox.create({
      data: {
        id: rowId,
        organizationId,
        eventType: envelope.type,
        aggregateType: 'notification',
        aggregateId: envelope.payload.notificationId,
        payload: envelope,
      },
    });

    await invokeUntilStatus(publisher, rowId, OutboxStatus.failed);
    expect(
      await database.transactionalOutbox.findUniqueOrThrow({
        where: { id: rowId },
      }),
    ).toMatchObject({
      status: OutboxStatus.failed,
      lastError: 'Outbox columns do not match the realtime event envelope.',
    });
    expect(
      messages.some(
        (message) => JSON.parse(message).eventId === embeddedEventId,
      ),
    ).toBe(false);
    await expect(publisher.ping()).rejects.toThrow(
      'public outbox event(s) require review',
    );

    await database.transactionalOutbox.delete({ where: { id: rowId } });
    await expect(publisher.ping()).resolves.toBeUndefined();
  });
});

function invokePublisher(publisher: OutboxPublisherService): Promise<void> {
  return (
    publisher as unknown as { publishNext: () => Promise<void> }
  ).publishNext();
}

async function invokeUntilPublished(
  publisher: OutboxPublisherService,
  id: string,
): Promise<void> {
  const deadline = Date.now() + 2000;
  while (true) {
    await invokePublisher(publisher);
    const row = await database.transactionalOutbox.findUniqueOrThrow({
      where: { id },
    });
    if (row.status === OutboxStatus.published) return;
    if (Date.now() > deadline) throw new Error('Timed out publishing outbox.');
  }
}

async function invokeUntilStatus(
  publisher: OutboxPublisherService,
  id: string,
  status: OutboxStatus,
): Promise<void> {
  const deadline = Date.now() + 2000;
  while (true) {
    await invokePublisher(publisher);
    const row = await database.transactionalOutbox.findUniqueOrThrow({
      where: { id },
    });
    if (row.status === status) return;
    if (Date.now() > deadline) throw new Error('Timed out processing outbox.');
  }
}

function matchingMessages(messages: string[], id: string): string[] {
  return messages.filter((message) => JSON.parse(message).eventId === id);
}

async function waitFor(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 2000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for Redis.');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
