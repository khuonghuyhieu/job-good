// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RewardDetailPage } from '../../pages/RewardDetailPage.js';
import { RewardsPage } from '../../pages/RewardsPage.js';

const rewardId = '90000000-0000-4000-8000-000000000001';
const redemptionId = '90000000-0000-4000-8000-000000000002';
const ledgerId = '90000000-0000-4000-8000-000000000003';
const reward = {
  id: rewardId,
  code: 'coffee',
  name: 'Coffee voucher',
  description: 'A fresh cup',
  costPoints: 60,
  imageUrl: null,
};
const detail = {
  ...reward,
  eligibility: { currentBalance: 100, eligible: true, reason: 'eligible' },
};
const redemption = {
  redemption: {
    id: redemptionId,
    rewardId,
    rewardName: reward.name,
    costPoints: 60,
    status: 'committed',
    committedAt: '2026-07-26T12:00:00.000Z',
  },
  ledgerEntryId: ledgerId,
  sequence: 2,
  balanceAfter: 40,
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function renderPage(element: ReactNode, path = '/') {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Phase 6 Rewards frontend', () => {
  it('shows catalog loading, active rewards, empty history, and catalog error recovery', async () => {
    let catalogCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input)).pathname;
        if (path === '/rewards') {
          catalogCalls += 1;
          return catalogCalls === 1
            ? response(
                {
                  code: 'TEMPORARY_UNAVAILABLE',
                  message: 'Try later.',
                  requestId: 'test-request',
                },
                503,
              )
            : response({ items: [reward] });
        }
        return response({ items: [], nextCursor: null });
      }),
    );
    renderPage(<RewardsPage />);
    expect(screen.getByText('Loading rewards…')).toHaveAttribute(
      'role',
      'status',
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Reward Catalog is temporarily unavailable',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Retry catalog' }),
    );
    expect(
      await screen.findByRole('heading', { name: reward.name }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('You have not redeemed a reward yet.'),
    ).toBeInTheDocument();
  });

  it('prevents repeated clicks, confirms only after server success, and refreshes protected caches', async () => {
    let resolveRedemption!: (value: Response) => void;
    let postCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          postCalls += 1;
          return new Promise<Response>((resolve) => {
            resolveRedemption = resolve;
          });
        }
        return response(detail);
      }),
    );
    const client = renderPage(
      <Routes>
        <Route path="/rewards/:rewardId" element={<RewardDetailPage />} />
      </Routes>,
      `/rewards/${rewardId}`,
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Redeem reward' }),
    );
    const confirm = screen.getByRole('button', { name: 'Confirm redemption' });
    await userEvent.click(confirm);
    await userEvent.click(confirm);
    expect(postCalls).toBe(1);
    expect(screen.queryByText(/Redemption committed/)).not.toBeInTheDocument();
    resolveRedemption(response(redemption, 201));
    expect(await screen.findByText(/Redemption committed/)).toHaveTextContent(
      '40 Reward Points',
    );
    await waitFor(() => {
      expect(
        client.getQueryState(['wallet', 'overview'])?.isInvalidated ?? true,
      ).toBe(true);
    });
  });

  it('moves focus into the confirmation dialog and closes it with Escape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(detail)),
    );
    renderPage(
      <Routes>
        <Route path="/rewards/:rewardId" element={<RewardDetailPage />} />
      </Routes>,
      `/rewards/${rewardId}`,
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Redeem reward' }),
    );
    expect(
      screen.getByRole('button', { name: 'Confirm redemption' }),
    ).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('uses the same idempotency key while checking an unknown response', async () => {
    const keys: string[] = [];
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          keys.push(new Headers(init.headers).get('Idempotency-Key') ?? '');
          calls += 1;
          if (calls === 1) throw new TypeError('network interrupted');
          return response(redemption, 201);
        }
        return response(detail);
      }),
    );
    renderPage(
      <Routes>
        <Route path="/rewards/:rewardId" element={<RewardDetailPage />} />
      </Routes>,
      `/rewards/${rewardId}`,
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Redeem reward' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm redemption' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'result is unknown',
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await userEvent.click(
      screen.getByRole('button', { name: 'Check redemption result' }),
    );
    expect(await screen.findByText(/Redemption committed/)).toBeInTheDocument();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('shows an ineligible state without a redemption action', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        response({
          ...detail,
          eligibility: {
            currentBalance: 20,
            eligible: false,
            reason: 'insufficient_points',
          },
        }),
      ),
    );
    renderPage(
      <Routes>
        <Route path="/rewards/:rewardId" element={<RewardDetailPage />} />
      </Routes>,
      `/rewards/${rewardId}`,
    );
    expect(
      await screen.findByText(/need more Reward Points/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Redeem reward' }),
    ).not.toBeInTheDocument();
  });
});
