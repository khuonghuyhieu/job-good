import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import {
  redemptionHistoryQuerySchema,
  type RedemptionHistoryResponse,
} from '@good-job/contracts';

import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal.js';
import { CurrentPrincipal } from '../../auth/current-principal.decorator.js';
import { SessionAuthGuard } from '../../auth/session-auth.guard.js';
import { ApiException } from '../../http/api.exception.js';
import { RewardsService } from '../application/rewards.service.js';
import { InvalidRedemptionCursorError } from '../domain/redemption-cursor.js';

@Controller('wallet')
@UseGuards(SessionAuthGuard)
export class RedemptionHistoryController {
  constructor(
    @Inject(RewardsService)
    private readonly rewards: RewardsService,
  ) {}

  @Get('redemptions')
  async history(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() rawQuery: unknown,
  ): Promise<RedemptionHistoryResponse> {
    const parsed = redemptionHistoryQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      throw new ApiException(400, {
        code: 'VALIDATION_ERROR',
        message: 'The redemption history query is invalid.',
      });
    }
    try {
      return await this.rewards.history(principal, parsed.data);
    } catch (error: unknown) {
      if (error instanceof InvalidRedemptionCursorError) {
        throw new ApiException(400, {
          code: 'VALIDATION_ERROR',
          message: error.message,
          fieldErrors: { cursor: 'The redemption history cursor is invalid.' },
        });
      }
      throw error;
    }
  }
}
