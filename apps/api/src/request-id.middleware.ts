import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

const safeRequestId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

export function requestIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const supplied = request.header('x-request-id');
  const requestId =
    supplied && safeRequestId.test(supplied) ? supplied : randomUUID();
  request.requestId = requestId;
  response.setHeader('x-request-id', requestId);
  next();
}
