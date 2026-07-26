import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { database } from '@good-job/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createRecognitionTestFixture,
  type RecognitionTestIds,
} from './recognition-test-fixture.js';

describe('Phase 4 social recognition E2E', () => {
  let app: INestApplication;
  let ids: RecognitionTestIds;
  let login: Awaited<ReturnType<typeof createRecognitionTestFixture>>['login'];

  beforeAll(async () => {
    ({ app, ids, login } =
      await createRecognitionTestFixture('phase-4-social-e2e'));
  });

  afterAll(async () => {
    await app.close();
  });

  async function createKudo(
    agent: Awaited<ReturnType<typeof login>>,
    description: string,
  ) {
    const response = await agent
      .post('/kudos')
      .set('Idempotency-Key', randomUUID())
      .send({
        receiverId: ids.receiverId,
        coreValueId: ids.coreValueId,
        points: 10,
        description,
      });
    expect(response.status).toBe(201);
    return response.body.kudo.id as string;
  }

  it('creates, reads, reacts to and comments on a Kudo exactly once', async () => {
    const agent = await login();
    const created = await agent
      .post('/kudos')
      .set('Idempotency-Key', randomUUID())
      .send({
        receiverId: ids.receiverId,
        coreValueId: ids.coreValueId,
        points: 20,
        description: 'A complete social recognition loop.',
      });
    expect(created.status).toBe(201);
    const kudoId = created.body.kudo.id as string;

    const feed = await agent.get('/kudos').query({ limit: 10 });
    expect(feed.status).toBe(200);
    expect(feed.body.items[0].id).toBe(kudoId);

    const reaction = await agent
      .put(`/kudos/${kudoId}/reaction`)
      .send({ emojiCode: 'clap' });
    expect(reaction.status).toBe(200);
    expect(reaction.body.reactions.currentUserReaction).toBe('clap');

    const commentKey = randomUUID();
    const comment = await agent
      .post(`/kudos/${kudoId}/comments`)
      .set('Idempotency-Key', commentKey)
      .send({ body: 'Well deserved!' });
    const recovered = await agent
      .post(`/kudos/${kudoId}/comments`)
      .set('Idempotency-Key', commentKey)
      .send({ body: 'Well deserved!' });
    expect(comment.status).toBe(201);
    expect(recovered.body).toEqual(comment.body);

    const detail = await agent.get(`/kudos/${kudoId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.reactions.currentUserReaction).toBe('clap');
    expect(detail.body.comments).toHaveLength(1);
    expect(detail.body.comments[0].body).toBe('Well deserved!');
    expect(await database.comment.count({ where: { kudoId } })).toBe(1);

    const removed = await agent.delete(`/kudos/${kudoId}/reaction`);
    expect(removed.body.reactions.currentUserReaction).toBeNull();
  });

  it('paginates without duplicates when a newer Kudo arrives', async () => {
    const agent = await login();
    await createKudo(agent, 'Pagination oldest.');
    await createKudo(agent, 'Pagination middle.');
    await createKudo(agent, 'Pagination newest.');

    const first = await agent.get('/kudos').query({ limit: 2 });
    expect(first.status).toBe(200);
    expect(first.body.nextCursor).toEqual(expect.any(String));
    const firstIds = first.body.items.map((item: { id: string }) => item.id);

    const arrivingId = await createKudo(agent, 'Arrived after page one.');
    await database.kudo.update({
      where: { id: arrivingId },
      data: { committedAt: new Date('2099-01-01T00:00:00.000Z') },
    });
    const second = await agent
      .get('/kudos')
      .query({ limit: 2, cursor: first.body.nextCursor as string });
    expect(second.status).toBe(200);
    const secondIds = second.body.items.map((item: { id: string }) => item.id);

    expect(secondIds).not.toContain(arrivingId);
    expect(secondIds.some((id: string) => firstIds.includes(id))).toBe(false);
    expect(new Set([...firstIds, ...secondIds]).size).toBe(
      firstIds.length + secondIds.length,
    );
  });
});
