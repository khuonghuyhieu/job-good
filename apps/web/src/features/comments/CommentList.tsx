import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Comment } from '@good-job/contracts';

import { feedQueryKey, feedQueryKeys } from '../feed/query-keys.js';
import { deleteComment } from './api.js';
import { Avatar, Button, EmptyState } from '../../shared/ui/index.js';

export function CommentList({
  kudoId,
  comments,
}: {
  kudoId: string;
  comments: Comment[];
}) {
  const queryClient = useQueryClient();
  const deletion = useMutation({
    mutationFn: deleteComment,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: feedQueryKeys.detail(kudoId),
        }),
        queryClient.invalidateQueries({ queryKey: feedQueryKey }),
      ]);
    },
  });

  if (comments.length === 0) {
    return (
      <EmptyState
        title="No comments yet."
        description="Start a thoughtful conversation about this recognition."
      />
    );
  }
  return (
    <div className="grid gap-3">
      {comments.map((comment) => (
        <article
          className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-gj-md bg-gj-surface-subtle p-4"
          key={comment.id}
        >
          <Avatar
            name={comment.author.displayName}
            src={comment.author.avatarUrl}
            size="small"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <strong className="text-gj-sm text-gj-brand-700">
                {comment.author.displayName}
              </strong>
              <time
                className="text-gj-xs text-gj-text-muted"
                dateTime={comment.createdAt}
              >
                {new Date(comment.createdAt).toLocaleString()}
              </time>
            </div>
            <p className="mt-2 mb-0 whitespace-pre-wrap text-gj-sm leading-6">
              {comment.body}
            </p>
            {comment.canDelete && (
              <Button
                className="mt-2 px-0"
                size="small"
                variant="ghost"
                type="button"
                disabled={deletion.isPending}
                onClick={() => deletion.mutate(comment.id)}
              >
                Delete comment
              </Button>
            )}
          </div>
        </article>
      ))}
      {deletion.isError && (
        <p className="m-0 text-gj-sm text-gj-danger" role="alert">
          Comment deletion failed.
        </p>
      )}
    </div>
  );
}
