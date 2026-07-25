import { useMutation, useQuery } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router-dom';
import { useState } from 'react';

import { ApiClientError } from '../api/error-adapter.js';
import { useSession } from '../app/session/session-context.js';
import { getDemoUsers, login } from '../features/auth/api.js';

export function LoginPage() {
  const session = useSession();
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
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <p className="eyebrow">Good Job</p>
        <h1 id="login-title">Choose your demo employee</h1>
        <p>Sign in to open your protected recognition dashboard.</p>

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
            onSubmit={(event) => {
              event.preventDefault();
              if (selectedEmployeeId) {
                loginMutation.mutate(selectedEmployeeId);
              }
            }}
          >
            <label htmlFor="employee">Demo employee</label>
            <select
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
