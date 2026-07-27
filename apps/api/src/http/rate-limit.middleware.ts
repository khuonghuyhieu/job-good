import { createHash } from 'node:crypto';

import type { ServerConfig } from '@good-job/config';
import type { NextFunction, Request, Response } from 'express';

import type { RedisService } from '../redis.service.js';
import { ApiException } from './api.exception.js';

function isCommand(request: Request): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
}

function subject(request: Request): string {
  const identity = request.session?.employeeId ?? request.ip ?? 'unknown';
  return createHash('sha256').update(identity).digest('hex').slice(0, 32);
}

export function rateLimitMiddleware(
  config: ServerConfig,
  redis: Pick<RedisService, 'consumeRateLimit'>,
) {
  return async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (request.method === 'POST' && request.path === '/auth/logout') {
      return next();
    }
    const isLogin =
      request.method === 'POST' && request.path === '/auth/demo-login';
    if (!isLogin && !isCommand(request)) return next();
    const maximum = isLogin
      ? config.RATE_LIMIT_LOGIN_MAX
      : config.RATE_LIMIT_COMMAND_MAX;
    const bucket = isLogin ? 'login' : 'command';
    try {
      const result = await redis.consumeRateLimit(
        `good-job:rate:${bucket}:${subject(request)}`,
        config.RATE_LIMIT_WINDOW_SECONDS,
      );
      response.setHeader(
        'x-ratelimit-remaining',
        String(Math.max(0, maximum - result.count)),
      );
      if (result.count > maximum) {
        response.setHeader('retry-after', String(result.retryAfterSeconds));
        return next(
          new ApiException(429, {
            code: 'RATE_LIMITED',
            message: 'Too many requests. Please try again later.',
            details: { retryAfterSeconds: result.retryAfterSeconds },
          }),
        );
      }
      next();
    } catch {
      next(
        new ApiException(503, {
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'Request protection is temporarily unavailable.',
        }),
      );
    }
  };
}
