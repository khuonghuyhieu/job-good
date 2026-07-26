import { z } from 'zod';

export const rewardSummarySchema = z.object({
  id: z.uuid(),
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  costPoints: z.number().int().positive(),
  imageUrl: z.url().nullable(),
});

export const rewardCatalogResponseSchema = z.object({
  items: z.array(rewardSummarySchema),
});

export const rewardEligibilitySchema = z.object({
  currentBalance: z.number().int().nonnegative(),
  eligible: z.boolean(),
  reason: z.enum(['eligible', 'insufficient_points']),
});

export const rewardDetailResponseSchema = rewardSummarySchema.extend({
  eligibility: rewardEligibilitySchema,
});

export const committedRedemptionSchema = z.object({
  id: z.uuid(),
  rewardId: z.uuid(),
  rewardName: z.string().min(1),
  costPoints: z.number().int().positive(),
  status: z.literal('committed'),
  committedAt: z.string().datetime(),
});

export const redeemRewardResponseSchema = z.object({
  redemption: committedRedemptionSchema,
  ledgerEntryId: z.uuid(),
  sequence: z.number().int().positive(),
  balanceAfter: z.number().int().nonnegative(),
});

export const redemptionHistoryQuerySchema = z
  .object({
    cursor: z.string().min(1).max(2048).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  })
  .strict();

export const redemptionHistoryEntrySchema = committedRedemptionSchema.extend({
  ledgerEntryId: z.uuid(),
  sequence: z.number().int().positive(),
  balanceAfter: z.number().int().nonnegative(),
});

export const redemptionHistoryResponseSchema = z.object({
  items: z.array(redemptionHistoryEntrySchema),
  nextCursor: z.string().min(1).nullable(),
});

export type RewardSummary = z.infer<typeof rewardSummarySchema>;
export type RewardCatalogResponse = z.infer<typeof rewardCatalogResponseSchema>;
export type RewardDetailResponse = z.infer<typeof rewardDetailResponseSchema>;
export type RedeemRewardResponse = z.infer<typeof redeemRewardResponseSchema>;
export type RedemptionHistoryQuery = z.infer<
  typeof redemptionHistoryQuerySchema
>;
export type RedemptionHistoryEntry = z.infer<
  typeof redemptionHistoryEntrySchema
>;
export type RedemptionHistoryResponse = z.infer<
  typeof redemptionHistoryResponseSchema
>;
