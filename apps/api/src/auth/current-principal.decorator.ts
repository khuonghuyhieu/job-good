import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { AuthenticatedPrincipal } from './authenticated-principal.js';

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedPrincipal => {
    const principal = context.switchToHttp().getRequest<Request>().auth;
    if (!principal) {
      throw new Error('Authenticated principal was not resolved.');
    }
    return principal;
  },
);
