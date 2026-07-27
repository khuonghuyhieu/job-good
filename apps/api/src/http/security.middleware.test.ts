import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { parseServerConfig } from '@good-job/config';

import { requestIdMiddleware } from '../request-id.middleware.js';
import { rateLimitMiddleware } from './rate-limit.middleware.js';
import {
  csrfOriginMiddleware,
  requestBoundaryErrorMiddleware,
  securityHeadersMiddleware,
} from './security.middleware.js';

const config = parseServerConfig({
  NODE_ENV: 'test',
  WEB_ORIGIN: 'http://localhost:8080',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/good_job',
  REDIS_URL: 'redis://localhost:6379',
  SESSION_SECRET: 'test-session-secret-at-least-32-characters',
  OBJECT_STORAGE_ENDPOINT: 'http://localhost:9000',
  OBJECT_STORAGE_REGION: 'us-east-1',
  OBJECT_STORAGE_BUCKET: 'good-job-media',
  OBJECT_STORAGE_ACCESS_KEY: 'test',
  OBJECT_STORAGE_SECRET_KEY: 'test-secret',
  MEDIA_MAX_IMAGE_BYTES: '10485760',
  MEDIA_MAX_VIDEO_BYTES: '209715200',
  MEDIA_MAX_VIDEO_DURATION_SECONDS: '180',
  WEBSOCKET_PATH: '/socket.io',
  ORGANIZATION_TIMEZONE: 'Asia/Ho_Chi_Minh',
});

function responseStub() {
  return { setHeader: vi.fn() } as unknown as Response;
}

describe('HTTP boundary hardening', () => {
  it('replaces unsafe request identifiers and keeps bounded identifiers', () => {
    const next = vi.fn();
    const unsafeRequest = {
      header: () => 'unsafe request id with spaces',
    } as unknown as Request;
    requestIdMiddleware(unsafeRequest, responseStub(), next);
    expect(unsafeRequest.requestId).toMatch(/^[0-9a-f-]{36}$/u);

    const safeRequest = {
      header: () => 'gateway:request-123',
    } as unknown as Request;
    requestIdMiddleware(safeRequest, responseStub(), next);
    expect(safeRequest.requestId).toBe('gateway:request-123');
  });

  it('sets defensive response headers', () => {
    const response = responseStub();
    securityHeadersMiddleware({} as Request, response, vi.fn());
    expect(response.setHeader).toHaveBeenCalledWith(
      'x-content-type-options',
      'nosniff',
    );
    expect(response.setHeader).toHaveBeenCalledWith('x-frame-options', 'DENY');
  });

  it('maps body-parser size failures to the shared error boundary', () => {
    const json = vi.fn();
    const response = {
      status: vi.fn().mockReturnValue({ json }),
    } as unknown as Response;
    requestBoundaryErrorMiddleware(
      { status: 413 },
      { requestId: 'request-123' } as Request,
      response,
      vi.fn(),
    );
    expect(json).toHaveBeenCalledWith({
      code: 'REQUEST_TOO_LARGE',
      message: 'The request body exceeds the configured limit.',
      requestId: 'request-123',
    });
  });

  it('rejects unsafe cross-origin browser commands', () => {
    const next = vi.fn();
    csrfOriginMiddleware(config)(
      {
        method: 'POST',
        header: (name: string) =>
          name === 'origin' ? 'https://attacker.example' : 'cross-site',
      } as unknown as Request,
      responseStub(),
      next,
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });

  it('allows the configured origin and safe methods', () => {
    const next = vi.fn();
    csrfOriginMiddleware(config)(
      {
        method: 'POST',
        header: (name: string) =>
          name === 'origin' ? config.WEB_ORIGIN : 'same-site',
      } as unknown as Request,
      responseStub(),
      next,
    );
    expect(next).toHaveBeenCalledWith();
  });

  it('rate limits login independently and emits Retry-After', async () => {
    const next = vi.fn();
    const response = responseStub();
    const redis = {
      consumeRateLimit: vi.fn().mockResolvedValue({
        count: config.RATE_LIMIT_LOGIN_MAX + 1,
        retryAfterSeconds: 42,
      }),
    };
    await rateLimitMiddleware(config, redis)(
      {
        method: 'POST',
        path: '/auth/demo-login',
        ip: '127.0.0.1',
      } as unknown as Request,
      response,
      next,
    );
    expect(response.setHeader).toHaveBeenCalledWith('retry-after', '42');
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 429 }));
  });
});
