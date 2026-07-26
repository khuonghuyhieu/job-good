import { createHash, randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type {
  RedeemRewardResponse,
  RedemptionHistoryQuery,
  RedemptionHistoryResponse,
  RewardCatalogResponse,
  RewardDetailResponse,
} from '@good-job/contracts';
import {
  database,
  LedgerDirection,
  LedgerSourceType,
  OutboxStatus,
  RedemptionStatus,
} from '@good-job/database';

import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal.js';
import {
  decodeRedemptionCursor,
  encodeRedemptionCursor,
} from '../domain/redemption-cursor.js';
import { RewardRuleError } from '../domain/reward-rule.error.js';
import { RedemptionIdempotencyRepository } from './redemption-idempotency.repository.js';

type LockedAccount = {
  id: string;
  currentBalance: number;
  ledgerSequence: number;
};

type LockedReward = {
  id: string;
  name: string;
  costPoints: number;
};

@Injectable()
export class RewardsRepository {
  constructor(
    @Inject(RedemptionIdempotencyRepository)
    private readonly idempotency: RedemptionIdempotencyRepository,
  ) {}

  async catalog(
    principal: AuthenticatedPrincipal,
  ): Promise<RewardCatalogResponse> {
    const items = await database.reward.findMany({
      where: { organizationId: principal.organizationId, isActive: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        costPoints: true,
        imageUrl: true,
      },
    });
    return { items };
  }

  async detail(
    principal: AuthenticatedPrincipal,
    rewardId: string,
  ): Promise<RewardDetailResponse> {
    const [reward, account] = await Promise.all([
      database.reward.findFirst({
        where: {
          id: rewardId,
          organizationId: principal.organizationId,
          isActive: true,
        },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          costPoints: true,
          imageUrl: true,
        },
      }),
      database.rewardPointAccount.findUnique({
        where: { employeeId: principal.employeeId },
        select: { currentBalance: true },
      }),
    ]);
    if (!reward) {
      throw new RewardRuleError(
        409,
        'REWARD_UNAVAILABLE',
        'The selected reward is unavailable.',
      );
    }
    const currentBalance = account?.currentBalance ?? 0;
    return {
      ...reward,
      eligibility: {
        currentBalance,
        eligible: currentBalance >= reward.costPoints,
        reason:
          currentBalance >= reward.costPoints
            ? 'eligible'
            : 'insufficient_points',
      },
    };
  }

  redeemAtomic(
    principal: AuthenticatedPrincipal,
    rewardId: string,
    idempotencyKey: string,
  ): Promise<RedeemRewardResponse> {
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ rewardId }))
      .digest('hex');
    return database.$transaction(async (transaction) => {
      const claim = await this.idempotency.claim(
        transaction,
        principal,
        idempotencyKey,
        requestHash,
      );
      if (claim.kind === 'replay') return claim.response;

      await transaction.$executeRaw`
        INSERT INTO "reward_point_accounts" (
          "id", "employee_id", "current_balance", "created_at", "updated_at"
        )
        VALUES (
          ${randomUUID()}::uuid, ${principal.employeeId}::uuid, 0,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT ("employee_id") DO NOTHING
      `;
      const [account] = await transaction.$queryRaw<LockedAccount[]>`
        SELECT "id", "current_balance" AS "currentBalance",
          "ledger_sequence" AS "ledgerSequence"
        FROM "reward_point_accounts"
        WHERE "employee_id" = ${principal.employeeId}::uuid
        FOR UPDATE
      `;
      if (!account)
        throw new Error('The Reward Point account could not be locked.');

      const [reward] = await transaction.$queryRaw<LockedReward[]>`
        SELECT "id", "name", "cost_points" AS "costPoints"
        FROM "rewards"
        WHERE "id" = ${rewardId}::uuid
          AND "organization_id" = ${principal.organizationId}::uuid
          AND "is_active" = true
        FOR SHARE
      `;
      if (!reward) {
        throw new RewardRuleError(
          409,
          'REWARD_UNAVAILABLE',
          'The selected reward is unavailable.',
        );
      }
      if (account.currentBalance < reward.costPoints) {
        throw new RewardRuleError(
          409,
          'INSUFFICIENT_REWARD_POINTS',
          'The latest Reward Point balance is insufficient.',
          {
            currentBalance: account.currentBalance,
            costPoints: reward.costPoints,
            shortfall: reward.costPoints - account.currentBalance,
          },
        );
      }

      const committedAt = new Date();
      const redemption = await transaction.rewardRedemption.create({
        data: {
          employeeId: principal.employeeId,
          rewardId: reward.id,
          idempotencyKey,
          costPoints: reward.costPoints,
          rewardName: reward.name,
          status: RedemptionStatus.committed,
          committedAt,
        },
      });
      const balanceAfter = account.currentBalance - reward.costPoints;
      const sequence = account.ledgerSequence + 1;
      await transaction.rewardPointAccount.update({
        where: { id: account.id },
        data: { currentBalance: balanceAfter, ledgerSequence: sequence },
      });
      const ledger = await transaction.rewardPointLedger.create({
        data: {
          employeeId: principal.employeeId,
          direction: LedgerDirection.debit,
          amount: reward.costPoints,
          sourceType: LedgerSourceType.redemption_debit,
          sourceId: redemption.id,
          sourceRedemptionId: redemption.id,
          sequence,
          balanceAfter,
          description: `Reward redemption: ${reward.name}`,
        },
      });
      const response: RedeemRewardResponse = {
        redemption: {
          id: redemption.id,
          rewardId: reward.id,
          rewardName: reward.name,
          costPoints: reward.costPoints,
          status: 'committed',
          committedAt: committedAt.toISOString(),
        },
        ledgerEntryId: ledger.id,
        sequence,
        balanceAfter,
      };
      const eventId = randomUUID();
      await transaction.transactionalOutbox.create({
        data: {
          id: eventId,
          organizationId: principal.organizationId,
          eventType: 'reward.redeemed',
          aggregateType: 'reward_redemption',
          aggregateId: redemption.id,
          payload: {
            eventId,
            type: 'reward.redeemed',
            organizationId: principal.organizationId,
            recipientUserIds: [principal.employeeId],
            occurredAt: committedAt.toISOString(),
            payload: {
              redemptionId: redemption.id,
              rewardId: reward.id,
              debit: reward.costPoints,
              balanceAfter,
            },
          },
          status: OutboxStatus.pending,
        },
      });
      await this.idempotency.complete(transaction, claim.recordId, response);
      return response;
    });
  }

  async history(
    principal: AuthenticatedPrincipal,
    query: RedemptionHistoryQuery,
  ): Promise<RedemptionHistoryResponse> {
    const cursor = query.cursor ? decodeRedemptionCursor(query.cursor) : null;
    const rows = await database.rewardRedemption.findMany({
      where: {
        employeeId: principal.employeeId,
        status: RedemptionStatus.committed,
        reward: { organizationId: principal.organizationId },
        ...(cursor
          ? {
              OR: [
                { committedAt: { lt: cursor.committedAt } },
                { committedAt: cursor.committedAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ committedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      include: {
        ledgerEntry: {
          select: { id: true, sequence: true, balanceAfter: true },
        },
      },
    });
    const hasNextPage = rows.length > query.limit;
    const page = hasNextPage ? rows.slice(0, query.limit) : rows;
    const last = page.at(-1);
    return {
      items: page.map((row) => {
        if (!row.ledgerEntry)
          throw new Error(
            'A committed redemption is missing its debit ledger entry.',
          );
        return {
          id: row.id,
          rewardId: row.rewardId,
          rewardName: row.rewardName,
          costPoints: row.costPoints,
          status: 'committed' as const,
          committedAt: row.committedAt.toISOString(),
          ledgerEntryId: row.ledgerEntry.id,
          sequence: row.ledgerEntry.sequence,
          balanceAfter: row.ledgerEntry.balanceAfter,
        };
      }),
      nextCursor:
        hasNextPage && last
          ? encodeRedemptionCursor({
              committedAt: last.committedAt,
              id: last.id,
            })
          : null,
    };
  }
}
