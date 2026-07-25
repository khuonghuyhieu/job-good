import type { ArgumentsHost } from '@nestjs/common';
import {
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import type { ApiExceptionBody } from './api.exception.js';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      error instanceof HttpException ? error.getResponse() : undefined;
    if (
      exceptionResponse &&
      typeof exceptionResponse === 'object' &&
      'service' in exceptionResponse &&
      'status' in exceptionResponse
    ) {
      response.status(status).json(exceptionResponse);
      return;
    }
    const body = this.toBody(status, exceptionResponse);
    const requestId =
      request.requestId ?? response.getHeader('x-request-id') ?? '';

    response.status(status).json({
      ...body,
      requestId: String(requestId),
    });
  }

  private toBody(
    status: number,
    response: string | object | undefined,
  ): ApiExceptionBody {
    if (
      response &&
      typeof response === 'object' &&
      'code' in response &&
      'message' in response
    ) {
      return response as ApiExceptionBody;
    }

    if (status === HttpStatus.UNAUTHORIZED) {
      return {
        code: 'UNAUTHENTICATED',
        message: 'A valid session is required.',
      };
    }

    const codeByStatus: Partial<Record<number, string>> = {
      [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'RESOURCE_NOT_FOUND',
      [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
      [HttpStatus.SERVICE_UNAVAILABLE]: 'DEPENDENCY_UNAVAILABLE',
    };
    return {
      code:
        status === HttpStatus.INTERNAL_SERVER_ERROR
          ? 'INTERNAL_ERROR'
          : (codeByStatus[status] ?? 'INTERNAL_ERROR'),
      message:
        status === HttpStatus.INTERNAL_SERVER_ERROR
          ? 'The service could not complete the request.'
          : typeof response === 'string'
            ? response
            : 'The request could not be completed.',
    };
  }
}
