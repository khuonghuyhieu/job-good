// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CommentComposer } from '../comments/CommentComposer.js';
import { ReactionBar } from '../reactions/ReactionBar.js';
import { KudoFocusPage } from '../../pages/KudoFocusPage.js';
import { Feed } from './Feed.js';
import { feedQueryKeys } from './query-keys.js';

const kudoId = '60000000-0000-4000-8000-000000000001';
const secondKudoId = '60000000-0000-4000-8000-000000000002';
const employee = {
  id: '20000000-0000-4000-8000-000000000001',
  displayName: 'An Nguyen',
  avatarUrl: null,
};
const kudo = {
  id: kudoId,
  sender: employee,
  receiver: {
    id: '20000000-0000-4000-8000-000000000002',
    displayName: 'Binh Tran',
    avatarUrl: null,
  },
  coreValue: {
    id: '50000000-0000-4000-8000-000000000001',
    code: 'OWNERSHIP',
    name: 'Ownership',
  },
  points: 20,
  description: 'Excellent work.',
  committedAt: '2026-07-25T10:00:00.000Z',
  attachments: [],
  reactions: {
    counts: { celebrate: 0, heart: 0, clap: 0, fire: 0 },
    currentUserReaction: null,
  },
  commentCount: 0,
};

function response(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function renderWithQuery(element: ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{element}</MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Phase 4 Feed and community frontend', () => {
  it('shows initial loading and a purposeful empty Feed state', async () => {
    let resolveFeed!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveFeed = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => pending),
    );
    renderWithQuery(<Feed />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading recognition Feed',
    );
    await act(async () =>
      resolveFeed(response({ items: [], nextCursor: null })),
    );
    expect(
      await screen.findByText(
        'No Kudos yet. Be the first to recognize a colleague.',
      ),
    ).toBeInTheDocument();
  });

  it('shows a recoverable initial Feed error', async () => {
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
    renderWithQuery(<Feed />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Feed is temporarily unavailable',
    );
    expect(
      screen.getByRole('button', { name: 'Retry Feed' }),
    ).toBeInTheDocument();
  });

  it('deduplicates cursor pages and keeps the latest server representation', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        return calls === 1
          ? response({ items: [kudo], nextCursor: 'next-page' })
          : response({
              items: [
                {
                  ...kudo,
                  description: 'Excellent work, with a newer summary.',
                  commentCount: 2,
                },
                {
                  ...kudo,
                  id: secondKudoId,
                  description: 'Older recognition.',
                },
              ],
              nextCursor: null,
            });
      }),
    );
    renderWithQuery(<Feed />);

    expect(await screen.findByText('Excellent work.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('Older recognition.')).toBeInTheDocument();
    expect(
      screen.getByText('Excellent work, with a newer summary.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Excellent work.')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'View Kudo · 2 comments' }),
    ).toBeInTheDocument();
  });

  it('preserves loaded items when loading more fails', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        return calls === 1
          ? response({ items: [kudo], nextCursor: 'next-page' })
          : response(
              {
                code: 'DEPENDENCY_UNAVAILABLE',
                message: 'Temporary',
                requestId: 'request-id',
              },
              503,
            );
      }),
    );
    renderWithQuery(<Feed />);
    expect(await screen.findByText('Excellent work.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Existing Kudos are preserved',
    );
    expect(screen.getByText('Excellent work.')).toBeInTheDocument();
  });

  it('communicates the loading-more state without hiding loaded items', async () => {
    let resolveOlder!: (value: Response) => void;
    const older = new Promise<Response>((resolve) => {
      resolveOlder = resolve;
    });
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        return calls === 1
          ? response({ items: [kudo], nextCursor: 'next-page' })
          : older;
      }),
    );
    renderWithQuery(<Feed />);
    expect(await screen.findByText('Excellent work.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(
      screen.getByRole('button', { name: 'Loading older Kudos…' }),
    ).toBeDisabled();
    expect(screen.getByText('Excellent work.')).toBeInTheDocument();
    await act(async () =>
      resolveOlder(response({ items: [], nextCursor: null })),
    );
  });

  it('optimistically updates a reaction and restores it on failure', async () => {
    let reject!: (error: Error) => void;
    const pending = new Promise<Response>((_resolve, rejectPromise) => {
      reject = rejectPromise;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => pending),
    );
    renderWithQuery(<ReactionBar kudoId={kudoId} reactions={kudo.reactions} />);

    await userEvent.click(screen.getByRole('button', { name: 'Celebrate 0' }));
    expect(screen.getByRole('button', { name: 'Celebrate 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await act(async () => reject(new Error('Network unavailable')));

    expect(await screen.findByRole('alert')).toHaveTextContent('restored');
    expect(screen.getByRole('button', { name: 'Celebrate 0' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('rolls optimistic reaction state back across Feed and detail caches', async () => {
    let reject!: (error: Error) => void;
    const pending = new Promise<Response>((_resolve, rejectPromise) => {
      reject = rejectPromise;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => pending),
    );
    const client = renderWithQuery(
      <ReactionBar kudoId={kudoId} reactions={kudo.reactions} />,
    );
    client.setQueryData(feedQueryKeys.pages(), {
      pages: [{ items: [kudo], nextCursor: null }],
      pageParams: [null],
    });
    client.setQueryData(feedQueryKeys.detail(kudoId), {
      ...kudo,
      comments: [],
    });

    await userEvent.click(screen.getByRole('button', { name: 'Celebrate 0' }));

    expect(
      client.getQueryData<{
        pages: Array<{ items: (typeof kudo)[] }>;
      }>(feedQueryKeys.pages())?.pages[0]?.items[0]?.reactions,
    ).toMatchObject({
      currentUserReaction: 'celebrate',
      counts: { celebrate: 1 },
    });
    expect(
      client.getQueryData<typeof kudo & { comments: [] }>(
        feedQueryKeys.detail(kudoId),
      )?.reactions,
    ).toMatchObject({
      currentUserReaction: 'celebrate',
      counts: { celebrate: 1 },
    });

    await act(async () => reject(new Error('Network unavailable')));

    expect(
      client.getQueryData<{
        pages: Array<{ items: (typeof kudo)[] }>;
      }>(feedQueryKeys.pages())?.pages[0]?.items[0]?.reactions,
    ).toEqual(kudo.reactions);
    expect(
      client.getQueryData<typeof kudo & { comments: [] }>(
        feedQueryKeys.detail(kudoId),
      )?.reactions,
    ).toEqual(kudo.reactions);
  });

  it('preserves a comment draft and idempotency key across recovery', async () => {
    const keys: string[] = [];
    let attempts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        keys.push(new Headers(init?.headers).get('Idempotency-Key') ?? '');
        attempts += 1;
        if (attempts === 1) {
          return response(
            {
              code: 'DEPENDENCY_UNAVAILABLE',
              message: 'Temporary',
              requestId: 'request-id',
            },
            503,
          );
        }
        return response({
          comment: {
            id: '70000000-0000-4000-8000-000000000001',
            kudoId,
            author: employee,
            body: 'Keep this draft.',
            createdAt: '2026-07-25T10:01:00.000Z',
            canDelete: true,
          },
        });
      }),
    );
    renderWithQuery(<CommentComposer kudoId={kudoId} />);
    await userEvent.type(
      screen.getByLabelText('Add a comment'),
      'Keep this draft.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Post comment' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'draft is preserved',
    );
    expect(screen.getByDisplayValue('Keep this draft.')).toBeDisabled();
    await userEvent.click(
      screen.getByRole('button', { name: 'Retry comment safely' }),
    );

    expect(await screen.findByLabelText('Add a comment')).toHaveValue('');
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
  });

  it('rejects an empty comment locally without making a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderWithQuery(<CommentComposer kudoId={kudoId} />);

    await userEvent.type(screen.getByLabelText('Add a comment'), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Post comment' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Comment text is required',
    );
    expect(screen.getByLabelText('Add a comment')).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders Kudo Focus and its no-comments state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response({ ...kudo, comments: [] })),
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/kudos/${kudoId}`]}>
          <Routes>
            <Route path="/kudos/:kudoId" element={<KudoFocusPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole('heading', {
        name: 'An Nguyen recognized Binh Tran',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('No comments yet.')).toBeInTheDocument();
  });

  it('renders an unavailable Kudo Focus state safely', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        response(
          {
            code: 'RESOURCE_NOT_FOUND',
            message: 'Unavailable',
            requestId: 'request-id',
          },
          404,
        ),
      ),
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/kudos/${kudoId}`]}>
          <Routes>
            <Route path="/kudos/:kudoId" element={<KudoFocusPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This Kudo is unavailable',
    );
    expect(
      screen.getByRole('link', { name: 'Return to Dashboard' }),
    ).toHaveAttribute('href', '/');
  });
});
