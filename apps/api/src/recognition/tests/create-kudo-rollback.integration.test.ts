import type { INestApplication } from '@nestjs/common';
import { database } from '@good-job/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createRecognitionTestFixture,
  type RecognitionTestIds,
} from './recognition-test-fixture.js';

describe('Phase 3 Group B Create Kudo rollback', () => {
  let app: INestApplication;
  let ids: RecognitionTestIds;
  let login: Awaited<ReturnType<typeof createRecognitionTestFixture>>['login'];

  beforeAll(async () => {
    ({ app, ids, login } =
      await createRecognitionTestFixture('group-b-rollback'));
  });

  afterAll(async () => {
    await app.close();
  });

  it('rolls back every prior effect when the final outbox insert fails', async () => {
    await database.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION reject_group_b_rollback_outbox()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.organization_id = '${ids.organizationId}'::uuid THEN
          RAISE EXCEPTION 'forced Group B outbox failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await database.$executeRawUnsafe(`
      DROP TRIGGER IF EXISTS group_b_rollback_outbox ON transactional_outbox
    `);
    await database.$executeRawUnsafe(`
      CREATE TRIGGER group_b_rollback_outbox
      BEFORE INSERT ON transactional_outbox
      FOR EACH ROW EXECUTE FUNCTION reject_group_b_rollback_outbox()
    `);

    try {
      const agent = await login();
      const response = await agent
        .post('/kudos')
        .set('Idempotency-Key', randomUUID())
        .send({
          receiverId: ids.receiverId,
          points: 40,
          coreValueId: ids.coreValueId,
          description: 'This transaction must be rolled back.',
        });

      expect(response.status).toBe(500);
      expect(response.body.code).toBe('INTERNAL_ERROR');
      const [budgets, kudos, ledger, notifications, outbox, account] =
        await Promise.all([
          database.monthlyGivingBudget.count({
            where: { employeeId: ids.senderId },
          }),
          database.kudo.count({
            where: { organizationId: ids.organizationId },
          }),
          database.rewardPointLedger.count({
            where: { employeeId: ids.receiverId },
          }),
          database.notification.count({
            where: { recipientId: ids.receiverId },
          }),
          database.transactionalOutbox.count({
            where: { organizationId: ids.organizationId },
          }),
          database.rewardPointAccount.findUnique({
            where: { employeeId: ids.receiverId },
          }),
        ]);
      expect({
        budgets,
        kudos,
        ledger,
        notifications,
        outbox,
        idempotency: await database.idempotencyRecord.count({
          where: {
            organizationId: ids.organizationId,
            employeeId: ids.senderId,
          },
        }),
        receiverAccount: account,
      }).toEqual({
        budgets: 0,
        kudos: 0,
        ledger: 0,
        notifications: 0,
        outbox: 0,
        idempotency: 0,
        receiverAccount: null,
      });
    } finally {
      await database.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS group_b_rollback_outbox ON transactional_outbox
      `);
      await database.$executeRawUnsafe(`
        DROP FUNCTION IF EXISTS reject_group_b_rollback_outbox()
      `);
    }
  });
});
import { randomUUID } from 'node:crypto';
