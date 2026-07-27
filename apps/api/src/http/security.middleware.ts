import { timingSafeEqual } from 'node:crypto';

import type { ServerConfig } from '@good-job/config';
import type { NextFunction, Request, Response } from 'express';

import { ApiException } from './api.exception.js';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

function sameValue(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function securityHeadersMiddleware(
  _request: Request,
  response: Response,
  next: NextFunction,
): void {
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('x-frame-options', 'DENY');
  response.setHeader('referrer-policy', 'no-referrer');
  response.setHeader('permissions-policy', 'camera=(), microphone=()');
  response.setHeader('cross-origin-resource-policy', 'same-site');
  next();
}

export function requestBoundaryErrorMiddleware(
  error: unknown,
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const status =
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number'
      ? error.status
      : 0;
  if (status !== 400 && status !== 413) return next(error);
  response.status(status).json({
    code: status === 413 ? 'REQUEST_TOO_LARGE' : 'VALIDATION_ERROR',
    message:
      status === 413
        ? 'The request body exceeds the configured limit.'
        : 'The request body is invalid JSON.',
    requestId: request.requestId ?? '',
  });
}

/**
 * Cookie sessions use SameSite=Lax as the first CSRF boundary. For unsafe
 * browser requests, an explicit Origin must also match the configured Web
 * origin. Requests without browser fetch metadata remain available to trusted
 * non-browser clients and automated operations.
 */
export function csrfOriginMiddleware(config: ServerConfig) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    if (safeMethods.has(request.method)) return next();
    const fetchSite = request.header('sec-fetch-site');
    const origin = request.header('origin');
    if (
      fetchSite === 'cross-site' ||
      (origin !== undefined && !sameValue(origin, config.WEB_ORIGIN))
    ) {
      return next(
        new ApiException(403, {
          code: 'FORBIDDEN',
          message: 'The request origin is not allowed.',
        }),
      );
    }
    next();
  };
}
