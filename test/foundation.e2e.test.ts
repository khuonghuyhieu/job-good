import { describe, expect, it } from 'vitest';

describe('Phase 1 stack', () => {
  it('serves healthy API and Worker processes', async () => {
    const [api, worker] = await Promise.all([
      fetch('http://127.0.0.1:3000/health/ready'),
      fetch('http://127.0.0.1:3001/health/ready'),
    ]);

    expect(api.ok).toBe(true);
    expect(worker.ok).toBe(true);
    await expect(api.json()).resolves.toMatchObject({
      service: 'api',
      status: 'ok',
    });
    await expect(worker.json()).resolves.toMatchObject({
      service: 'worker',
      status: 'ok',
    });
  });

  it('serves the Phase 1 Web shell', async () => {
    const response = await fetch('http://127.0.0.1:8080/');
    const html = await response.text();

    expect(response.ok).toBe(true);
    expect(html).toContain('<title>Good Job</title>');
  });

  it('serves a healthy MinIO instance', async () => {
    const response = await fetch('http://127.0.0.1:9000/minio/health/cluster');

    expect(response.ok).toBe(true);
  });
});

describe('Phase 2 identity stack', () => {
  it('supports login, protected current user, and logout', async () => {
    const usersResponse = await fetch('http://127.0.0.1:3000/auth/demo-users');
    const users = (await usersResponse.json()) as {
      users: Array<{ id: string }>;
    };
    expect(usersResponse.ok).toBe(true);
    expect(users.users.length).toBeGreaterThan(0);

    const loginResponse = await fetch('http://127.0.0.1:3000/auth/demo-login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ employeeId: users.users[0]!.id }),
    });
    const cookie = loginResponse.headers.getSetCookie()[0]?.split(';')[0];
    expect(loginResponse.ok).toBe(true);
    expect(cookie).toBeDefined();

    const meResponse = await fetch('http://127.0.0.1:3000/me', {
      headers: { cookie: cookie! },
    });
    expect(meResponse.ok).toBe(true);
    await expect(meResponse.json()).resolves.toMatchObject({
      user: { id: users.users[0]!.id, status: 'active' },
      organization: { slug: 'amanotes-demo' },
    });

    const logoutResponse = await fetch('http://127.0.0.1:3000/auth/logout', {
      method: 'POST',
      headers: { cookie: cookie! },
    });
    expect(logoutResponse.status).toBe(204);
    expect(
      (
        await fetch('http://127.0.0.1:3000/me', {
          headers: { cookie: cookie! },
        })
      ).status,
    ).toBe(401);
  });
});
