import {
  Controller,
  Get,
  Inject,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  feedQuerySchema,
  idempotencyKeySchema,
  type FeedResponse,
  type KudoDetailResponse,
} from '@good-job/contracts';

import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal.js';
import { CurrentPrincipal } from '../../auth/current-principal.decorator.js';
import { SessionAuthGuard } from '../../auth/session-auth.guard.js';
import { ApiException } from '../../http/api.exception.js';
import { GetFeedQuery } from '../application/queries/get-feed.query.js';
import { GetKudoDetailQuery } from '../application/queries/get-kudo-detail.query.js';
import { InvalidFeedCursorError } from '../domain/feed-cursor.js';

@Controller('kudos')
@UseGuards(SessionAuthGuard)
export class FeedController {
  constructor(
    @Inject(GetFeedQuery) private readonly getFeed: GetFeedQuery,
    @Inject(GetKudoDetailQuery)
    private readonly getDetail: GetKudoDetailQuery,
  ) {}

  @Get()
  async page(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() rawQuery: unknown,
  ): Promise<FeedResponse> {
    const parsed = feedQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      throw new ApiException(400, {
        code: 'VALIDATION_ERROR',
        message: 'The Feed query is invalid.',
      });
    }
    try {
      return await this.getFeed.execute(principal, parsed.data);
    } catch (error: unknown) {
      if (error instanceof InvalidFeedCursorError) {
        throw new ApiException(400, {
          code: 'VALIDATION_ERROR',
          message: error.message,
          fieldErrors: { cursor: 'The Feed cursor is invalid.' },
        });
      }
      throw error;
    }
  }

  @Get(':id')
  detail(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') rawId: string,
  ): Promise<KudoDetailResponse> {
    const id = idempotencyKeySchema.safeParse(rawId);
    if (!id.success) {
      throw new ApiException(404, {
        code: 'RESOURCE_NOT_FOUND',
        message: 'The Kudo is unavailable.',
      });
    }
    return this.getDetail.execute(principal, id.data);
  }
}
