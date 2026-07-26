import { useInfiniteQuery } from '@tanstack/react-query';

import { getRedemptionHistory, redemptionHistoryQueryKey } from './api.js';

export function RedemptionHistory() {
  const history = useInfiniteQuery({
    queryKey: redemptionHistoryQueryKey,
    queryFn: ({ pageParam }) => getRedemptionHistory(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  if (history.isPending)
    return <p role="status">Loading redemption history…</p>;
  if (history.isError) {
    return (
      <div role="alert">
        <p>Redemption history is temporarily unavailable.</p>
        <button type="button" onClick={() => void history.refetch()}>
          Retry history
        </button>
      </div>
    );
  }
  const items = history.data.pages.flatMap((page) => page.items);
  return (
    <section aria-labelledby="redemption-history-heading">
      <h2 id="redemption-history-heading">Redemption history</h2>
      {items.length === 0 ? (
        <p>You have not redeemed a reward yet.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <strong>{item.rewardName}</strong> · {item.costPoints} points ·
              balance {item.balanceAfter}
            </li>
          ))}
        </ul>
      )}
      {history.hasNextPage && (
        <button
          type="button"
          disabled={history.isFetchingNextPage}
          onClick={() => void history.fetchNextPage()}
        >
          {history.isFetchingNextPage ? 'Loading more…' : 'Load more'}
        </button>
      )}
      {history.isFetchNextPageError && (
        <p role="alert">
          More redemptions could not be loaded. Existing history remains
          visible.
        </p>
      )}
    </section>
  );
}
