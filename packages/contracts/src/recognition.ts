import { z } from 'zod';

export const colleagueSearchQuerySchema = z
  .object({
    query: z.string().trim().max(100).optional().default(''),
    cursor: z.uuid().optional(),
  })
  .strict();

export const colleagueSchema = z.object({
  id: z.uuid(),
  displayName: z.string().min(1),
  avatarUrl: z.url().nullable(),
  teamName: z.string().min(1).nullable(),
});

export const colleagueSearchResponseSchema = z.object({
  items: z.array(colleagueSchema),
  nextCursor: z.uuid().nullable(),
});

export const coreValueSchema = z.object({
  id: z.uuid(),
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
});

export const coreValuesResponseSchema = z.object({
  items: z.array(coreValueSchema),
});

export const givingBudgetSchema = z.object({
  allowance: z.literal(200),
  used: z.number().int().min(0).max(200),
  remaining: z.number().int().min(0).max(200),
});

export const walletOverviewResponseSchema = z.object({
  businessMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/u),
  givingBudget: givingBudgetSchema,
  rewardBalance: z.number().int().nonnegative(),
});

export type ColleagueSearchQuery = z.infer<typeof colleagueSearchQuerySchema>;
export type ColleagueSearchResponse = z.infer<
  typeof colleagueSearchResponseSchema
>;
export type CoreValuesResponse = z.infer<typeof coreValuesResponseSchema>;
export type WalletOverviewResponse = z.infer<
  typeof walletOverviewResponseSchema
>;
