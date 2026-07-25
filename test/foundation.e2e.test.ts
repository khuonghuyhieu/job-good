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
