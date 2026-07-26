import type {
  FeedResponse,
  KudoDetailResponse,
  ReactionState,
} from '@good-job/contracts';
import type {
  InfiniteData,
  QueryClient,
  QueryKey,
} from '@tanstack/react-query';

import { feedQueryKeys } from '../feed/query-keys.js';

type FeedCache = InfiniteData<FeedResponse, string | null>;
type CacheSnapshot = {
  feed: Array<[QueryKey, FeedCache | undefined]>;
  detail: KudoDetailResponse | undefined;
};

function withReaction<T extends { id: string; reactions: ReactionState }>(
  kudo: T,
  kudoId: string,
  reactions: ReactionState,
): T {
  return kudo.id === kudoId ? { ...kudo, reactions } : kudo;
}

export function updateReactionCache(
  queryClient: QueryClient,
  kudoId: string,
  reactions: ReactionState,
): void {
  queryClient.setQueriesData<FeedCache>(
    { queryKey: feedQueryKeys.pages() },
    (current) =>
      current
        ? {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              items: page.items.map((kudo) =>
                withReaction(kudo, kudoId, reactions),
              ),
            })),
          }
        : current,
  );
  queryClient.setQueryData<KudoDetailResponse>(
    feedQueryKeys.detail(kudoId),
    (current) => (current ? withReaction(current, kudoId, reactions) : current),
  );
}

export function snapshotReactionCache(
  queryClient: QueryClient,
  kudoId: string,
): CacheSnapshot {
  return {
    feed: queryClient.getQueriesData<FeedCache>({
      queryKey: feedQueryKeys.pages(),
    }),
    detail: queryClient.getQueryData<KudoDetailResponse>(
      feedQueryKeys.detail(kudoId),
    ),
  };
}

export function restoreReactionCache(
  queryClient: QueryClient,
  kudoId: string,
  snapshot: CacheSnapshot,
): void {
  for (const [queryKey, data] of snapshot.feed) {
    queryClient.setQueryData(queryKey, data);
  }
  queryClient.setQueryData(feedQueryKeys.detail(kudoId), snapshot.detail);
}
