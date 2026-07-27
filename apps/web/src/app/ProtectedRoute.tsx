import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';

import { useSession } from './session/session-context.js';
import { SystemStatePage } from '../layout/SystemStatePage.js';

export function ProtectedRoute() {
  const session = useSession();
  const location = useLocation();
  const [isRetrying, setIsRetrying] = useState(false);

  if (session.status === 'checking') {
    return (
      <SystemStatePage
        state="loading"
        title="Checking your session"
        description="Preparing your protected Good Job workspace."
      />
    );
  }
  if (session.status === 'error') {
    return (
      <SystemStatePage
        state="error"
        title="Good Job is temporarily unavailable"
        description="Your protected content has not been displayed. Retry when the service is ready."
        actionLabel="Retry"
        actionPending={isRetrying}
        onAction={() => {
          setIsRetrying(true);
          void session.retrySession().finally(() => setIsRetrying(false));
        }}
      />
    );
  }
  if (session.status !== 'authenticated') {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
          reason: 'protected-session-required',
        }}
      />
    );
  }
  return <Outlet />;
}
