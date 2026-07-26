import { z } from 'zod';

export const notificationSchema = z.object({
  id: z.uuid(),
  eventId: z.uuid(),
  type: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  relatedKudoId: z.uuid().nullable(),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const notificationListResponseSchema = z.object({
  items: z.array(notificationSchema),
  nextCursor: z.string().min(1).nullable(),
});

export const notificationUnreadCountResponseSchema = z.object({
  unreadCount: z.number().int().nonnegative(),
});

export const markNotificationReadResponseSchema = z.object({
  notification: notificationSchema,
});

export type NotificationDto = z.infer<typeof notificationSchema>;
export type NotificationListResponse = z.infer<
  typeof notificationListResponseSchema
>;
export type NotificationUnreadCountResponse = z.infer<
  typeof notificationUnreadCountResponseSchema
>;
export type MarkNotificationReadResponse = z.infer<
  typeof markNotificationReadResponseSchema
>;
