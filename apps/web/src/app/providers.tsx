import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';

import { SessionProvider } from './session/SessionProvider.js';
import { RealtimeProvider } from './realtime/RealtimeProvider.js';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <RealtimeProvider>{children}</RealtimeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
