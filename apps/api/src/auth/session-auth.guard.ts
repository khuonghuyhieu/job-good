import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

import { ApiException } from '../http/api.exception.js';
import { CurrentUserService } from './current-user.service.js';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    @Inject(CurrentUserService)
    private readonly currentUser: CurrentUserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const employeeId = request.session?.employeeId;
    if (!employeeId) {
      throw new ApiException(401, {
        code: 'UNAUTHENTICATED',
        message: 'A valid session is required.',
      });
    }

    const principal = await this.currentUser.findActivePrincipal(employeeId);
    if (!principal) {
      await new Promise<void>((resolve) =>
        request.session.destroy(() => resolve()),
      );
      throw new ApiException(401, {
        code: 'UNAUTHENTICATED',
        message: 'The session is no longer valid.',
      });
    }
    request.auth = principal;
    return true;
  }
}
