import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { database } from '@good-job/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createRecognitionTestFixture,
  type RecognitionTestIds,
} from './recognition-test-fixture.js';

describe('Phase 3 Create Kudo E2E flow', () => {
  let app: INestApplication;
  let ids: RecognitionTestIds;
  let login: Awaited<ReturnType<typeof createRecognitionTestFixture>>['login'];

  beforeAll(async () => {
    ({ app, ids, login } = await createRecognitionTestFixture(
      'phase-3-create-kudo-e2e',
    ));
  });

  afterAll(async () => {
    await app.close();
  });

  it('discovers eligible data and commits one stable Kudo result end to end', async () => {
    const agent = await login();
    const [initialBudget, colleagues, coreValues] = await Promise.all([
      agent.get('/wallet/overview'),
      agent.get('/employees'),
      agent.get('/core-values'),
    ]);

    expect(initialBudget.status).toBe(200);
    expect(initialBudget.body.givingBudget).toEqual({
      allowance: 200,
      used: 0,
      remaining: 200,
    });
    expect(
      colleagues.body.items.map((employee: { id: string }) => employee.id),
    ).toContain(ids.receiverId);
    expect(
      colleagues.body.items.map((employee: { id: string }) => employee.id),
    ).not.toContain(ids.senderId);
    expect(
      coreValues.body.items.map((coreValue: { id: string }) => coreValue.id),
    ).toContain(ids.coreValueId);

    const key = randomUUID();
    const command = {
      receiverId: ids.receiverId,
      coreValueId: ids.coreValueId,
      points: 30,
      description: 'Phase 3 end-to-end recognition.',
    };
    const committed = await agent
      .post('/kudos')
      .set('Idempotency-Key', key)
      .send(command);
    const recovered = await agent
      .post('/kudos')
      .set('Idempotency-Key', key)
      .send(command);
    const updatedBudget = await agent.get('/wallet/overview');

    expect(committed.status).toBe(201);
    expect(recovered.status).toBe(201);
    expect(recovered.body).toEqual(committed.body);
    expect(updatedBudget.body.givingBudget).toEqual({
      allowance: 200,
      used: 30,
      remaining: 170,
    });
    expect(
      await database.kudo.count({
        where: { id: committed.body.kudo.id as string },
      }),
    ).toBe(1);
    expect(
      await database.rewardPointLedger.count({
        where: { sourceKudoId: committed.body.kudo.id as string },
      }),
    ).toBe(1);
  });
});
