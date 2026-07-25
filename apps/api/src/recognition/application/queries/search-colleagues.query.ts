import { Injectable } from '@nestjs/common';
import type {
  ColleagueSearchQuery,
  ColleagueSearchResponse,
} from '@good-job/contracts';
import { database, EmployeeStatus } from '@good-job/database';

import type { AuthenticatedPrincipal } from '../../../auth/authenticated-principal.js';

const pageSize = 20;

@Injectable()
export class SearchColleaguesQuery {
  async execute(
    principal: AuthenticatedPrincipal,
    input: ColleagueSearchQuery,
  ): Promise<ColleagueSearchResponse> {
    const employees = await database.employee.findMany({
      where: {
        organizationId: principal.organizationId,
        status: EmployeeStatus.active,
        id: { not: principal.employeeId },
        ...(input.query
          ? {
              displayName: {
                contains: input.query,
                mode: 'insensitive' as const,
              },
            }
          : {}),
      },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        team: { select: { name: true } },
      },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      take: pageSize + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });

    const hasNextPage = employees.length > pageSize;
    const page = hasNextPage ? employees.slice(0, pageSize) : employees;
    return {
      items: page.map((employee) => ({
        id: employee.id,
        displayName: employee.displayName,
        avatarUrl: employee.avatarUrl,
        teamName: employee.team?.name ?? null,
      })),
      nextCursor: hasNextPage ? (page.at(-1)?.id ?? null) : null,
    };
  }
}
