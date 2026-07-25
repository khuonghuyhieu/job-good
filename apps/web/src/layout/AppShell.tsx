import { useMutation } from '@tanstack/react-query';
import { Outlet, useNavigate } from 'react-router-dom';

import { useSession } from '../app/session/session-context.js';
import { logout } from '../features/auth/api.js';

export function AppShell() {
  const session = useSession();
  const navigate = useNavigate();
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      await session.clearProtectedState();
      navigate('/login', { replace: true });
    },
  });
  if (session.status !== 'authenticated') {
    return null;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Good Job home">
          <span className="brand-mark" aria-hidden="true">
            GJ
          </span>
          <span>Good Job</span>
        </a>
        <div className="current-user">
          <span>
            {session.currentUser.user.displayName} ·{' '}
            {session.currentUser.organization.name}
          </span>
          <button
            type="button"
            disabled={logoutMutation.isPending}
            onClick={() => logoutMutation.mutate()}
          >
            {logoutMutation.isPending ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>
      {logoutMutation.isError && (
        <div role="alert">Sign out failed. Please try again.</div>
      )}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
