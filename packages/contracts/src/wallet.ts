import { z } from 'zod';

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

export const walletLedgerQuerySchema = z
  .object({
    cursor: z.string().min(1).max(2048).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  })
  .strict();

export const walletLedgerSourceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('kudo'),
    kudoId: z.uuid(),
    label: z.string().min(1),
  }),
  z.object({
    type: z.literal('redemption'),
    redemptionId: z.uuid(),
    label: z.string().min(1),
  }),
]);

export const walletLedgerEntrySchema = z.object({
  id: z.uuid(),
  direction: z.enum(['credit', 'debit']),
  amount: z.number().int().positive(),
  sequence: z.number().int().positive(),
  balanceAfter: z.number().int().nonnegative(),
  sourceType: z.enum(['kudo_credit', 'redemption_debit', 'seed_adjustment']),
  sourceId: z.uuid(),
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
  source: walletLedgerSourceSchema.nullable(),
});

export const walletLedgerResponseSchema = z.object({
  items: z.array(walletLedgerEntrySchema),
  nextCursor: z.string().min(1).nullable(),
});

export type GivingBudget = z.infer<typeof givingBudgetSchema>;
export type WalletOverviewResponse = z.infer<
  typeof walletOverviewResponseSchema
>;
export type WalletLedgerQuery = z.infer<typeof walletLedgerQuerySchema>;
export type WalletLedgerEntry = z.infer<typeof walletLedgerEntrySchema>;
export type WalletLedgerResponse = z.infer<typeof walletLedgerResponseSchema>;
