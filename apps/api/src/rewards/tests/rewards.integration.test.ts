import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import {
  database,
  LedgerDirection,
  LedgerSourceType,
} from '@good-job/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import {
  createRecognitionTestFixture,
  type RecognitionTestIds,
} from '../../recognition/tests/recognition-test-fixture.js';
import { WalletRepository } from '../../wallet/infrastructure/wallet.repository.js';

describe('Phase 6 Reward Catalog and atomic redemption', () => {
  let app: INestApplication;
  let ids: RecognitionTestIds;
  let login: Awaited<ReturnType<typeof createRecognitionTestFixture>>['login'];
  let rewardId: string;
  let secondRewardId: string;
  let inactiveRewardId: string;
  let foreignRewardId: string;

  beforeAll(async () => {
    ({ app, ids, login } =
      await createRecognitionTestFixture('phase-6-rewards'));
    const foreign = await database.employee.findUniqueOrThrow({
      where: { id: ids.foreignReceiverId },
      select: { organizationId: true },
    });
    [rewardId, secondRewardId, inactiveRewardId, foreignRewardId] = [
      randomUUID(),
      randomUUID(),
      randomUUID(),
      randomUUID(),
    ];
    await database.reward.createMany({
      data: [
        {
          id: rewardId,
          organizationId: ids.organizationId,
          code: 'coffee',
          name: 'Coffee voucher',
          costPoints: 60,
        },
        {
          id: secondRewardId,
          organizationId: ids.organizationId,
          code: 'lunch',
          name: 'Lunch voucher',
          costPoints: 80,
        },
        {
          id: inactiveRewardId,
          organizationId: ids.organizationId,
          code: 'old',
          name: 'Old reward',
          costPoints: 10,
          isActive: false,
        },
        {
          id: foreignRewardId,
          organizationId: foreign.organizationId,
          code: 'foreign',
          name: 'Foreign reward',
          costPoints: 10,
        },
      ],
    });
    await credit(ids.senderId, 100);
    await credit(ids.poorSenderId, 100);
    await credit(ids.receiverId, 100);
  });

  afterAll(async () => {
    await app.close();
  });

  async function credit(employeeId: string, amount: number) {
    const account = await database.rewardPointAccount.upsert({
      where: { employeeId },
      create: { employeeId },
      update: {},
    });
    const sequence = account.ledgerSequence + 1;
    await database.$transaction([
      database.rewardPointAccount.update({
        where: { id: account.id },
        data: {
          currentBalance: { increment: amount },
          ledgerSequence: sequence,
        },
      }),
      database.rewardPointLedger.create({
        data: {
          employeeId,
          direction: LedgerDirection.credit,
          amount,
          sourceType: LedgerSourceType.seed_adjustment,
          sourceId: randomUUID(),
          sequence,
          balanceAfter: account.currentBalance + amount,
          description: 'Phase 6 test credit',
        },
      }),
    ]);
  }

  it('protects all Reward HTTP endpoints', async () => {
    const server = app.getHttpServer();
    const responses = [
      await request(server).get('/rewards'),
      await request(server).get(`/rewards/${rewardId}`),
      await request(server)
        .post(`/rewards/${rewardId}/redeem`)
        .set('Idempotency-Key', randomUUID()),
      await request(server).get('/wallet/redemptions'),
    ];
    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.body.code).toBe('UNAUTHENTICATED');
    }
  });

  it('lists only active organization rewards and computes eligibility from the account', async () => {
    const agent = await login();
    const catalog = await agent.get('/rewards');
    const detail = await agent.get(`/rewards/${rewardId}`);
    expect(catalog.status).toBe(200);
    expect(catalog.body.items.map((item: { id: string }) => item.id)).toEqual([
      rewardId,
      secondRewardId,
    ]);
    expect(detail.body).toMatchObject({
      id: rewardId,
      costPoints: 60,
      eligibility: { currentBalance: 100, eligible: true, reason: 'eligible' },
    });
    for (const unavailable of [inactiveRewardId, foreignRewardId]) {
      const response = await agent.get(`/rewards/${unavailable}`);
      expect(response.status).toBe(409);
      expect(response.body.code).toBe('REWARD_UNAVAILABLE');
    }
  });

  it('requires a key, trusts server cost, commits one debit, and leaves Giving Budget unchanged', async () => {
    const agent = await login();
    const missingKey = await agent
      .post(`/rewards/${rewardId}/redeem`)
      .send({ costPoints: 1 });
    expect(missingKey.status).toBe(400);
    const key = randomUUID();
    const response = await agent
      .post(`/rewards/${rewardId}/redeem`)
      .set('Idempotency-Key', key)
      .send({ costPoints: 1 });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      redemption: { rewardId, costPoints: 60, status: 'committed' },
      balanceAfter: 40,
      sequence: 2,
    });
    const [account, redemption, ledger, budget] = await Promise.all([
      database.rewardPointAccount.findUniqueOrThrow({
        where: { employeeId: ids.senderId },
      }),
      database.rewardRedemption.findUniqueOrThrow({
        where: {
          employeeId_idempotencyKey: {
            employeeId: ids.senderId,
            idempotencyKey: key,
          },
        },
      }),
      database.rewardPointLedger.findMany({
        where: {
          employeeId: ids.senderId,
          sourceType: LedgerSourceType.redemption_debit,
        },
      }),
      database.monthlyGivingBudget.findMany({
        where: { employeeId: ids.senderId },
      }),
    ]);
    expect(account.currentBalance).toBe(40);
    expect(redemption.costPoints).toBe(60);
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      direction: LedgerDirection.debit,
      amount: 60,
      balanceAfter: 40,
      sourceRedemptionId: redemption.id,
    });
    expect(budget).toHaveLength(0);
    expect(await app.get(WalletRepository).reconcileAll()).toContainEqual({
      employeeId: ids.senderId,
      result: expect.objectContaining({
        reconciled: true,
        accountBalance: 40,
        calculatedBalance: 40,
      }),
    });
  });

  it('replays the committed result after timeout and rejects a conflicting reward for the same key', async () => {
    const agent = await login();
    const key = randomUUID();
    const first = await agent
      .post(`/rewards/${secondRewardId}/redeem`)
      .set('Idempotency-Key', key);
    expect(first.status).toBe(409);
    expect(first.body.code).toBe('INSUFFICIENT_REWARD_POINTS');

    const committed = await database.rewardRedemption.findFirstOrThrow({
      where: { employeeId: ids.senderId },
    });
    const committedKey = committed.idempotencyKey;
    const replay = await agent
      .post(`/rewards/${rewardId}/redeem`)
      .set('Idempotency-Key', committedKey);
    expect(replay.status).toBe(201);
    expect(replay.body.redemption.id).toBe(committed.id);
    const conflict = await agent
      .post(`/rewards/${secondRewardId}/redeem`)
      .set('Idempotency-Key', committedKey);
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(
      await database.rewardRedemption.count({
        where: { employeeId: ids.senderId },
      }),
    ).toBe(1);
  });

  it('serializes different keys and permits only one redemption against the latest balance', async () => {
    const [firstAgent, secondAgent] = await Promise.all([
      login(ids.poorSenderId),
      login(ids.poorSenderId),
    ]);
    const responses = await Promise.all([
      firstAgent
        .post(`/rewards/${secondRewardId}/redeem`)
        .set('Idempotency-Key', randomUUID()),
      secondAgent
        .post(`/rewards/${secondRewardId}/redeem`)
        .set('Idempotency-Key', randomUUID()),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(
      responses.find((response) => response.status === 409)?.body.code,
    ).toBe('INSUFFICIENT_REWARD_POINTS');
    const account = await database.rewardPointAccount.findUniqueOrThrow({
      where: { employeeId: ids.poorSenderId },
    });
    expect(account.currentBalance).toBe(20);
    expect(
      await database.rewardRedemption.count({
        where: { employeeId: ids.poorSenderId },
      }),
    ).toBe(1);
    expect(
      await database.rewardPointLedger.count({
        where: {
          employeeId: ids.poorSenderId,
          sourceType: LedgerSourceType.redemption_debit,
        },
      }),
    ).toBe(1);
  });

  it('returns one stable result for simultaneous requests using the same key', async () => {
    const key = randomUUID();
    const [firstAgent, secondAgent] = await Promise.all([
      login(ids.receiverId),
      login(ids.receiverId),
    ]);
    const [first, second] = await Promise.all([
      firstAgent
        .post(`/rewards/${secondRewardId}/redeem`)
        .set('Idempotency-Key', key),
      secondAgent
        .post(`/rewards/${secondRewardId}/redeem`)
        .set('Idempotency-Key', key),
    ]);
    expect([first.status, second.status]).toEqual([201, 201]);
    expect(first.body).toEqual(second.body);
    expect(
      await database.rewardRedemption.count({
        where: { employeeId: ids.receiverId, idempotencyKey: key },
      }),
    ).toBe(1);
    expect(
      await database.rewardPointLedger.count({
        where: {
          employeeId: ids.receiverId,
          sourceType: LedgerSourceType.redemption_debit,
        },
      }),
    ).toBe(1);
    expect(
      (
        await database.rewardPointAccount.findUniqueOrThrow({
          where: { employeeId: ids.receiverId },
        })
      ).currentBalance,
    ).toBe(20);
  });

  it('returns committed history with stable cursor pagination', async () => {
    const agent = await login();
    const first = await agent.get('/wallet/redemptions?limit=1');
    expect(first.status).toBe(200);
    expect(first.body.items).toHaveLength(1);
    expect(first.body.items[0].status).toBe('committed');
    expect(first.body.items[0].ledgerEntryId).toBeTruthy();
    expect(first.body.nextCursor).toBeNull();
    const invalid = await agent.get('/wallet/redemptions?cursor=invalid');
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe('VALIDATION_ERROR');
  });

  it('holds the selected Reward row stable until redemption commit', async () => {
    const lockingRewardId = randomUUID();
    await database.reward.create({
      data: {
        id: lockingRewardId,
        organizationId: ids.organizationId,
        code: `locking-${lockingRewardId}`,
        name: 'Locking reward',
        costPoints: 10,
      },
    });
    await database.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION delay_phase_6_redemption()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.reward_id = '${lockingRewardId}'::uuid THEN
          PERFORM pg_sleep(0.20);
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await database.$executeRawUnsafe(
      `DROP TRIGGER IF EXISTS phase_6_redemption_delay ON reward_redemptions`,
    );
    await database.$executeRawUnsafe(`
      CREATE TRIGGER phase_6_redemption_delay BEFORE INSERT ON reward_redemptions
      FOR EACH ROW EXECUTE FUNCTION delay_phase_6_redemption()
    `);
    try {
      const agent = await login(ids.receiverId);
      const redemption = agent
        .post(`/rewards/${lockingRewardId}/redeem`)
        .set('Idempotency-Key', randomUUID())
        .then((response) => response);
      await new Promise((resolve) => setTimeout(resolve, 75));
      const updateStartedAt = performance.now();
      const rewardUpdate = database.reward.update({
        where: { id: lockingRewardId },
        data: { costPoints: 15 },
      });

      const [response, updatedReward] = await Promise.all([
        redemption,
        rewardUpdate,
      ]);
      const updateDurationMs = performance.now() - updateStartedAt;
      expect(response.status).toBe(201);
      expect(response.body.redemption.costPoints).toBe(10);
      expect(updatedReward.costPoints).toBe(15);
      expect(updateDurationMs).toBeGreaterThan(75);
    } finally {
      await database.$executeRawUnsafe(
        `DROP TRIGGER IF EXISTS phase_6_redemption_delay ON reward_redemptions`,
      );
      await database.$executeRawUnsafe(
        `DROP FUNCTION IF EXISTS delay_phase_6_redemption()`,
      );
    }
  });
});
