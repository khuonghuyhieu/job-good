import { z } from 'zod';

const booleanFromString = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

const serverEnvironmentSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  WORKER_HEALTH_PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.url(),
  DATABASE_URL: z.string().startsWith('postgresql://'),
  REDIS_URL: z.string().startsWith('redis://'),
  SESSION_SECRET: z.string().min(32),
  OBJECT_STORAGE_ENDPOINT: z.url(),
  OBJECT_STORAGE_REGION: z.string().min(1),
  OBJECT_STORAGE_BUCKET: z.string().min(3),
  OBJECT_STORAGE_ACCESS_KEY: z.string().min(1),
  OBJECT_STORAGE_SECRET_KEY: z.string().min(8),
  OBJECT_STORAGE_FORCE_PATH_STYLE: booleanFromString.default(true),
  MEDIA_MAX_IMAGE_BYTES: z.coerce.number().int().positive(),
  MEDIA_MAX_VIDEO_BYTES: z.coerce.number().int().positive(),
  MEDIA_MAX_VIDEO_DURATION_SECONDS: z.coerce.number().int().max(180),
  WEBSOCKET_PATH: z.string().startsWith('/'),
  ORGANIZATION_TIMEZONE: z.string().min(1),
  SEED_BUSINESS_MONTH: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/u)
    .default('2026-07'),
});

export type ServerConfig = z.infer<typeof serverEnvironmentSchema>;

export function parseServerConfig(
  environment: Record<string, string | undefined>,
): ServerConfig {
  return serverEnvironmentSchema.parse(environment);
}
