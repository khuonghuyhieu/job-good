import {
  createCommentResponseSchema,
  type CreateCommentResponse,
} from '@good-job/contracts';

import { apiRequest } from '../../api/client.js';

export async function createComment(
  kudoId: string,
  body: string,
  idempotencyKey: string,
): Promise<CreateCommentResponse> {
  return createCommentResponseSchema.parse(
    await apiRequest(`/kudos/${kudoId}/comments`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ body }),
    }),
  );
}

export async function deleteComment(commentId: string): Promise<void> {
  await apiRequest<void>(`/comments/${commentId}`, { method: 'DELETE' });
}
