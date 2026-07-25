import { createBrowserRouter } from 'react-router-dom';

import { AppShell } from '../layout/AppShell.js';
import { FoundationPage } from '../pages/FoundationPage.js';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [{ index: true, element: <FoundationPage /> }],
  },
]);
