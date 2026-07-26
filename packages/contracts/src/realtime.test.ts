import { describe, expect, it } from 'vitest';

import {
  organizationRoom,
  realtimeEventEnvelopeSchema,
  userRoom,
} from './realtime.js';

const id = '10000000-0000-4000-8000-000000000001';

describe('realtime event contract', () => {
  it('accepts a stable public envelope and rejects internal jobs', () => {
    expect(
      realtimeEventEnvelopeSchema.parse({
        eventId: id,
        type: 'kudo.committed',
        organizationId: id,
        recipientUserIds: [id],
        occurredAt: '2026-07-27T00:00:00.000Z',
        payload: {
          kudoId: id,
          senderId: id,
          receiverId: id,
          coreValueId: id,
          points: 20,
          description: 'Well done.',
        },
      }).eventId,
    ).toBe(id);
    expect(
      realtimeEventEnvelopeSchema.safeParse({
        eventId: id,
        type: 'media.video_processing_requested',
        organizationId: id,
        occurredAt: '2026-07-27T00:00:00.000Z',
        payload: { attachmentId: id },
      }).success,
    ).toBe(false);
  });

  it('rejects an event type with an incomplete or foreign payload shape', () => {
    expect(
      realtimeEventEnvelopeSchema.safeParse({
        eventId: id,
        type: 'kudo.committed',
        organizationId: id,
        occurredAt: '2026-07-27T00:00:00.000Z',
        payload: { kudoId: id },
      }).success,
    ).toBe(false);
    expect(
      realtimeEventEnvelopeSchema.safeParse({
        eventId: id,
        type: 'reward.redeemed',
        organizationId: id,
        recipientUserIds: [id],
        occurredAt: '2026-07-27T00:00:00.000Z',
        payload: { notificationId: id },
      }).success,
    ).toBe(false);
  });

  it('defines server-controlled room names', () => {
    expect(organizationRoom(id)).toBe(`org:${id}`);
    expect(userRoom(id, id)).toBe(`org:${id}:user:${id}`);
  });
});
