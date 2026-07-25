import type { CurrentUserResponse } from '@good-job/contracts';

export type AuthenticatedPrincipal = CurrentUserResponse & {
  employeeId: string;
  organizationId: string;
};
