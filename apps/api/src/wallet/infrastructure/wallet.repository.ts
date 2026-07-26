import { Injectable } from '@nestjs/common';
import type {
  WalletLedgerQuery,
  WalletLedgerResponse,
} from '@good-job/contracts';
import { database, LedgerSourceType, Prisma } from '@good-job/database';

import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal.js';
import {
  decodeLedgerCursor,
  encodeLedgerCursor,
} from '../domain/ledger-cursor.js';
import {
  reconcileRewardAccount,
  type RewardAccountReconciliation,
} from '../domain/reconcile-reward-account.js';

@Injectable()
export class WalletRepository {
  async ledger(
    principal: AuthenticatedPrincipal,
    query: WalletLedgerQuery,
  ): Promise<WalletLedgerResponse> {
    const cursor = query.cursor ? decodeLedgerCursor(query.cursor) : null;
    const rows = await database.rewardPointLedger.findMany({
      where: {
        employeeId: principal.employeeId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      include: {
        sourceKudo: {
          select: {
            id: true,
            organizationId: true,
            sender: { select: { displayName: true } },
          },
        },
        sourceRedemption: {
          select: {
            id: true,
            reward: { select: { name: true, organizationId: true } },
          },
        },
      },
    });
    const hasNextPage = rows.length > query.limit;
    const pageRows = hasNextPage ? rows.slice(0, query.limit) : rows;
    const last = pageRows.at(-1);

    return {
      items: pageRows.map((row) => {
        const kudo =
          row.sourceType === LedgerSourceType.kudo_credit &&
          row.sourceKudo?.organizationId === principal.organizationId
            ? {
                type: 'kudo' as const,
                kudoId: row.sourceKudo.id,
                label: `Kudo from ${row.sourceKudo.sender.displayName}`,
              }
            : null;
        const redemption =
          row.sourceType === LedgerSourceType.redemption_debit &&
          row.sourceRedemption?.reward.organizationId ===
            principal.organizationId
            ? {
                type: 'redemption' as const,
                redemptionId: row.sourceRedemption.id,
                label: row.sourceRedemption.reward.name,
              }
            : null;
        return {
          id: row.id,
          direction: row.direction,
          amount: row.amount,
          sequence: row.sequence,
          balanceAfter: row.balanceAfter,
          sourceType: row.sourceType,
          sourceId: row.sourceId,
          description: row.description,
          createdAt: row.createdAt.toISOString(),
          source: kudo ?? redemption,
        };
      }),
      nextCursor:
        hasNextPage && last
          ? encodeLedgerCursor({ createdAt: last.createdAt, id: last.id })
          : null,
    };
  }

  async reconcile(
    principal: AuthenticatedPrincipal,
  ): Promise<RewardAccountReconciliation> {
    return database.$transaction(
      async (transaction) => {
        const [account, entries] = await Promise.all([
          transaction.rewardPointAccount.findUnique({
            where: { employeeId: principal.employeeId },
            select: { currentBalance: true, ledgerSequence: true },
          }),
          transaction.rewardPointLedger.findMany({
            where: { employeeId: principal.employeeId },
            orderBy: { sequence: 'asc' },
            select: {
              id: true,
              sequence: true,
              direction: true,
              amount: true,
              balanceAfter: true,
            },
          }),
        ]);
        return reconcileRewardAccount(account, entries);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async reconcileAll(): Promise<
    Array<{ employeeId: string; result: RewardAccountReconciliation }>
  > {
    const employees = await database.$transaction(
      (transaction) =>
        transaction.employee.findMany({
          where: {
            OR: [
              { rewardPointAccount: { isNot: null } },
              { ledgerEntries: { some: {} } },
            ],
          },
          select: {
            id: true,
            rewardPointAccount: {
              select: { currentBalance: true, ledgerSequence: true },
            },
            ledgerEntries: {
              orderBy: { sequence: 'asc' },
              select: {
                id: true,
                sequence: true,
                direction: true,
                amount: true,
                balanceAfter: true,
              },
            },
          },
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return employees.map((employee) => ({
      employeeId: employee.id,
      result: reconcileRewardAccount(
        employee.rewardPointAccount,
        employee.ledgerEntries,
      ),
    }));
  }
}
