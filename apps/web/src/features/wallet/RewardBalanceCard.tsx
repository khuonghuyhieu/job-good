import type { WalletOverviewResponse } from '@good-job/contracts';

import { rewardBalanceExplanation } from './points-copy.js';
import { Link } from 'react-router-dom';
import { AppIcon, Card, Eyebrow, Heading } from '../../shared/ui/index.js';

export function RewardBalanceCard({
  overview,
}: {
  overview: WalletOverviewResponse;
}) {
  return (
    <Card
      as="section"
      className="grid content-start gap-4 border-gj-warning/20 bg-gj-warning-subtle"
      aria-labelledby="wallet-reward-title"
    >
      <Eyebrow>Earned points</Eyebrow>
      <Heading id="wallet-reward-title" level={2}>
        Reward Balance
      </Heading>
      <strong className="text-gj-3xl text-gj-warning">
        {overview.rewardBalance} Reward Points
      </strong>
      <p className="m-0 text-gj-sm text-gj-text-secondary">
        {rewardBalanceExplanation}
      </p>
      <Link
        className="inline-flex min-h-11 w-fit items-center gap-2 rounded-gj-sm bg-gj-brand-700 px-4 font-bold text-white no-underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-gj-focus"
        to="/rewards"
      >
        <AppIcon name="rewards" className="size-5" />
        Browse rewards
      </Link>
    </Card>
  );
}
