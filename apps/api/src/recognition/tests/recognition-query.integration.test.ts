import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { parseServerConfig, type ServerConfig } from '@good-job/config';
import { database, EmployeeStatus } from '@good-job/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import { AppModule } from '../../app.module.js';
import { CurrentUserService } from '../../auth/current-user.service.js';
import { SessionService } from '../../auth/session/session.service.js';
import { ApiExceptionFilter } from '../../http/api-exception.filter.js';
import { requestIdMiddleware } from '../../request-id.middleware.js';
import { GetGivingBudgetQuery } from '../application/queries/get-giving-budget.query.js';
import { SearchColleaguesQuery } from '../application/queries/search-colleagues.query.js';
import { resolveBusinessMonth } from '../domain/business-month.js';

const organizationId = '10000000-0000-4000-8000-000000000001';
const currentEmployeeId = '20000000-0000-4000-8000-000000000001';
const secondEmployeeId = '20000000-0000-4000-8000-000000000002';
const employeeWithoutBudgetId = '20000000-0000-4000-8000-000000000003';
const inactiveEmployeeId = '20000000-0000-4000-8000-000000000004';
const inactiveCoreValueId = '31000000-0000-4000-8000-000000000001';
const otherOrganizationId = '91000000-0000-4000-8000-000000000001';
const otherEmployeeId = '91000000-0000-4000-8000-000000000002';
const otherCoreValueId = '91000000-0000-4000-8000-000000000003';
const pagedInactiveEmployeeId = '92000000-0000-4000-8000-000000000099';

function testConfig(): ServerConfig {
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
    SESSION_COOKIE_NAME: 'gj.recognition.test.sid',
    SESSION_TTL_SECONDS: '3600',
    SESSION_COOKIE_SECURE: 'false',
    SESSION_TRUST_PROXY: 'false',
    SESSION_REDIS_PREFIX: 'good-job:recognition-query-test:',
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

async function createApp(): Promise<INestApplication> {
  const config = testConfig();
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
  await app.init();
  return app;
}

function previousMonth(businessMonth: string): string {
  const [year, month] = businessMonth.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    '0',
  )}`;
}

describe('Phase 3 Group A recognition queries', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();

    await database.organization.create({
      data: {
        id: otherOrganizationId,
        name: 'Other Group A tenant',
        slug: 'other-group-a-tenant',
        timezone: 'UTC',
        employees: {
          create: {
            id: otherEmployeeId,
            email: 'group-a@other.local',
            normalizedEmail: 'group-a@other.local',
            displayName: 'Other Tenant Colleague',
            status: EmployeeStatus.active,
          },
        },
        coreValues: {
          create: {
            id: otherCoreValueId,
            code: 'other-value',
            name: 'Other Tenant Value',
            isActive: true,
          },
        },
      },
    });
    await database.coreValue.create({
      data: {
        id: inactiveCoreValueId,
        organizationId,
        code: 'inactive-group-a-value',
        name: 'Inactive Group A Value',
        isActive: false,
      },
    });
  });

  afterAll(async () => {
    await database.monthlyGivingBudget.deleteMany({
      where: { employeeId: employeeWithoutBudgetId },
    });
    await database.coreValue.deleteMany({
      where: { id: { in: [inactiveCoreValueId, otherCoreValueId] } },
    });
    await database.employee.deleteMany({
      where: { organizationId: otherOrganizationId },
    });
    await database.organization.deleteMany({
      where: { id: otherOrganizationId },
    });
    await app.close();
  });

  async function authenticatedAgent(
    employeeId = currentEmployeeId,
  ): Promise<ReturnType<typeof request.agent>> {
    const agent = request.agent(app.getHttpServer());
    const response = await agent.post('/auth/demo-login').send({ employeeId });
    expect(response.status).toBe(201);
    return agent;
  }

  it('protects every Group A query with the session guard', async () => {
    for (const path of ['/employees', '/core-values', '/wallet/overview']) {
      const response = await request(app.getHttpServer()).get(path);
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHENTICATED',
        requestId: expect.any(String),
      });
    }
  });

  it('discovers only active same-organization colleagues and excludes self', async () => {
    const agent = await authenticatedAgent();
    const response = await agent.get('/employees');

    expect(response.status).toBe(200);
    const ids = (response.body.items as Array<{ id: string }>).map(
      (employee) => employee.id,
    );
    expect(ids).toContain(secondEmployeeId);
    expect(ids).not.toContain(currentEmployeeId);
    expect(ids).not.toContain(inactiveEmployeeId);
    expect(ids).not.toContain(otherEmployeeId);
    expect(response.body.nextCursor).toBeNull();
  });

  it('supports case-insensitive colleague search and strict query validation', async () => {
    const agent = await authenticatedAgent();
    const found = await agent.get('/employees').query({ query: 'bINh' });
    const forged = await agent
      .get('/employees')
      .query({ organizationId: otherOrganizationId });

    expect(found.status).toBe(200);
    expect(found.body.items).toEqual([
      expect.objectContaining({
        id: secondEmployeeId,
        displayName: 'Binh Tran',
      }),
    ]);
    expect(forged.status).toBe(400);
    expect(forged.body.code).toBe('VALIDATION_ERROR');
  });

  it('paginates colleague discovery without duplicates, self, or inactive employees', async () => {
    const employees = Array.from({ length: 22 }, (_, index) => ({
      id: `92000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      organizationId: otherOrganizationId,
      email: `paged-${index + 1}@other.local`,
      normalizedEmail: `paged-${index + 1}@other.local`,
      displayName: `Paged Colleague ${String(index % 3).padStart(2, '0')}`,
      status: EmployeeStatus.active,
    }));
    await database.employee.createMany({
      data: [
        ...employees,
        {
          id: pagedInactiveEmployeeId,
          organizationId: otherOrganizationId,
          email: 'paged-inactive@other.local',
          normalizedEmail: 'paged-inactive@other.local',
          displayName: 'Paged Colleague 00',
          status: EmployeeStatus.inactive,
        },
      ],
    });

    try {
      const principal = await app
        .get(CurrentUserService)
        .findActivePrincipal(otherEmployeeId);
      expect(principal).not.toBeNull();
      const search = app.get(SearchColleaguesQuery);
      const firstPage = await search.execute(principal!, {
        query: 'paged colleague',
      });
      expect(firstPage.items).toHaveLength(20);
      expect(firstPage.nextCursor).not.toBeNull();

      const secondPage = await search.execute(principal!, {
        query: 'paged colleague',
        cursor: firstPage.nextCursor!,
      });
      const ids = [...firstPage.items, ...secondPage.items].map(
        (employee) => employee.id,
      );
      expect(secondPage.items).toHaveLength(2);
      expect(secondPage.nextCursor).toBeNull();
      expect(new Set(ids).size).toBe(22);
      expect(ids).not.toContain(otherEmployeeId);
      expect(ids).not.toContain(pagedInactiveEmployeeId);
    } finally {
      await database.employee.deleteMany({
        where: { id: { in: employees.map((employee) => employee.id) } },
      });
      await database.employee.deleteMany({
        where: { id: pagedInactiveEmployeeId },
      });
    }
  });

  it('returns only active Core Values from the session organization', async () => {
    const agent = await authenticatedAgent();
    const response = await agent.get('/core-values');

    expect(response.status).toBe(200);
    const ids = (response.body.items as Array<{ id: string }>).map(
      (coreValue) => coreValue.id,
    );
    expect(ids).not.toContain(inactiveCoreValueId);
    expect(ids).not.toContain(otherCoreValueId);
    expect(ids).toHaveLength(3);
  });

  it('creates one 200-point employee-month budget without rolling usage over', async () => {
    const organization = await database.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { timezone: true },
    });
    const currentMonth = resolveBusinessMonth(organization.timezone);
    const oldMonth = previousMonth(currentMonth);
    await database.monthlyGivingBudget.deleteMany({
      where: { employeeId: employeeWithoutBudgetId },
    });
    await database.monthlyGivingBudget.create({
      data: {
        employeeId: employeeWithoutBudgetId,
        businessMonth: oldMonth,
        allowancePoints: 200,
        usedPoints: 190,
      },
    });

    const agent = await authenticatedAgent(employeeWithoutBudgetId);
    const responses = await Promise.all(
      Array.from({ length: 4 }, () => agent.get('/wallet/overview')),
    );

    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        businessMonth: currentMonth,
        givingBudget: { allowance: 200, used: 0, remaining: 200 },
      });
    }
    expect(
      await database.monthlyGivingBudget.count({
        where: {
          employeeId: employeeWithoutBudgetId,
          businessMonth: currentMonth,
        },
      }),
    ).toBe(1);
  });

  it('applies the organization timezone at an application month boundary', async () => {
    const principal = await app
      .get(CurrentUserService)
      .findActivePrincipal(employeeWithoutBudgetId);
    expect(principal).not.toBeNull();
    const response = await app
      .get(GetGivingBudgetQuery)
      .execute(principal!, new Date('2026-07-31T18:00:00.000Z'));

    expect(response).toMatchObject({
      businessMonth: '2026-08',
      givingBudget: { allowance: 200, used: 0, remaining: 200 },
    });
    expect(
      await database.monthlyGivingBudget.count({
        where: {
          employeeId: employeeWithoutBudgetId,
          businessMonth: '2026-08',
        },
      }),
    ).toBe(1);
  });
});
