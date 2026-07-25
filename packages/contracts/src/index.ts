import { z } from 'zod';

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

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
