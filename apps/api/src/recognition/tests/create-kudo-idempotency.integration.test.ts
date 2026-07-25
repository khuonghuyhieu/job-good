import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { database } from '@good-job/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CurrentUserService } from '../../auth/current-user.service.js';
import { CreateKudoCommand } from '../application/commands/create-kudo.command.js';
import {
  createRecognitionTestFixture,
  type RecognitionTestIds,
} from './recognition-test-fixture.js';

describe('Phase 3 Group C Create Kudo idempotency', () => {
  let app: INestApplication;
  let ids: RecognitionTestIds;
  let login: Awaited<ReturnType<typeof createRecognitionTestFixture>>['login'];

  beforeAll(async () => {
    ({ app, ids, login } = await createRecognitionTestFixture(
      'group-c-idempotency',
    ));
  });

  afterAll(async () => {
    await app.close();
  });

  function body(points = 30) {
    return {
      receiverId: ids.receiverId,
      points,
      coreValueId: ids.coreValueId,
      description: 'A stable idempotent Kudo.',
    };
  }

  it('requires a valid Idempotency-Key header', async () => {
    const agent = await login();
    const missing = await agent.post('/kudos').send(body());
    const invalid = await agent
      .post('/kudos')
      .set('Idempotency-Key', 'not-a-uuid')
      .send(body());

    for (const response of [missing, invalid]) {
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'VALIDATION_ERROR',
        fieldErrors: {
          idempotencyKey: 'Idempotency-Key must be a UUID.',
        },
      });
    }
    expect(
      await database.kudo.count({
        where: { organizationId: ids.organizationId },
      }),
    ).toBe(0);
  });

  it('returns the same result for a repeated key and payload', async () => {
    const key = randomUUID();
    const agent = await login();
    const first = await agent
      .post('/kudos')
      .set('Idempotency-Key', key)
      .send(body());
    const repeated = await agent
      .post('/kudos')
      .set('Idempotency-Key', key)
      .send(body());

    expect(first.status).toBe(201);
    expect(repeated.status).toBe(201);
    expect(repeated.body).toEqual(first.body);
    expect(
      await database.kudo.count({
        where: { id: first.body.kudo.id as string },
      }),
    ).toBe(1);
    expect(
      await database.rewardPointLedger.count({
        where: { sourceKudoId: first.body.kudo.id as string },
      }),
    ).toBe(1);
  });

  it('rejects the same key with a conflicting payload without new effects', async () => {
    const key = randomUUID();
    const agent = await login();
    const first = await agent
      .post('/kudos')
      .set('Idempotency-Key', key)
      .send(body(20));
    const conflict = await agent
      .post('/kudos')
      .set('Idempotency-Key', key)
      .send(body(40));

    expect(first.status).toBe(201);
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe('IDEMPOTENCY_CONFLICT');
    const record = await database.idempotencyRecord.findUniqueOrThrow({
      where: {
        organizationId_employeeId_operation_key: {
          organizationId: ids.organizationId,
          employeeId: ids.senderId,
          operation: 'create_kudo',
          key,
        },
      },
    });
    expect(record.resourceId).toBe(first.body.kudo.id);
    expect(
      await database.kudo.count({
        where: { id: first.body.kudo.id as string },
      }),
    ).toBe(1);
  });

  it('recovers the committed result after the original response is lost', async () => {
    const key = randomUUID();
    const principal = await app
      .get(CurrentUserService)
      .findActivePrincipal(ids.senderId);
    expect(principal).not.toBeNull();
    const committedResult = await app
      .get(CreateKudoCommand)
      .execute(principal!, body(20), key);

    const retryAgent = await login();
    const recovered = await retryAgent
      .post('/kudos')
      .set('Idempotency-Key', key)
      .send(body(20));

    expect(recovered.status).toBe(201);
    expect(recovered.body).toEqual(committedResult);
    expect(
      await database.kudo.count({
        where: { id: committedResult.kudo.id },
      }),
    ).toBe(1);
  });

  it('keeps a completed result stable after its retention timestamp', async () => {
    const key = randomUUID();
    const agent = await login();
    const first = await agent
      .post('/kudos')
      .set('Idempotency-Key', key)
      .send(body(20));
    expect(first.status).toBe(201);

    await database.idempotencyRecord.update({
      where: {
        organizationId_employeeId_operation_key: {
          organizationId: ids.organizationId,
          employeeId: ids.senderId,
          operation: 'create_kudo',
          key,
        },
      },
      data: { expiresAt: new Date(0) },
    });

    const repeated = await agent
      .post('/kudos')
      .set('Idempotency-Key', key)
      .send(body(20));
    const conflict = await agent
      .post('/kudos')
      .set('Idempotency-Key', key)
      .send(body(30));

    expect(repeated.status).toBe(201);
    expect(repeated.body).toEqual(first.body);
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(
      await database.kudo.count({
        where: { id: first.body.kudo.id as string },
      }),
    ).toBe(1);
    expect(
      await database.rewardPointLedger.count({
        where: { sourceKudoId: first.body.kudo.id as string },
      }),
    ).toBe(1);
  });

  it('returns one stable result to simultaneous requests with the same key', async () => {
    const key = randomUUID();
    const [firstAgent, secondAgent] = await Promise.all([login(), login()]);
    const [first, second] = await Promise.all([
      firstAgent.post('/kudos').set('Idempotency-Key', key).send(body(30)),
      secondAgent.post('/kudos').set('Idempotency-Key', key).send(body(30)),
    ]);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body).toEqual(first.body);
    expect(
      await database.kudo.count({
        where: { id: first.body.kudo.id as string },
      }),
    ).toBe(1);
    expect(
      await database.notification.count({
        where: {
          recipientId: ids.receiverId,
          payload: { path: ['kudoId'], equals: first.body.kudo.id },
        },
      }),
    ).toBe(1);
    expect(
      await database.transactionalOutbox.count({
        where: { aggregateId: first.body.kudo.id as string },
      }),
    ).toBe(1);
  });
});
