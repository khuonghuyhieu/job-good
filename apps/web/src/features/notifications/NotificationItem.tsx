import type { NotificationDto } from '@good-job/contracts';
import { Link } from 'react-router-dom';

import { Badge, Button } from '../../shared/ui/index.js';
import { notificationLabel } from './presentation.js';

interface NotificationItemProps {
  notification: NotificationDto;
  compact?: boolean;
  markReadPending: boolean;
  markReadError: boolean;
  onMarkRead: (notificationId: string) => void;
}

export function NotificationItem({
  notification,
  compact = false,
  markReadPending,
  markReadError,
  onMarkRead,
}: NotificationItemProps) {
  const markUnreadNotificationRead = () => {
    if (!notification.readAt && !markReadPending) {
      onMarkRead(notification.id);
    }
  };

  return (
    <li
      className={`gj-notification-item grid gap-2 rounded-gj-sm bg-gj-surface-subtle p-3 ${
        notification.readAt
          ? ''
          : 'gj-notification-item--unread shadow-[inset_0.2rem_0_var(--color-gj-primary-600)]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <strong className="text-gj-sm">
          {notificationLabel(notification.type)}
        </strong>
        {!compact && (
          <Badge tone={notification.readAt ? 'neutral' : 'primary'}>
            {notification.readAt ? 'Read' : 'Unread'}
          </Badge>
        )}
      </div>
      <time
        className="text-gj-xs text-gj-text-muted"
        dateTime={notification.createdAt}
      >
        {compact
          ? new Date(notification.createdAt).toLocaleDateString()
          : new Date(notification.createdAt).toLocaleString()}
        {compact && !notification.readAt ? ' · Unread' : ''}
      </time>
      <div className="flex flex-wrap items-center gap-2">
        {notification.relatedKudoId ? (
          <Link
            className="min-h-9 content-center font-bold text-gj-primary-700"
            to={`/kudos/${notification.relatedKudoId}`}
            onClick={markUnreadNotificationRead}
          >
            {compact ? notificationLabel(notification.type) : 'Open Kudo'}
          </Link>
        ) : (
          <span className="text-gj-sm text-gj-text-secondary">
            Update recorded
          </span>
        )}
        {!notification.readAt && (
          <Button
            size="small"
            variant="ghost"
            pending={markReadPending}
            pendingLabel="Marking as read…"
            onClick={markUnreadNotificationRead}
          >
            Mark as read
          </Button>
        )}
      </div>
      {markReadError && (
        <p className="m-0 text-gj-xs font-semibold text-gj-danger" role="alert">
          Could not mark this notification as read. Try again.
        </p>
      )}
    </li>
  );
}
