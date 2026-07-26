import { z } from 'zod';

export * from './errors.js';
export * from './community.js';
export * from './identity.js';
export * from './recognition.js';
export * from './wallet.js';
export * from './rewards.js';
export * from './media.js';
export * from './notifications.js';
export * from './realtime.js';

export const dependencyHealthSchema = z.object({
  status: z.enum(['up', 'down']),
  latencyMs: z.number().nonnegative(),
});

export const healthResponseSchema = z.object({
  service: z.string().min(1),
  status: z.enum(['ok', 'not_ready']),
  timestamp: z.string().datetime(),
  dependencies: z.record(z.string(), dependencyHealthSchema).optional(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
