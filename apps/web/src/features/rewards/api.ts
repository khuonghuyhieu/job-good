import {
  redeemRewardResponseSchema,
  redemptionHistoryResponseSchema,
  rewardCatalogResponseSchema,
  rewardDetailResponseSchema,
  type RedeemRewardResponse,
  type RedemptionHistoryResponse,
  type RewardCatalogResponse,
  type RewardDetailResponse,
} from '@good-job/contracts';

import { apiRequest } from '../../api/client.js';

export const rewardsQueryKey = ['rewards'] as const;
export const rewardDetailQueryKey = (rewardId: string) =>
  [...rewardsQueryKey, rewardId] as const;
export const redemptionHistoryQueryKey = ['wallet', 'redemptions'] as const;

export async function getRewards(): Promise<RewardCatalogResponse> {
  return rewardCatalogResponseSchema.parse(await apiRequest('/rewards'));
}

export async function getRewardDetail(
  rewardId: string,
): Promise<RewardDetailResponse> {
  return rewardDetailResponseSchema.parse(
    await apiRequest(`/rewards/${rewardId}`),
  );
}

export async function redeemReward(
  rewardId: string,
  idempotencyKey: string,
): Promise<RedeemRewardResponse> {
  return redeemRewardResponseSchema.parse(
    await apiRequest(`/rewards/${rewardId}/redeem`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  );
}

export async function getRedemptionHistory(
  cursor: string | null,
  limit = 20,
): Promise<RedemptionHistoryResponse> {
  const parameters = new URLSearchParams({ limit: String(limit) });
  if (cursor) parameters.set('cursor', cursor);
  return redemptionHistoryResponseSchema.parse(
    await apiRequest(`/wallet/redemptions?${parameters.toString()}`),
  );
}
