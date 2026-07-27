import { useInfiniteQuery } from '@tanstack/react-query';

import { getRedemptionHistory, redemptionHistoryQueryKey } from './api.js';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Heading,
  Skeleton,
} from '../../shared/ui/index.js';

export function RedemptionHistory() {
  const history = useInfiniteQuery({
    queryKey: redemptionHistoryQueryKey,
    queryFn: ({ pageParam }) => getRedemptionHistory(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  if (history.isPending) {
    return (
      <Card as="section" role="status" aria-label="Loading redemption history">
        <Skeleton className="mb-5 h-8 w-56" />
        <Skeleton className="h-24 w-full" />
        <span className="sr-only">Loading redemption history…</span>
      </Card>
    );
  }
  if (history.isError && !history.data) {
    return (
      <ErrorState
        title="Redemption history is temporarily unavailable"
        description="Committed redemptions remain recorded by the server."
        actionLabel="Retry history"
        onAction={() => void history.refetch()}
      />
    );
  }
  const unique = new Map(
    (history.data?.pages ?? [])
      .flatMap((page) => page.items)
      .map((item) => [item.id, item]),
  );
  const items = [...unique.values()];
  return (
    <Card as="section" aria-labelledby="redemption-history-heading">
      <Heading id="redemption-history-heading" level={2}>
        Redemption history
      </Heading>
      {items.length === 0 ? (
        <EmptyState
          title="You have not redeemed a reward yet."
          description="Committed redemptions will appear here with their resulting balance."
        />
      ) : (
        <ul className="m-0 mt-4 list-none divide-y divide-gj-border p-0">
          {items.map((item) => (
            <li
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-5 max-mobile:grid-cols-1"
              key={item.id}
            >
              <div>
                <strong className="text-gj-brand-700">{item.rewardName}</strong>
                <time
                  className="mt-1 block text-gj-xs text-gj-text-muted"
                  dateTime={item.committedAt}
                >
                  {new Date(item.committedAt).toLocaleString()}
                </time>
              </div>
              <div className="grid justify-items-end gap-2 max-mobile:justify-items-start">
                <Badge tone="danger">−{item.costPoints} Reward Points</Badge>
                <span className="text-gj-xs text-gj-text-secondary">
                  Balance after: {item.balanceAfter}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {history.hasNextPage && (
        <Button
          className="mt-4"
          variant="secondary"
          type="button"
          pending={history.isFetchingNextPage}
          pendingLabel="Loading more…"
          onClick={() => void history.fetchNextPage()}
        >
          Load more
        </Button>
      )}
      {history.isFetchNextPageError && (
        <p
          className="mt-4 rounded-gj-sm bg-gj-danger-subtle p-4 text-gj-sm text-gj-danger"
          role="alert"
        >
          More redemptions could not be loaded. Existing history remains
          visible.
        </p>
      )}
    </Card>
  );
}
