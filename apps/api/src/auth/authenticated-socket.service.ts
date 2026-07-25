import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import type { ServerConfig } from '@good-job/config';
import type { Request } from 'express';
import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';

import { CONFIG } from '../config.js';
import { CurrentUserService } from './current-user.service.js';
import { SessionService } from './session/session.service.js';

@Injectable()
export class AuthenticatedSocketService implements OnApplicationShutdown {
  private server?: Server;

  constructor(
    @Inject(CONFIG) private readonly config: ServerConfig,
    @Inject(SessionService)
    private readonly sessions: SessionService,
    @Inject(CurrentUserService)
    private readonly currentUser: CurrentUserService,
  ) {}

  attach(httpServer: HttpServer): void {
    this.server = new Server(httpServer, {
      path: this.config.WEBSOCKET_PATH,
      cors: {
        origin: this.config.WEB_ORIGIN,
        credentials: true,
      },
    });
    this.server.engine.use(this.sessions.middleware);
    this.server.use(async (socket, next) => {
      const request = socket.request as Request;
      const employeeId = request.session?.employeeId;
      if (!employeeId) {
        next(new Error('UNAUTHENTICATED'));
        return;
      }
      const principal = await this.currentUser.findActivePrincipal(employeeId);
      if (!principal) {
        next(new Error('UNAUTHENTICATED'));
        return;
      }
      socket.data['principal'] = {
        employeeId: principal.employeeId,
        organizationId: principal.organizationId,
      };
      next();
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.server?.close();
  }
}
