import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { getWalletOverview, walletOverviewQueryKey } from './api.js';
import {
  givingBudgetExplanation,
  rewardBalanceExplanation,
} from './points-copy.js';
import {
  AppIcon,
  Card,
  ErrorState,
  Heading,
  LoadingState,
  Text,
} from '../../shared/ui/index.js';

export function DashboardPointsSummary() {
  const overview = useQuery({
    queryKey: walletOverviewQueryKey,
    queryFn: getWalletOverview,
  });

  if (overview.isPending) {
    return (
      <Card as="section" aria-label="Points summary">
        <LoadingState
          title="Loading your points"
          description="Checking Giving Budget and Reward Balance…"
        />
      </Card>
    );
  }
  if (overview.isError || !overview.data) {
    return (
      <Card as="section" aria-label="Points summary">
        <ErrorState
          title="Points unavailable"
          description="Your balances are safe. Try loading the server overview again."
          actionLabel="Retry points"
          onAction={() => void overview.refetch()}
        />
      </Card>
    );
  }

  const { businessMonth, givingBudget, rewardBalance } = overview.data;
  const progress = (givingBudget.remaining / givingBudget.allowance) * 100;
  const budgetTone =
    givingBudget.remaining < 10
      ? 'bg-gj-danger'
      : givingBudget.remaining <= 50
        ? 'bg-gj-warning'
        : 'bg-gj-primary-600';

  return (
    <>
      <Card
        as="section"
        className="grid gap-4 border-s-4 border-s-gj-primary-600"
        aria-labelledby="dashboard-giving-budget"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="m-0 text-gj-xs font-extrabold tracking-[0.1em] text-gj-primary-700 uppercase">
              {businessMonth}
            </p>
            <Heading
              id="dashboard-giving-budget"
              level={2}
              className="mt-1 text-gj-lg"
            >
              Giving Budget
            </Heading>
          </div>
          <span className="grid size-10 place-items-center rounded-full bg-gj-primary-100 text-gj-primary-700">
            <AppIcon name="home" className="size-5" />
          </span>
        </div>
        <p className="m-0 text-gj-2xl font-extrabold text-gj-brand-700">
          {givingBudget.remaining}
          <span className="ms-1 text-gj-sm font-semibold text-gj-text-secondary">
            / {givingBudget.allowance} Giving Points
          </span>
        </p>
        <div
          className="h-2 overflow-hidden rounded-full bg-gj-border"
          role="progressbar"
          aria-label="Giving Budget remaining"
          aria-valuemin={0}
          aria-valuemax={givingBudget.allowance}
          aria-valuenow={givingBudget.remaining}
        >
          <span
            className={`block h-full rounded-full ${budgetTone}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <Text size="small">
          {givingBudget.used} used. {givingBudgetExplanation}
        </Text>
      </Card>

      <Card
        as="section"
        className="grid gap-4 border-s-4 border-s-gj-orange"
        aria-labelledby="dashboard-reward-balance"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="m-0 text-gj-xs font-extrabold tracking-[0.1em] text-gj-warning uppercase">
              Earned from Kudos
            </p>
            <Heading
              id="dashboard-reward-balance"
              level={2}
              className="mt-1 text-gj-lg"
            >
              Reward Balance
            </Heading>
          </div>
          <span className="grid size-10 place-items-center rounded-full bg-gj-warning-subtle text-gj-warning">
            <AppIcon name="wallet" className="size-5" />
          </span>
        </div>
        <p className="m-0 text-gj-2xl font-extrabold text-gj-brand-700">
          {rewardBalance}
          <span className="ms-1 text-gj-sm font-semibold text-gj-text-secondary">
            Reward Points
          </span>
        </p>
        <Text size="small">{rewardBalanceExplanation}</Text>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-gj-sm border border-gj-control-border bg-white px-4 text-gj-sm font-bold text-gj-primary-700"
          to="/wallet"
        >
          Open Wallet
        </Link>
      </Card>
    </>
  );
}
