import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { database, KudoStatus } from '@good-job/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createRecognitionTestFixture,
  type RecognitionTestIds,
} from './recognition-test-fixture.js';

describe('Phase 4 Feed and community', () => {
  let app: INestApplication;
  let ids: RecognitionTestIds;
  let login: Awaited<ReturnType<typeof createRecognitionTestFixture>>['login'];
  const createdKudoIds: string[] = [];

  beforeAll(async () => {
    ({ app, ids, login } = await createRecognitionTestFixture(
      'phase-4-feed-community',
    ));
  });

  afterAll(async () => {
    await app.close();
  });

  async function createKudo(committedAt: Date, id: string = randomUUID()) {
    createdKudoIds.push(id);
    return database.kudo.create({
      data: {
        id,
        organizationId: ids.organizationId,
        senderId: ids.senderId,
        receiverId: ids.receiverId,
        coreValueId: ids.coreValueId,
        points: 10,
        description: `Feed Kudo ${id}`,
        status: KudoStatus.committed,
        committedAt,
      },
    });
  }

  it('returns committed Kudos newest first with a deterministic id tie-break', async () => {
    const timestamp = new Date('2026-07-25T10:00:00.000Z');
    const sharedSuffix = randomUUID().slice(1);
    const lowerId = `1${sharedSuffix}`;
    const higherId = `f${sharedSuffix}`;
    await createKudo(new Date('2026-07-25T09:00:00.000Z'));
    await createKudo(timestamp, lowerId);
    await createKudo(timestamp, higherId);
    const agent = await login();

    const response = await agent.get('/kudos').query({ limit: 10 });

    expect(response.status).toBe(200);
    expect(response.body.items.map((kudo: { id: string }) => kudo.id)).toEqual([
      higherId,
      lowerId,
      createdKudoIds[0],
    ]);
    expect(
      response.body.items.every(
        (kudo: { sender: { id: string }; receiver: { id: string } }) =>
          kudo.sender.id === ids.senderId &&
          kudo.receiver.id === ids.receiverId,
      ),
    ).toBe(true);
  });

  it('uses a stable cursor when a newer Kudo arrives between page requests', async () => {
    const agent = await login();
    const first = await agent.get('/kudos').query({ limit: 2 });
    expect(first.status).toBe(200);
    expect(first.body.nextCursor).toEqual(expect.any(String));
    const firstIds = first.body.items.map((kudo: { id: string }) => kudo.id);

    const newest = await createKudo(new Date('2026-07-26T10:00:00.000Z'));
    const second = await agent
      .get('/kudos')
      .query({ limit: 2, cursor: first.body.nextCursor as string });

    expect(second.status).toBe(200);
    const secondIds = second.body.items.map((kudo: { id: string }) => kudo.id);
    expect(secondIds).not.toContain(newest.id);
    expect(secondIds.some((id: string) => firstIds.includes(id))).toBe(false);
    expect(new Set([...firstIds, ...secondIds]).size).toBe(
      firstIds.length + secondIds.length,
    );
  });

  it('rejects malformed cursors and protects Feed/detail routes', async () => {
    const agent = await login();
    const malformed = await agent.get('/kudos').query({ cursor: 'broken' });
    const missing = await agent.get(`/kudos/${randomUUID()}`);

    expect(malformed.status).toBe(400);
    expect(malformed.body.code).toBe('VALIDATION_ERROR');
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('sets, repeats, changes and removes one reaction per employee and Kudo', async () => {
    const kudo = await createKudo(new Date('2026-07-27T10:00:00.000Z'));
    const agent = await login();
    const first = await agent
      .put(`/kudos/${kudo.id}/reaction`)
      .send({ emojiCode: 'celebrate' });
    const repeated = await agent
      .put(`/kudos/${kudo.id}/reaction`)
      .send({ emojiCode: 'celebrate' });
    const changed = await agent
      .put(`/kudos/${kudo.id}/reaction`)
      .send({ emojiCode: 'heart' });
    const removed = await agent.delete(`/kudos/${kudo.id}/reaction`);

    expect(first.status).toBe(200);
    expect(repeated.body.reactions.counts.celebrate).toBe(1);
    expect(changed.body.reactions).toMatchObject({
      currentUserReaction: 'heart',
      counts: { celebrate: 0, heart: 1 },
    });
    expect(removed.body.reactions.currentUserReaction).toBeNull();
    expect(
      await database.reaction.count({
        where: { kudoId: kudo.id, employeeId: ids.senderId },
      }),
    ).toBe(0);
  });

  it('rejects unsupported emoji without a reaction effect', async () => {
    const kudo = await createKudo(new Date('2026-07-28T10:00:00.000Z'));
    const agent = await login();
    const response = await agent
      .put(`/kudos/${kudo.id}/reaction`)
      .send({ emojiCode: 'thumbs-up' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(await database.reaction.count({ where: { kudoId: kudo.id } })).toBe(
      0,
    );
  });

  it('keeps one resulting state under concurrent reaction changes', async () => {
    const kudo = await createKudo(new Date('2026-07-28T11:00:00.000Z'));
    const [firstAgent, secondAgent] = await Promise.all([login(), login()]);
    const responses = await Promise.all([
      firstAgent.put(`/kudos/${kudo.id}/reaction`).send({ emojiCode: 'heart' }),
      secondAgent.put(`/kudos/${kudo.id}/reaction`).send({ emojiCode: 'fire' }),
    ]);

    expect(responses.every((result) => result.status === 200)).toBe(true);
    const rows = await database.reaction.findMany({
      where: { kudoId: kudo.id, employeeId: ids.senderId },
    });
    expect(rows).toHaveLength(1);
    expect(['heart', 'fire']).toContain(rows[0]?.emojiCode);
  });

  it('rolls back a reaction when its outbox insert fails', async () => {
    const kudo = await createKudo(new Date('2026-07-28T12:00:00.000Z'));
    await installCommunityOutboxFailure('reaction');
    try {
      const response = await (
        await login()
      )
        .put(`/kudos/${kudo.id}/reaction`)
        .send({ emojiCode: 'heart' });
      expect(response.status).toBe(500);
      expect(
        await database.reaction.count({
          where: { kudoId: kudo.id, employeeId: ids.senderId },
        }),
      ).toBe(0);
      expect(
        await database.transactionalOutbox.count({
          where: { aggregateType: 'reaction', aggregateId: kudo.id },
        }),
      ).toBe(0);
    } finally {
      await removeCommunityOutboxFailure();
    }
  });

  it('rejects empty comments and creates one idempotent trimmed comment', async () => {
    const kudo = await createKudo(new Date('2026-07-29T10:00:00.000Z'));
    const agent = await login();
    const invalid = await agent
      .post(`/kudos/${kudo.id}/comments`)
      .set('Idempotency-Key', randomUUID())
      .send({ body: '   ' });
    const key = randomUUID();
    const first = await agent
      .post(`/kudos/${kudo.id}/comments`)
      .set('Idempotency-Key', key)
      .send({ body: '  Great work!  ' });
    const repeated = await agent
      .post(`/kudos/${kudo.id}/comments`)
      .set('Idempotency-Key', key)
      .send({ body: 'Great work!' });

    expect(invalid.status).toBe(400);
    expect(first.status).toBe(201);
    expect(first.body.comment.body).toBe('Great work!');
    expect(repeated.body).toEqual(first.body);
    expect(await database.comment.count({ where: { kudoId: kudo.id } })).toBe(
      1,
    );
  });

  it('rejects a conflicting comment payload with the same key', async () => {
    const kudo = await createKudo(new Date('2026-07-30T10:00:00.000Z'));
    const agent = await login();
    const key = randomUUID();
    await agent
      .post(`/kudos/${kudo.id}/comments`)
      .set('Idempotency-Key', key)
      .send({ body: 'First' });
    const conflict = await agent
      .post(`/kudos/${kudo.id}/comments`)
      .set('Idempotency-Key', key)
      .send({ body: 'Second' });

    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(await database.comment.count({ where: { kudoId: kudo.id } })).toBe(
      1,
    );
  });

  it('rolls back a comment and idempotency key when its outbox insert fails', async () => {
    const kudo = await createKudo(new Date('2026-07-30T11:00:00.000Z'));
    const idempotencyKey = randomUUID();
    await installCommunityOutboxFailure('comment');
    try {
      const response = await (
        await login()
      )
        .post(`/kudos/${kudo.id}/comments`)
        .set('Idempotency-Key', idempotencyKey)
        .send({ body: 'This comment must roll back.' });
      expect(response.status).toBe(500);
      expect(await database.comment.count({ where: { kudoId: kudo.id } })).toBe(
        0,
      );
      expect(
        await database.idempotencyRecord.count({
          where: {
            organizationId: ids.organizationId,
            employeeId: ids.senderId,
            operation: 'create_comment',
            key: idempotencyKey,
          },
        }),
      ).toBe(0);
      expect(
        await database.transactionalOutbox.count({
          where: { aggregateType: 'comment', aggregateId: kudo.id },
        }),
      ).toBe(0);
    } finally {
      await removeCommunityOutboxFailure();
    }
  });

  it('orders comments deterministically and permits only author deletion', async () => {
    const kudo = await createKudo(new Date('2026-07-31T10:00:00.000Z'));
    const author = await login();
    const otherEmployee = await login(ids.receiverId);
    const first = await author
      .post(`/kudos/${kudo.id}/comments`)
      .set('Idempotency-Key', randomUUID())
      .send({ body: 'First comment' });
    const second = await author
      .post(`/kudos/${kudo.id}/comments`)
      .set('Idempotency-Key', randomUUID())
      .send({ body: 'Second comment' });
    const detail = await author.get(`/kudos/${kudo.id}`);

    expect(
      detail.body.comments.map((comment: { id: string }) => comment.id),
    ).toEqual([first.body.comment.id, second.body.comment.id]);
    const forbidden = await otherEmployee.delete(
      `/comments/${first.body.comment.id as string}`,
    );
    const deleted = await author.delete(
      `/comments/${first.body.comment.id as string}`,
    );
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe('FORBIDDEN');
    expect(deleted.status).toBe(204);
    expect(
      await database.comment.count({
        where: { id: first.body.comment.id as string },
      }),
    ).toBe(0);
  });

  it('does not expose foreign-organization Kudos to community commands', async () => {
    const foreignEmployee = await database.employee.findUniqueOrThrow({
      where: { id: ids.foreignReceiverId },
      select: { organizationId: true },
    });
    const foreignKudo = await database.kudo.create({
      data: {
        organizationId: foreignEmployee.organizationId,
        senderId: ids.senderId,
        receiverId: ids.foreignReceiverId,
        coreValueId: ids.foreignCoreValueId,
        points: 10,
        description: 'Foreign Kudo',
      },
    });
    const agent = await login();

    const results = await Promise.all([
      agent.get(`/kudos/${foreignKudo.id}`),
      agent
        .put(`/kudos/${foreignKudo.id}/reaction`)
        .send({ emojiCode: 'clap' }),
      agent
        .post(`/kudos/${foreignKudo.id}/comments`)
        .set('Idempotency-Key', randomUUID())
        .send({ body: 'No access' }),
    ]);

    expect(results.every((result) => result.status === 404)).toBe(true);
    expect(
      await database.reaction.count({ where: { kudoId: foreignKudo.id } }),
    ).toBe(0);
    expect(
      await database.comment.count({ where: { kudoId: foreignKudo.id } }),
    ).toBe(0);
  });

  async function installCommunityOutboxFailure(
    aggregateType: 'reaction' | 'comment',
  ): Promise<void> {
    await database.$executeRawUnsafe(
      `DROP TRIGGER IF EXISTS phase_8_community_outbox_failure ON transactional_outbox`,
    );
    await database.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION reject_phase_8_community_outbox()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.organization_id = '${ids.organizationId}'::uuid
          AND NEW.aggregate_type = '${aggregateType}' THEN
          RAISE EXCEPTION 'forced community outbox failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await database.$executeRawUnsafe(`
      CREATE TRIGGER phase_8_community_outbox_failure
      BEFORE INSERT ON transactional_outbox
      FOR EACH ROW EXECUTE FUNCTION reject_phase_8_community_outbox()
    `);
  }

  async function removeCommunityOutboxFailure(): Promise<void> {
    await database.$executeRawUnsafe(
      `DROP TRIGGER IF EXISTS phase_8_community_outbox_failure ON transactional_outbox`,
    );
    await database.$executeRawUnsafe(
      `DROP FUNCTION IF EXISTS reject_phase_8_community_outbox()`,
    );
  }
});
