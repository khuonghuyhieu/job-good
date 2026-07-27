import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useState } from 'react';

import {
  AppIcon,
  Badge,
  Button,
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
import { NotificationItem } from './NotificationItem.js';

export function NotificationIndicator() {
  const queryClient = useQueryClient();
  const [retryInProgress, setRetryInProgress] = useState(false);
  const unread = useQuery({
    queryKey: notificationQueryKeys.unread,
    queryFn: getUnreadNotificationCount,
  });
  const notifications = useInfiniteQuery({
    queryKey: notificationQueryKeys.pages,
    queryFn: ({ pageParam }) => getNotifications(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
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
    (notifications.isError && !notifications.data) ||
    !notifications.data;
  const unreadCount = unread.data?.unreadCount ?? 0;
  const triggerLabel = isPending
    ? 'Notifications, loading'
    : isError
      ? 'Notifications unavailable'
      : `Notifications, ${unreadCount} unread`;
  const uniqueNotifications = new Map(
    (notifications.data?.pages ?? [])
      .flatMap((page) => page.items)
      .map((notification) => [notification.id, notification]),
  );
  const notificationItems = [...uniqueNotifications.values()];

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
          ) : notificationItems.length === 0 ? (
            <EmptyState
              title="No notifications yet"
              description="Recognition updates will appear here."
            />
          ) : (
            <ul className="gj-notification-list m-0 grid max-h-[min(28rem,60vh)] list-none gap-2 overflow-auto p-0">
              {notificationItems.map((notification) => {
                const isCurrentMutation =
                  markRead.variables === notification.id;
                return (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    markReadPending={isCurrentMutation && markRead.isPending}
                    markReadError={isCurrentMutation && markRead.isError}
                    onMarkRead={(notificationId) =>
                      markRead.mutate(notificationId)
                    }
                  />
                );
              })}
            </ul>
          )}
          {!isPending && !isError && notifications.isFetchNextPageError && (
            <p
              className="m-0 rounded-gj-sm bg-gj-danger-subtle p-3 text-gj-xs text-gj-danger"
              role="alert"
            >
              Older notifications could not be loaded. Existing notifications
              remain visible.
            </p>
          )}
          {!isPending && !isError && notifications.hasNextPage && (
            <Button
              size="small"
              variant="secondary"
              pending={notifications.isFetchingNextPage}
              pendingLabel="Loading older notifications…"
              onClick={() => void notifications.fetchNextPage()}
            >
              Load older notifications
            </Button>
          )}
        </section>
      </Popover>
    </div>
  );
}
