import { z } from 'zod';

export const employeeStatusSchema = z.enum(['active', 'inactive']);

export const demoUserSchema = z.object({
  id: z.uuid(),
  displayName: z.string().min(1),
  email: z.email(),
  avatarUrl: z.url().nullable(),
  teamName: z.string().min(1).nullable(),
});

export const demoUsersResponseSchema = z.object({
  users: z.array(demoUserSchema),
});

export const demoLoginRequestSchema = z
  .object({
    employeeId: z.uuid(),
  })
  .strict();

export const currentUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string().min(1),
  avatarUrl: z.url().nullable(),
  status: employeeStatusSchema,
  team: z
    .object({
      id: z.uuid(),
      name: z.string().min(1),
    })
    .nullable(),
});

export const currentOrganizationSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  timezone: z.string().min(1),
});

export const currentUserResponseSchema = z.object({
  user: currentUserSchema,
  organization: currentOrganizationSchema,
});

export type DemoUser = z.infer<typeof demoUserSchema>;
export type DemoUsersResponse = z.infer<typeof demoUsersResponseSchema>;
export type DemoLoginRequest = z.infer<typeof demoLoginRequestSchema>;
export type CurrentUserResponse = z.infer<typeof currentUserResponseSchema>;
