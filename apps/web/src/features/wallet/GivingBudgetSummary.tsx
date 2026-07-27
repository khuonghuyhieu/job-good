import type { WalletOverviewResponse } from '@good-job/contracts';

import { givingBudgetExplanation } from './points-copy.js';

export function GivingBudgetSummary({
  overview,
}: {
  overview: WalletOverviewResponse;
}) {
  return (
    <section className="wallet-card" aria-labelledby="wallet-giving-title">
      <p className="eyebrow">{overview.businessMonth}</p>
      <h2 id="wallet-giving-title">Giving Budget</h2>
      <strong>{overview.givingBudget.remaining} points remaining</strong>
      <p>{givingBudgetExplanation}</p>
      <p>
        {overview.givingBudget.used} used of {overview.givingBudget.allowance}
      </p>
    </section>
  );
}
