import { useMutation } from '@tanstack/react-query';
import { Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';

import { useSession } from '../app/session/session-context.js';
import { logout } from '../features/auth/api.js';
import { NotificationIndicator } from '../features/notifications/NotificationIndicator.js';
import { ErrorState } from '../shared/ui/index.js';
import { AccountMenu } from './AccountMenu.js';
import { AppLogo } from './AppLogo.js';
import { PrimaryNavigation } from './PrimaryNavigation.js';

export function AppShell() {
  const session = useSession();
  const navigate = useNavigate();
  const [showLogoutRecovery, setShowLogoutRecovery] = useState(false);
  const logoutMutation = useMutation({
    mutationFn: logout,
    onError: () => setShowLogoutRecovery(true),
    onSuccess: async () => {
      setShowLogoutRecovery(false);
      await session.clearProtectedState();
      navigate('/login', { replace: true });
    },
  });
  if (session.status !== 'authenticated') {
    return null;
  }

  return (
    <div className="gj-app-shell min-h-screen bg-gj-canvas text-gj-text">
      <a
        className="gj-skip-link fixed start-2 top-2 z-50 -translate-y-[150%] rounded-gj-sm bg-gj-brand-700 px-4 py-3 text-white focus:translate-y-0"
        href="#main-content"
      >
        Skip to main content
      </a>
      <header className="gj-shell-header sticky top-0 z-20 grid min-h-[5.75rem] grid-cols-[minmax(10rem,1fr)_auto_minmax(10rem,1fr)] items-center gap-5 border-b border-gj-border bg-white/96 px-[clamp(1.25rem,4vw,3rem)] shadow-gj-shell backdrop-blur-xl max-tablet:min-h-[5.25rem] max-tablet:grid-cols-[auto_1fr_auto] max-tablet:px-5 max-mobile:min-h-18 max-mobile:grid-cols-[1fr_auto] max-mobile:px-4">
        <AppLogo />
        <PrimaryNavigation placement="desktop" />
        <div className="gj-shell-actions flex items-center justify-end gap-3">
          <div
            className="gj-shell-account-summary grid max-w-48 justify-items-end font-gj text-gj-xs max-tablet:hidden"
            aria-hidden="true"
          >
            <strong>{session.currentUser.user.displayName}</strong>
            <span>{session.currentUser.organization.name}</span>
          </div>
          <NotificationIndicator />
          <AccountMenu
            displayName={session.currentUser.user.displayName}
            organizationName={session.currentUser.organization.name}
            avatarUrl={session.currentUser.user.avatarUrl}
            logoutPending={logoutMutation.isPending}
            onLogout={() => logoutMutation.mutate()}
          />
        </div>
      </header>
      {showLogoutRecovery && (
        <div className="gj-shell-alert mx-auto mt-3 max-w-[90rem] px-5 max-mobile:px-4 [&_.gj-feedback]:grid-cols-[1fr_auto] [&_.gj-feedback]:items-center max-mobile:[&_.gj-feedback]:grid-cols-1">
          <ErrorState
            title="Sign out failed"
            description="Your protected session is still active. Please try again."
            actionLabel="Try signing out again"
            actionPending={logoutMutation.isPending}
            onAction={() => logoutMutation.mutate()}
          />
        </div>
      )}
      <main
        className="gj-shell-main min-h-[calc(100vh-5.75rem)] p-[clamp(1.5rem,5vw,1.5rem)] max-mobile:min-h-[calc(100vh-4.5rem)] max-mobile:px-4 max-mobile:pt-5 max-mobile:pb-[calc(5.5rem+env(safe-area-inset-bottom))]"
        id="main-content"
        tabIndex={-1}
      >
        <Outlet />
      </main>
      <PrimaryNavigation placement="mobile" />
    </div>
  );
}
