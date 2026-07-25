import { describe, expect, it } from 'vitest';

import { parseServerConfig } from './index.js';

const validEnvironment = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'info',
  API_PORT: '3000',
  WORKER_HEALTH_PORT: '3001',
  WEB_ORIGIN: 'http://localhost:8080',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/good_job',
  REDIS_URL: 'redis://localhost:6379',
  SESSION_SECRET: 'a-development-secret-with-32-chars',
  OBJECT_STORAGE_ENDPOINT: 'http://localhost:9000',
  OBJECT_STORAGE_REGION: 'us-east-1',
  OBJECT_STORAGE_BUCKET: 'good-job-media',
  OBJECT_STORAGE_ACCESS_KEY: 'test',
  OBJECT_STORAGE_SECRET_KEY: 'test-secret',
  OBJECT_STORAGE_FORCE_PATH_STYLE: 'true',
  MEDIA_MAX_IMAGE_BYTES: '10485760',
  MEDIA_MAX_VIDEO_BYTES: '209715200',
  MEDIA_MAX_VIDEO_DURATION_SECONDS: '180',
  WEBSOCKET_PATH: '/socket.io',
  ORGANIZATION_TIMEZONE: 'Asia/Ho_Chi_Minh',
  SEED_BUSINESS_MONTH: '2026-07',
} as const;

describe('parseServerConfig', () => {
  it('returns typed and coerced values for a valid environment', () => {
    const config = parseServerConfig(validEnvironment);

    expect(config.API_PORT).toBe(3000);
    expect(config.OBJECT_STORAGE_FORCE_PATH_STYLE).toBe(true);
  });

  it('fails fast when a required variable is missing', () => {
    expect(() =>
      parseServerConfig({ ...validEnvironment, DATABASE_URL: undefined }),
    ).toThrow();
  });

  it('rejects a video duration above the product limit', () => {
    expect(() =>
      parseServerConfig({
        ...validEnvironment,
        MEDIA_MAX_VIDEO_DURATION_SECONDS: '181',
      }),
    ).toThrow();
  });

  it('rejects an invalid deterministic seed business month', () => {
    expect(() =>
      parseServerConfig({
        ...validEnvironment,
        SEED_BUSINESS_MONTH: 'July 2026',
      }),
    ).toThrow();
  });
});
