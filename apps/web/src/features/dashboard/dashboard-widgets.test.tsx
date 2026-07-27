// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ColleaguesWidget, FeaturedRewardsWidget } from './CommunityWidgets.js';
import { QuickNotificationsWidget } from './QuickNotificationsWidget.js';
import { notificationLabel } from '../notifications/presentation.js';

const notificationId = '80000000-0000-4000-8000-000000000001';
const kudoId = '60000000-0000-4000-8000-000000000001';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function renderWidgets() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <QuickNotificationsWidget />
        <ColleaguesWidget />
        <FeaturedRewardsWidget />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('VR-3 Dashboard contextual widgets', () => {
  it('uses one notification label mapping for supported events and fallback', () => {
    expect(notificationLabel('kudo.received')).toBe('You received a Kudo');
    expect(notificationLabel('comment.created')).toBe('New comment');
    expect(notificationLabel('reaction.changed')).toBe('New reaction');
    expect(notificationLabel('reward.redeemed')).toBe('Reward redeemed');
    expect(notificationLabel('future.event')).toBe('Good Job update');
  });

  it('presents independent loading states', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    renderWidgets();

    expect(screen.getByLabelText('Loading notifications')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading colleagues')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading rewards')).toBeInTheDocument();
  });

  it('presents independent empty states', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input)).pathname;
        if (path === '/notifications/unread-count') {
          return json({ unreadCount: 0 });
        }
        return json({
          items: [],
          nextCursor:
            path === '/notifications' || path === '/employees'
              ? null
              : undefined,
        });
      }),
    );
    renderWidgets();

    expect(await screen.findByText('You’re all caught up')).toBeInTheDocument();
    expect(screen.getByText('No colleagues found')).toBeInTheDocument();
    expect(screen.getByText('No rewards available')).toBeInTheDocument();
  });

  it('keeps other widgets available when one dependency fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input)).pathname;
        if (path.startsWith('/notifications')) {
          return json(
            {
              code: 'DEPENDENCY_UNAVAILABLE',
              message: 'Temporary',
              requestId: 'request-id',
            },
            503,
          );
        }
        if (path === '/employees') {
          return json({ items: [], nextCursor: null });
        }
        return json({ items: [] });
      }),
    );
    renderWidgets();

    expect(
      await screen.findByText('Notifications unavailable'),
    ).toBeInTheDocument();
    expect(screen.getByText('No colleagues found')).toBeInTheDocument();
    expect(screen.getByText('No rewards available')).toBeInTheDocument();
  });

  it('marks an unread Dashboard notification read and refreshes server state', async () => {
    let unread = true;
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input)).pathname;
        calls.push(`${init?.method ?? 'GET'} ${path}`);
        if (path === '/notifications/unread-count') {
          return json({ unreadCount: unread ? 1 : 0 });
        }
        if (path === '/notifications') {
          return json({
            items: [
              {
                id: notificationId,
                eventId: '81000000-0000-4000-8000-000000000001',
                type: 'kudo.received',
                payload: {},
                relatedKudoId: kudoId,
                readAt: unread ? null : '2026-07-27T10:05:00.000Z',
                createdAt: '2026-07-27T10:00:00.000Z',
              },
            ],
            nextCursor: null,
          });
        }
        if (path === `/notifications/${notificationId}/read`) {
          unread = false;
          return json({
            notification: {
              id: notificationId,
              eventId: '81000000-0000-4000-8000-000000000001',
              type: 'kudo.received',
              payload: {},
              relatedKudoId: kudoId,
              readAt: '2026-07-27T10:05:00.000Z',
              createdAt: '2026-07-27T10:00:00.000Z',
            },
          });
        }
        if (path === '/employees') {
          return json({ items: [], nextCursor: null });
        }
        return json({ items: [] });
      }),
    );
    renderWidgets();

    await userEvent.click(
      await screen.findByRole('link', { name: 'You received a Kudo' }),
    );
    await waitFor(() =>
      expect(
        calls.filter(
          (call) => call === `PATCH /notifications/${notificationId}/read`,
        ),
      ).toHaveLength(1),
    );
    await waitFor(() =>
      expect(screen.getByText('0 unread')).toBeInTheDocument(),
    );
  });
});
