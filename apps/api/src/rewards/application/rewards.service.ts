import { Inject, Injectable } from '@nestjs/common';
import type {
  RedeemRewardResponse,
  RedemptionHistoryQuery,
  RedemptionHistoryResponse,
  RewardCatalogResponse,
  RewardDetailResponse,
} from '@good-job/contracts';

import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal.js';
import { ApiException } from '../../http/api.exception.js';
import { RewardRuleError } from '../domain/reward-rule.error.js';
import { RewardsRepository } from '../infrastructure/rewards.repository.js';

@Injectable()
export class RewardsService {
  constructor(
    @Inject(RewardsRepository)
    private readonly repository: RewardsRepository,
  ) {}

  catalog(principal: AuthenticatedPrincipal): Promise<RewardCatalogResponse> {
    return this.repository.catalog(principal);
  }

  detail(
    principal: AuthenticatedPrincipal,
    rewardId: string,
  ): Promise<RewardDetailResponse> {
    return this.mapRules(() => this.repository.detail(principal, rewardId));
  }

  redeem(
    principal: AuthenticatedPrincipal,
    rewardId: string,
    idempotencyKey: string,
  ): Promise<RedeemRewardResponse> {
    return this.mapRules(() =>
      this.repository.redeemAtomic(principal, rewardId, idempotencyKey),
    );
  }

  history(
    principal: AuthenticatedPrincipal,
    query: RedemptionHistoryQuery,
  ): Promise<RedemptionHistoryResponse> {
    return this.repository.history(principal, query);
  }

  private async mapRules<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof RewardRuleError) {
        throw new ApiException(error.status, {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        });
      }
      throw error;
    }
  }
}
