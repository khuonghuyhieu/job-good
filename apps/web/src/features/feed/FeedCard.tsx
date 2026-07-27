import type { FeedKudo } from '@good-job/contracts';
import { Link } from 'react-router-dom';

import { ReactionBar } from '../reactions/ReactionBar.js';
import { KudoContent } from '../../entities/kudo/KudoContent.js';
import { AppIcon } from '../../shared/ui/index.js';

export function FeedCard({ kudo }: { kudo: FeedKudo }) {
  return (
    <article className="grid gap-5 rounded-gj-lg border border-gj-border bg-white p-[clamp(1.25rem,3vw,1.75rem)] shadow-gj-card">
      <KudoContent kudo={kudo} />
      <ReactionBar kudoId={kudo.id} reactions={kudo.reactions} />
      <Link
        className="inline-flex min-h-11 items-center gap-2 justify-self-start rounded-gj-sm px-2 text-gj-sm font-bold text-gj-primary-700 no-underline hover:bg-gj-primary-100"
        to={`/kudos/${kudo.id}`}
      >
        <AppIcon name="comment" className="size-5" />
        View Kudo · {kudo.commentCount}{' '}
        {kudo.commentCount === 1 ? 'comment' : 'comments'}
      </Link>
    </article>
  );
}
