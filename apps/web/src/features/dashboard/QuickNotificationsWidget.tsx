import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  notificationQueryKeys,
} from '../notifications/api.js';
import { notificationLabel } from '../notifications/presentation.js';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Heading,
  LoadingState,
} from '../../shared/ui/index.js';

export function QuickNotificationsWidget() {
  const queryClient = useQueryClient();
  const notifications = useQuery({
    queryKey: notificationQueryKeys.list,
    queryFn: getNotifications,
  });
  const unread = useQuery({
    queryKey: notificationQueryKeys.unread,
    queryFn: getUnreadNotificationCount,
  });
  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: notificationQueryKeys.all,
      });
    },
  });
  const pending = notifications.isPending || unread.isPending;
  const failed = notifications.isError || unread.isError || !notifications.data;

  return (
    <Card
      as="section"
      className="grid gap-4"
      aria-labelledby="dashboard-notifications"
    >
      <header className="flex items-center justify-between gap-3">
        <Heading id="dashboard-notifications" level={2} className="text-gj-lg">
          Notifications
        </Heading>
        {!pending && !failed && (
          <Badge tone={unread.data?.unreadCount ? 'primary' : 'neutral'}>
            {unread.data?.unreadCount ?? 0} unread
          </Badge>
        )}
      </header>
      {pending ? (
        <LoadingState title="Loading notifications" />
      ) : failed ? (
        <ErrorState
          title="Notifications unavailable"
          description="Durable updates can be loaded again."
          actionLabel="Retry notifications"
          onAction={() => {
            void Promise.all([notifications.refetch(), unread.refetch()]);
          }}
        />
      ) : notifications.data.items.length === 0 ? (
        <EmptyState
          title="You’re all caught up"
          description="Recognition updates will appear here."
        />
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0">
          {notifications.data.items.slice(0, 4).map((notification) => (
            <li
              key={notification.id}
              className="rounded-gj-sm bg-gj-surface-subtle p-3"
            >
              {notification.relatedKudoId ? (
                <Link
                  className="font-bold text-gj-primary-700"
                  to={`/kudos/${notification.relatedKudoId}`}
                  onClick={() => {
                    if (!notification.readAt) {
                      markRead.mutate(notification.id);
                    }
                  }}
                >
                  {notificationLabel(notification.type)}
                </Link>
              ) : (
                <span className="font-bold">
                  {notificationLabel(notification.type)}
                </span>
              )}
              <p className="mt-1 mb-0 text-gj-xs text-gj-text-muted">
                <time dateTime={notification.createdAt}>
                  {new Date(notification.createdAt).toLocaleDateString()}
                </time>
                {!notification.readAt && ' · Unread'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
