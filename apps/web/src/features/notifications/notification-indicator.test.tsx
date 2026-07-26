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
    api.getNotifications.mockResolvedValue({ items: [], nextCursor: null });
    api.getUnreadNotificationCount.mockResolvedValue({ unreadCount: 0 });

    renderIndicator();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading notifications',
    );
    expect(
      await screen.findByText('Notifications (0 unread)'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByText('Notifications (0 unread)'));
    expect(screen.getByText('No notifications yet.')).toBeInTheDocument();
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
    await userEvent.click(await screen.findByText('Notifications (1 unread)'));
    const link = screen.getByRole('link', { name: 'Open Kudo' });
    expect(link).toHaveAttribute('href', `/kudos/${kudoId}`);
    await userEvent.click(link);
    await waitFor(() => expect(api.markNotificationRead).toHaveBeenCalled());
    expect(api.markNotificationRead.mock.calls[0]?.[0]).toBe(notificationId);
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
