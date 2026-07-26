import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import {
  database,
  LedgerDirection,
  LedgerSourceType,
} from '@good-job/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createRecognitionTestFixture,
  type RecognitionTestIds,
} from '../../recognition/tests/recognition-test-fixture.js';

describe('Phase 6 redemption rollback', () => {
  let app: INestApplication;
  let ids: RecognitionTestIds;
  let login: Awaited<ReturnType<typeof createRecognitionTestFixture>>['login'];
  let rewardId: string;

  beforeAll(async () => {
    ({ app, ids, login } =
      await createRecognitionTestFixture('phase-6-rollback'));
    rewardId = randomUUID();
    await database.reward.create({
      data: {
        id: rewardId,
        organizationId: ids.organizationId,
        code: 'rollback',
        name: 'Rollback reward',
        costPoints: 10,
      },
    });
    await database.$transaction([
      database.rewardPointAccount.update({
        where: { employeeId: ids.senderId },
        data: { currentBalance: 20, ledgerSequence: 1 },
      }),
      database.rewardPointLedger.create({
        data: {
          employeeId: ids.senderId,
          direction: LedgerDirection.credit,
          amount: 20,
          sourceType: LedgerSourceType.seed_adjustment,
          sourceId: randomUUID(),
          sequence: 1,
          balanceAfter: 20,
          description: 'Phase 6 rollback fixture credit',
        },
      }),
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rolls back redemption, balance, ledger, and key when the debit insert fails', async () => {
    await database.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION reject_phase_6_debit()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.employee_id = '${ids.senderId}'::uuid AND NEW.source_type = 'redemption_debit' THEN
          RAISE EXCEPTION 'forced Phase 6 debit failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await database.$executeRawUnsafe(
      `DROP TRIGGER IF EXISTS phase_6_debit_failure ON reward_point_ledger`,
    );
    await database.$executeRawUnsafe(`
      CREATE TRIGGER phase_6_debit_failure BEFORE INSERT ON reward_point_ledger
      FOR EACH ROW EXECUTE FUNCTION reject_phase_6_debit()
    `);
    try {
      const agent = await login();
      const response = await agent
        .post(`/rewards/${rewardId}/redeem`)
        .set('Idempotency-Key', randomUUID());
      expect(response.status).toBe(500);
      expect(response.body.code).toBe('INTERNAL_ERROR');
      const account = await database.rewardPointAccount.findUniqueOrThrow({
        where: { employeeId: ids.senderId },
      });
      expect(account.currentBalance).toBe(20);
      expect(account.ledgerSequence).toBe(1);
      expect(
        await database.rewardRedemption.count({
          where: { employeeId: ids.senderId },
        }),
      ).toBe(0);
      expect(
        await database.rewardPointLedger.count({
          where: {
            employeeId: ids.senderId,
            sourceType: LedgerSourceType.redemption_debit,
          },
        }),
      ).toBe(0);
      expect(
        await database.idempotencyRecord.count({
          where: { employeeId: ids.senderId, operation: 'redeem_reward' },
        }),
      ).toBe(0);
      expect(
        await database.transactionalOutbox.count({
          where: {
            organizationId: ids.organizationId,
            eventType: 'reward.redeemed',
          },
        }),
      ).toBe(0);
    } finally {
      await database.$executeRawUnsafe(
        `DROP TRIGGER IF EXISTS phase_6_debit_failure ON reward_point_ledger`,
      );
      await database.$executeRawUnsafe(
        `DROP FUNCTION IF EXISTS reject_phase_6_debit()`,
      );
    }
  });

  it('rolls back redemption, debit and key when the outbox insert fails', async () => {
    await database.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION reject_phase_6_redemption_outbox()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.organization_id = '${ids.organizationId}'::uuid
          AND NEW.event_type = 'reward.redeemed' THEN
          RAISE EXCEPTION 'forced redemption outbox failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await database.$executeRawUnsafe(`
      CREATE TRIGGER phase_6_redemption_outbox_failure
      BEFORE INSERT ON transactional_outbox
      FOR EACH ROW EXECUTE FUNCTION reject_phase_6_redemption_outbox()
    `);
    try {
      const response = await (
        await login()
      )
        .post(`/rewards/${rewardId}/redeem`)
        .set('Idempotency-Key', randomUUID());
      expect(response.status).toBe(500);
      const account = await database.rewardPointAccount.findUniqueOrThrow({
        where: { employeeId: ids.senderId },
      });
      expect(account).toMatchObject({ currentBalance: 20, ledgerSequence: 1 });
      expect(
        await database.rewardRedemption.count({
          where: { employeeId: ids.senderId },
        }),
      ).toBe(0);
      expect(
        await database.rewardPointLedger.count({
          where: {
            employeeId: ids.senderId,
            sourceType: LedgerSourceType.redemption_debit,
          },
        }),
      ).toBe(0);
      expect(
        await database.transactionalOutbox.count({
          where: {
            organizationId: ids.organizationId,
            eventType: 'reward.redeemed',
          },
        }),
      ).toBe(0);
    } finally {
      await database.$executeRawUnsafe(
        `DROP TRIGGER IF EXISTS phase_6_redemption_outbox_failure ON transactional_outbox`,
      );
      await database.$executeRawUnsafe(
        `DROP FUNCTION IF EXISTS reject_phase_6_redemption_outbox()`,
      );
    }
  });
});
