import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { database } from '@good-job/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createRecognitionTestFixture,
  type RecognitionTestIds,
} from '../../recognition/tests/recognition-test-fixture.js';
import { WalletRepository } from '../infrastructure/wallet.repository.js';

describe('Phase 5 Wallet E2E', () => {
  let app: INestApplication;
  let ids: RecognitionTestIds;
  let login: Awaited<ReturnType<typeof createRecognitionTestFixture>>['login'];

  beforeAll(async () => {
    ({ app, ids, login } =
      await createRecognitionTestFixture('phase-5-wallet-e2e'));
  });

  afterAll(async () => {
    await app.close();
  });

  it('lets a receiver verify an exact-once Kudo credit and reconciled balance', async () => {
    const receiver = await login(ids.receiverId);
    const initial = await receiver.get('/wallet/overview');
    expect(initial.body).toMatchObject({
      givingBudget: { allowance: 200, used: 0, remaining: 200 },
      rewardBalance: 0,
    });

    const sender = await login(ids.senderId);
    const key = randomUUID();
    const command = {
      receiverId: ids.receiverId,
      coreValueId: ids.coreValueId,
      points: 40,
      description: 'Credit visible in the receiver Wallet.',
    };
    const created = await sender
      .post('/kudos')
      .set('Idempotency-Key', key)
      .send(command);
    const recovered = await sender
      .post('/kudos')
      .set('Idempotency-Key', key)
      .send(command);
    expect(created.status).toBe(201);
    expect(recovered.body).toEqual(created.body);

    const [overview, ledger] = await Promise.all([
      receiver.get('/wallet/overview'),
      receiver.get('/wallet/ledger').query({ limit: 10 }),
    ]);
    expect(overview.body).toMatchObject({
      givingBudget: initial.body.givingBudget,
      rewardBalance: 40,
    });
    expect(ledger.body.items).toHaveLength(1);
    expect(ledger.body.items[0]).toMatchObject({
      amount: 40,
      balanceAfter: 40,
      sourceId: created.body.kudo.id,
      source: {
        type: 'kudo',
        kudoId: created.body.kudo.id,
      },
    });
    expect(
      await database.rewardPointLedger.count({
        where: { sourceKudoId: created.body.kudo.id as string },
      }),
    ).toBe(1);

    const principal = {
      employeeId: ids.receiverId,
      organizationId: ids.organizationId,
      user: {
        id: ids.receiverId,
        email: 'receiver@test.local',
        displayName: 'Receiver',
        avatarUrl: null,
        status: 'active' as const,
        team: null,
      },
      organization: {
        id: ids.organizationId,
        name: 'Phase 5 E2E',
        slug: 'phase-5-e2e',
        timezone: 'Asia/Ho_Chi_Minh',
      },
    };
    expect(await app.get(WalletRepository).reconcile(principal)).toMatchObject({
      reconciled: true,
      calculatedBalance: 40,
      accountBalance: 40,
      ledgerSequence: 1,
      accountSequence: 1,
      issues: [],
    });
  });
});
