import { describe, expect, it } from 'vitest';

import { toWalletOverview } from './get-giving-budget.query.js';

describe('Giving Budget projection', () => {
  it('does not derive Giving Budget from Reward Point balance', () => {
    const budget = { allowancePoints: 200, usedPoints: 70 };
    const withoutRewards = toWalletOverview('2026-07', budget, 0);
    const withRewards = toWalletOverview('2026-07', budget, 500);

    expect(withoutRewards.givingBudget).toEqual({
      allowance: 200,
      used: 70,
      remaining: 130,
    });
    expect(withRewards.givingBudget).toEqual(withoutRewards.givingBudget);
    expect(withRewards.rewardBalance).toBe(500);
  });
});
