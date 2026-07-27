import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { CommentComposer } from '../features/comments/CommentComposer.js';
import { CommentList } from '../features/comments/CommentList.js';
import { getKudoDetail } from '../features/feed/api.js';
import { feedQueryKeys } from '../features/feed/query-keys.js';
import { ReactionBar } from '../features/reactions/ReactionBar.js';
import { KudoContent } from '../entities/kudo/KudoContent.js';
import { Card, ErrorState, Heading, LoadingState } from '../shared/ui/index.js';

export function KudoFocusPage() {
  const { kudoId = '' } = useParams();
  const query = useQuery({
    queryKey: feedQueryKeys.detail(kudoId),
    queryFn: () => getKudoDetail(kudoId),
    retry: false,
  });

  if (query.isPending) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <LoadingState
          title="Loading Kudo"
          description="Gathering the recognition and conversation…"
        />
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <ErrorState
          title="This Kudo is unavailable"
          description="It may no longer be accessible in your organization."
        />
        <Link
          className="mt-4 inline-flex min-h-11 items-center rounded-gj-sm px-3 font-bold text-gj-primary-700"
          to="/"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const kudo = query.data;
  return (
    <main className="mx-auto grid w-full max-w-5xl gap-5">
      <Link
        className="inline-flex min-h-11 items-center justify-self-start rounded-gj-sm px-2 text-gj-sm font-bold text-gj-primary-700 no-underline hover:bg-gj-primary-100"
        to="/"
      >
        ← Dashboard
      </Link>
      <Card as="article" className="grid gap-5">
        <KudoContent kudo={kudo} headingLevel={1} />
        <ReactionBar kudoId={kudo.id} reactions={kudo.reactions} />
      </Card>
      <Card
        as="section"
        className="grid gap-5"
        aria-labelledby="comments-title"
      >
        <div>
          <p className="m-0 text-gj-xs font-extrabold tracking-[0.1em] text-gj-primary-600 uppercase">
            Community
          </p>
          <Heading id="comments-title" level={2} className="mt-1">
            Comments
          </Heading>
        </div>
        <CommentList kudoId={kudo.id} comments={kudo.comments} />
        <CommentComposer kudoId={kudo.id} />
      </Card>
    </main>
  );
}
