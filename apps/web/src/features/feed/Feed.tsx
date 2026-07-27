import { useInfiniteQuery } from '@tanstack/react-query';
import type { FeedKudo } from '@good-job/contracts';

import { getFeed } from './api.js';
import { FeedCard } from './FeedCard.js';
import { feedQueryKeys } from './query-keys.js';
import {
  Button,
  EmptyState,
  ErrorState,
  Heading,
  LoadingState,
} from '../../shared/ui/index.js';

export function Feed() {
  const query = useInfiniteQuery({
    queryKey: feedQueryKeys.pages(),
    queryFn: ({ pageParam }) => getFeed(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  if (query.isPending) {
    return (
      <section aria-label="Recognition Feed">
        <LoadingState
          title="Loading recognition Feed"
          description="Gathering the latest committed Kudos…"
        />
      </section>
    );
  }
  if (query.isError && !query.data) {
    return (
      <ErrorState
        title="Feed is temporarily unavailable"
        description="Your recognition activity is safe. Try loading it again."
        actionLabel="Retry Feed"
        onAction={() => void query.refetch()}
      />
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
    <section
      className="feed-section grid min-w-0 gap-5"
      aria-labelledby="feed-title"
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="m-0 text-gj-xs font-extrabold tracking-[0.1em] text-gj-primary-600 uppercase">
            Latest recognition
          </p>
          <Heading id="feed-title" level={2} className="mt-1">
            Recognition Feed
          </Heading>
        </div>
      </div>
      {items.length === 0 ? (
        <EmptyState
          title="No Kudos yet"
          description="Be the first to recognize a colleague."
        />
      ) : (
        <div className="feed-list m-0 grid gap-5">
          {items.map((kudo) => (
            <FeedCard key={kudo.id} kudo={kudo} />
          ))}
        </div>
      )}
      {query.isFetchNextPageError && (
        <ErrorState
          title="Older Kudos could not be loaded"
          description="Existing Kudos are preserved. Try loading the next page again."
          actionLabel="Retry older Kudos"
          onAction={() => void query.fetchNextPage()}
        />
      )}
      {query.hasNextPage && (
        <Button
          variant="secondary"
          pending={query.isFetchingNextPage}
          pendingLabel="Loading older Kudos…"
          className="justify-self-center"
          onClick={() => void query.fetchNextPage()}
        >
          Load more
        </Button>
      )}
    </section>
  );
}
