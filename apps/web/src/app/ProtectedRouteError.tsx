import { useNavigate } from 'react-router-dom';

import { SystemStatePage } from '../layout/SystemStatePage.js';

export function ProtectedRouteError() {
  const navigate = useNavigate();
  return (
    <SystemStatePage
      state="error"
      title="This page could not be displayed"
      description="Your protected session is unchanged. Return to the dashboard and try again."
      actionLabel="Return to dashboard"
      onAction={() => navigate('/', { replace: true })}
    />
  );
}

export function ProtectedNotFoundPage() {
  const navigate = useNavigate();
  return (
    <SystemStatePage
      state="error"
      title="Page not found"
      description="The protected page you requested does not exist."
      actionLabel="Return to dashboard"
      onAction={() => navigate('/', { replace: true })}
    />
  );
}
