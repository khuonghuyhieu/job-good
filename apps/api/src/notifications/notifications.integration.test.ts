import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import {
  createRecognitionTestFixture,
  type RecognitionTestIds,
} from '../recognition/tests/recognition-test-fixture.js';

describe('Phase 8 durable notifications', () => {
  let app: INestApplication;
  let ids: RecognitionTestIds;
  let login: Awaited<ReturnType<typeof createRecognitionTestFixture>>['login'];

  beforeAll(async () => {
    ({ app, ids, login } = await createRecognitionTestFixture(
      'phase-8-notifications',
    ));
    const sender = await login();
    const response = await sender
      .post('/kudos')
      .set('Idempotency-Key', randomUUID())
      .send({
        receiverId: ids.receiverId,
        points: 20,
        coreValueId: ids.coreValueId,
        description: 'Durable notification after reconnect.',
      });
    expect(response.status).toBe(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps notification history queryable with authoritative unread state', async () => {
    const receiver = await login(ids.receiverId);
    const list = await receiver.get('/notifications');
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({
      type: 'kudo.received',
      relatedKudoId: expect.any(String),
      readAt: null,
    });
    expect((await receiver.get('/notifications/unread-count')).body).toEqual({
      unreadCount: 1,
    });

    const notificationId = list.body.items[0].id as string;
    const marked = await receiver.patch(
      `/notifications/${notificationId}/read`,
    );
    expect(marked.status).toBe(200);
    expect(marked.body.notification.readAt).toEqual(expect.any(String));
    expect(
      (await receiver.patch(`/notifications/${notificationId}/read`)).status,
    ).toBe(200);
    expect((await receiver.get('/notifications/unread-count')).body).toEqual({
      unreadCount: 0,
    });
  });

  it('rejects unauthenticated and cross-recipient notification access', async () => {
    const receiver = await login(ids.receiverId);
    const notificationId = (await receiver.get('/notifications')).body.items[0]
      .id as string;
    expect(
      (
        await login().then((sender) =>
          sender.patch(`/notifications/${notificationId}/read`),
        )
      ).status,
    ).toBe(404);
    expect(
      (await request(app.getHttpServer()).get('/notifications')).status,
    ).toBe(401);
  });
});
