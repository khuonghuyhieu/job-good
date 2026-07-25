import { Injectable } from '@nestjs/common';
import { database, EmployeeStatus } from '@good-job/database';
import type { CurrentUserResponse } from '@good-job/contracts';

import type { AuthenticatedPrincipal } from './authenticated-principal.js';

@Injectable()
export class CurrentUserService {
  async findActivePrincipal(
    employeeId: string,
  ): Promise<AuthenticatedPrincipal | null> {
    const employee = await database.employee.findFirst({
      where: { id: employeeId, status: EmployeeStatus.active },
      include: { organization: true, team: true },
    });
    if (!employee) {
      return null;
    }

    const context: CurrentUserResponse = {
      user: {
        id: employee.id,
        email: employee.email,
        displayName: employee.displayName,
        avatarUrl: employee.avatarUrl,
        status: employee.status,
        team: employee.team
          ? { id: employee.team.id, name: employee.team.name }
          : null,
      },
      organization: {
        id: employee.organization.id,
        name: employee.organization.name,
        slug: employee.organization.slug,
        timezone: employee.organization.timezone,
      },
    };

    return {
      ...context,
      employeeId: employee.id,
      organizationId: employee.organizationId,
    };
  }
}
