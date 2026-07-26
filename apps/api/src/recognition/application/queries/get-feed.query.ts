import { Inject, Injectable } from '@nestjs/common';
import type { FeedQuery, FeedResponse } from '@good-job/contracts';

import type { AuthenticatedPrincipal } from '../../../auth/authenticated-principal.js';
import { FeedRepository } from '../../infrastructure/feed.repository.js';

@Injectable()
export class GetFeedQuery {
  constructor(
    @Inject(FeedRepository) private readonly repository: FeedRepository,
  ) {}

  execute(
    principal: AuthenticatedPrincipal,
    query: FeedQuery,
  ): Promise<FeedResponse> {
    return this.repository.page(principal, query);
  }
}
