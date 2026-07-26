import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import {
  database,
  EmployeeStatus,
  LedgerDirection,
  LedgerSourceType,
} from '@good-job/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import { CurrentUserService } from '../../auth/current-user.service.js';
import { ApiException } from '../../http/api.exception.js';
import { CreateKudoCommand } from '../application/commands/create-kudo.command.js';
import { resolveBusinessMonth } from '../domain/business-month.js';
import {
  createRecognitionTestFixture,
  type RecognitionTestIds,
} from './recognition-test-fixture.js';

describe('Phase 3 Group B atomic Create Kudo', () => {
  let app: INestApplication;
  let ids: RecognitionTestIds;
  let login: Awaited<ReturnType<typeof createRecognitionTestFixture>>['login'];
  let committedKudoId: string;

  beforeAll(async () => {
    ({ app, ids, login } = await createRecognitionTestFixture(
      'group-b-create-kudo',
    ));
  });

  afterAll(async () => {
    await app.close();
  });

  function validBody(overrides: Record<string, unknown> = {}) {
    return {
      receiverId: ids.receiverId,
      points: 30,
      coreValueId: ids.coreValueId,
      description: 'Thank you for the excellent work.',
      ...overrides,
    };
  }

  it('requires authentication and rejects payload-controlled identity', async () => {
    const unauthenticated = await request(app.getHttpServer())
      .post('/kudos')
      .set('Idempotency-Key', randomUUID())
      .send(validBody());
    const agent = await login();
    const spoofed = await agent
      .post('/kudos')
      .set('Idempotency-Key', randomUUID())
      .send(
        validBody({
          senderId: ids.foreignReceiverId,
          organizationId: ids.organizationId,
        }),
      );

    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.code).toBe('UNAUTHENTICATED');
    expect(spoofed.status).toBe(400);
    expect(spoofed.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a stale principal when the sender becomes inactive before the transaction', async () => {
    const principal = await app
      .get(CurrentUserService)
      .findActivePrincipal(ids.senderId);
    expect(principal).not.toBeNull();
    await database.employee.update({
      where: { id: ids.senderId },
      data: { status: EmployeeStatus.inactive },
    });

    try {
      try {
        await app.get(CreateKudoCommand).execute(
          principal!,
          {
            receiverId: ids.receiverId,
            points: 30,
            coreValueId: ids.coreValueId,
            description: 'A stale principal must not be accepted.',
          },
          randomUUID(),
        );
        throw new Error('Expected the stale principal to be rejected.');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(ApiException);
        expect((error as ApiException).getStatus()).toBe(401);
        expect((error as ApiException).getResponse()).toMatchObject({
          code: 'UNAUTHENTICATED',
          message: 'The session is no longer valid.',
        });
      }
      expect(
        await database.monthlyGivingBudget.count({
          where: { employeeId: ids.senderId },
        }),
      ).toBe(0);
    } finally {
      await database.employee.update({
        where: { id: ids.senderId },
        data: { status: EmployeeStatus.active },
      });
    }
  });

  it('rejects self-giving, invalid points, blank description, and unavailable targets without effects', async () => {
    const agent = await login();
    const cases = [
      [
        validBody({ receiverId: ids.senderId }),
        409,
        'SELF_RECOGNITION_NOT_ALLOWED',
      ],
      [validBody({ points: 9 }), 400, 'VALIDATION_ERROR'],
      [validBody({ points: 51 }), 400, 'VALIDATION_ERROR'],
      [validBody({ description: '   ' }), 400, 'VALIDATION_ERROR'],
      [
        validBody({ receiverId: ids.inactiveReceiverId }),
        404,
        'RESOURCE_NOT_FOUND',
      ],
      [
        validBody({ receiverId: ids.foreignReceiverId }),
        404,
        'RESOURCE_NOT_FOUND',
      ],
      [
        validBody({ coreValueId: ids.inactiveCoreValueId }),
        409,
        'CORE_VALUE_UNAVAILABLE',
      ],
      [
        validBody({ coreValueId: ids.foreignCoreValueId }),
        409,
        'CORE_VALUE_UNAVAILABLE',
      ],
    ] as const;

    for (const [body, status, code] of cases) {
      const response = await agent
        .post('/kudos')
        .set('Idempotency-Key', randomUUID())
        .send(body);
      expect(response.status).toBe(status);
      expect(response.body.code).toBe(code);
    }

    expect(
      await database.kudo.count({
        where: { organizationId: ids.organizationId },
      }),
    ).toBe(0);
    expect(
      await database.monthlyGivingBudget.count({
        where: { employeeId: ids.senderId },
      }),
    ).toBe(0);
  });

  it('rejects insufficient latest monthly budget without partial effects', async () => {
    const organization = await database.organization.findUniqueOrThrow({
      where: { id: ids.organizationId },
      select: { timezone: true },
    });
    const businessMonth = resolveBusinessMonth(organization.timezone);
    await database.monthlyGivingBudget.create({
      data: {
        employeeId: ids.poorSenderId,
        businessMonth,
        allowancePoints: 200,
        usedPoints: 190,
      },
    });
    const agent = await login(ids.poorSenderId);
    const response = await agent
      .post('/kudos')
      .set('Idempotency-Key', randomUUID())
      .send(validBody({ points: 20 }));

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      code: 'INSUFFICIENT_GIVING_BUDGET',
      details: { used: 190, remaining: 10, requested: 20 },
    });
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
      await database.kudo.count({ where: { senderId: ids.poorSenderId } }),
    ).toBe(0);
  });

  it('commits Kudo, budget, one receiver credit, notification, and pending outbox together', async () => {
    const agent = await login();
    const response = await agent
      .post('/kudos')
      .set('Idempotency-Key', randomUUID())
      .send(
        validBody({ description: '  Thank you for the excellent work.  ' }),
      );

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      kudo: {
        senderId: ids.senderId,
        receiverId: ids.receiverId,
        coreValueId: ids.coreValueId,
        points: 30,
        description: 'Thank you for the excellent work.',
        status: 'committed',
      },
      givingBudget: { allowance: 200, used: 30, remaining: 170 },
      receiverCredit: { amount: 30, balanceAfter: 30 },
    });
    committedKudoId = response.body.kudo.id as string;

    const [kudo, budget, account, ledger, notifications, outbox] =
      await Promise.all([
        database.kudo.findUniqueOrThrow({ where: { id: committedKudoId } }),
        database.monthlyGivingBudget.findUniqueOrThrow({
          where: {
            employeeId_businessMonth: {
              employeeId: ids.senderId,
              businessMonth: response.body.businessMonth as string,
            },
          },
        }),
        database.rewardPointAccount.findUniqueOrThrow({
          where: { employeeId: ids.receiverId },
        }),
        database.rewardPointLedger.findMany({
          where: { sourceKudoId: committedKudoId },
        }),
        database.notification.findMany({
          where: {
            recipientId: ids.receiverId,
            payload: { path: ['kudoId'], equals: committedKudoId },
          },
        }),
        database.transactionalOutbox.findMany({
          where: { aggregateId: committedKudoId },
        }),
      ]);

    expect(kudo.status).toBe('committed');
    expect(budget.usedPoints).toBe(30);
    expect(account.currentBalance).toBe(30);
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      employeeId: ids.receiverId,
      direction: LedgerDirection.credit,
      amount: 30,
      sourceType: LedgerSourceType.kudo_credit,
      sourceId: committedKudoId,
      sourceKudoId: committedKudoId,
      balanceAfter: 30,
    });
    expect(notifications).toHaveLength(1);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      eventType: 'kudo.committed',
      aggregateType: 'kudo',
      aggregateId: committedKudoId,
      status: 'pending',
      attempts: 0,
      publishedAt: null,
    });
    expect(notifications[0]!.eventId).toBe(outbox[0]!.id);

    const receiverLedger = await database.rewardPointLedger.findMany({
      where: { employeeId: ids.receiverId },
    });
    const reconciledBalance = receiverLedger.reduce(
      (balance, entry) =>
        balance +
        (entry.direction === LedgerDirection.credit
          ? entry.amount
          : -entry.amount),
      0,
    );
    expect(reconciledBalance).toBe(account.currentBalance);
    await expect(
      database.rewardPointLedger.create({
        data: {
          employeeId: ids.receiverId,
          direction: LedgerDirection.credit,
          amount: 30,
          sourceType: LedgerSourceType.kudo_credit,
          sourceId: committedKudoId,
          sourceKudoId: committedKudoId,
          sequence: 2,
          balanceAfter: 60,
        },
      }),
    ).rejects.toThrow();
  });

  it('protects committed recognition facts and the append-only credit ledger', async () => {
    for (const data of [
      { senderId: ids.poorSenderId },
      { receiverId: ids.poorSenderId },
      { coreValueId: ids.inactiveCoreValueId },
      { points: 40 },
    ]) {
      await expect(
        database.kudo.update({
          where: { id: committedKudoId },
          data,
        }),
      ).rejects.toThrow();
    }
    await expect(
      database.kudo.delete({ where: { id: committedKudoId } }),
    ).rejects.toThrow();
    const ledger = await database.rewardPointLedger.findFirstOrThrow({
      where: { sourceKudoId: committedKudoId },
    });
    await expect(
      database.rewardPointLedger.update({
        where: { id: ledger.id },
        data: { description: 'Mutation must fail.' },
      }),
    ).rejects.toThrow();
    await expect(
      database.rewardPointLedger.delete({ where: { id: ledger.id } }),
    ).rejects.toThrow();
  });
});
