import {
  markNotificationReadResponseSchema,
  notificationListResponseSchema,
  notificationUnreadCountResponseSchema,
} from '@good-job/contracts';

import { apiRequest } from '../../api/client.js';

export const notificationQueryKeys = {
  all: ['notifications'] as const,
  list: ['notifications', 'list'] as const,
  pages: ['notifications', 'pages'] as const,
  unread: ['notifications', 'unread'] as const,
};

export async function getNotifications(cursor: string | null = null) {
  const parameters = new URLSearchParams({ limit: '20' });
  if (cursor) parameters.set('cursor', cursor);
  return notificationListResponseSchema.parse(
    await apiRequest(`/notifications?${parameters.toString()}`),
  );
}

export async function getUnreadNotificationCount() {
  return notificationUnreadCountResponseSchema.parse(
    await apiRequest('/notifications/unread-count'),
  );
}

export async function markNotificationRead(notificationId: string) {
  return markNotificationReadResponseSchema.parse(
    await apiRequest(`/notifications/${notificationId}/read`, {
      method: 'PATCH',
    }),
  );
}
