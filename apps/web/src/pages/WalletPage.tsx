import { useQuery } from '@tanstack/react-query';

import {
  getWalletOverview,
  walletOverviewQueryKey,
} from '../features/wallet/api.js';
import { GivingBudgetSummary } from '../features/wallet/GivingBudgetSummary.js';
import { PointHistory } from '../features/wallet/PointHistory.js';
import { RewardBalanceCard } from '../features/wallet/RewardBalanceCard.js';

export function WalletPage() {
  const overview = useQuery({
    queryKey: walletOverviewQueryKey,
    queryFn: getWalletOverview,
  });

  return (
    <div className="wallet-page">
      <header>
        <p className="eyebrow">Your points</p>
        <h1>Wallet</h1>
        <p>
          Giving Points help you recognize others. Reward Points record what you
          have earned.
        </p>
      </header>
      {overview.isPending ? (
        <p role="status">Loading Wallet overview…</p>
      ) : overview.isError || !overview.data ? (
        <div role="alert">
          <p>Wallet overview is temporarily unavailable.</p>
          <button type="button" onClick={() => void overview.refetch()}>
            Retry Wallet
          </button>
        </div>
      ) : (
        <div className="wallet-summary">
          <GivingBudgetSummary overview={overview.data} />
          <RewardBalanceCard overview={overview.data} />
        </div>
      )}
      <PointHistory />
    </div>
  );
}
