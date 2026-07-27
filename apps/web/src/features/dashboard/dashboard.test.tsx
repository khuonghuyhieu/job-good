// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  SessionContext,
  type SessionContextValue,
} from '../../app/session/session-context.js';
import { DashboardPage } from '../../pages/DashboardPage.js';
import { DashboardLayout } from './DashboardLayout.js';

const employeeId = '20000000-0000-4000-8000-000000000001';
const colleagueId = '20000000-0000-4000-8000-000000000002';
const rewardId = '90000000-0000-4000-8000-000000000001';
const coreValueId = '50000000-0000-4000-8000-000000000001';

const session: SessionContextValue = {
  status: 'authenticated',
  currentUser: {
    user: {
      id: employeeId,
      email: 'an@goodjob.local',
      displayName: 'An Nguyen',
      avatarUrl: null,
      status: 'active',
      team: { id: '30000000-0000-4000-8000-000000000001', name: 'Product' },
    },
    organization: {
      id: '10000000-0000-4000-8000-000000000001',
      name: 'Good Job Vietnam',
      slug: 'good-job-vietnam',
      timezone: 'Asia/Ho_Chi_Minh',
    },
  },
  acceptLogin: vi.fn(),
  clearProtectedState: vi.fn(async () => undefined),
  retrySession: vi.fn(async () => undefined),
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function routeResponse(path: string): Response {
  if (path === '/wallet/overview') {
    return json({
      businessMonth: '2026-07',
      givingBudget: { allowance: 200, used: 50, remaining: 150 },
      rewardBalance: 80,
    });
  }
  if (path === '/core-values') {
    return json({
      items: [
        {
          id: coreValueId,
          code: 'OWNERSHIP',
          name: 'Ownership',
          description: null,
        },
      ],
    });
  }
  if (path === '/employees') {
    return json({
      items: [
        {
          id: colleagueId,
          displayName: 'Binh Tran',
          avatarUrl: null,
          teamName: 'Engineering',
        },
      ],
      nextCursor: null,
    });
  }
  if (path === '/rewards') {
    return json({
      items: [
        {
          id: rewardId,
          code: 'COFFEE',
          name: 'Coffee voucher',
          description: null,
          costPoints: 60,
          imageUrl: null,
        },
      ],
    });
  }
  if (path === '/notifications') {
    return json({ items: [], nextCursor: null });
  }
  if (path === '/notifications/unread-count') {
    return json({ unreadCount: 0 });
  }
  if (path === '/kudos') {
    return json({ items: [], nextCursor: null });
  }
  throw new Error(`Unexpected request: ${path}`);
}

function renderDashboard() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SessionContext.Provider value={session}>
          <DashboardPage />
        </SessionContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('VR-3 Dashboard', () => {
  it('maps desktop rails to a feed-first tablet and mobile composition', () => {
    render(
      <DashboardLayout
        personal={<span>Personal summary</span>}
        primary={<span>Give recognition</span>}
        feed={<span>Center feed</span>}
        community={<span>Community highlights</span>}
      />,
    );

    const layout = screen.getByTestId('dashboard-layout');
    expect(layout).toHaveClass(
      'grid-cols-[minmax(13.5rem,0.72fr)_minmax(0,1.75fr)_minmax(15rem,0.86fr)]',
      'max-tablet:grid-cols-2',
      'max-mobile:grid-cols-1',
    );
    expect(
      screen.getByRole('region', { name: 'Give recognition' }),
    ).toHaveClass('max-tablet:order-1', 'max-tablet:col-span-2');
    expect(
      screen.getByRole('complementary', {
        name: 'Your recognition summary',
      }),
    ).toHaveClass('max-tablet:order-2', 'max-tablet:grid-cols-3');
    expect(
      screen.getByRole('region', { name: 'Recognition activity' }),
    ).toHaveClass('max-tablet:order-3');
  });

  it('uses a compact accessible composer and preserves its draft when collapsed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        routeResponse(new URL(String(input)).pathname),
      ),
    );
    renderDashboard();

    expect(screen.queryByLabelText('Find a colleague')).not.toBeInTheDocument();
    expect(await screen.findByText('No Kudos yet')).toBeInTheDocument();

    const open = screen.getByRole('button', { name: 'Give a Kudo' });
    expect(open).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(open);
    expect(screen.getByLabelText('Find a colleague')).toHaveFocus();
    await userEvent.type(screen.getByLabelText('Find a colleague'), 'Binh');
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    const reopenedTrigger = screen.getByRole('button', {
      name: 'Give a Kudo',
    });
    await waitFor(() => expect(reopenedTrigger).toHaveFocus());
    await userEvent.click(reopenedTrigger);
    expect(screen.getByLabelText('Find a colleague')).toHaveValue('Binh');
  });

  it('renders server-owned personal, community and empty Feed states', async () => {
    const paths: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input)).pathname;
        paths.push(path);
        return routeResponse(path);
      }),
    );
    renderDashboard();

    expect(
      screen.getByRole('heading', { name: 'What’s worth celebrating?' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Giving Budget' }),
    ).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Reward Balance' }),
    ).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('Binh Tran')).toBeInTheDocument();
    expect(screen.getByText('Coffee voucher')).toBeInTheDocument();
    expect(screen.getByText('You’re all caught up')).toBeInTheDocument();
    expect(await screen.findByText('No Kudos yet')).toBeInTheDocument();

    await waitFor(() =>
      expect(paths.filter((path) => path === '/wallet/overview')).toHaveLength(
        1,
      ),
    );
  });

  it('keeps independent dashboard recovery surfaces usable', async () => {
    let walletCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input)).pathname;
        if (path === '/wallet/overview') {
          walletCalls += 1;
          return walletCalls === 1
            ? json(
                {
                  code: 'DEPENDENCY_UNAVAILABLE',
                  message: 'Temporary',
                  requestId: 'request-id',
                },
                503,
              )
            : routeResponse(path);
        }
        return routeResponse(path);
      }),
    );
    renderDashboard();

    expect(await screen.findByText('Points unavailable')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry points' }));
    expect(
      await screen.findByRole('heading', { name: 'Giving Budget' }),
    ).toBeInTheDocument();
    expect(walletCalls).toBe(2);
  });
});
