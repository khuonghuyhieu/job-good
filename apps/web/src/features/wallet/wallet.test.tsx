// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WalletPage } from '../../pages/WalletPage.js';

const kudoId = '60000000-0000-4000-8000-000000000001';
const entryId = '70000000-0000-4000-8000-000000000001';
const olderEntryId = '70000000-0000-4000-8000-000000000002';
const overview = {
  businessMonth: '2026-07',
  givingBudget: { allowance: 200, used: 30, remaining: 170 },
  rewardBalance: 45,
};
const entry = {
  id: entryId,
  direction: 'credit',
  amount: 30,
  sequence: 1,
  balanceAfter: 45,
  sourceType: 'kudo_credit',
  sourceId: kudoId,
  description: null,
  createdAt: '2026-07-26T10:00:00.000Z',
  source: {
    type: 'kudo',
    kudoId,
    label: 'Kudo from An Nguyen',
  },
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function renderWallet() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <WalletPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Phase 5 Wallet', () => {
  it('shows loading then separates Giving Budget, Reward Balance and Kudo history', async () => {
    let resolveOverview!: (value: Response) => void;
    let resolveHistory!: (value: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const path = new URL(String(input)).pathname;
        return new Promise<Response>((resolve) => {
          if (path === '/wallet/overview') {
            resolveOverview = resolve;
          } else {
            resolveHistory = resolve;
          }
        });
      }),
    );
    renderWallet();

    expect(screen.getByText('Loading Wallet overview…')).toHaveAttribute(
      'role',
      'status',
    );
    expect(screen.getByText('Loading Point History…')).toHaveAttribute(
      'role',
      'status',
    );
    await act(async () => {
      resolveOverview(response(overview));
      resolveHistory(response({ items: [entry], nextCursor: null }));
    });

    expect(
      await screen.findByRole('heading', { name: 'Giving Budget' }),
    ).toBeInTheDocument();
    expect(screen.getByText('170 points remaining')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Reward Balance' }),
    ).toBeInTheDocument();
    expect(screen.getByText('45 Reward Points')).toBeInTheDocument();
    expect(screen.getByText('+30 Reward Points')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'View related Kudo' }),
    ).toHaveAttribute('href', `/kudos/${kudoId}`);
  });

  it('renders a purposeful empty Point History', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        new URL(String(input)).pathname === '/wallet/overview'
          ? response(overview)
          : response({ items: [], nextCursor: null }),
      ),
    );
    renderWallet();
    expect(
      await screen.findByText('No Reward Point activity yet.'),
    ).toBeInTheDocument();
  });

  it('preserves and deduplicates history when loading an older page fails', async () => {
    let ledgerCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input)).pathname;
        if (path === '/wallet/overview') {
          return response(overview);
        }
        ledgerCalls += 1;
        if (ledgerCalls === 1) {
          return response({ items: [entry], nextCursor: 'older' });
        }
        return response(
          {
            code: 'DEPENDENCY_UNAVAILABLE',
            message: 'Temporary',
            requestId: 'request-id',
          },
          503,
        );
      }),
    );
    renderWallet();
    expect(await screen.findByText('+30 Reward Points')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Load older activity' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Existing entries are preserved',
    );
    expect(screen.getAllByText('+30 Reward Points')).toHaveLength(1);
  });

  it('deduplicates cursor pages and keeps the latest entry representation', async () => {
    let ledgerCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input)).pathname;
        if (path === '/wallet/overview') {
          return response(overview);
        }
        ledgerCalls += 1;
        return ledgerCalls === 1
          ? response({ items: [entry], nextCursor: 'older' })
          : response({
              items: [
                {
                  ...entry,
                  source: { ...entry.source, label: 'Updated Kudo source' },
                },
                {
                  ...entry,
                  id: olderEntryId,
                  sourceType: 'seed_adjustment',
                  sourceId: olderEntryId,
                  source: null,
                },
              ],
              nextCursor: null,
            });
      }),
    );
    renderWallet();
    await screen.findByText('Kudo from An Nguyen');
    await userEvent.click(
      screen.getByRole('button', { name: 'Load older activity' }),
    );

    expect(await screen.findByText('Updated Kudo source')).toBeInTheDocument();
    expect(screen.queryByText('Kudo from An Nguyen')).not.toBeInTheDocument();
    expect(screen.getAllByText('+30 Reward Points')).toHaveLength(2);
  });

  it('offers independent recovery for overview and initial history failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        response(
          {
            code: 'DEPENDENCY_UNAVAILABLE',
            message: 'Temporary',
            requestId: 'request-id',
          },
          503,
        ),
      ),
    );
    renderWallet();

    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: 'Retry Wallet' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Retry history' }),
    ).toBeInTheDocument();
  });
});
