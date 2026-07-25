import type { WalletOverviewResponse } from '@good-job/contracts';

type GivingBudgetCardProps = {
  overview: WalletOverviewResponse | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
};

export function GivingBudgetCard({
  overview,
  isPending,
  isError,
  onRetry,
}: GivingBudgetCardProps) {
  if (isPending) {
    return <p role="status">Loading Giving Budget…</p>;
  }
  if (isError || !overview) {
    return (
      <div role="alert">
        <p>Giving Budget is temporarily unavailable.</p>
        <button type="button" onClick={onRetry}>
          Retry budget
        </button>
      </div>
    );
  }

  return (
    <section className="budget-card" aria-labelledby="giving-budget-title">
      <p className="eyebrow">{overview.businessMonth}</p>
      <h2 id="giving-budget-title">Giving Budget</h2>
      <strong>{overview.givingBudget.remaining} points remaining</strong>
      <p>
        {overview.givingBudget.used} used of {overview.givingBudget.allowance}
      </p>
    </section>
  );
}
