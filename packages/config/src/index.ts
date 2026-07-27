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

const documentedProductionPlaceholders = {
  databasePassword: 'generate-a-password',
  objectStorageAccessKey: 'configure-in-secret-manager',
  objectStorageSecretKey: 'generate-and-configure-in-secret-manager',
  sessionSecret: 'generate-a-random-secret-of-at-least-32-characters',
} as const;

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
    API_MAX_JSON_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .max(1_048_576)
      .default(131_072),
    RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(10),
    RATE_LIMIT_COMMAND_MAX: z.coerce.number().int().positive().default(60),
    RATE_LIMIT_WINDOW_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .max(3600)
      .default(60),
    OBJECT_STORAGE_ENDPOINT: z.url(),
    OBJECT_STORAGE_PUBLIC_ENDPOINT: z.url().default('http://localhost:9000'),
    OBJECT_STORAGE_REGION: z.string().min(1),
    OBJECT_STORAGE_BUCKET: z.string().min(3),
    OBJECT_STORAGE_ACCESS_KEY: z.string().min(1),
    OBJECT_STORAGE_SECRET_KEY: z.string().min(8),
    OBJECT_STORAGE_FORCE_PATH_STYLE: booleanFromString.default(true),
    MEDIA_MAX_IMAGE_BYTES: z.coerce.number().int().positive(),
    MEDIA_MAX_VIDEO_BYTES: z.coerce.number().int().positive(),
    MEDIA_MAX_VIDEO_DURATION_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .max(180),
    MEDIA_UPLOAD_URL_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .max(3600)
      .default(900),
    MEDIA_WORKER_CONCURRENCY: z.coerce
      .number()
      .int()
      .positive()
      .max(8)
      .default(2),
    MEDIA_WORKER_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
    MEDIA_WORKER_BACKOFF_MS: z.coerce.number().int().positive().default(1000),
    MEDIA_PROBE_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .max(120_000)
      .default(30_000),
    OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(250),
    OUTBOX_CLAIM_LEASE_MS: z.coerce.number().int().positive().default(30_000),
    OUTBOX_RETRY_BACKOFF_MS: z.coerce.number().int().positive().default(1000),
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
    if (
      config.NODE_ENV === 'production' &&
      [
        'replace-with-at-least-32-characters',
        documentedProductionPlaceholders.sessionSecret,
      ].includes(config.SESSION_SECRET)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['SESSION_SECRET'],
        message: 'SESSION_SECRET must not use the documented placeholder.',
      });
    }
    if (
      config.NODE_ENV === 'production' &&
      [
        'local-development-only',
        documentedProductionPlaceholders.objectStorageSecretKey,
      ].includes(config.OBJECT_STORAGE_SECRET_KEY)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['OBJECT_STORAGE_SECRET_KEY'],
        message:
          'OBJECT_STORAGE_SECRET_KEY must not use the local placeholder.',
      });
    }
    if (
      config.NODE_ENV === 'production' &&
      config.OBJECT_STORAGE_ACCESS_KEY ===
        documentedProductionPlaceholders.objectStorageAccessKey
    ) {
      context.addIssue({
        code: 'custom',
        path: ['OBJECT_STORAGE_ACCESS_KEY'],
        message:
          'OBJECT_STORAGE_ACCESS_KEY must not use the documented placeholder.',
      });
    }
    if (
      config.NODE_ENV === 'production' &&
      new URL(config.DATABASE_URL).password ===
        documentedProductionPlaceholders.databasePassword
    ) {
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL must not use the documented password.',
      });
    }
    if (
      config.NODE_ENV === 'production' &&
      new URL(config.WEB_ORIGIN).protocol !== 'https:'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['WEB_ORIGIN'],
        message: 'WEB_ORIGIN must use HTTPS in production.',
      });
    }
  });

export type ServerConfig = z.infer<typeof serverEnvironmentSchema>;

export function parseServerConfig(
  environment: Record<string, string | undefined>,
): ServerConfig {
  return serverEnvironmentSchema.parse(environment);
}
