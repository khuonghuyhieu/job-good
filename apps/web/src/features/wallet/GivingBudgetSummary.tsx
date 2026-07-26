import type { WalletOverviewResponse } from '@good-job/contracts';

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
      <p>
        Use Giving Points to recognize colleagues. They reset each organization
        business month and cannot be spent on rewards.
      </p>
      <p>
        {overview.givingBudget.used} used of {overview.givingBudget.allowance}
      </p>
    </section>
  );
}
