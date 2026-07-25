import { type DynamicModule, Module } from '@nestjs/common';
import type { ServerConfig } from '@good-job/config';

import { CONFIG } from '../config.js';
import { AuthController } from './auth.controller.js';
import { AuthenticatedSocketService } from './authenticated-socket.service.js';
import { CurrentUserService } from './current-user.service.js';
import { OrganizationScopeService } from './organization-scope.service.js';
import { SessionAuthGuard } from './session-auth.guard.js';
import { SessionService } from './session/session.service.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthenticatedSocketService,
    CurrentUserService,
    OrganizationScopeService,
    SessionAuthGuard,
    SessionService,
  ],
  exports: [
    AuthenticatedSocketService,
    CurrentUserService,
    OrganizationScopeService,
    SessionAuthGuard,
    SessionService,
  ],
})
export class AuthModule {
  static register(config: ServerConfig): DynamicModule {
    return {
      module: AuthModule,
      providers: [{ provide: CONFIG, useValue: config }],
    };
  }
}
