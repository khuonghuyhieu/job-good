import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { ReactionState, SupportedEmoji } from '@good-job/contracts';

import { feedQueryKey, feedQueryKeys } from '../feed/query-keys.js';
import { removeReaction, setReaction } from './api.js';
import {
  restoreReactionCache,
  snapshotReactionCache,
  updateReactionCache,
} from './cache.js';
import { Chip } from '../../shared/ui/index.js';

const emoji: Array<{ code: SupportedEmoji; label: string; glyph: string }> = [
  { code: 'celebrate', label: 'Celebrate', glyph: '🎉' },
  { code: 'heart', label: 'Heart', glyph: '♥' },
  { code: 'clap', label: 'Clap', glyph: '👏' },
  { code: 'fire', label: 'Fire', glyph: '🔥' },
];

function optimisticState(
  state: ReactionState,
  next: SupportedEmoji | null,
): ReactionState {
  const counts = { ...state.counts };
  if (state.currentUserReaction) {
    counts[state.currentUserReaction] = Math.max(
      0,
      counts[state.currentUserReaction] - 1,
    );
  }
  if (next) {
    counts[next] += 1;
  }
  return { counts, currentUserReaction: next };
}

export function ReactionBar({
  kudoId,
  reactions,
}: {
  kudoId: string;
  reactions: ReactionState;
}) {
  const queryClient = useQueryClient();
  const [visible, setVisible] = useState(reactions);
  const mutating = useRef(false);

  useEffect(() => {
    if (!mutating.current) {
      setVisible(reactions);
    }
  }, [reactions]);

  const mutation = useMutation({
    mutationFn: (next: SupportedEmoji | null) =>
      next ? setReaction(kudoId, next) : removeReaction(kudoId),
    onMutate: (next) => {
      mutating.current = true;
      const previous = visible;
      const optimistic = optimisticState(previous, next);
      const cache = snapshotReactionCache(queryClient, kudoId);
      setVisible(optimistic);
      updateReactionCache(queryClient, kudoId, optimistic);
      return { previous, cache };
    },
    onError: (_error, _next, context) => {
      if (context) {
        setVisible(context.previous);
        restoreReactionCache(queryClient, kudoId, context.cache);
      }
    },
    onSuccess: async (response) => {
      setVisible(response.reactions);
      updateReactionCache(queryClient, kudoId, response.reactions);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: feedQueryKey }),
        queryClient.invalidateQueries({
          queryKey: feedQueryKeys.detail(kudoId),
        }),
      ]);
    },
    onSettled: () => {
      mutating.current = false;
    },
  });

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-t border-gj-border pt-4"
      aria-label="Kudo reactions"
    >
      {emoji.map(({ code, label, glyph }) => (
        <Chip
          key={code}
          type="button"
          selected={visible.currentUserReaction === code}
          aria-label={`${label} ${visible.counts[code]}`}
          disabled={mutation.isPending}
          onClick={() =>
            mutation.mutate(visible.currentUserReaction === code ? null : code)
          }
        >
          <span aria-hidden="true">{glyph}</span>
          <span>{visible.counts[code]}</span>
        </Chip>
      ))}
      {mutation.isError && (
        <span
          className="w-full text-gj-xs font-semibold text-gj-danger"
          role="alert"
        >
          Reaction failed and was restored.
        </span>
      )}
    </div>
  );
}
