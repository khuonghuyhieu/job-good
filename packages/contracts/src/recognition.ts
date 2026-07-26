import { z } from 'zod';

import { givingBudgetSchema } from './wallet.js';

export {
  givingBudgetSchema,
  walletOverviewResponseSchema,
  type WalletOverviewResponse,
} from './wallet.js';

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

export const createKudoRequestSchema = z
  .object({
    receiverId: z.uuid(),
    points: z.number().int(),
    coreValueId: z.uuid(),
    description: z.string(),
    attachmentIds: z.array(z.uuid()).max(5).optional(),
  })
  .strict();

export const idempotencyKeySchema = z.uuid();

export const committedKudoSchema = z.object({
  id: z.uuid(),
  senderId: z.uuid(),
  receiverId: z.uuid(),
  coreValueId: z.uuid(),
  points: z.number().int().min(10).max(50),
  description: z.string().min(1),
  status: z.literal('committed'),
  committedAt: z.string().datetime(),
  attachments: z.array(
    z.object({
      id: z.uuid(),
      mediaType: z.enum(['image', 'video']),
      status: z.enum(['uploading', 'processing', 'ready', 'failed']),
    }),
  ),
});

export const createKudoResponseSchema = z.object({
  kudo: committedKudoSchema,
  businessMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/u),
  givingBudget: givingBudgetSchema,
  receiverCredit: z.object({
    amount: z.number().int().min(10).max(50),
    balanceAfter: z.number().int().nonnegative(),
  }),
});

export type ColleagueSearchQuery = z.infer<typeof colleagueSearchQuerySchema>;
export type ColleagueSearchResponse = z.infer<
  typeof colleagueSearchResponseSchema
>;
export type CoreValuesResponse = z.infer<typeof coreValuesResponseSchema>;
export type CreateKudoRequest = z.infer<typeof createKudoRequestSchema>;
export type CreateKudoResponse = z.infer<typeof createKudoResponseSchema>;
