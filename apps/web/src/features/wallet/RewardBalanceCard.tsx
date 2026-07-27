import type { WalletOverviewResponse } from '@good-job/contracts';

import { rewardBalanceExplanation } from './points-copy.js';

export function RewardBalanceCard({
  overview,
}: {
  overview: WalletOverviewResponse;
}) {
  return (
    <section className="wallet-card" aria-labelledby="wallet-reward-title">
      <p className="eyebrow">Earned points</p>
      <h2 id="wallet-reward-title">Reward Balance</h2>
      <strong>{overview.rewardBalance} Reward Points</strong>
      <p>{rewardBalanceExplanation}</p>
    </section>
  );
}
