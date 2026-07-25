import { createContext, useContext } from 'react';
import type { CurrentUserResponse } from '@good-job/contracts';

export type SessionState =
  | { status: 'checking'; currentUser: null }
  | { status: 'authenticated'; currentUser: CurrentUserResponse }
  | { status: 'unauthenticated'; currentUser: null }
  | { status: 'error'; currentUser: null };

export type SessionContextValue = SessionState & {
  acceptLogin: (currentUser: CurrentUserResponse) => void;
  clearProtectedState: () => Promise<void>;
  retrySession: () => Promise<void>;
};

export const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession must be used within SessionProvider.');
  }
  return value;
}
