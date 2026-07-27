import { useMutation, useQuery } from '@tanstack/react-query';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';

import { ApiClientError } from '../api/error-adapter.js';
import { useSession } from '../app/session/session-context.js';
import { getDemoUsers, login } from '../features/auth/api.js';

export function LoginPage() {
  const session = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const users = useQuery({
    queryKey: ['auth', 'demo-users'],
    queryFn: getDemoUsers,
    retry: false,
  });
  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (currentUser) => {
      session.acceptLogin(currentUser);
      navigate('/', { replace: true });
    },
  });

  if (session.status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  const error = loginMutation.error;
  const showSessionNotice =
    isSessionRequiredNavigationState(location.state) &&
    session.status === 'unauthenticated';
  const errorMessage =
    error instanceof ApiClientError
      ? error.code === 'EMPLOYEE_INACTIVE'
        ? 'This employee is inactive and cannot sign in.'
        : error.code === 'RESOURCE_NOT_FOUND'
          ? 'The selected demo user is no longer available.'
          : error.status >= 500
            ? 'The service is temporarily unavailable. Please try again.'
            : error.message
      : error
        ? 'The service is temporarily unavailable. Please try again.'
        : null;

  return (
    <main className="login-page grid min-h-screen place-items-center p-6">
      <section
        className="login-card w-full max-w-lg rounded-2xl border border-gj-border bg-gj-surface p-8 shadow-gj-card"
        aria-labelledby="login-title"
      >
        <p className="m-0 mb-2 text-gj-xs font-extrabold tracking-[0.12em] text-gj-primary-600 uppercase">
          Good Job
        </p>
        <h1
          className="m-0 text-[clamp(2rem,6vw,3.6rem)] leading-[1.05] tracking-[-0.04em]"
          id="login-title"
        >
          Choose your demo employee
        </h1>
        <p className="mt-4">
          Sign in to open your protected recognition dashboard.
        </p>
        {showSessionNotice && (
          <div
            className="session-notice my-4 rounded-gj-sm border border-gj-info bg-gj-info-subtle p-3 text-gj-info"
            role="status"
          >
            Your protected session is no longer active. Sign in again to
            continue.
          </div>
        )}

        {users.isPending && <p role="status">Loading demo employees…</p>}
        {users.isError && (
          <div role="alert">
            <p>The service is temporarily unavailable.</p>
            <button
              type="button"
              disabled={users.isFetching}
              onClick={() => void users.refetch()}
            >
              {users.isFetching ? 'Retrying…' : 'Retry'}
            </button>
          </div>
        )}
        {users.data?.users.length === 0 && (
          <p role="status">No active demo employees are available.</p>
        )}
        {users.data && users.data.users.length > 0 && (
          <form
            className="mt-6 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (selectedEmployeeId) {
                loginMutation.mutate(selectedEmployeeId);
              }
            }}
          >
            <label htmlFor="employee">Demo employee</label>
            <select
              className="min-h-11 rounded-gj-sm border border-gj-control-border bg-gj-surface px-3 font-inherit"
              id="employee"
              value={selectedEmployeeId}
              disabled={loginMutation.isPending}
              onChange={(event) => setSelectedEmployeeId(event.target.value)}
            >
              <option value="">Select an employee</option>
              {users.data.users.map((user) => (
                <option value={user.id} key={user.id}>
                  {user.displayName} — {user.teamName ?? 'No team'}
                </option>
              ))}
            </select>
            <button
              className="min-h-11 cursor-pointer rounded-gj-sm bg-gj-primary-600 px-4 font-inherit text-white disabled:cursor-wait disabled:opacity-65"
              type="submit"
              disabled={!selectedEmployeeId || loginMutation.isPending}
            >
              {loginMutation.isPending ? 'Signing in…' : 'Continue'}
            </button>
          </form>
        )}
        {errorMessage && <div role="alert">{errorMessage}</div>}
      </section>
    </main>
  );
}

function isSessionRequiredNavigationState(
  state: unknown,
): state is { reason: 'protected-session-required' } {
  return (
    typeof state === 'object' &&
    state !== null &&
    'reason' in state &&
    state.reason === 'protected-session-required'
  );
}
