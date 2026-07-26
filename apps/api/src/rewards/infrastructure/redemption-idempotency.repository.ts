import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import {
  redeemRewardResponseSchema,
  type RedeemRewardResponse,
} from '@good-job/contracts';
import type { Prisma } from '@good-job/database';

import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal.js';
import { RewardRuleError } from '../domain/reward-rule.error.js';

const operation = 'redeem_reward';
const retentionMs = 24 * 60 * 60 * 1000;

type LockedRecord = {
  id: string;
  requestHash: string;
  responseBody: unknown | null;
  expiresAt: Date;
};

export type RedemptionClaim =
  | { kind: 'claimed'; recordId: string }
  | { kind: 'replay'; response: RedeemRewardResponse };

@Injectable()
export class RedemptionIdempotencyRepository {
  async claim(
    transaction: Prisma.TransactionClient,
    principal: AuthenticatedPrincipal,
    key: string,
    requestHash: string,
  ): Promise<RedemptionClaim> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + retentionMs);
    await transaction.$executeRaw`
      INSERT INTO "idempotency_records" (
        "id", "organization_id", "employee_id", "operation", "key",
        "request_hash", "expires_at"
      )
      VALUES (
        ${randomUUID()}::uuid, ${principal.organizationId}::uuid,
        ${principal.employeeId}::uuid, ${operation}, ${key}::uuid,
        ${requestHash}, ${expiresAt}
      )
      ON CONFLICT ("organization_id", "employee_id", "operation", "key")
      DO NOTHING
    `;
    const [record] = await transaction.$queryRaw<LockedRecord[]>`
      SELECT "id", "request_hash" AS "requestHash",
        "response_body" AS "responseBody", "expires_at" AS "expiresAt"
      FROM "idempotency_records"
      WHERE "organization_id" = ${principal.organizationId}::uuid
        AND "employee_id" = ${principal.employeeId}::uuid
        AND "operation" = ${operation}
        AND "key" = ${key}::uuid
      FOR UPDATE
    `;
    if (!record)
      throw new Error('The redemption idempotency record could not be locked.');
    if (record.expiresAt <= now && record.responseBody === null) {
      await transaction.$executeRaw`
        UPDATE "idempotency_records"
        SET "request_hash" = ${requestHash}, "resource_type" = NULL,
          "resource_id" = NULL, "response_code" = NULL,
          "response_body" = NULL, "expires_at" = ${expiresAt}
        WHERE "id" = ${record.id}::uuid
      `;
      return { kind: 'claimed', recordId: record.id };
    }
    if (record.requestHash !== requestHash) {
      throw new RewardRuleError(
        409,
        'IDEMPOTENCY_CONFLICT',
        'The Idempotency-Key was already used with a different request.',
      );
    }
    if (record.responseBody !== null) {
      const parsed = redeemRewardResponseSchema.safeParse(record.responseBody);
      if (!parsed.success)
        throw new Error('The stored redemption response is invalid.');
      return { kind: 'replay', response: parsed.data };
    }
    return { kind: 'claimed', recordId: record.id };
  }

  async complete(
    transaction: Prisma.TransactionClient,
    recordId: string,
    response: RedeemRewardResponse,
  ): Promise<void> {
    await transaction.idempotencyRecord.update({
      where: { id: recordId },
      data: {
        resourceType: 'reward_redemption',
        resourceId: response.redemption.id,
        responseCode: 201,
        responseBody: response,
      },
    });
  }
}
