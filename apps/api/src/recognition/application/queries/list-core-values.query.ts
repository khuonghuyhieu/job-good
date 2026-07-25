import { Injectable } from '@nestjs/common';
import type { CoreValuesResponse } from '@good-job/contracts';
import { database } from '@good-job/database';

import type { AuthenticatedPrincipal } from '../../../auth/authenticated-principal.js';

@Injectable()
export class ListCoreValuesQuery {
  async execute(
    principal: AuthenticatedPrincipal,
  ): Promise<CoreValuesResponse> {
    const coreValues = await database.coreValue.findMany({
      where: {
        organizationId: principal.organizationId,
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return { items: coreValues };
  }
}
