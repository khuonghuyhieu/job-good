import { Module } from '@nestjs/common';

import { CreateKudoCommand } from './application/commands/create-kudo.command.js';
import {
  CreateCommentCommand,
  DeleteCommentCommand,
  RemoveReactionCommand,
  SetReactionCommand,
} from './application/commands/community.commands.js';
import { GetFeedQuery } from './application/queries/get-feed.query.js';
import { GetKudoDetailQuery } from './application/queries/get-kudo-detail.query.js';
import { GetGivingBudgetQuery } from './application/queries/get-giving-budget.query.js';
import { ListCoreValuesQuery } from './application/queries/list-core-values.query.js';
import { SearchColleaguesQuery } from './application/queries/search-colleagues.query.js';
import { CommunityController } from './http/community.controller.js';
import { FeedController } from './http/feed.controller.js';
import { KudosController } from './http/kudos.controller.js';
import { RecognitionQueryController } from './http/recognition-query.controller.js';
import { CommunityRepository } from './infrastructure/community.repository.js';
import { CreateKudoIdempotencyRepository } from './infrastructure/create-kudo-idempotency.repository.js';
import { CreateKudoRepository } from './infrastructure/create-kudo.repository.js';
import { FeedRepository } from './infrastructure/feed.repository.js';

@Module({
  controllers: [
    RecognitionQueryController,
    KudosController,
    FeedController,
    CommunityController,
  ],
  providers: [
    SearchColleaguesQuery,
    ListCoreValuesQuery,
    GetGivingBudgetQuery,
    CreateKudoCommand,
    CreateKudoIdempotencyRepository,
    CreateKudoRepository,
    FeedRepository,
    CommunityRepository,
    GetFeedQuery,
    GetKudoDetailQuery,
    SetReactionCommand,
    RemoveReactionCommand,
    CreateCommentCommand,
    DeleteCommentCommand,
  ],
})
export class RecognitionModule {}
