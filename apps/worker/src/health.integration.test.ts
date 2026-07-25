import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import { parseServerConfig } from '@good-job/config';

import { AppModule } from './app.module.js';

describe('Worker health endpoints', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const config = parseServerConfig({
      NODE_ENV: 'test',
      LOG_LEVEL: 'error',
      API_PORT: '3000',
      WORKER_HEALTH_PORT: '3001',
      WEB_ORIGIN: 'http://localhost:8080',
      DATABASE_URL:
        'postgresql://good_job:local-development-only@localhost:5432/good_job',
      REDIS_URL: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
      SESSION_SECRET: 'test-session-secret-at-least-32-characters',
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
    });
    app = await NestFactory.create(AppModule.register(config), {
      logger: false,
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports process liveness', async () => {
    const response = await request(app.getHttpServer()).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ service: 'worker', status: 'ok' });
  });

  it('reports queue connectivity', async () => {
    const response = await request(app.getHttpServer()).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      service: 'worker',
      status: 'ok',
      dependencies: { queue: { status: 'up' } },
    });
  });
});
