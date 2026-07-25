import { z } from 'zod';

export const apiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  fieldErrors: z.record(z.string(), z.string()).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
  requestId: z.string().min(1),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export const identityErrorCodes = {
  inactiveEmployee: 'EMPLOYEE_INACTIVE',
  invalidDemoUser: 'RESOURCE_NOT_FOUND',
  unauthenticated: 'UNAUTHENTICATED',
  validation: 'VALIDATION_ERROR',
} as const;
