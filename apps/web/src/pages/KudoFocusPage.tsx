import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { CommentComposer } from '../features/comments/CommentComposer.js';
import { CommentList } from '../features/comments/CommentList.js';
import { getKudoDetail } from '../features/feed/api.js';
import { feedQueryKeys } from '../features/feed/query-keys.js';
import { ReactionBar } from '../features/reactions/ReactionBar.js';

export function KudoFocusPage() {
  const { kudoId = '' } = useParams();
  const query = useQuery({
    queryKey: feedQueryKeys.detail(kudoId),
    queryFn: () => getKudoDetail(kudoId),
    retry: false,
  });

  if (query.isPending) {
    return <p role="status">Loading Kudo…</p>;
  }
  if (query.isError) {
    return (
      <section role="alert">
        <p>This Kudo is unavailable.</p>
        <Link to="/">Return to Dashboard</Link>
      </section>
    );
  }

  const kudo = query.data;
  return (
    <section className="kudo-focus">
      <Link to="/">← Dashboard</Link>
      <p className="eyebrow">{kudo.coreValue.name}</p>
      <h1>
        {kudo.sender.displayName} recognized {kudo.receiver.displayName}
      </h1>
      <p>{kudo.description}</p>
      <p>
        <strong>{kudo.points} points</strong>
      </p>
      <ReactionBar kudoId={kudo.id} reactions={kudo.reactions} />
      <h2>Comments</h2>
      <CommentList kudoId={kudo.id} comments={kudo.comments} />
      <CommentComposer kudoId={kudo.id} />
    </section>
  );
}
