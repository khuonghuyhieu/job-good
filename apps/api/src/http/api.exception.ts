import { HttpException } from '@nestjs/common';

export type ApiExceptionBody = {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
  details?: Record<string, unknown>;
};

export class ApiException extends HttpException {
  constructor(status: number, body: ApiExceptionBody) {
    super(body, status);
  }
}
