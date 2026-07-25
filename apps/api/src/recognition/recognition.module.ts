import { Module } from '@nestjs/common';

import { GetGivingBudgetQuery } from './application/queries/get-giving-budget.query.js';
import { ListCoreValuesQuery } from './application/queries/list-core-values.query.js';
import { SearchColleaguesQuery } from './application/queries/search-colleagues.query.js';
import { RecognitionQueryController } from './http/recognition-query.controller.js';

@Module({
  controllers: [RecognitionQueryController],
  providers: [SearchColleaguesQuery, ListCoreValuesQuery, GetGivingBudgetQuery],
})
export class RecognitionModule {}
