import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';

import { useSession } from './session/session-context.js';

export function ProtectedRoute() {
  const session = useSession();
  const location = useLocation();
  const [isRetrying, setIsRetrying] = useState(false);

  if (session.status === 'checking') {
    return <p role="status">Checking your session…</p>;
  }
  if (session.status === 'error') {
    return (
      <div role="alert">
        <p>The service is temporarily unavailable.</p>
        <button
          type="button"
          disabled={isRetrying}
          onClick={() => {
            setIsRetrying(true);
            void session.retrySession().finally(() => setIsRetrying(false));
          }}
        >
          {isRetrying ? 'Retrying…' : 'Retry'}
        </button>
      </div>
    );
  }
  if (session.status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
