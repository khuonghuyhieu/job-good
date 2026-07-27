// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NotificationIndicator } from './NotificationIndicator.js';
import type * as NotificationsApi from './api.js';

const api = vi.hoisted(() => ({
  getNotifications: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
  markNotificationRead: vi.fn(),
}));

vi.mock('./api.js', async (importOriginal) => {
  const original = await importOriginal<typeof NotificationsApi>();
  return { ...original, ...api };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Phase 8 durable notification indicator', () => {
  it('shows loading and empty states from authoritative queries', async () => {
    let resolveNotifications!: (value: { items: []; nextCursor: null }) => void;
    let resolveUnread!: (value: { unreadCount: number }) => void;
    api.getNotifications.mockReturnValue(
      new Promise((resolve) => {
        resolveNotifications = resolve;
      }),
    );
    api.getUnreadNotificationCount.mockReturnValue(
      new Promise((resolve) => {
        resolveUnread = resolve;
      }),
    );

    renderIndicator();
    const trigger = screen.getByRole('button', {
      name: 'Notifications, loading',
    });
    await userEvent.click(trigger);
    expect(
      screen.getByRole('status', { name: 'Loading notifications' }),
    ).toHaveTextContent('Loading notifications');
    resolveNotifications({ items: [], nextCursor: null });
    resolveUnread({ unreadCount: 0 });
    expect(
      await screen.findByRole('button', { name: 'Notifications, 0 unread' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('No notifications yet')).toBeInTheDocument();
  });

  it('opens the related Kudo and marks an unread notification read', async () => {
    const notificationId = '70000000-0000-4000-8000-000000000001';
    const kudoId = '60000000-0000-4000-8000-000000000001';
    api.getUnreadNotificationCount.mockResolvedValue({ unreadCount: 1 });
    api.getNotifications.mockResolvedValue({
      items: [
        {
          id: notificationId,
          eventId: '80000000-0000-4000-8000-000000000001',
          type: 'kudo.received',
          payload: { kudoId },
          relatedKudoId: kudoId,
          readAt: null,
          createdAt: '2026-07-27T00:00:00.000Z',
        },
      ],
      nextCursor: null,
    });
    api.markNotificationRead.mockResolvedValue({
      notification: {
        id: notificationId,
        eventId: '80000000-0000-4000-8000-000000000001',
        type: 'kudo.received',
        payload: { kudoId },
        relatedKudoId: kudoId,
        readAt: '2026-07-27T00:01:00.000Z',
        createdAt: '2026-07-27T00:00:00.000Z',
      },
    });

    renderIndicator();
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Notifications, 1 unread',
      }),
    );
    const link = screen.getByRole('link', { name: 'Open Kudo' });
    expect(link).toHaveAttribute('href', `/kudos/${kudoId}`);
    await userEvent.click(link);
    await waitFor(() => expect(api.markNotificationRead).toHaveBeenCalled());
    expect(api.markNotificationRead.mock.calls[0]?.[0]).toBe(notificationId);
  });

  it('marks an unread notification without a related Kudo read', async () => {
    const notificationId = '70000000-0000-4000-8000-000000000002';
    api.getUnreadNotificationCount.mockResolvedValue({ unreadCount: 1 });
    api.getNotifications.mockResolvedValue({
      items: [
        {
          id: notificationId,
          eventId: '80000000-0000-4000-8000-000000000002',
          type: 'reward.redeemed',
          payload: {},
          relatedKudoId: null,
          readAt: null,
          createdAt: '2026-07-27T00:00:00.000Z',
        },
      ],
      nextCursor: null,
    });
    api.markNotificationRead.mockResolvedValue({
      notification: {
        id: notificationId,
        eventId: '80000000-0000-4000-8000-000000000002',
        type: 'reward.redeemed',
        payload: {},
        relatedKudoId: null,
        readAt: '2026-07-27T00:01:00.000Z',
        createdAt: '2026-07-27T00:00:00.000Z',
      },
    });

    renderIndicator();
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Notifications, 1 unread',
      }),
    );
    expect(screen.getByText('Update recorded')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mark as read' }));

    await waitFor(() =>
      expect(api.markNotificationRead.mock.calls[0]?.[0]).toBe(notificationId),
    );
  });

  it('keeps an unread notification actionable when mark-read fails', async () => {
    const notificationId = '70000000-0000-4000-8000-000000000003';
    api.getUnreadNotificationCount.mockResolvedValue({ unreadCount: 1 });
    api.getNotifications.mockResolvedValue({
      items: [
        {
          id: notificationId,
          eventId: '80000000-0000-4000-8000-000000000003',
          type: 'reward.redeemed',
          payload: {},
          relatedKudoId: null,
          readAt: null,
          createdAt: '2026-07-27T00:00:00.000Z',
        },
      ],
      nextCursor: null,
    });
    api.markNotificationRead.mockRejectedValue(new Error('Unavailable'));

    renderIndicator();
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Notifications, 1 unread',
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Mark as read' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not mark this notification as read',
    );
    expect(screen.getByRole('button', { name: 'Mark as read' })).toBeEnabled();
  });

  it('shows a single pending retry and recovers from query failure', async () => {
    const user = userEvent.setup();
    let resolveNotifications!: (value: { items: []; nextCursor: null }) => void;
    let resolveUnread!: (value: { unreadCount: number }) => void;
    api.getNotifications
      .mockRejectedValueOnce(new Error('Unavailable'))
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveNotifications = resolve;
        }),
      );
    api.getUnreadNotificationCount
      .mockRejectedValueOnce(new Error('Unavailable'))
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveUnread = resolve;
        }),
      );

    renderIndicator();
    await user.click(
      await screen.findByRole('button', {
        name: 'Notifications unavailable',
      }),
    );
    const retry = screen.getByRole('button', { name: 'Retry notifications' });
    await user.click(retry);
    expect(screen.getByRole('button', { name: 'Retrying…' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Retrying…' }));
    expect(api.getNotifications).toHaveBeenCalledTimes(2);
    expect(api.getUnreadNotificationCount).toHaveBeenCalledTimes(2);

    resolveNotifications({ items: [], nextCursor: null });
    resolveUnread({ unreadCount: 0 });
    expect(
      await screen.findByRole('button', { name: 'Notifications, 0 unread' }),
    ).toBeInTheDocument();
    expect(screen.getByText('No notifications yet')).toBeInTheDocument();
  });

  it('preserves durable notifications when an older page fails', async () => {
    const notification = {
      id: '70000000-0000-4000-8000-000000000001',
      eventId: '80000000-0000-4000-8000-000000000001',
      type: 'kudo.received',
      payload: {},
      relatedKudoId: '60000000-0000-4000-8000-000000000001',
      readAt: null,
      createdAt: '2026-07-27T00:00:00.000Z',
    };
    api.getUnreadNotificationCount.mockResolvedValue({ unreadCount: 1 });
    api.getNotifications
      .mockResolvedValueOnce({ items: [notification], nextCursor: 'older' })
      .mockRejectedValueOnce(new Error('temporary'));

    renderIndicator();
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Notifications, 1 unread',
      }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Load older notifications' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Existing notifications remain visible',
    );
    expect(screen.getByRole('link', { name: 'Open Kudo' })).toHaveAttribute(
      'href',
      `/kudos/${notification.relatedKudoId}`,
    );
    expect(screen.getByText('Unread')).toBeInTheDocument();
  });
});

function renderIndicator(): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <NotificationIndicator />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}
