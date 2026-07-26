import type { FeedKudo } from '@good-job/contracts';
import { Link } from 'react-router-dom';

import { ReactionBar } from '../reactions/ReactionBar.js';

export function FeedCard({ kudo }: { kudo: FeedKudo }) {
  return (
    <article className="feed-card">
      <p className="eyebrow">{kudo.coreValue.name}</p>
      <h2>
        {kudo.sender.displayName} recognized {kudo.receiver.displayName}
      </h2>
      <p>{kudo.description}</p>
      <p>
        <strong>{kudo.points} points</strong> ·{' '}
        <time dateTime={kudo.committedAt}>
          {new Date(kudo.committedAt).toLocaleString()}
        </time>
      </p>
      <ReactionBar kudoId={kudo.id} reactions={kudo.reactions} />
      <Link to={`/kudos/${kudo.id}`}>
        View Kudo · {kudo.commentCount} comments
      </Link>
    </article>
  );
}
