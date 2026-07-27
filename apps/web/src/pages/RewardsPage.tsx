import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { getRewards, rewardsQueryKey } from '../features/rewards/api.js';
import { RedemptionHistory } from '../features/rewards/RedemptionHistory.js';
import { RewardMedia } from '../entities/reward/RewardMedia.js';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Eyebrow,
  Heading,
  Skeleton,
  Text,
} from '../shared/ui/index.js';

export function RewardsPage() {
  const rewards = useQuery({ queryKey: rewardsQueryKey, queryFn: getRewards });
  return (
    <main className="rewards-page mx-auto grid w-full max-w-6xl gap-8">
      <header className="max-w-3xl">
        <Eyebrow>Reward Points</Eyebrow>
        <Heading level={1} className="mt-2">
          Reward Catalog
        </Heading>
        <Text className="mt-3">
          Redeem the Reward Points you have earned from committed Kudos.
        </Text>
      </header>
      {rewards.isPending ? (
        <div
          className="grid grid-cols-3 gap-5 max-tablet:grid-cols-2 max-mobile:grid-cols-1"
          aria-label="Loading rewards"
        >
          {[0, 1, 2].map((item) => (
            <Skeleton className="min-h-80 rounded-gj-lg" key={item} />
          ))}
          <span className="sr-only" role="status">
            Loading rewards…
          </span>
        </div>
      ) : rewards.isError ? (
        <ErrorState
          title="The Reward Catalog is temporarily unavailable"
          description="Your Reward Balance is unchanged."
          actionLabel="Retry catalog"
          onAction={() => void rewards.refetch()}
        />
      ) : rewards.data.items.length === 0 ? (
        <EmptyState
          title="No active rewards are available right now"
          description="Your Reward Points remain available for future rewards."
        />
      ) : (
        <ul className="reward-grid m-0 grid list-none grid-cols-3 gap-5 p-0 max-tablet:grid-cols-2 max-mobile:grid-cols-1">
          {rewards.data.items.map((reward) => (
            <li key={reward.id}>
              <Card
                as="article"
                className="grid h-full grid-rows-[auto_1fr_auto] gap-5 overflow-hidden"
              >
                <RewardMedia imageUrl={reward.imageUrl} />
                <div>
                  <Badge tone="warning">
                    {reward.costPoints} Reward Points
                  </Badge>
                  <Heading level={2} className="mt-3 text-gj-xl">
                    {reward.name}
                  </Heading>
                  <p className="mt-2 mb-0 text-gj-sm text-gj-text-secondary">
                    {reward.description ?? 'More details coming soon.'}
                  </p>
                </div>
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-gj-sm bg-gj-brand-700 px-4 font-bold text-white no-underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-gj-focus"
                  to={`/rewards/${reward.id}`}
                >
                  View reward
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <RedemptionHistory />
    </main>
  );
}
