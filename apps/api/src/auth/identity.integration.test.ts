import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { parseServerConfig, type ServerConfig } from '@good-job/config';
import { database, EmployeeStatus } from '@good-job/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request, { type Response } from 'supertest';
import { io, type Socket } from 'socket.io-client';

import { AppModule } from '../app.module.js';
import { AuthenticatedSocketService } from './authenticated-socket.service.js';
import { SessionService } from './session/session.service.js';
import { ApiExceptionFilter } from '../http/api-exception.filter.js';
import { requestIdMiddleware } from '../request-id.middleware.js';

const activeEmployeeId = '20000000-0000-4000-8000-000000000001';
const inactiveEmployeeId = '20000000-0000-4000-8000-000000000004';
const unknownEmployeeId = '20000000-0000-4000-8000-999999999999';

function testConfig(ttlSeconds = 3600): ServerConfig {
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
    SESSION_COOKIE_NAME: 'gj.test.sid',
    SESSION_TTL_SECONDS: String(ttlSeconds),
    SESSION_COOKIE_SECURE: 'false',
    SESSION_TRUST_PROXY: 'false',
    SESSION_REDIS_PREFIX: `good-job:test-session:${ttlSeconds}:`,
    DEMO_ORGANIZATION_SLUG: 'amanotes-demo',
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

async function createApp(ttlSeconds = 3600): Promise<INestApplication> {
  const config = testConfig(ttlSeconds);
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
  app.get(AuthenticatedSocketService).attach(app.getHttpServer());
  await app.listen(0, '127.0.0.1');
  return app;
}

async function login(
  agent: ReturnType<typeof request.agent>,
  employeeId = activeEmployeeId,
): Promise<Response> {
  return agent.post('/auth/demo-login').send({ employeeId });
}

describe('Phase 2 identity', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    app = await createApp();
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists only active demo users', async () => {
    const response = await request(app.getHttpServer()).get('/auth/demo-users');

    expect(response.status).toBe(200);
    expect(response.body.users).toHaveLength(3);
    expect(
      response.body.users.some(
        (user: { id: string }) => user.id === inactiveEmployeeId,
      ),
    ).toBe(false);
  });

  it('authenticates an active employee and returns stable /me context', async () => {
    const agent = request.agent(app.getHttpServer());
    const loginResponse = await login(agent);

    expect(loginResponse.status).toBe(201);
    const firstCookie = loginResponse.headers['set-cookie']?.[0];
    expect(firstCookie).toContain('HttpOnly');
    expect(firstCookie).toContain('SameSite=Lax');
    expect(firstCookie).toContain('Path=/');
    expect(firstCookie).toContain('Expires=');

    const secondLoginResponse = await login(agent);
    const secondCookie = secondLoginResponse.headers['set-cookie']?.[0];
    expect(secondCookie).toBeDefined();
    expect(secondCookie?.split(';')[0]).not.toBe(firstCookie?.split(';')[0]);

    const response = await agent
      .get('/me')
      .set('x-employee-id', unknownEmployeeId)
      .set('x-organization-id', '90000000-0000-4000-8000-000000000001');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      user: { id: activeEmployeeId, status: 'active' },
      organization: {
        id: '10000000-0000-4000-8000-000000000001',
        slug: 'amanotes-demo',
      },
    });
  });

  it('rejects invalid, unknown and inactive employees', async () => {
    const invalid = await request(app.getHttpServer())
      .post('/auth/demo-login')
      .send({ employeeId: 'invalid', organizationId: 'forged' });
    const unknown = await request(app.getHttpServer())
      .post('/auth/demo-login')
      .send({ employeeId: unknownEmployeeId });
    const inactive = await request(app.getHttpServer())
      .post('/auth/demo-login')
      .send({ employeeId: inactiveEmployeeId });

    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe('VALIDATION_ERROR');
    expect(unknown.status).toBe(404);
    expect(unknown.body.code).toBe('RESOURCE_NOT_FOUND');
    expect(inactive.status).toBe(403);
    expect(inactive.body.code).toBe('EMPLOYEE_INACTIVE');
  });

  it('does not create a session after failed authentication', async () => {
    for (const employeeId of [unknownEmployeeId, inactiveEmployeeId]) {
      const agent = request.agent(app.getHttpServer());
      const loginResponse = await login(agent, employeeId);

      expect(loginResponse.headers['set-cookie']).toBeUndefined();
      const meResponse = await agent.get('/me');
      expect(meResponse.status).toBe(401);
      expect(meResponse.body.code).toBe('UNAUTHENTICATED');
    }
  });

  it('does not authenticate an active employee from another organization', async () => {
    const organizationId = '90000000-0000-4000-8000-000000000001';
    const employeeId = '90000000-0000-4000-8000-000000000002';
    await database.organization.create({
      data: {
        id: organizationId,
        name: 'Other tenant',
        slug: 'other-tenant-test',
        timezone: 'UTC',
        employees: {
          create: {
            id: employeeId,
            email: 'employee@other.local',
            normalizedEmail: 'employee@other.local',
            displayName: 'Other Employee',
            status: EmployeeStatus.active,
          },
        },
      },
    });

    try {
      const response = await request(app.getHttpServer())
        .post('/auth/demo-login')
        .send({ employeeId });
      expect(response.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    } finally {
      await database.employee.delete({ where: { id: employeeId } });
      await database.organization.delete({ where: { id: organizationId } });
    }
  });

  it('protects /me and invalidates the session on logout', async () => {
    const anonymous = await request(app.getHttpServer()).get('/me');
    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toMatchObject({
      code: 'UNAUTHENTICATED',
      requestId: expect.any(String),
    });

    const agent = request.agent(app.getHttpServer());
    await login(agent);
    const logout = await agent.post('/auth/logout');
    expect(logout.status).toBe(204);
    expect(logout.headers['set-cookie']?.[0]).toContain('gj.test.sid=');
    expect(logout.headers['set-cookie']?.[0]).toContain(
      'Expires=Thu, 01 Jan 1970',
    );
    expect((await agent.get('/me')).status).toBe(401);
  });

  it('rejects an extra tenant field even with a valid employee id', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/demo-login')
      .send({
        employeeId: activeEmployeeId,
        organizationId: '90000000-0000-4000-8000-000000000001',
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('revokes existing HTTP and WebSocket access when an employee becomes inactive', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/demo-login')
      .send({ employeeId: activeEmployeeId });
    const cookie = loginResponse.headers['set-cookie']?.[0]?.split(';')[0];
    expect(cookie).toBeDefined();

    await database.employee.update({
      where: { id: activeEmployeeId },
      data: { status: EmployeeStatus.inactive },
    });
    try {
      const socketError = await new Promise<string>((resolve) => {
        const socket = io(baseUrl, {
          path: '/socket.io',
          transports: ['websocket'],
          reconnection: false,
          extraHeaders: { cookie: cookie! },
        });
        socket.on('connect_error', (error) => {
          socket.close();
          resolve(error.message);
        });
      });
      expect(socketError).toBe('UNAUTHENTICATED');

      const response = await request(app.getHttpServer())
        .get('/me')
        .set('cookie', cookie!);
      expect(response.status).toBe(401);
    } finally {
      await database.employee.update({
        where: { id: activeEmployeeId },
        data: { status: EmployeeStatus.active },
      });
    }
  });

  it('uses documented error codes for framework HTTP failures', async () => {
    const response = await request(app.getHttpServer()).get('/missing-route');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
      requestId: expect.any(String),
    });
  });

  it('rejects an unauthenticated WebSocket and accepts a session cookie', async () => {
    const anonymousError = await new Promise<string>((resolve) => {
      const socket = io(baseUrl, {
        path: '/socket.io',
        transports: ['websocket'],
        reconnection: false,
      });
      socket.on('connect_error', (error) => {
        socket.close();
        resolve(error.message);
      });
    });
    expect(anonymousError).toBe('UNAUTHENTICATED');

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/demo-login')
      .send({ employeeId: activeEmployeeId });
    const cookie = loginResponse.headers['set-cookie']?.[0]?.split(';')[0];
    expect(cookie).toBeDefined();

    const socket = await new Promise<Socket>((resolve, reject) => {
      const client = io(baseUrl, {
        path: '/socket.io',
        transports: ['websocket'],
        reconnection: false,
        extraHeaders: { cookie: cookie! },
        auth: {
          employeeId: unknownEmployeeId,
          organizationId: '90000000-0000-4000-8000-000000000001',
        },
      });
      client.on('connect', () => resolve(client));
      client.on('connect_error', reject);
    });
    expect(socket.connected).toBe(true);
    socket.close();
  });
});

describe('Phase 2 session expiration', () => {
  it('rejects a session after its server-side TTL expires', async () => {
    const app = await createApp(1);
    const agent = request.agent(app.getHttpServer());
    await login(agent);
    expect((await agent.get('/me')).status).toBe(200);

    await new Promise((resolve) => setTimeout(resolve, 1_100));
    expect((await agent.get('/me')).status).toBe(401);
    await app.close();
  });

  it('rejects a WebSocket handshake after the server-side TTL expires', async () => {
    const app = await createApp(1);
    const baseUrl = await app.getUrl();
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/demo-login')
      .send({ employeeId: activeEmployeeId });
    const cookie = loginResponse.headers['set-cookie']?.[0]?.split(';')[0];
    expect(cookie).toBeDefined();

    await new Promise((resolve) => setTimeout(resolve, 1_100));
    const socketError = await new Promise<string>((resolve) => {
      const socket = io(baseUrl, {
        path: '/socket.io',
        transports: ['websocket'],
        reconnection: false,
        extraHeaders: { cookie: cookie! },
      });
      socket.on('connect_error', (error) => {
        socket.close();
        resolve(error.message);
      });
    });

    expect(socketError).toBe('UNAUTHENTICATED');
    await app.close();
  });
});
