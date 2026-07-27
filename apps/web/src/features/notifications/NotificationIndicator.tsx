import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';

import {
  AppIcon,
  Badge,
  EmptyState,
  ErrorState,
  Popover,
  Spinner,
} from '../../shared/ui/index.js';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  notificationQueryKeys,
} from './api.js';
import { notificationLabel } from './presentation.js';

export function NotificationIndicator() {
  const queryClient = useQueryClient();
  const [retryInProgress, setRetryInProgress] = useState(false);
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

  const isPending =
    !retryInProgress && (unread.isPending || notifications.isPending);
  const isError =
    retryInProgress ||
    unread.isError ||
    notifications.isError ||
    !notifications.data;
  const unreadCount = unread.data?.unreadCount ?? 0;
  const triggerLabel = isPending
    ? 'Notifications, loading'
    : isError
      ? 'Notifications unavailable'
      : `Notifications, ${unreadCount} unread`;

  return (
    <div className="gj-notification-entry">
      <Popover
        triggerLabel={triggerLabel}
        panelLabel="Notifications"
        trigger={
          <span className="gj-notification-trigger grid place-items-center [&_svg]:size-[1.35rem]">
            <AppIcon name="bell" />
            {!isPending && !isError && unreadCount > 0 && (
              <span className="gj-notification-badge absolute -top-[0.2rem] -end-[0.3rem] min-h-5 min-w-5 rounded-full border-2 border-white bg-gj-danger px-1 text-[0.65rem] leading-4 font-extrabold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </span>
        }
      >
        <section className="gj-notification-panel grid min-w-[min(20rem,calc(100vw-3rem))] gap-3">
          <header className="gj-notification-panel__header flex items-center justify-between gap-3">
            <strong>Notifications</strong>
            {!isPending && !isError && (
              <Badge tone={unreadCount > 0 ? 'primary' : 'neutral'}>
                {unreadCount} unread
              </Badge>
            )}
          </header>
          {isPending ? (
            <div role="status" aria-label="Loading notifications">
              <Spinner decorative />
              <span>Loading notifications…</span>
            </div>
          ) : isError ? (
            <ErrorState
              title="Notifications unavailable"
              description="Your durable notifications are safe. Try loading them again."
              actionLabel="Retry notifications"
              actionPending={retryInProgress}
              onAction={() => {
                setRetryInProgress(true);
                void Promise.all([
                  unread.refetch(),
                  notifications.refetch(),
                ]).finally(() => setRetryInProgress(false));
              }}
            />
          ) : notifications.data.items.length === 0 ? (
            <EmptyState
              title="No notifications yet"
              description="Recognition updates will appear here."
            />
          ) : (
            <ul className="gj-notification-list m-0 grid max-h-[min(28rem,60vh)] list-none gap-2 overflow-auto p-0">
              {notifications.data.items.map((notification) => (
                <li
                  key={notification.id}
                  className={`gj-notification-item grid gap-2 rounded-gj-sm bg-gj-surface-subtle p-3 ${
                    notification.readAt
                      ? ''
                      : 'gj-notification-item--unread shadow-[inset_0.2rem_0_var(--color-gj-primary-600)]'
                  }`}
                >
                  <div className="gj-notification-item__meta flex items-center justify-between gap-2 text-gj-xs text-gj-text-muted">
                    <span>{notificationLabel(notification.type)}</span>
                    {!notification.readAt && <span>Unread</span>}
                  </div>
                  {notification.relatedKudoId ? (
                    <Link
                      className="w-fit font-bold text-gj-primary-700"
                      to={`/kudos/${notification.relatedKudoId}`}
                      onClick={() => {
                        if (!notification.readAt) {
                          markRead.mutate(notification.id);
                        }
                      }}
                    >
                      Open Kudo
                    </Link>
                  ) : (
                    <span>Update recorded</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </Popover>
    </div>
  );
}
