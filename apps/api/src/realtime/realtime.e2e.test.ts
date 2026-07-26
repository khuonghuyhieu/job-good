import { randomUUID } from 'node:crypto';

import { database, OutboxStatus } from '@good-job/database';
import {
  realtimeEventEnvelopeSchema,
  realtimeRedisChannel,
  realtimeSocketEventName,
} from '@good-job/contracts';
import { Redis } from 'ioredis';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import {
  createRecognitionTestFixture,
  type RecognitionTestIds,
} from '../recognition/tests/recognition-test-fixture.js';

describe('Phase 8 committed realtime and durable recovery', () => {
  let app: Awaited<ReturnType<typeof createRecognitionTestFixture>>['app'];
  let ids: RecognitionTestIds;
  let login: Awaited<ReturnType<typeof createRecognitionTestFixture>>['login'];
  let publisher: Redis;

  beforeAll(async () => {
    const fixture = await createRecognitionTestFixture('phase-8-realtime-e2e', {
      realtime: true,
    });
    ({ app, ids, login } = fixture);
    publisher = new Redis(fixture.config.REDIS_URL);
  });

  afterAll(async () => {
    publisher.disconnect();
    await app.close();
  });

  it('delivers only the committed event and recovers notification after reconnect', async () => {
    const receiverLogin = await request(app.getHttpServer())
      .post('/auth/demo-login')
      .send({ employeeId: ids.receiverId });
    const cookie = receiverLogin.headers['set-cookie']?.[0]?.split(';')[0];
    expect(cookie).toBeDefined();
    const socket = await connectSocket(await app.getUrl(), cookie!);
    const delivered = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Timed out waiting for committed event.')),
        2000,
      );
      socket.once(realtimeSocketEventName, (event: { eventId: string }) => {
        clearTimeout(timeout);
        resolve(event.eventId);
      });
    });

    const created = await (
      await login()
    )
      .post('/kudos')
      .set('Idempotency-Key', randomUUID())
      .send({
        receiverId: ids.receiverId,
        points: 20,
        coreValueId: ids.coreValueId,
        description: 'Committed realtime E2E.',
      });
    expect(created.status).toBe(201);
    const outbox = await database.transactionalOutbox.findFirstOrThrow({
      where: {
        aggregateId: created.body.kudo.id as string,
        eventType: 'kudo.committed',
      },
    });
    await publishCommittedEvent(publisher, outbox.id);
    expect(await delivered).toBe(outbox.id);

    socket.close();
    const recovered = await request(app.getHttpServer())
      .get('/notifications')
      .set('cookie', cookie!);
    expect(recovered.status).toBe(200);
    expect(recovered.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventId: outbox.id,
          relatedKudoId: created.body.kudo.id,
        }),
      ]),
    );
  });

  it('emits no ghost event when the domain transaction rolls back', async () => {
    const receiverLogin = await request(app.getHttpServer())
      .post('/auth/demo-login')
      .send({ employeeId: ids.receiverId });
    const cookie = receiverLogin.headers['set-cookie']?.[0]?.split(';')[0];
    const socket = await connectSocket(await app.getUrl(), cookie!);
    let received = false;
    socket.on(realtimeSocketEventName, () => {
      received = true;
    });
    const outboxBefore = await database.transactionalOutbox.count({
      where: {
        organizationId: ids.organizationId,
        eventType: 'kudo.committed',
      },
    });
    await database.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION reject_phase_8_e2e_outbox()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.organization_id = '${ids.organizationId}'::uuid
          AND NEW.event_type = 'kudo.committed' THEN
          RAISE EXCEPTION 'forced realtime E2E rollback';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await database.$executeRawUnsafe(`
      CREATE TRIGGER phase_8_e2e_outbox_failure
      BEFORE INSERT ON transactional_outbox
      FOR EACH ROW EXECUTE FUNCTION reject_phase_8_e2e_outbox()
    `);
    try {
      const response = await (
        await login()
      )
        .post('/kudos')
        .set('Idempotency-Key', randomUUID())
        .send({
          receiverId: ids.receiverId,
          points: 20,
          coreValueId: ids.coreValueId,
          description: 'This realtime event must not exist.',
        });
      expect(response.status).toBe(500);
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(received).toBe(false);
      expect(
        await database.transactionalOutbox.count({
          where: {
            organizationId: ids.organizationId,
            eventType: 'kudo.committed',
          },
        }),
      ).toBe(outboxBefore);
    } finally {
      socket.close();
      await database.$executeRawUnsafe(
        `DROP TRIGGER IF EXISTS phase_8_e2e_outbox_failure ON transactional_outbox`,
      );
      await database.$executeRawUnsafe(
        `DROP FUNCTION IF EXISTS reject_phase_8_e2e_outbox()`,
      );
    }
  });
});

function connectSocket(baseUrl: string, cookie: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      path: '/socket.io',
      transports: ['websocket'],
      reconnection: false,
      extraHeaders: { cookie },
    });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

async function publishCommittedEvent(
  publisher: Redis,
  eventId: string,
): Promise<void> {
  const row = await database.transactionalOutbox.findUniqueOrThrow({
    where: { id: eventId },
  });
  if (row.status === OutboxStatus.published) return;
  const envelope = realtimeEventEnvelopeSchema.parse(row.payload);
  expect(envelope).toMatchObject({
    eventId: row.id,
    type: row.eventType,
    organizationId: row.organizationId,
  });
  await publisher.publish(realtimeRedisChannel, JSON.stringify(envelope));
  await database.transactionalOutbox.update({
    where: { id: row.id },
    data: {
      status: OutboxStatus.published,
      publishedAt: new Date(),
    },
  });
}
