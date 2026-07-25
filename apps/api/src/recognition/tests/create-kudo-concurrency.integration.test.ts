import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { database, LedgerDirection } from '@good-job/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resolveBusinessMonth } from '../domain/business-month.js';
import {
  createRecognitionTestFixture,
  type RecognitionTestIds,
} from './recognition-test-fixture.js';

describe('Phase 3 Group C concurrent budget protection', () => {
  let app: INestApplication;
  let ids: RecognitionTestIds;
  let login: Awaited<ReturnType<typeof createRecognitionTestFixture>>['login'];
  let businessMonth: string;

  beforeAll(async () => {
    ({ app, ids, login } = await createRecognitionTestFixture(
      'group-c-concurrency',
    ));
    const organization = await database.organization.findUniqueOrThrow({
      where: { id: ids.organizationId },
      select: { timezone: true },
    });
    businessMonth = resolveBusinessMonth(organization.timezone);
  });

  afterAll(async () => {
    await app.close();
  });

  function body(points: number) {
    return {
      receiverId: ids.receiverId,
      points,
      coreValueId: ids.coreValueId,
      description: `Concurrent recognition for ${points} points.`,
    };
  }

  it('allows only one of two simultaneous requests near the 200-point limit', async () => {
    await database.monthlyGivingBudget.create({
      data: {
        employeeId: ids.poorSenderId,
        businessMonth,
        allowancePoints: 200,
        usedPoints: 170,
      },
    });
    const [firstAgent, secondAgent] = await Promise.all([
      login(ids.poorSenderId),
      login(ids.poorSenderId),
    ]);
    const responses = await Promise.all([
      firstAgent
        .post('/kudos')
        .set('Idempotency-Key', randomUUID())
        .send(body(20)),
      secondAgent
        .post('/kudos')
        .set('Idempotency-Key', randomUUID())
        .send(body(20)),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(
      responses.find((response) => response.status === 409)?.body.code,
    ).toBe('INSUFFICIENT_GIVING_BUDGET');
    expect(
      (
        await database.monthlyGivingBudget.findUniqueOrThrow({
          where: {
            employeeId_businessMonth: {
              employeeId: ids.poorSenderId,
              businessMonth,
            },
          },
        })
      ).usedPoints,
    ).toBe(190);
    expect(
      await database.kudo.count({
        where: { senderId: ids.poorSenderId },
      }),
    ).toBe(1);
  });

  it('commits only the valid total from many concurrent requests', async () => {
    const agents = await Promise.all(
      Array.from({ length: 10 }, () => login(ids.senderId)),
    );
    const responses = await Promise.all(
      agents.map((agent) =>
        agent
          .post('/kudos')
          .set('Idempotency-Key', randomUUID())
          .send(body(30)),
      ),
    );
    const successful = responses.filter((response) => response.status === 201);
    const rejected = responses.filter((response) => response.status === 409);

    expect(successful).toHaveLength(6);
    expect(rejected).toHaveLength(4);
    expect(
      rejected.every(
        (response) => response.body.code === 'INSUFFICIENT_GIVING_BUDGET',
      ),
    ).toBe(true);
    const budget = await database.monthlyGivingBudget.findUniqueOrThrow({
      where: {
        employeeId_businessMonth: {
          employeeId: ids.senderId,
          businessMonth,
        },
      },
    });
    expect(budget.usedPoints).toBe(180);
    expect(budget.usedPoints).toBeLessThanOrEqual(200);

    const kudos = await database.kudo.findMany({
      where: { senderId: ids.senderId },
      select: { id: true },
    });
    const ledger = await database.rewardPointLedger.findMany({
      where: { sourceKudoId: { in: kudos.map((kudo) => kudo.id) } },
    });
    expect(kudos).toHaveLength(6);
    expect(ledger).toHaveLength(6);
    expect(
      ledger.every(
        (entry) =>
          entry.direction === LedgerDirection.credit && entry.amount === 30,
      ),
    ).toBe(true);
    expect(
      await database.idempotencyRecord.count({
        where: {
          organizationId: ids.organizationId,
          employeeId: ids.senderId,
          operation: 'create_kudo',
        },
      }),
    ).toBe(6);

    const account = await database.rewardPointAccount.findUniqueOrThrow({
      where: { employeeId: ids.receiverId },
    });
    const allReceiverLedger = await database.rewardPointLedger.findMany({
      where: { employeeId: ids.receiverId },
    });
    const reconciled = allReceiverLedger.reduce(
      (balance, entry) =>
        balance +
        (entry.direction === LedgerDirection.credit
          ? entry.amount
          : -entry.amount),
      0,
    );
    expect(account.currentBalance).toBe(200);
    expect(reconciled).toBe(account.currentBalance);
  });
});
