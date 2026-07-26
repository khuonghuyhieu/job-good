import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import type { ServerConfig } from '@good-job/config';
import type { Request } from 'express';
import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import {
  organizationRoom,
  realtimeSocketEventName,
  type RealtimeEventEnvelope,
  userRoom,
} from '@good-job/contracts';

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
    this.server.on('connection', (socket) => {
      const principal = socket.data['principal'] as
        { employeeId: string; organizationId: string } | undefined;
      if (!principal) {
        socket.disconnect(true);
        return;
      }
      void socket.join([
        organizationRoom(principal.organizationId),
        userRoom(principal.organizationId, principal.employeeId),
      ]);
    });
  }

  emitEvent(event: RealtimeEventEnvelope): void {
    if (!this.server) return;
    if (
      event.type === 'reward.redeemed' ||
      event.type === 'notification.created'
    ) {
      for (const employeeId of event.recipientUserIds ?? []) {
        this.server
          .to(userRoom(event.organizationId, employeeId))
          .emit(realtimeSocketEventName, event);
      }
      return;
    }
    this.server
      .to(organizationRoom(event.organizationId))
      .emit(realtimeSocketEventName, event);
  }

  async disconnectEmployee(employeeId: string): Promise<void> {
    const sockets = await this.server?.fetchSockets();
    for (const socket of sockets ?? []) {
      const principal = socket.data['principal'] as
        { employeeId: string } | undefined;
      if (principal?.employeeId === employeeId) socket.disconnect(true);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.server?.close();
  }
}
