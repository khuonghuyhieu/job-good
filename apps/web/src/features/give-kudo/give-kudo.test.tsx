// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  SessionContext,
  type SessionContextValue,
} from '../../app/session/session-context.js';
import {
  GiveKudoComposer,
  updateWalletOverviewAfterKudo,
} from './GiveKudoComposer.js';
import { feedQueryKey } from '../feed/query-keys.js';
import { walletOverviewQueryKey } from './api.js';

const senderId = '20000000-0000-4000-8000-000000000001';
const receiverId = '20000000-0000-4000-8000-000000000002';
const coreValueId = '50000000-0000-4000-8000-000000000001';

const session: SessionContextValue = {
  status: 'authenticated',
  currentUser: {
    user: {
      id: senderId,
      email: 'sender@goodjob.local',
      displayName: 'Sender Employee',
      avatarUrl: null,
      status: 'active',
      team: null,
    },
    organization: {
      id: '10000000-0000-4000-8000-000000000001',
      name: 'Good Job',
      slug: 'good-job',
      timezone: 'Asia/Ho_Chi_Minh',
    },
  },
  acceptLogin: vi.fn(),
  clearProtectedState: vi.fn(async () => undefined),
  retrySession: vi.fn(async () => undefined),
};

const overview = {
  businessMonth: '2026-07',
  givingBudget: { allowance: 200 as const, used: 50, remaining: 150 },
  rewardBalance: 12,
};

const success = {
  kudo: {
    id: '60000000-0000-4000-8000-000000000001',
    senderId,
    receiverId,
    coreValueId,
    points: 20,
    description: 'A thoughtful contribution.',
    status: 'committed' as const,
    committedAt: '2026-07-25T10:00:00.000Z',
    attachments: [],
  },
  businessMonth: '2026-07',
  givingBudget: { allowance: 200 as const, used: 70, remaining: 130 },
  receiverCredit: { amount: 20, balanceAfter: 20 },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function baseResponse(pathname: string): Response {
  if (pathname === '/wallet/overview') {
    return jsonResponse(overview);
  }
  if (pathname === '/core-values') {
    return jsonResponse({
      items: [
        {
          id: coreValueId,
          code: 'OWNERSHIP',
          name: 'Ownership',
          description: 'Own the outcome.',
        },
      ],
    });
  }
  if (pathname === '/employees') {
    return jsonResponse({
      items: [
        {
          id: senderId,
          displayName: 'Sender Employee',
          avatarUrl: null,
          teamName: 'Engineering',
        },
        {
          id: receiverId,
          displayName: 'Receiver Employee',
          avatarUrl: null,
          teamName: 'Product',
        },
      ],
      nextCursor: null,
    });
  }
  throw new Error(`Unexpected request: ${pathname}`);
}

function renderComposer(
  fetchMock: ReturnType<typeof vi.fn>,
  options: { compact?: boolean } = {},
) {
  vi.stubGlobal('fetch', fetchMock);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  queryClient.setQueryData(feedQueryKey, { items: [] });
  render(
    <QueryClientProvider client={queryClient}>
      <SessionContext.Provider value={session}>
        <GiveKudoComposer
          {...(options.compact === undefined
            ? {}
            : { compact: options.compact })}
        />
      </SessionContext.Provider>
    </QueryClientProvider>,
  );
  return queryClient;
}

async function completeDraft() {
  await userEvent.click(
    await screen.findByRole('radio', {
      name: /Receiver Employee Product/u,
    }),
  );
  await userEvent.click(screen.getByRole('radio', { name: /Ownership/u }));
  await userEvent.click(screen.getByRole('radio', { name: '20' }));
  await userEvent.type(
    screen.getByLabelText('Why are you recognizing them?'),
    'A thoughtful contribution.',
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Phase 3 Give Kudo frontend', () => {
  it('never invents a Reward Balance when Wallet overview is not cached', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await updateWalletOverviewAfterKudo(queryClient, success);

    expect(queryClient.getQueryData(walletOverviewQueryKey)).toBeUndefined();
  });

  it('shows authoritative budget and eligible selector values', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      return baseResponse(new URL(String(input)).pathname);
    });
    renderComposer(fetchMock);

    expect(screen.getByText('Loading Core Values…')).toHaveAttribute(
      'role',
      'status',
    );
    expect(await screen.findByText('150 points remaining')).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: /Receiver Employee Product/u }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('radio', { name: /Sender Employee/u }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: /Ownership/u }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: /Receiver Employee/u }),
    ).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /Ownership/u })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: '10' })).toBeChecked();
  });

  it('keeps rich selector and segmented-point controls synchronized with the command fields', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
      baseResponse(new URL(String(input)).pathname),
    );
    renderComposer(fetchMock);

    await userEvent.click(
      await screen.findByRole('radio', { name: /Receiver Employee/u }),
    );
    await userEvent.click(screen.getByRole('radio', { name: /Ownership/u }));
    await userEvent.click(screen.getByRole('radio', { name: '40' }));

    expect(
      screen.getByRole('radio', { name: /Receiver Employee/u }),
    ).toBeChecked();
    expect(screen.getByRole('radio', { name: /Ownership/u })).toBeChecked();
    expect(screen.getByRole('radio', { name: '40' })).toBeChecked();
  });

  it('communicates empty colleague and Core Value states', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      if (path === '/employees') {
        return jsonResponse({ items: [], nextCursor: null });
      }
      if (path === '/core-values') {
        return jsonResponse({ items: [] });
      }
      return baseResponse(path);
    });
    renderComposer(fetchMock);

    expect(await screen.findByText('No matching colleagues.')).toHaveAttribute(
      'role',
      'status',
    );
    expect(screen.getByText('No active Core Values.')).toHaveAttribute(
      'role',
      'status',
    );
    expect(screen.getByRole('button', { name: 'Give Kudo' })).toBeDisabled();
  });

  it('validates required fields without losing the draft', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
      baseResponse(new URL(String(input)).pathname),
    );
    renderComposer(fetchMock);
    await screen.findByText('150 points remaining');

    await userEvent.type(
      screen.getByLabelText('Why are you recognizing them?'),
      'Preserve this draft',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Give Kudo' }));

    expect(screen.getByText('Choose a colleague.')).toBeInTheDocument();
    expect(screen.getByText('Choose a Core Value.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Preserve this draft')).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        ([input]) => new URL(String(input)).pathname === '/kudos',
      ),
    ).toBe(false);
    expect(
      screen.getByRole('radio', { name: /Receiver Employee Product/u }),
    ).toHaveFocus();
  });

  it('keeps the selected colleague visible when search results change', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === '/employees' && url.searchParams.get('query')) {
        return jsonResponse({ items: [], nextCursor: null });
      }
      return baseResponse(url.pathname);
    });
    renderComposer(fetchMock);

    const receiver = await screen.findByRole('radio', {
      name: /Receiver Employee Product/u,
    });
    await userEvent.click(receiver);
    await userEvent.type(screen.getByLabelText('Find a colleague'), 'Nobody');

    expect(
      await screen.findByRole('radio', {
        name: /Receiver Employee Product/u,
      }),
    ).toBeChecked();
    expect(screen.getByText('No matching colleagues.')).toBeInTheDocument();
  });

  it('does not show success while pending and updates server caches after success', async () => {
    let resolveCommand!: (response: Response) => void;
    const command = new Promise<Response>((resolve) => {
      resolveCommand = resolve;
    });
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input)).pathname;
        if (path === '/kudos' && init?.method === 'POST') {
          return command;
        }
        return baseResponse(path);
      },
    );
    const queryClient = renderComposer(fetchMock);
    await completeDraft();
    await userEvent.click(screen.getByRole('button', { name: 'Give Kudo' }));

    expect(
      screen.getByRole('button', { name: 'Sending Kudo…' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('radio', { name: /Receiver Employee/u }),
    ).toBeDisabled();
    expect(
      screen.getByLabelText('Why are you recognizing them?'),
    ).toBeDisabled();
    expect(screen.queryByText(/Kudo committed/u)).not.toBeInTheDocument();

    await act(async () => resolveCommand(jsonResponse(success, 201)));

    expect(
      await screen.findByText('Kudo committed for 20 points.'),
    ).toBeVisible();
    expect(queryClient.getQueryData(walletOverviewQueryKey)).toEqual({
      businessMonth: '2026-07',
      givingBudget: success.givingBudget,
      rewardBalance: 12,
    });
    expect(queryClient.getQueryState(feedQueryKey)?.isInvalidated).toBe(true);

    const commandCall = fetchMock.mock.calls.find(
      ([input]) => new URL(String(input)).pathname === '/kudos',
    );
    expect(commandCall?.[1]?.headers).toMatchObject({
      'Idempotency-Key': expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
      ),
    });
  });

  it('keeps compact success confirmation visible after collapsing', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input)).pathname;
        if (path === '/kudos' && init?.method === 'POST') {
          return jsonResponse(success, 201);
        }
        return baseResponse(path);
      },
    );
    renderComposer(fetchMock, { compact: true });

    await userEvent.click(screen.getByRole('button', { name: 'Give a Kudo' }));
    await completeDraft();
    await userEvent.click(screen.getByRole('button', { name: 'Give Kudo' }));

    expect(
      await screen.findByText('Kudo committed for 20 points.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Give a Kudo' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('preserves the draft and reuses one idempotency key after a temporary failure', async () => {
    const commandKeys: string[] = [];
    let attempts = 0;
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input)).pathname;
        if (path === '/kudos' && init?.method === 'POST') {
          commandKeys.push(
            new Headers(init.headers).get('Idempotency-Key') ?? '',
          );
          attempts += 1;
          if (attempts === 1) {
            return jsonResponse(
              {
                code: 'DEPENDENCY_UNAVAILABLE',
                message: 'Temporary',
                requestId: 'request-id',
              },
              503,
            );
          }
          return jsonResponse(success, 201);
        }
        return baseResponse(path);
      },
    );
    renderComposer(fetchMock);
    await completeDraft();
    await userEvent.click(screen.getByRole('button', { name: 'Give Kudo' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'draft is preserved',
    );
    expect(
      screen.getByRole('radio', { name: /Receiver Employee/u }),
    ).toBeDisabled();
    expect(
      screen.getByDisplayValue('A thoughtful contribution.'),
    ).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Retry safely' }));
    expect(
      await screen.findByText('Kudo committed for 20 points.'),
    ).toBeVisible();
    expect(commandKeys).toHaveLength(2);
    expect(commandKeys[1]).toBe(commandKeys[0]);
  });

  it('guards against two submit events in the same render', async () => {
    let resolveCommand!: (response: Response) => void;
    const command = new Promise<Response>((resolve) => {
      resolveCommand = resolve;
    });
    let commandCalls = 0;
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input)).pathname;
        if (path === '/kudos' && init?.method === 'POST') {
          commandCalls += 1;
          return command;
        }
        return baseResponse(path);
      },
    );
    renderComposer(fetchMock);
    await completeDraft();
    const button = screen.getByRole('button', { name: 'Give Kudo' });
    const form = button.closest('form');
    expect(form).not.toBeNull();

    fireEvent.submit(form!);
    fireEvent.submit(form!);

    await waitFor(() => expect(commandCalls).toBe(1));
    await act(async () => resolveCommand(jsonResponse(success, 201)));
    expect(
      await screen.findByText('Kudo committed for 20 points.'),
    ).toBeVisible();
  });

  it('renders server field validation without clearing the draft', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input)).pathname;
        if (path === '/kudos' && init?.method === 'POST') {
          return jsonResponse(
            {
              code: 'VALIDATION_ERROR',
              message: 'Invalid Kudo',
              fieldErrors: {
                description: 'Description was rejected by the server.',
              },
              requestId: 'request-id',
            },
            400,
          );
        }
        return baseResponse(path);
      },
    );
    renderComposer(fetchMock);
    await completeDraft();
    await userEvent.click(screen.getByRole('button', { name: 'Give Kudo' }));

    expect(
      await screen.findByText('Description was rejected by the server.'),
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue('A thoughtful contribution.'),
    ).toBeInTheDocument();
  });

  it('refreshes the latest budget, preserves draft and blocks an exhausted budget', async () => {
    let budgetLoads = 0;
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input)).pathname;
        if (path === '/wallet/overview') {
          budgetLoads += 1;
          return jsonResponse(
            budgetLoads === 1
              ? overview
              : {
                  ...overview,
                  givingBudget: {
                    allowance: 200,
                    used: 200,
                    remaining: 0,
                  },
                },
          );
        }
        if (path === '/kudos' && init?.method === 'POST') {
          return jsonResponse(
            {
              code: 'INSUFFICIENT_GIVING_BUDGET',
              message: 'Insufficient',
              details: { remaining: 0 },
              requestId: 'request-id',
            },
            409,
          );
        }
        return baseResponse(path);
      },
    );
    renderComposer(fetchMock);
    await completeDraft();
    await userEvent.click(screen.getByRole('button', { name: 'Give Kudo' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'latest Giving Budget is insufficient',
    );
    expect(
      screen.getByDisplayValue('A thoughtful contribution.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        'Your Giving Budget is exhausted for this business month.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Give Kudo' })).toBeDisabled();
    expect(budgetLoads).toBeGreaterThanOrEqual(2);
  });

  it('does not expose stale budget as usable when conflict refresh fails', async () => {
    let budgetLoads = 0;
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input)).pathname;
        if (path === '/wallet/overview') {
          budgetLoads += 1;
          return budgetLoads === 1
            ? jsonResponse(overview)
            : jsonResponse(
                {
                  code: 'DEPENDENCY_UNAVAILABLE',
                  message: 'Temporary',
                  requestId: 'request-id',
                },
                503,
              );
        }
        if (path === '/kudos' && init?.method === 'POST') {
          return jsonResponse(
            {
              code: 'INSUFFICIENT_GIVING_BUDGET',
              message: 'Insufficient',
              requestId: 'request-id',
            },
            409,
          );
        }
        return baseResponse(path);
      },
    );
    renderComposer(fetchMock);
    await completeDraft();
    await userEvent.click(screen.getByRole('button', { name: 'Give Kudo' }));

    expect(
      await screen.findByText('Giving Budget is temporarily unavailable.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Give Kudo' })).toBeDisabled();
    expect(
      screen.getByDisplayValue('A thoughtful contribution.'),
    ).toBeInTheDocument();
  });

  it('refreshes an unavailable Core Value and preserves the other fields', async () => {
    let coreValueLoads = 0;
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input)).pathname;
        if (path === '/core-values') {
          coreValueLoads += 1;
          return jsonResponse(
            coreValueLoads === 1
              ? {
                  items: [
                    {
                      id: coreValueId,
                      code: 'OWNERSHIP',
                      name: 'Ownership',
                      description: null,
                    },
                  ],
                }
              : { items: [] },
          );
        }
        if (path === '/kudos' && init?.method === 'POST') {
          return jsonResponse(
            {
              code: 'CORE_VALUE_UNAVAILABLE',
              message: 'Unavailable',
              requestId: 'request-id',
            },
            409,
          );
        }
        return baseResponse(path);
      },
    );
    renderComposer(fetchMock);
    await completeDraft();
    await userEvent.click(screen.getByRole('button', { name: 'Give Kudo' }));

    expect(
      await screen.findByText('No active Core Values.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Choose an active Core Value.'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole('radiogroup', { name: 'Choose a Core Value' }),
      ).toHaveFocus(),
    );
    expect(
      screen.getByRole('radio', { name: /Receiver Employee/u }),
    ).toBeChecked();
    expect(screen.getByRole('radio', { name: '20' })).toBeChecked();
    expect(
      screen.getByDisplayValue('A thoughtful contribution.'),
    ).toBeInTheDocument();
    expect(coreValueLoads).toBeGreaterThanOrEqual(2);
  });
});
