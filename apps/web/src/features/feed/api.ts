import {
  feedResponseSchema,
  kudoDetailResponseSchema,
  type FeedResponse,
  type KudoDetailResponse,
} from '@good-job/contracts';

import { apiRequest } from '../../api/client.js';

export async function getFeed(
  cursor: string | null,
  limit = 10,
): Promise<FeedResponse> {
  const parameters = new URLSearchParams({ limit: String(limit) });
  if (cursor) {
    parameters.set('cursor', cursor);
  }
  return feedResponseSchema.parse(
    await apiRequest(`/kudos?${parameters.toString()}`),
  );
}

export async function getKudoDetail(
  kudoId: string,
): Promise<KudoDetailResponse> {
  return kudoDetailResponseSchema.parse(await apiRequest(`/kudos/${kudoId}`));
}
