import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { colleaguesQueryKey, searchColleagues } from '../give-kudo/api.js';
import { getRewards, rewardsQueryKey } from '../rewards/api.js';
import {
  Avatar,
  Card,
  EmptyState,
  ErrorState,
  Heading,
  LoadingState,
} from '../../shared/ui/index.js';

export function ColleaguesWidget() {
  const colleagues = useQuery({
    queryKey: colleaguesQueryKey(''),
    queryFn: () => searchColleagues(''),
  });

  return (
    <Card
      as="section"
      className="grid gap-4"
      aria-labelledby="dashboard-colleagues"
    >
      <Heading id="dashboard-colleagues" level={2} className="text-gj-lg">
        Colleagues
      </Heading>
      {colleagues.isPending ? (
        <LoadingState title="Loading colleagues" />
      ) : colleagues.isError || !colleagues.data ? (
        <ErrorState
          title="Colleagues unavailable"
          actionLabel="Retry colleagues"
          onAction={() => void colleagues.refetch()}
        />
      ) : colleagues.data.items.length === 0 ? (
        <EmptyState
          title="No colleagues found"
          description="Active colleagues will appear here."
        />
      ) : (
        <ul className="m-0 grid grid-cols-3 list-none gap-3 p-0">
          {colleagues.data.items.slice(0, 6).map((colleague) => (
            <li
              key={colleague.id}
              className="grid min-w-0 justify-items-center gap-1 text-center"
            >
              <Avatar
                name={colleague.displayName}
                src={colleague.avatarUrl}
                size="large"
              />
              <span className="w-full truncate text-gj-xs font-bold">
                {colleague.displayName}
              </span>
              {colleague.teamName && (
                <span className="w-full truncate text-[0.68rem] text-gj-text-muted">
                  {colleague.teamName}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function FeaturedRewardsWidget() {
  const rewards = useQuery({
    queryKey: rewardsQueryKey,
    queryFn: getRewards,
  });

  return (
    <Card
      as="section"
      className="grid gap-4"
      aria-labelledby="dashboard-featured-rewards"
    >
      <header className="flex items-center justify-between gap-3">
        <Heading
          id="dashboard-featured-rewards"
          level={2}
          className="text-gj-lg"
        >
          Featured rewards
        </Heading>
        <Link
          className="text-gj-xs font-bold text-gj-primary-700"
          to="/rewards"
        >
          View all
        </Link>
      </header>
      {rewards.isPending ? (
        <LoadingState title="Loading rewards" />
      ) : rewards.isError || !rewards.data ? (
        <ErrorState
          title="Rewards unavailable"
          actionLabel="Retry rewards"
          onAction={() => void rewards.refetch()}
        />
      ) : rewards.data.items.length === 0 ? (
        <EmptyState
          title="No rewards available"
          description="Active rewards will appear here."
        />
      ) : (
        <ul className="m-0 grid list-none gap-3 p-0">
          {rewards.data.items.slice(0, 3).map((reward) => (
            <li
              key={reward.id}
              className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-3 rounded-gj-sm bg-gj-surface-subtle p-2"
            >
              {reward.imageUrl ? (
                <img
                  className="size-13 rounded-gj-sm object-cover"
                  src={reward.imageUrl}
                  alt=""
                />
              ) : (
                <span
                  className="grid size-13 place-items-center rounded-gj-sm bg-gj-warning-subtle text-xl"
                  aria-hidden="true"
                >
                  🎁
                </span>
              )}
              <div className="min-w-0">
                <Link
                  className="block truncate text-gj-sm font-bold text-gj-brand-700"
                  to={`/rewards/${reward.id}`}
                >
                  {reward.name}
                </Link>
                <span className="text-gj-xs font-semibold text-gj-warning">
                  {reward.costPoints} Reward Points
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
