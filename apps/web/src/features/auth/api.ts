import {
  currentUserResponseSchema,
  demoUsersResponseSchema,
  type CurrentUserResponse,
  type DemoUsersResponse,
} from '@good-job/contracts';

import { apiRequest } from '../../api/client.js';

export async function getDemoUsers(): Promise<DemoUsersResponse> {
  return demoUsersResponseSchema.parse(await apiRequest('/auth/demo-users'));
}

export async function login(employeeId: string): Promise<CurrentUserResponse> {
  return currentUserResponseSchema.parse(
    await apiRequest('/auth/demo-login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ employeeId }),
    }),
  );
}

export async function getCurrentUser(): Promise<CurrentUserResponse> {
  return currentUserResponseSchema.parse(await apiRequest('/me'));
}

export async function logout(): Promise<void> {
  await apiRequest<void>('/auth/logout', { method: 'POST' });
}
