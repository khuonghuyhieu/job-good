import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import {
  colleagueSearchQuerySchema,
  type ColleagueSearchResponse,
  type CoreValuesResponse,
  type WalletOverviewResponse,
} from '@good-job/contracts';

import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal.js';
import { CurrentPrincipal } from '../../auth/current-principal.decorator.js';
import { SessionAuthGuard } from '../../auth/session-auth.guard.js';
import { ApiException } from '../../http/api.exception.js';
import { GetGivingBudgetQuery } from '../application/queries/get-giving-budget.query.js';
import { ListCoreValuesQuery } from '../application/queries/list-core-values.query.js';
import { SearchColleaguesQuery } from '../application/queries/search-colleagues.query.js';

@Controller()
@UseGuards(SessionAuthGuard)
export class RecognitionQueryController {
  constructor(
    @Inject(SearchColleaguesQuery)
    private readonly searchColleagues: SearchColleaguesQuery,
    @Inject(ListCoreValuesQuery)
    private readonly listCoreValues: ListCoreValuesQuery,
    @Inject(GetGivingBudgetQuery)
    private readonly getGivingBudget: GetGivingBudgetQuery,
  ) {}

  @Get('employees')
  async colleagues(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() rawQuery: unknown,
  ): Promise<ColleagueSearchResponse> {
    const parsed = colleagueSearchQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      throw new ApiException(400, {
        code: 'VALIDATION_ERROR',
        message: 'The colleague search request is invalid.',
        fieldErrors: Object.fromEntries(
          parsed.error.issues.map((issue) => [
            issue.path.join('.') || 'query',
            issue.message,
          ]),
        ),
      });
    }
    return this.searchColleagues.execute(principal, parsed.data);
  }

  @Get('core-values')
  coreValues(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<CoreValuesResponse> {
    return this.listCoreValues.execute(principal);
  }

  @Get('wallet/overview')
  walletOverview(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<WalletOverviewResponse> {
    return this.getGivingBudget.execute(principal);
  }
}
