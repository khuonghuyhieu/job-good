import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';

import { ApiClientError } from '../../api/error-adapter.js';
import { feedQueryKey, feedQueryKeys } from '../feed/query-keys.js';
import { createComment } from './api.js';

type Attempt = { body: string; key: string };

function isAmbiguous(error: unknown): boolean {
  return !(error instanceof ApiClientError) || error.status >= 500;
}

export function CommentComposer({ kudoId }: { kudoId: string }) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<Attempt | null>(null);
  const submitting = useRef(false);

  const mutation = useMutation({
    mutationFn: (attempt: Attempt) =>
      createComment(kudoId, attempt.body, attempt.key),
    onSuccess: async () => {
      setBody('');
      setError(null);
      setRecovery(null);
      setKey(crypto.randomUUID());
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: feedQueryKeys.detail(kudoId),
        }),
        queryClient.invalidateQueries({ queryKey: feedQueryKey }),
      ]);
    },
    onError: (failure, attempt) => {
      setError(
        failure instanceof ApiClientError && failure.code === 'VALIDATION_ERROR'
          ? 'Comment text is required.'
          : 'Comment failed. Your draft is preserved.',
      );
      if (isAmbiguous(failure)) {
        setRecovery(attempt);
      } else {
        setRecovery(null);
        setKey(crypto.randomUUID());
      }
    },
    onSettled: () => {
      submitting.current = false;
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) {
      return;
    }
    if (recovery) {
      submitting.current = true;
      mutation.mutate(recovery);
      return;
    }
    const trimmed = body.trim();
    if (!trimmed) {
      setError('Comment text is required.');
      document.getElementById('comment-body')?.focus();
      return;
    }
    setError(null);
    submitting.current = true;
    mutation.mutate({ body: trimmed, key });
  }

  const locked = mutation.isPending || recovery !== null;
  return (
    <form className="comment-composer" onSubmit={submit} noValidate>
      <label htmlFor="comment-body">Add a comment</label>
      <textarea
        id="comment-body"
        value={body}
        disabled={locked}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? 'comment-error' : undefined}
        onChange={(event) => {
          setBody(event.target.value);
          setError(null);
        }}
      />
      {error && (
        <p id="comment-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={mutation.isPending}>
        {mutation.isPending
          ? 'Posting comment…'
          : recovery
            ? 'Retry comment safely'
            : 'Post comment'}
      </button>
    </form>
  );
}
