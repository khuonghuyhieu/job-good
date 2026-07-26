import { randomUUID } from 'node:crypto';

import type { INestApplication, NestInterceptor } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { parseServerConfig, type ServerConfig } from '@good-job/config';
import { database, EmployeeStatus } from '@good-job/database';
import request from 'supertest';

import { AppModule } from '../../app.module.js';
import { SessionService } from '../../auth/session/session.service.js';
import { ApiExceptionFilter } from '../../http/api-exception.filter.js';
import { requestIdMiddleware } from '../../request-id.middleware.js';

export type RecognitionTestIds = {
  organizationId: string;
  senderId: string;
  poorSenderId: string;
  receiverId: string;
  inactiveReceiverId: string;
  coreValueId: string;
  inactiveCoreValueId: string;
  foreignReceiverId: string;
  foreignCoreValueId: string;
};

function configFor(slug: string): ServerConfig {
  return parseServerConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    API_PORT: '3000',
    WORKER_HEALTH_PORT: '3001',
    WEB_ORIGIN: 'http://localhost:8080',
    DATABASE_URL:
      process.env['DATABASE_URL'] ??
      'postgresql://good_job:local-development-only@localhost:5432/good_job',
    REDIS_URL: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
    SESSION_SECRET: 'test-session-secret-at-least-32-characters',
    SESSION_COOKIE_NAME: `gj.${slug}.sid`,
    SESSION_TTL_SECONDS: '3600',
    SESSION_COOKIE_SECURE: 'false',
    SESSION_TRUST_PROXY: 'false',
    SESSION_REDIS_PREFIX: `good-job:${slug}:`,
    DEMO_ORGANIZATION_SLUG: slug,
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
}

export async function createRecognitionTestFixture(
  label: string,
  options: { interceptors?: NestInterceptor[] } = {},
): Promise<{
  app: INestApplication;
  ids: RecognitionTestIds;
  login: (employeeId?: string) => Promise<ReturnType<typeof request.agent>>;
}> {
  const slug = `${label}-${randomUUID()}`;
  const ids: RecognitionTestIds = {
    organizationId: randomUUID(),
    senderId: randomUUID(),
    poorSenderId: randomUUID(),
    receiverId: randomUUID(),
    inactiveReceiverId: randomUUID(),
    coreValueId: randomUUID(),
    inactiveCoreValueId: randomUUID(),
    foreignReceiverId: randomUUID(),
    foreignCoreValueId: randomUUID(),
  };
  const foreignOrganizationId = randomUUID();

  await database.organization.create({
    data: {
      id: ids.organizationId,
      name: `${label} organization`,
      slug,
      timezone: 'Asia/Ho_Chi_Minh',
      employees: {
        create: [
          {
            id: ids.senderId,
            email: `sender@${slug}.local`,
            normalizedEmail: `sender@${slug}.local`,
            displayName: 'Group B Sender',
            status: EmployeeStatus.active,
            rewardPointAccount: { create: { currentBalance: 0 } },
          },
          {
            id: ids.poorSenderId,
            email: `poor-sender@${slug}.local`,
            normalizedEmail: `poor-sender@${slug}.local`,
            displayName: 'Group B Limited Sender',
            status: EmployeeStatus.active,
            rewardPointAccount: { create: { currentBalance: 0 } },
          },
          {
            id: ids.receiverId,
            email: `receiver@${slug}.local`,
            normalizedEmail: `receiver@${slug}.local`,
            displayName: 'Group B Receiver',
            status: EmployeeStatus.active,
          },
          {
            id: ids.inactiveReceiverId,
            email: `inactive@${slug}.local`,
            normalizedEmail: `inactive@${slug}.local`,
            displayName: 'Group B Inactive Receiver',
            status: EmployeeStatus.inactive,
            rewardPointAccount: { create: { currentBalance: 0 } },
          },
        ],
      },
      coreValues: {
        create: [
          {
            id: ids.coreValueId,
            code: 'group-b-active',
            name: 'Group B Active Value',
            isActive: true,
          },
          {
            id: ids.inactiveCoreValueId,
            code: 'group-b-inactive',
            name: 'Group B Inactive Value',
            isActive: false,
          },
        ],
      },
    },
  });
  await database.organization.create({
    data: {
      id: foreignOrganizationId,
      name: `${label} foreign organization`,
      slug: `${slug}-foreign`,
      timezone: 'UTC',
      employees: {
        create: {
          id: ids.foreignReceiverId,
          email: `receiver@${slug}-foreign.local`,
          normalizedEmail: `receiver@${slug}-foreign.local`,
          displayName: 'Foreign Receiver',
          status: EmployeeStatus.active,
          rewardPointAccount: { create: { currentBalance: 0 } },
        },
      },
      coreValues: {
        create: {
          id: ids.foreignCoreValueId,
          code: 'foreign-value',
          name: 'Foreign Value',
          isActive: true,
        },
      },
    },
  });

  const config = configFor(slug);
  const app = await NestFactory.create(AppModule.register(config), {
    logger: false,
  });
  app.use(requestIdMiddleware);
  app.use(app.get(SessionService).middleware);
  app
    .getHttpAdapter()
    .getInstance()
    .set('sessionCookieName', config.SESSION_COOKIE_NAME);
  app.useGlobalFilters(new ApiExceptionFilter());
  if (options.interceptors?.length) {
    app.useGlobalInterceptors(...options.interceptors);
  }
  await app.init();

  return {
    app,
    ids,
    login: async (employeeId = ids.senderId) => {
      const agent = request.agent(app.getHttpServer());
      const response = await agent
        .post('/auth/demo-login')
        .send({ employeeId });
      if (response.status !== 201) {
        throw new Error(`Test login failed with HTTP ${response.status}.`);
      }
      return agent;
    },
  };
}
