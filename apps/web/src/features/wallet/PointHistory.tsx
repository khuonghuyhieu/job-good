import { useInfiniteQuery } from '@tanstack/react-query';
import type { WalletLedgerEntry } from '@good-job/contracts';
import { Link } from 'react-router-dom';

import { getWalletLedger, walletLedgerQueryKey } from './api.js';

function PointHistoryItem({ entry }: { entry: WalletLedgerEntry }) {
  const sign = entry.direction === 'credit' ? '+' : '−';
  return (
    <li className="history-item">
      <div>
        <strong>
          {sign}
          {entry.amount} Reward Points
        </strong>
        <p>{entry.source?.label ?? entry.description ?? 'Point adjustment'}</p>
        <time dateTime={entry.createdAt}>
          {new Date(entry.createdAt).toLocaleString()}
        </time>
      </div>
      <div>
        <span>Balance after: {entry.balanceAfter}</span>
        {entry.source?.type === 'kudo' && (
          <Link to={`/kudos/${entry.source.kudoId}`}>View related Kudo</Link>
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
    return <p role="status">Loading Point History…</p>;
  }
  if (query.isError && !query.data) {
    return (
      <div role="alert">
        <p>Point History is temporarily unavailable.</p>
        <button type="button" onClick={() => void query.refetch()}>
          Retry history
        </button>
      </div>
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
    <section className="point-history" aria-labelledby="point-history-title">
      <h2 id="point-history-title">Point History</h2>
      {entries.length === 0 ? (
        <p>No Reward Point activity yet.</p>
      ) : (
        <ol className="history-list">
          {entries.map((entry) => (
            <PointHistoryItem key={entry.id} entry={entry} />
          ))}
        </ol>
      )}
      {query.isFetchNextPageError && (
        <div role="alert">
          Older Point History could not be loaded. Existing entries are
          preserved.
        </div>
      )}
      {query.hasNextPage && (
        <button
          type="button"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage
            ? 'Loading older activity…'
            : 'Load older activity'}
        </button>
      )}
      {!query.hasNextPage && entries.length > 0 && (
        <p>You have reached the end of Point History.</p>
      )}
    </section>
  );
}
