import { createHash } from 'node:crypto';

import type { CreateKudoRequest } from '@good-job/contracts';

export function hashCreateKudoRequest(input: CreateKudoRequest): string {
  const canonicalPayload = JSON.stringify({
    receiverId: input.receiverId,
    points: input.points,
    coreValueId: input.coreValueId,
    description: input.description.trim(),
    attachmentIds: [...(input.attachmentIds ?? [])].sort(),
  });
  return createHash('sha256').update(canonicalPayload).digest('hex');
}
