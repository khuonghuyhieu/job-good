import { createBrowserRouter } from 'react-router-dom';

import { AppShell } from '../layout/AppShell.js';
import { DashboardPage } from '../pages/DashboardPage.js';
import { KudoFocusPage } from '../pages/KudoFocusPage.js';
import { LoginPage } from '../pages/LoginPage.js';
import { RewardDetailPage } from '../pages/RewardDetailPage.js';
import { RewardsPage } from '../pages/RewardsPage.js';
import { WalletPage } from '../pages/WalletPage.js';
import { ProtectedRoute } from './ProtectedRoute.js';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'kudos/:kudoId', element: <KudoFocusPage /> },
          { path: 'wallet', element: <WalletPage /> },
          { path: 'rewards', element: <RewardsPage /> },
          { path: 'rewards/:rewardId', element: <RewardDetailPage /> },
        ],
      },
    ],
  },
]);
