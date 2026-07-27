import { useQuery } from '@tanstack/react-query';

import {
  getWalletOverview,
  walletOverviewQueryKey,
} from '../features/wallet/api.js';
import { GivingBudgetSummary } from '../features/wallet/GivingBudgetSummary.js';
import { PointHistory } from '../features/wallet/PointHistory.js';
import { RewardBalanceCard } from '../features/wallet/RewardBalanceCard.js';
import {
  ErrorState,
  Eyebrow,
  Heading,
  Skeleton,
  Text,
} from '../shared/ui/index.js';

export function WalletPage() {
  const overview = useQuery({
    queryKey: walletOverviewQueryKey,
    queryFn: getWalletOverview,
  });

  return (
    <main className="wallet-page mx-auto grid w-full max-w-6xl gap-8">
      <header className="max-w-3xl">
        <Eyebrow>Your points</Eyebrow>
        <Heading level={1} className="mt-2">
          Wallet
        </Heading>
        <Text className="mt-3">
          Giving Points help you recognize others. Reward Points record what you
          have earned.
        </Text>
      </header>
      {overview.isPending ? (
        <div
          className="grid grid-cols-2 gap-5 max-mobile:grid-cols-1"
          aria-label="Loading Wallet overview"
        >
          <Skeleton className="min-h-64 rounded-gj-lg" />
          <Skeleton className="min-h-64 rounded-gj-lg" />
          <span className="sr-only" role="status">
            Loading Wallet overview…
          </span>
        </div>
      ) : overview.isError || !overview.data ? (
        <ErrorState
          title="Wallet overview is temporarily unavailable"
          description="Your balances remain server-owned and safe."
          actionLabel="Retry Wallet"
          onAction={() => void overview.refetch()}
        />
      ) : (
        <div className="wallet-summary grid grid-cols-2 gap-5 max-mobile:grid-cols-1">
          <GivingBudgetSummary overview={overview.data} />
          <RewardBalanceCard overview={overview.data} />
        </div>
      )}
      <PointHistory />
    </main>
  );
}
