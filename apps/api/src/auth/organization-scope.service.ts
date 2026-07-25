import { Injectable } from '@nestjs/common';

import type { AuthenticatedPrincipal } from './authenticated-principal.js';

@Injectable()
export class OrganizationScopeService {
  fromPrincipal(principal: AuthenticatedPrincipal): {
    employeeId: string;
    organizationId: string;
  } {
    return {
      employeeId: principal.employeeId,
      organizationId: principal.organizationId,
    };
  }
}
