import type { WalletOverviewResponse } from '@good-job/contracts';

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
      <p>
        Reward Points are earned from committed Kudos. They are independent from
        your monthly Giving Budget.
      </p>
    </section>
  );
}
