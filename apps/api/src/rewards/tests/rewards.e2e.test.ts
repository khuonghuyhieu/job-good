import { randomUUID } from 'node:crypto';

import type {
  CallHandler,
  ExecutionContext,
  INestApplication,
  NestInterceptor,
} from '@nestjs/common';
import { database } from '@good-job/database';
import { delay } from 'rxjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createRecognitionTestFixture,
  type RecognitionTestIds,
} from '../../recognition/tests/recognition-test-fixture.js';

describe('Phase 6 Reward redemption E2E', () => {
  let app: INestApplication;
  let ids: RecognitionTestIds;
  let login: Awaited<ReturnType<typeof createRecognitionTestFixture>>['login'];
  let rewardId: string;
  let timeoutRewardId: string;

  beforeAll(async () => {
    const delayedResponse: NestInterceptor = {
      intercept(context: ExecutionContext, next: CallHandler) {
        const request = context.switchToHttp().getRequest<{
          headers: Record<string, string | undefined>;
        }>();
        return request.headers['x-test-delay-response'] === 'true'
          ? next.handle().pipe(delay(100))
          : next.handle();
      },
    };
    ({ app, ids, login } = await createRecognitionTestFixture('phase-6-e2e', {
      interceptors: [delayedResponse],
    }));
    rewardId = randomUUID();
    timeoutRewardId = randomUUID();
    await database.reward.createMany({
      data: [
        {
          id: rewardId,
          organizationId: ids.organizationId,
          code: 'e2e-coffee',
          name: 'E2E Coffee',
          costPoints: 40,
        },
        {
          id: timeoutRewardId,
          organizationId: ids.organizationId,
          code: 'e2e-timeout',
          name: 'E2E Timeout Recovery',
          costPoints: 10,
        },
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('earns points from a committed Kudo then atomically redeems and exposes history', async () => {
    const sender = await login(ids.senderId);
    const kudo = await sender
      .post('/kudos')
      .set('Idempotency-Key', randomUUID())
      .send({
        receiverId: ids.receiverId,
        points: 50,
        coreValueId: ids.coreValueId,
        description: 'A committed Kudo funds this E2E redemption.',
      });
    expect(kudo.status).toBe(201);

    const receiver = await login(ids.receiverId);
    const detail = await receiver.get(`/rewards/${rewardId}`);
    expect(detail.body.eligibility).toMatchObject({
      currentBalance: 50,
      eligible: true,
    });
    const key = randomUUID();
    const redeemed = await receiver
      .post(`/rewards/${rewardId}/redeem`)
      .set('Idempotency-Key', key);
    expect(redeemed.status).toBe(201);
    expect(redeemed.body).toMatchObject({
      redemption: { rewardId, costPoints: 40, status: 'committed' },
      balanceAfter: 10,
    });

    const replay = await receiver
      .post(`/rewards/${rewardId}/redeem`)
      .set('Idempotency-Key', key);
    expect(replay.body).toEqual(redeemed.body);
    const [history, wallet] = await Promise.all([
      receiver.get('/wallet/redemptions'),
      receiver.get('/wallet/ledger'),
    ]);
    expect(history.body.items).toEqual([
      expect.objectContaining({
        id: redeemed.body.redemption.id,
        status: 'committed',
        balanceAfter: 10,
      }),
    ]);
    expect(wallet.body.items[0]).toMatchObject({
      direction: 'debit',
      sourceType: 'redemption_debit',
      balanceAfter: 10,
    });
  });

  it('recovers the committed result after the transport times out post-commit', async () => {
    const receiver = await login(ids.receiverId);
    const key = randomUUID();
    const timeoutPath = `/rewards/${timeoutRewardId}/redeem`;

    await expect(
      receiver
        .post(timeoutPath)
        .set('Idempotency-Key', key)
        .set('x-test-delay-response', 'true')
        .timeout({ response: 20 }),
    ).rejects.toThrow();

    let committed: { id: string } | null = null;
    for (let attempt = 0; attempt < 20 && !committed; attempt += 1) {
      committed = await database.rewardRedemption.findUnique({
        where: {
          employeeId_idempotencyKey: {
            employeeId: ids.receiverId,
            idempotencyKey: key,
          },
        },
        select: { id: true },
      });
      if (!committed) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
    expect(committed).not.toBeNull();

    const recovered = await receiver
      .post(timeoutPath)
      .set('Idempotency-Key', key);
    expect(recovered.status).toBe(201);
    expect(recovered.body).toMatchObject({
      redemption: { id: committed!.id, rewardId: timeoutRewardId },
      balanceAfter: 0,
    });
    expect(
      await database.rewardRedemption.count({
        where: { employeeId: ids.receiverId, idempotencyKey: key },
      }),
    ).toBe(1);
    expect(
      await database.rewardPointLedger.count({
        where: { sourceRedemptionId: committed!.id },
      }),
    ).toBe(1);
  });
});
