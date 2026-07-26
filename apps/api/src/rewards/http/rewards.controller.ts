import {
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  idempotencyKeySchema,
  type RedeemRewardResponse,
  type RewardCatalogResponse,
  type RewardDetailResponse,
} from '@good-job/contracts';

import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal.js';
import { CurrentPrincipal } from '../../auth/current-principal.decorator.js';
import { SessionAuthGuard } from '../../auth/session-auth.guard.js';
import { ApiException } from '../../http/api.exception.js';
import { RewardsService } from '../application/rewards.service.js';

const rewardIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

@Controller('rewards')
@UseGuards(SessionAuthGuard)
export class RewardsController {
  constructor(
    @Inject(RewardsService)
    private readonly rewards: RewardsService,
  ) {}

  @Get()
  catalog(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<RewardCatalogResponse> {
    return this.rewards.catalog(principal);
  }

  @Get(':rewardId')
  detail(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('rewardId') rawRewardId: string,
  ): Promise<RewardDetailResponse> {
    return this.rewards.detail(principal, this.parseRewardId(rawRewardId));
  }

  @Post(':rewardId/redeem')
  redeem(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('rewardId') rawRewardId: string,
    @Headers('idempotency-key') rawIdempotencyKey: string | undefined,
  ): Promise<RedeemRewardResponse> {
    const idempotencyKey = idempotencyKeySchema.safeParse(rawIdempotencyKey);
    if (!idempotencyKey.success) {
      throw new ApiException(400, {
        code: 'VALIDATION_ERROR',
        message: 'A valid Idempotency-Key header is required.',
        fieldErrors: { idempotencyKey: 'Idempotency-Key must be a UUID.' },
      });
    }
    return this.rewards.redeem(
      principal,
      this.parseRewardId(rawRewardId),
      idempotencyKey.data,
    );
  }

  private parseRewardId(value: string): string {
    if (!rewardIdPattern.test(value)) {
      throw new ApiException(400, {
        code: 'VALIDATION_ERROR',
        message: 'The reward identifier is invalid.',
        fieldErrors: { rewardId: 'Reward ID must be a UUID.' },
      });
    }
    return value;
  }
}
