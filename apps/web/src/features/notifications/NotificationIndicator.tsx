import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  notificationQueryKeys,
} from './api.js';

export function NotificationIndicator() {
  const queryClient = useQueryClient();
  const unread = useQuery({
    queryKey: notificationQueryKeys.unread,
    queryFn: getUnreadNotificationCount,
  });
  const notifications = useQuery({
    queryKey: notificationQueryKeys.list,
    queryFn: getNotifications,
  });
  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: notificationQueryKeys.all,
      });
    },
  });

  if (unread.isPending || notifications.isPending) {
    return <span role="status">Loading notifications…</span>;
  }
  if (unread.isError || notifications.isError || !notifications.data) {
    return <span role="alert">Notifications unavailable.</span>;
  }
  return (
    <details>
      <summary>Notifications ({unread.data?.unreadCount ?? 0} unread)</summary>
      {notifications.data.items.length === 0 ? (
        <p>No notifications yet.</p>
      ) : (
        <ul>
          {notifications.data.items.map((notification) => (
            <li key={notification.id}>
              <span>{notification.type}</span>{' '}
              {notification.relatedKudoId && (
                <Link
                  to={`/kudos/${notification.relatedKudoId}`}
                  onClick={() => {
                    if (!notification.readAt) markRead.mutate(notification.id);
                  }}
                >
                  Open Kudo
                </Link>
              )}
              {!notification.readAt && <span> · Unread</span>}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
