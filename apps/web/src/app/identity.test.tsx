// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProtectedRoute } from './ProtectedRoute.js';
import {
  SessionContext,
  type SessionContextValue,
  useSession,
} from './session/session-context.js';
import { SessionProvider } from './session/SessionProvider.js';
import { LoginPage } from '../pages/LoginPage.js';
import { AppShell } from '../layout/AppShell.js';

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

function response(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function renderLogin(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetchMock);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const session: SessionContextValue = {
    status: 'unauthenticated',
    currentUser: null,
    acceptLogin: vi.fn(),
    clearProtectedState: vi.fn(async () => undefined),
    retrySession: vi.fn(async () => undefined),
  };
  render(
    <QueryClientProvider client={queryClient}>
      <SessionContext.Provider value={session}>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<p>Protected dashboard</p>} />
          </Routes>
        </MemoryRouter>
      </SessionContext.Provider>
    </QueryClientProvider>,
  );
  return session;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Phase 2 login experience', () => {
  it('shows loading and authenticating states before entering protected UI', async () => {
    let resolveUsers!: (value: Response) => void;
    const usersPromise = new Promise<Response>((resolve) => {
      resolveUsers = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(usersPromise)
      .mockResolvedValueOnce(response(currentUser, 201));
    const session = renderLogin(fetchMock);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading demo employees',
    );
    expect(screen.queryByText('Protected dashboard')).not.toBeInTheDocument();

    await act(async () => {
      resolveUsers(
        response({
          users: [
            {
              id: currentUser.user.id,
              displayName: currentUser.user.displayName,
              email: currentUser.user.email,
              avatarUrl: null,
              teamName: 'Engineering',
            },
          ],
        }),
      );
    });
    await userEvent.selectOptions(
      await screen.findByLabelText('Demo employee'),
      currentUser.user.id,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Protected dashboard')).toBeInTheDocument();
    expect(session.acceptLogin).toHaveBeenCalledWith(currentUser);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      credentials: 'include',
    });
  });

  it.each([
    [403, 'EMPLOYEE_INACTIVE', 'inactive and cannot sign in'],
    [404, 'RESOURCE_NOT_FOUND', 'no longer available'],
    [503, 'DEPENDENCY_UNAVAILABLE', 'temporarily unavailable'],
  ])(
    'shows a safe login error for status %s',
    async (status, code, message) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          response({
            users: [
              {
                id: currentUser.user.id,
                displayName: currentUser.user.displayName,
                email: currentUser.user.email,
                avatarUrl: null,
                teamName: 'Engineering',
              },
            ],
          }),
        )
        .mockResolvedValueOnce(
          response(
            { code, message: 'Rejected', requestId: 'request-id' },
            status,
          ),
        );
      renderLogin(fetchMock);

      await userEvent.selectOptions(
        await screen.findByLabelText('Demo employee'),
        currentUser.user.id,
      );
      await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(screen.queryByText('Protected dashboard')).not.toBeInTheDocument();
    },
  );

  it('recovers when loading demo employees temporarily fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response(
          {
            code: 'DEPENDENCY_UNAVAILABLE',
            message: 'Unavailable',
            requestId: 'request-id',
          },
          503,
        ),
      )
      .mockResolvedValueOnce(
        response({
          users: [
            {
              id: currentUser.user.id,
              displayName: currentUser.user.displayName,
              email: currentUser.user.email,
              avatarUrl: null,
              teamName: 'Engineering',
            },
          ],
        }),
      );
    renderLogin(fetchMock);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('temporarily unavailable');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByLabelText('Demo employee')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('protected routing', () => {
  it('does not expose protected content while checking and redirects after expiry', () => {
    const base = {
      acceptLogin: vi.fn(),
      clearProtectedState: vi.fn(async () => undefined),
      retrySession: vi.fn(async () => undefined),
    };
    const { rerender } = render(
      <SessionContext.Provider
        value={{ ...base, status: 'checking', currentUser: null }}
      >
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<p>Protected dashboard</p>} />
            </Route>
            <Route path="/login" element={<p>Login destination</p>} />
          </Routes>
        </MemoryRouter>
      </SessionContext.Provider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Checking');
    expect(screen.queryByText('Protected dashboard')).not.toBeInTheDocument();

    rerender(
      <SessionContext.Provider
        value={{ ...base, status: 'unauthenticated', currentUser: null }}
      >
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<p>Protected dashboard</p>} />
            </Route>
            <Route path="/login" element={<p>Login destination</p>} />
          </Routes>
        </MemoryRouter>
      </SessionContext.Provider>,
    );
    expect(screen.getByText('Login destination')).toBeInTheDocument();
    expect(screen.queryByText('Protected dashboard')).not.toBeInTheDocument();
  });

  it('clears protected query cache when /me reports an expired session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response(
          {
            code: 'UNAUTHENTICATED',
            message: 'Expired',
            requestId: 'request-id',
          },
          401,
        ),
      ),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(['protected', 'example'], { secret: true });
    const protectedMutation = queryClient
      .getMutationCache()
      .build(queryClient, {
        mutationKey: ['protected', 'mutation'],
        mutationFn: async () => ({ secret: true }),
      });
    await protectedMutation.execute(undefined);

    function SessionStatus() {
      return <p>{useSession().status}</p>;
    }

    render(
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <SessionStatus />
        </SessionProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('unauthenticated')).toBeInTheDocument();
    expect(queryClient.getQueryData(['protected', 'example'])).toBeUndefined();
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
  });

  it('recovers from a temporary current-user service failure', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response(
          {
            code: 'DEPENDENCY_UNAVAILABLE',
            message: 'Unavailable',
            requestId: 'request-id',
          },
          503,
        ),
      )
      .mockResolvedValueOnce(response(currentUser));
    vi.stubGlobal('fetch', fetchMock);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <MemoryRouter initialEntries={['/']}>
            <Routes>
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<p>Protected dashboard</p>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </SessionProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'temporarily unavailable',
    );
    expect(screen.queryByText('Protected dashboard')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Protected dashboard')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps authenticated UI visible during a background session refresh', async () => {
    let resolveRefresh!: (value: Response) => void;
    const refresh = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(refresh));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(['session', 'current-user'], currentUser, {
      updatedAt: 0,
    });

    function SessionStatus() {
      const session = useSession();
      return (
        <p>
          {session.status}:{session.currentUser?.user.displayName ?? 'none'}
        </p>
      );
    }

    render(
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <SessionStatus />
        </SessionProvider>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByText('authenticated:An Nguyen'),
    ).toBeInTheDocument();
    await act(async () => {
      resolveRefresh(response(currentUser));
      await refresh;
    });
  });

  it('does not allow an in-flight protected query to repopulate cache after expiration', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response(
          {
            code: 'UNAUTHENTICATED',
            message: 'Expired',
            requestId: 'request-id',
          },
          401,
        ),
      ),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    let resolveProtected!: () => void;
    void queryClient
      .fetchQuery({
        queryKey: ['protected', 'late'],
        queryFn: () =>
          new Promise<{ secret: boolean }>((resolve) => {
            resolveProtected = () => resolve({ secret: true });
          }),
      })
      .catch(() => undefined);

    render(
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <p>Session boundary</p>
        </SessionProvider>
      </QueryClientProvider>,
    );

    await screen.findByText('Session boundary');
    await act(async () => {
      resolveProtected();
      await Promise.resolve();
    });
    expect(queryClient.getQueryData(['protected', 'late'])).toBeUndefined();
  });

  it('clears protected cache and redirects after successful logout', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(null, 204));
    vi.stubGlobal('fetch', fetchMock);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(['protected', 'dashboard'], { secret: true });
    const clearProtectedState = vi.fn(async () => {
      await queryClient.cancelQueries();
      queryClient.removeQueries();
    });
    const session: SessionContextValue = {
      status: 'authenticated',
      currentUser,
      acceptLogin: vi.fn(),
      clearProtectedState,
      retrySession: vi.fn(async () => undefined),
    };

    render(
      <QueryClientProvider client={queryClient}>
        <SessionContext.Provider value={session}>
          <MemoryRouter initialEntries={['/']}>
            <Routes>
              <Route path="/" element={<AppShell />}>
                <Route index element={<p>Protected dashboard</p>} />
              </Route>
              <Route path="/login" element={<p>Login destination</p>} />
            </Routes>
          </MemoryRouter>
        </SessionContext.Provider>
      </QueryClientProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByText('Login destination')).toBeInTheDocument();
    expect(clearProtectedState).toHaveBeenCalledOnce();
    expect(
      queryClient.getQueryData(['protected', 'dashboard']),
    ).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ credentials: 'include', method: 'POST' }),
    );
  });
});
