import {
  reactionResponseSchema,
  type ReactionResponse,
  type SupportedEmoji,
} from '@good-job/contracts';

import { apiRequest } from '../../api/client.js';

export async function setReaction(
  kudoId: string,
  emojiCode: SupportedEmoji,
): Promise<ReactionResponse> {
  return reactionResponseSchema.parse(
    await apiRequest(`/kudos/${kudoId}/reaction`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ emojiCode }),
    }),
  );
}

export async function removeReaction(
  kudoId: string,
): Promise<ReactionResponse> {
  return reactionResponseSchema.parse(
    await apiRequest(`/kudos/${kudoId}/reaction`, { method: 'DELETE' }),
  );
}
