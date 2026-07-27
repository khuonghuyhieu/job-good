// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SessionContext,
  type SessionContextValue,
} from '../app/session/session-context.js';
import { AppShell } from './AppShell.js';
import type * as AuthApi from '../features/auth/api.js';
import type * as NotificationsApi from '../features/notifications/api.js';

const api = vi.hoisted(() => ({
  logout: vi.fn(),
  getNotifications: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
  markNotificationRead: vi.fn(),
}));

vi.mock('../features/auth/api.js', async (importOriginal) => {
  const original = await importOriginal<typeof AuthApi>();
  return { ...original, logout: api.logout };
});

vi.mock('../features/notifications/api.js', async (importOriginal) => {
  const original = await importOriginal<typeof NotificationsApi>();
  return {
    ...original,
    getNotifications: api.getNotifications,
    getUnreadNotificationCount: api.getUnreadNotificationCount,
    markNotificationRead: api.markNotificationRead,
  };
});

const currentUser = {
  user: {
    id: '20000000-0000-4000-8000-000000000001',
    email: 'an@goodjob.local',
    displayName: 'An Nguyen',
    avatarUrl: null,
    status: 'active' as const,
    team: {
      id: '11000000-0000-4000-8000-000000000001',
      name: 'Engineering',
    },
  },
  organization: {
    id: '10000000-0000-4000-8000-000000000001',
    name: 'Amanotes Demo',
    slug: 'amanotes-demo',
    timezone: 'Asia/Ho_Chi_Minh',
  },
};

beforeEach(() => {
  api.getNotifications.mockResolvedValue({ items: [], nextCursor: null });
  api.getUnreadNotificationCount.mockResolvedValue({ unreadCount: 0 });
  api.logout.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('VR-2 App Shell', () => {
  it('renders desktop and mobile navigation with a stable active state', async () => {
    renderShell('/wallet');

    expect(
      screen.getByRole('navigation', { name: 'Primary navigation' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Mobile navigation' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Good Job home' })).toHaveAttribute(
      'href',
      '/',
    );

    const walletLinks = screen.getAllByRole('link', {
      name: 'Wallet',
    });
    expect(walletLinks).toHaveLength(2);
    for (const walletLink of walletLinks) {
      expect(walletLink).toHaveAttribute('aria-current', 'page');
    }
    expect(screen.getByText('Wallet content')).toBeInTheDocument();
    for (const label of ['Home', 'Rewards', 'Wallet']) {
      expect(screen.getAllByRole('link', { name: label })).toHaveLength(2);
    }
  });

  it('supports keyboard access and focus return for the account menu', async () => {
    const user = userEvent.setup();
    renderShell('/');
    const trigger = screen.getByRole('button', {
      name: 'Open account menu for An Nguyen',
    });

    trigger.focus();
    await user.keyboard('{ArrowDown}');
    const signOut = await screen.findByRole('button', { name: 'Sign out' });
    await waitFor(() => expect(signOut).toHaveFocus());
    await user.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
    expect(
      screen.queryByRole('dialog', { name: 'Account menu' }),
    ).not.toBeInTheDocument();
  });

  it('uses the server unread count and exposes the notification entry', async () => {
    api.getUnreadNotificationCount.mockResolvedValue({ unreadCount: 125 });
    renderShell('/');

    expect(
      await screen.findByRole('button', {
        name: 'Notifications, 125 unread',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('99+')).toBeInTheDocument();
    expect(api.getUnreadNotificationCount).toHaveBeenCalledTimes(1);
  });

  it('keeps cache cleanup in the existing session logout flow', async () => {
    const user = userEvent.setup();
    api.logout.mockResolvedValue(undefined);
    const { session } = renderShell('/');

    await user.click(
      screen.getByRole('button', {
        name: 'Open account menu for An Nguyen',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(api.logout).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(session.clearProtectedState).toHaveBeenCalledTimes(1),
    );
    expect(screen.getByText('Login destination')).toBeInTheDocument();
  });

  it('prevents repeated logout retries while recovery is pending', async () => {
    const user = userEvent.setup();
    let resolveRetry!: () => void;
    api.logout
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockReturnValueOnce(
        new Promise<void>((resolve) => {
          resolveRetry = resolve;
        }),
      );
    renderShell('/');

    await user.click(
      screen.getByRole('button', {
        name: 'Open account menu for An Nguyen',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    const retry = await screen.findByRole('button', {
      name: 'Try signing out again',
    });
    await user.click(retry);

    expect(screen.getByRole('button', { name: 'Retrying…' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Retrying…' }));
    expect(api.logout).toHaveBeenCalledTimes(2);
    resolveRetry();
    expect(await screen.findByText('Login destination')).toBeInTheDocument();
  });

  it('provides a keyboard skip link to protected page content', () => {
    renderShell('/');
    expect(
      screen.getByRole('link', { name: 'Skip to main content' }),
    ).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });
});

function renderShell(path: string): { session: SessionContextValue } {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const session: SessionContextValue = {
    status: 'authenticated',
    currentUser,
    acceptLogin: vi.fn(),
    clearProtectedState: vi.fn(async () => {
      queryClient.clear();
    }),
    retrySession: vi.fn(async () => undefined),
  };
  render(
    <QueryClientProvider client={queryClient}>
      <SessionContext.Provider value={session}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/login" element={<p>Login destination</p>} />
            <Route element={<AppShell />}>
              <Route path="/" element={<p>Home content</p>} />
              <Route path="/wallet" element={<p>Wallet content</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </SessionContext.Provider>
    </QueryClientProvider>,
  );
  return { session };
}
