import { useInfiniteQuery } from '@tanstack/react-query';
import type { WalletLedgerEntry } from '@good-job/contracts';
import { Link } from 'react-router-dom';

import { getWalletLedger, walletLedgerQueryKey } from './api.js';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Heading,
  Skeleton,
} from '../../shared/ui/index.js';

function PointHistoryItem({ entry }: { entry: WalletLedgerEntry }) {
  const sign = entry.direction === 'credit' ? '+' : '−';
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-gj-border py-5 last:border-b-0 max-mobile:grid-cols-1">
      <div className="min-w-0">
        <strong
          className={
            entry.direction === 'credit' ? 'text-gj-success' : 'text-gj-danger'
          }
        >
          {sign}
          {entry.amount} Reward Points
        </strong>
        <p className="mt-1 mb-0 text-gj-sm text-gj-text">
          {entry.source?.label ?? entry.description ?? 'Point adjustment'}
        </p>
        <time
          className="mt-1 block text-gj-xs text-gj-text-muted"
          dateTime={entry.createdAt}
        >
          {new Date(entry.createdAt).toLocaleString()}
        </time>
      </div>
      <div className="grid justify-items-end gap-2 max-mobile:justify-items-start">
        <Badge tone={entry.direction === 'credit' ? 'success' : 'danger'}>
          Balance after: {entry.balanceAfter}
        </Badge>
        {entry.source?.type === 'kudo' && (
          <Link
            className="min-h-11 content-center font-bold text-gj-primary-700"
            to={`/kudos/${entry.source.kudoId}`}
          >
            View related Kudo
          </Link>
        )}
      </div>
    </li>
  );
}

export function PointHistory() {
  const query = useInfiniteQuery({
    queryKey: walletLedgerQueryKey,
    queryFn: ({ pageParam }) => getWalletLedger(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  if (query.isPending) {
    return (
      <Card as="section" role="status" aria-label="Loading Point History">
        <Skeleton className="mb-5 h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <span className="sr-only" role="status">
          Loading Point History…
        </span>
      </Card>
    );
  }
  if (query.isError && !query.data) {
    return (
      <ErrorState
        title="Point History is temporarily unavailable"
        description="The append-only Reward Point ledger remains the audit source."
        actionLabel="Retry history"
        onAction={() => void query.refetch()}
      />
    );
  }

  const unique = new Map<string, WalletLedgerEntry>();
  for (const page of query.data?.pages ?? []) {
    for (const entry of page.items) {
      unique.set(entry.id, entry);
    }
  }
  const entries = [...unique.values()];

  return (
    <Card
      as="section"
      className="point-history"
      aria-labelledby="point-history-title"
    >
      <Heading id="point-history-title" level={2}>
        Point History
      </Heading>
      <p className="mt-2 text-gj-sm text-gj-text-secondary">
        Auditable Reward Point credits and debits reported by the server.
      </p>
      {entries.length === 0 ? (
        <EmptyState
          title="No Reward Point activity yet."
          description="Credits from committed Kudos and reward debits will appear here."
        />
      ) : (
        <ol className="history-list m-0 list-none p-0">
          {entries.map((entry) => (
            <PointHistoryItem key={entry.id} entry={entry} />
          ))}
        </ol>
      )}
      {query.isFetchNextPageError && (
        <div
          className="mt-4 rounded-gj-sm bg-gj-danger-subtle p-4 text-gj-sm text-gj-danger"
          role="alert"
        >
          Older Point History could not be loaded. Existing entries are
          preserved.
        </div>
      )}
      {query.hasNextPage && (
        <Button
          className="mt-4"
          variant="secondary"
          type="button"
          pending={query.isFetchingNextPage}
          pendingLabel="Loading older activity…"
          onClick={() => void query.fetchNextPage()}
        >
          Load older activity
        </Button>
      )}
      {!query.hasNextPage && entries.length > 0 && (
        <p className="mt-4 mb-0 text-gj-xs text-gj-text-muted">
          You have reached the end of Point History.
        </p>
      )}
    </Card>
  );
}
