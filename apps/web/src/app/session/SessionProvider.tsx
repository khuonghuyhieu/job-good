import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, type PropsWithChildren } from 'react';
import type { CurrentUserResponse } from '@good-job/contracts';

import { ApiClientError } from '../../api/error-adapter.js';
import { getCurrentUser } from '../../features/auth/api.js';
import { SessionContext, type SessionState } from './session-context.js';

export const currentUserQueryKey = ['session', 'current-user'] as const;
const demoUsersQueryKey = ['auth', 'demo-users'] as const;

function isProtectedQuery(queryKey: readonly unknown[]): boolean {
  const isCurrentUser =
    queryKey.length === 2 &&
    queryKey[0] === currentUserQueryKey[0] &&
    queryKey[1] === currentUserQueryKey[1];
  const isDemoUsers =
    queryKey.length === 2 &&
    queryKey[0] === demoUsersQueryKey[0] &&
    queryKey[1] === demoUsersQueryKey[1];
  return !isCurrentUser && !isDemoUsers;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: currentUserQueryKey,
    queryFn: getCurrentUser,
    retry: false,
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const clearProtectedState = useCallback(async () => {
    queryClient.setQueryData(currentUserQueryKey, null);
    await queryClient.cancelQueries({
      predicate: (query) => isProtectedQuery(query.queryKey),
    });
    queryClient.removeQueries({
      predicate: (query) => isProtectedQuery(query.queryKey),
    });
    queryClient.getMutationCache().clear();
  }, [queryClient]);

  useEffect(() => {
    if (query.error instanceof ApiClientError && query.error.status === 401) {
      void clearProtectedState();
    }
  }, [clearProtectedState, query.error]);

  useEffect(() => {
    const handleUnauthenticated = () => {
      void clearProtectedState();
    };
    window.addEventListener('good-job:unauthenticated', handleUnauthenticated);
    return () =>
      window.removeEventListener(
        'good-job:unauthenticated',
        handleUnauthenticated,
      );
  }, [clearProtectedState]);

  const acceptLogin = useCallback(
    (currentUser: CurrentUserResponse) => {
      queryClient.setQueryData(currentUserQueryKey, currentUser);
    },
    [queryClient],
  );
  const retrySession = useCallback(async () => {
    await query.refetch();
  }, [query]);

  let state: SessionState;
  if (query.isPending) {
    state = { status: 'checking', currentUser: null };
  } else if (query.data) {
    state = { status: 'authenticated', currentUser: query.data };
  } else if (
    query.error instanceof ApiClientError &&
    query.error.status !== 401
  ) {
    state = { status: 'error', currentUser: null };
  } else {
    state = { status: 'unauthenticated', currentUser: null };
  }

  return (
    <SessionContext.Provider
      value={{ ...state, acceptLogin, clearProtectedState, retrySession }}
    >
      {children}
    </SessionContext.Provider>
  );
}
