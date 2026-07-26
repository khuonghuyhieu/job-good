import { z } from 'zod';

import { commentSchema, reactionStateSchema } from './community.js';

export const publicRealtimeEventTypes = [
  'kudo.committed',
  'reaction.changed',
  'comment.created',
  'reward.redeemed',
  'notification.created',
  'media.status_changed',
] as const;

export const realtimeEventTypeSchema = z.enum(publicRealtimeEventTypes);

const envelopeFields = {
  eventId: z.uuid(),
  organizationId: z.uuid(),
  occurredAt: z.string().datetime(),
  entityVersion: z.number().int().nonnegative().optional(),
};

const publicEnvelopeFields = {
  ...envelopeFields,
  recipientUserIds: z.array(z.uuid()).max(100).optional(),
};

const personalEnvelopeFields = {
  ...envelopeFields,
  recipientUserIds: z.array(z.uuid()).min(1).max(100),
};

export const realtimeEventEnvelopeSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...publicEnvelopeFields,
      type: z.literal('kudo.committed'),
      payload: z
        .object({
          kudoId: z.uuid(),
          senderId: z.uuid(),
          receiverId: z.uuid(),
          coreValueId: z.uuid(),
          points: z.number().int().min(10).max(50),
          description: z.string().min(1),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...publicEnvelopeFields,
      type: z.literal('reaction.changed'),
      payload: z
        .object({
          kudoId: z.uuid(),
          actorEmployeeId: z.uuid(),
          reactions: reactionStateSchema,
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...publicEnvelopeFields,
      type: z.literal('comment.created'),
      payload: z
        .object({
          kudoId: z.uuid(),
          comment: commentSchema,
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...personalEnvelopeFields,
      type: z.literal('reward.redeemed'),
      payload: z
        .object({
          redemptionId: z.uuid(),
          rewardId: z.uuid(),
          debit: z.number().int().positive(),
          balanceAfter: z.number().int().nonnegative(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...personalEnvelopeFields,
      type: z.literal('notification.created'),
      payload: z
        .object({
          notificationId: z.uuid(),
          relatedKudoId: z.uuid().optional(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...publicEnvelopeFields,
      type: z.literal('media.status_changed'),
      payload: z
        .object({
          attachmentId: z.uuid(),
          ownerType: z.enum(['kudo', 'comment']),
          ownerId: z.uuid(),
          status: z.enum(['processing', 'ready', 'failed']),
          failureCode: z.string().min(1).optional(),
        })
        .strict(),
    })
    .strict(),
]);

export type RealtimeEventEnvelope = z.infer<typeof realtimeEventEnvelopeSchema>;

export const realtimeSocketEventName = 'realtime.event' as const;
export const realtimeRedisChannel = 'good-job:realtime:events' as const;

export function organizationRoom(organizationId: string): string {
  return `org:${organizationId}`;
}

export function userRoom(organizationId: string, employeeId: string): string {
  return `org:${organizationId}:user:${employeeId}`;
}
