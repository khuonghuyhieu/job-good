import type { WalletOverviewResponse } from '@good-job/contracts';
import {
  Card,
  ErrorState,
  Heading,
  LoadingState,
} from '../../shared/ui/index.js';

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
    return <LoadingState title="Loading Giving Budget" />;
  }
  if (isError || !overview) {
    return (
      <ErrorState
        title="Giving Budget is temporarily unavailable."
        actionLabel="Retry budget"
        onAction={onRetry}
      />
    );
  }

  return (
    <Card
      as="section"
      className="grid gap-4"
      aria-labelledby="giving-budget-title"
    >
      <p className="m-0 text-gj-xs font-extrabold tracking-[0.1em] text-gj-primary-600 uppercase">
        {overview.businessMonth}
      </p>
      <Heading id="giving-budget-title" level={2}>
        Giving Budget
      </Heading>
      <strong className="text-gj-xl text-gj-primary-700">
        {overview.givingBudget.remaining} points remaining
      </strong>
      <div
        className="h-2 overflow-hidden rounded-full bg-gj-primary-100"
        role="progressbar"
        aria-label="Giving Budget used"
        aria-valuemin={0}
        aria-valuemax={overview.givingBudget.allowance}
        aria-valuenow={overview.givingBudget.used}
      >
        <span
          className="block h-full rounded-full bg-gj-primary-600"
          style={{
            width: `${Math.min(
              100,
              (overview.givingBudget.used / overview.givingBudget.allowance) *
                100,
            )}%`,
          }}
        />
      </div>
      <p className="m-0 text-gj-sm text-gj-text-secondary">
        {overview.givingBudget.used} used of {overview.givingBudget.allowance}
      </p>
    </Card>
  );
}
