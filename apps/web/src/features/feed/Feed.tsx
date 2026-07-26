import { useInfiniteQuery } from '@tanstack/react-query';
import type { FeedKudo } from '@good-job/contracts';

import { getFeed } from './api.js';
import { FeedCard } from './FeedCard.js';
import { feedQueryKeys } from './query-keys.js';

export function Feed() {
  const query = useInfiniteQuery({
    queryKey: feedQueryKeys.pages(),
    queryFn: ({ pageParam }) => getFeed(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  if (query.isPending) {
    return <p role="status">Loading recognition Feed…</p>;
  }
  if (query.isError && !query.data) {
    return (
      <div role="alert">
        Feed is temporarily unavailable.
        <button type="button" onClick={() => void query.refetch()}>
          Retry Feed
        </button>
      </div>
    );
  }

  const unique = new Map<string, FeedKudo>();
  for (const page of query.data?.pages ?? []) {
    for (const kudo of page.items) {
      // Keep the first position but reconcile duplicate cursor-page entries
      // with the latest server representation.
      unique.set(kudo.id, kudo);
    }
  }
  const items = [...unique.values()];

  return (
    <section className="feed-section" aria-labelledby="feed-title">
      <h1 id="feed-title">Recognition Feed</h1>
      {items.length === 0 ? (
        <p>No Kudos yet. Be the first to recognize a colleague.</p>
      ) : (
        <div className="feed-list">
          {items.map((kudo) => (
            <FeedCard key={kudo.id} kudo={kudo} />
          ))}
        </div>
      )}
      {query.isFetchNextPageError && (
        <div role="alert">
          Older Kudos could not be loaded. Existing Kudos are preserved.
        </div>
      )}
      {query.hasNextPage && (
        <button
          type="button"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? 'Loading older Kudos…' : 'Load more'}
        </button>
      )}
    </section>
  );
}
