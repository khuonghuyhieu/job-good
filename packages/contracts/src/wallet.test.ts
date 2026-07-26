import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  walletLedgerQuerySchema,
  walletLedgerResponseSchema,
  walletOverviewResponseSchema,
} from './wallet.js';

describe('Wallet contracts', () => {
  it('parses separate Giving Budget, Reward Balance and Kudo credit history', () => {
    const kudoId = randomUUID();
    expect(
      walletOverviewResponseSchema.parse({
        businessMonth: '2026-07',
        givingBudget: { allowance: 200, used: 30, remaining: 170 },
        rewardBalance: 30,
      }).rewardBalance,
    ).toBe(30);
    expect(
      walletLedgerResponseSchema.parse({
        items: [
          {
            id: randomUUID(),
            direction: 'credit',
            amount: 30,
            sequence: 1,
            balanceAfter: 30,
            sourceType: 'kudo_credit',
            sourceId: kudoId,
            description: null,
            createdAt: '2026-07-25T10:00:00.000Z',
            source: {
              type: 'kudo',
              kudoId,
              label: 'Kudo from An Nguyen',
            },
          },
        ],
        nextCursor: null,
      }).items,
    ).toHaveLength(1);
  });

  it('bounds pagination and rejects invalid ledger values', () => {
    expect(walletLedgerQuerySchema.parse({ limit: '50' }).limit).toBe(50);
    expect(walletLedgerQuerySchema.safeParse({ limit: 51 }).success).toBe(
      false,
    );
    expect(
      walletLedgerResponseSchema.safeParse({
        items: [
          {
            id: randomUUID(),
            direction: 'credit',
            amount: 0,
            sequence: 1,
            balanceAfter: -1,
            sourceType: 'kudo_credit',
            sourceId: randomUUID(),
            description: null,
            createdAt: new Date().toISOString(),
            source: null,
          },
        ],
        nextCursor: null,
      }).success,
    ).toBe(false);
  });
});
