import { z } from 'zod';

const booleanFromString = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

export function isIanaTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

const ianaTimeZoneSchema = z
  .string()
  .min(1)
  .refine(isIanaTimeZone, 'Must be a valid IANA timezone.');

const serverEnvironmentSchema = z
  .object({
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
    SESSION_COOKIE_NAME: z
      .string()
      .regex(/^[A-Za-z0-9_.-]+$/u)
      .default('gj.sid'),
    SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
    SESSION_COOKIE_SECURE: booleanFromString.default(false),
    SESSION_TRUST_PROXY: booleanFromString.default(false),
    SESSION_REDIS_PREFIX: z.string().min(1).default('good-job:session:'),
    DEMO_ORGANIZATION_SLUG: z.string().min(1).default('amanotes-demo'),
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
    ORGANIZATION_TIMEZONE: ianaTimeZoneSchema,
    SEED_BUSINESS_MONTH: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/u)
      .default('2026-07'),
  })
  .superRefine((config, context) => {
    if (config.NODE_ENV === 'production' && !config.SESSION_COOKIE_SECURE) {
      context.addIssue({
        code: 'custom',
        path: ['SESSION_COOKIE_SECURE'],
        message: 'SESSION_COOKIE_SECURE must be true in production.',
      });
    }
  });

export type ServerConfig = z.infer<typeof serverEnvironmentSchema>;

export function parseServerConfig(
  environment: Record<string, string | undefined>,
): ServerConfig {
  return serverEnvironmentSchema.parse(environment);
}
