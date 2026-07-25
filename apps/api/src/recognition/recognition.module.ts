import { Module } from '@nestjs/common';

import { CreateKudoCommand } from './application/commands/create-kudo.command.js';
import { GetGivingBudgetQuery } from './application/queries/get-giving-budget.query.js';
import { ListCoreValuesQuery } from './application/queries/list-core-values.query.js';
import { SearchColleaguesQuery } from './application/queries/search-colleagues.query.js';
import { KudosController } from './http/kudos.controller.js';
import { RecognitionQueryController } from './http/recognition-query.controller.js';
import { CreateKudoIdempotencyRepository } from './infrastructure/create-kudo-idempotency.repository.js';
import { CreateKudoRepository } from './infrastructure/create-kudo.repository.js';

@Module({
  controllers: [RecognitionQueryController, KudosController],
  providers: [
    SearchColleaguesQuery,
    ListCoreValuesQuery,
    GetGivingBudgetQuery,
    CreateKudoCommand,
    CreateKudoIdempotencyRepository,
    CreateKudoRepository,
  ],
})
export class RecognitionModule {}
