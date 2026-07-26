import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import {
  database,
  EmployeeStatus,
  LedgerDirection,
  LedgerSourceType,
} from '@good-job/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createRecognitionTestFixture,
  type RecognitionTestIds,
} from '../../recognition/tests/recognition-test-fixture.js';
import { WalletRepository } from '../infrastructure/wallet.repository.js';

describe('Phase 5 Wallet and ledger', () => {
  let app: INestApplication;
  let ids: RecognitionTestIds;
  let login: Awaited<ReturnType<typeof createRecognitionTestFixture>>['login'];

  beforeAll(async () => {
    ({ app, ids, login } =
      await createRecognitionTestFixture('phase-5-wallet'));
  });

  afterAll(async () => {
    await app.close();
  });

  it('protects Wallet routes and materializes one zero-balance account', async () => {
    const unauthenticated = await (
      await import('supertest')
    )
      .default(app.getHttpServer())
      .get('/wallet/ledger');
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.code).toBe('UNAUTHENTICATED');

    expect(
      await database.rewardPointAccount.findUnique({
        where: { employeeId: ids.receiverId },
      }),
    ).toBeNull();
    const receiver = await login(ids.receiverId);
    const responses = await Promise.all([
      receiver.get('/wallet/overview'),
      receiver.get('/wallet/overview'),
    ]);
    expect(
      responses.every(
        (response) =>
          response.status === 200 && response.body.rewardBalance === 0,
      ),
    ).toBe(true);
    expect(
      await database.rewardPointAccount.count({
        where: { employeeId: ids.receiverId },
      }),
    ).toBe(1);
  });

  it('shows one Kudo credit after an idempotent retry without changing receiver Giving Budget', async () => {
    const receiver = await login(ids.receiverId);
    const before = await receiver.get('/wallet/overview');
    const sender = await login();
    const key = randomUUID();
    const request = {
      receiverId: ids.receiverId,
      points: 30,
      coreValueId: ids.coreValueId,
      description: 'A Wallet-verifiable Kudo credit.',
    };
    const created = await sender
      .post('/kudos')
      .set('Idempotency-Key', key)
      .send(request);
    const repeated = await sender
      .post('/kudos')
      .set('Idempotency-Key', key)
      .send(request);
    expect(created.status).toBe(201);
    expect(repeated.body).toEqual(created.body);

    const [overview, history] = await Promise.all([
      receiver.get('/wallet/overview'),
      receiver.get('/wallet/ledger'),
    ]);
    const credit = history.body.items.filter(
      (entry: { sourceId: string }) => entry.sourceId === created.body.kudo.id,
    );
    expect(overview.body).toMatchObject({
      givingBudget: before.body.givingBudget,
      rewardBalance: 30,
    });
    expect(credit).toHaveLength(1);
    expect(credit[0]).toMatchObject({
      direction: 'credit',
      amount: 30,
      balanceAfter: 30,
      sourceType: 'kudo_credit',
      source: {
        type: 'kudo',
        kudoId: created.body.kudo.id,
      },
    });
  });

  it('uses stable tenant-scoped cursor pages without duplicate entries', async () => {
    const timestamp = new Date('2026-07-26T10:00:00.000Z');
    const suffix = randomUUID().slice(1);
    const entryIds = [`1${suffix}`, `2${suffix}`, `3${suffix}`];
    await database.$transaction(async (transaction) => {
      for (const [index, id] of entryIds.entries()) {
        await transaction.rewardPointLedger.create({
          data: {
            id,
            employeeId: ids.poorSenderId,
            direction: LedgerDirection.credit,
            amount: 10,
            sourceType: LedgerSourceType.seed_adjustment,
            sourceId: randomUUID(),
            sequence: index + 1,
            balanceAfter: (index + 1) * 10,
            createdAt: timestamp,
          },
        });
      }
      await transaction.rewardPointAccount.update({
        where: { employeeId: ids.poorSenderId },
        data: { currentBalance: 30, ledgerSequence: 3 },
      });
    });
    const employee = await login(ids.poorSenderId);
    const first = await employee.get('/wallet/ledger').query({ limit: 2 });
    expect(first.status).toBe(200);
    expect(first.body.items.map((entry: { id: string }) => entry.id)).toEqual([
      entryIds[2],
      entryIds[1],
    ]);

    const arrivingId = randomUUID();
    await database.$transaction([
      database.rewardPointAccount.update({
        where: { employeeId: ids.poorSenderId },
        data: { currentBalance: 40, ledgerSequence: 4 },
      }),
      database.rewardPointLedger.create({
        data: {
          id: arrivingId,
          employeeId: ids.poorSenderId,
          direction: LedgerDirection.credit,
          amount: 10,
          sourceType: LedgerSourceType.seed_adjustment,
          sourceId: randomUUID(),
          sequence: 4,
          balanceAfter: 40,
          createdAt: new Date('2099-01-01T00:00:00.000Z'),
        },
      }),
    ]);
    const second = await employee
      .get('/wallet/ledger')
      .query({ limit: 2, cursor: first.body.nextCursor as string });
    const secondIds = second.body.items.map(
      (entry: { id: string }) => entry.id,
    );
    expect(secondIds).not.toContain(arrivingId);
    expect(
      secondIds.some((id: string) =>
        first.body.items.some((entry: { id: string }) => entry.id === id),
      ),
    ).toBe(false);
    expect(secondIds).toContain(entryIds[0]);

    const otherEmployee = await login(ids.senderId);
    expect((await otherEmployee.get('/wallet/ledger')).body.items).toEqual([]);
    const malformed = await employee
      .get('/wallet/ledger')
      .query({ cursor: 'broken' });
    expect(malformed.status).toBe(400);
    expect(malformed.body.code).toBe('VALIDATION_ERROR');
  });

  it('reconciles valid history and detects projection drift', async () => {
    const repository = app.get(WalletRepository);
    const principal = {
      employeeId: ids.receiverId,
      organizationId: ids.organizationId,
      user: {
        id: ids.receiverId,
        email: 'receiver@test.local',
        displayName: 'Group B Receiver',
        avatarUrl: null,
        status: 'active' as const,
        team: null,
      },
      organization: {
        id: ids.organizationId,
        name: 'Phase 5 organization',
        slug: 'phase-5-wallet',
        timezone: 'Asia/Ho_Chi_Minh',
      },
    };
    const [sender, secondSender] = await Promise.all([
      login(ids.senderId),
      login(ids.poorSenderId),
    ]);
    const concurrent = await Promise.all([
      sender.post('/kudos').set('Idempotency-Key', randomUUID()).send({
        receiverId: ids.receiverId,
        points: 10,
        coreValueId: ids.coreValueId,
        description: 'Concurrent Wallet credit one.',
      }),
      secondSender.post('/kudos').set('Idempotency-Key', randomUUID()).send({
        receiverId: ids.receiverId,
        points: 10,
        coreValueId: ids.coreValueId,
        description: 'Concurrent Wallet credit two.',
      }),
    ]);
    expect(concurrent.every((response) => response.status === 201)).toBe(true);
    expect(await repository.reconcile(principal)).toMatchObject({
      reconciled: true,
      calculatedBalance: 50,
      accountBalance: 50,
      ledgerSequence: 3,
      accountSequence: 3,
      issues: [],
    });
    await database.rewardPointAccount.update({
      where: { employeeId: ids.receiverId },
      data: { currentBalance: 51 },
    });
    const projectionMismatch = await repository.reconcile(principal);
    expect(projectionMismatch).toMatchObject({
      reconciled: false,
      calculatedBalance: 50,
      accountBalance: 51,
    });
    expect(projectionMismatch.issues).toContainEqual({
      code: 'ACCOUNT_PROJECTION_MISMATCH',
      calculatedBalance: 50,
      accountBalance: 51,
    });
    await database.rewardPointAccount.update({
      where: { employeeId: ids.receiverId },
      data: { currentBalance: 50 },
    });

    const employeeWithoutAccount = randomUUID();
    await database.employee.create({
      data: {
        id: employeeWithoutAccount,
        organizationId: ids.organizationId,
        email: `ledger-only-${employeeWithoutAccount}@test.local`,
        normalizedEmail: `ledger-only-${employeeWithoutAccount}@test.local`,
        displayName: 'Ledger-only employee',
        status: EmployeeStatus.active,
      },
    });
    await database.rewardPointLedger.create({
      data: {
        employeeId: employeeWithoutAccount,
        direction: LedgerDirection.credit,
        amount: 10,
        sourceType: LedgerSourceType.seed_adjustment,
        sourceId: randomUUID(),
        sequence: 1,
        balanceAfter: 10,
      },
    });
    const employeeWithBadBalanceAfter = randomUUID();
    await database.employee.create({
      data: {
        id: employeeWithBadBalanceAfter,
        organizationId: ids.organizationId,
        email: `bad-balance-${employeeWithBadBalanceAfter}@test.local`,
        normalizedEmail: `bad-balance-${employeeWithBadBalanceAfter}@test.local`,
        displayName: 'Bad balance-after employee',
        status: EmployeeStatus.active,
        rewardPointAccount: {
          create: { currentBalance: 10, ledgerSequence: 1 },
        },
      },
    });
    await database.rewardPointLedger.create({
      data: {
        employeeId: employeeWithBadBalanceAfter,
        direction: LedgerDirection.credit,
        amount: 10,
        sourceType: LedgerSourceType.seed_adjustment,
        sourceId: randomUUID(),
        sequence: 1,
        balanceAfter: 9,
      },
    });
    const audit = await repository.reconcileAll();
    expect(
      audit.find((entry) => entry.employeeId === ids.receiverId)?.result,
    ).toMatchObject({ reconciled: true });
    expect(
      audit.find((entry) => entry.employeeId === employeeWithoutAccount)?.result
        .issues,
    ).toContainEqual({ code: 'MISSING_ACCOUNT', calculatedBalance: 10 });
    expect(
      audit.find((entry) => entry.employeeId === employeeWithBadBalanceAfter)
        ?.result.issues,
    ).toContainEqual({
      code: 'BALANCE_AFTER_MISMATCH',
      entryId: expect.any(String),
      expectedBalanceAfter: 10,
      actualBalanceAfter: 9,
    });
  });
});
