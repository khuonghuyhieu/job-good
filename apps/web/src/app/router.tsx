import { createBrowserRouter } from 'react-router-dom';

import { AppShell } from '../layout/AppShell.js';
import { DashboardPage } from '../pages/DashboardPage.js';
import { LoginPage } from '../pages/LoginPage.js';
import { ProtectedRoute } from './ProtectedRoute.js';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <AppShell />,
        children: [{ index: true, element: <DashboardPage /> }],
      },
    ],
  },
]);
