import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  redeemRewardResponseSchema,
  redemptionHistoryQuerySchema,
  rewardCatalogResponseSchema,
  rewardDetailResponseSchema,
} from './rewards.js';

describe('Reward contracts', () => {
  const reward = {
    id: randomUUID(),
    code: 'coffee',
    name: 'Coffee Voucher',
    description: null,
    costPoints: 40,
    imageUrl: null,
  };

  it('defines active catalog and server eligibility shapes', () => {
    expect(
      rewardCatalogResponseSchema.parse({ items: [reward] }).items,
    ).toHaveLength(1);
    expect(
      rewardDetailResponseSchema.parse({
        ...reward,
        eligibility: {
          currentBalance: 50,
          eligible: true,
          reason: 'eligible',
        },
      }).eligibility,
    ).toMatchObject({ eligible: true, currentBalance: 50 });
  });

  it('defines one committed redemption result and bounded history query', () => {
    expect(
      redeemRewardResponseSchema.parse({
        redemption: {
          id: randomUUID(),
          rewardId: reward.id,
          rewardName: reward.name,
          costPoints: reward.costPoints,
          status: 'committed',
          committedAt: new Date().toISOString(),
        },
        ledgerEntryId: randomUUID(),
        sequence: 2,
        balanceAfter: 10,
      }).balanceAfter,
    ).toBe(10);
    expect(redemptionHistoryQuerySchema.parse({ limit: '50' }).limit).toBe(50);
    expect(redemptionHistoryQuerySchema.safeParse({ limit: 51 }).success).toBe(
      false,
    );
  });
});
