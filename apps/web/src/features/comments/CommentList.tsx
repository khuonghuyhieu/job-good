import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Comment } from '@good-job/contracts';

import { feedQueryKey, feedQueryKeys } from '../feed/query-keys.js';
import { deleteComment } from './api.js';

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
    return <p>No comments yet.</p>;
  }
  return (
    <div className="comment-list">
      {comments.map((comment) => (
        <article key={comment.id}>
          <strong>{comment.author.displayName}</strong>
          <p>{comment.body}</p>
          {comment.canDelete && (
            <button
              type="button"
              disabled={deletion.isPending}
              onClick={() => deletion.mutate(comment.id)}
            >
              Delete comment
            </button>
          )}
        </article>
      ))}
      {deletion.isError && <p role="alert">Comment deletion failed.</p>}
    </div>
  );
}
