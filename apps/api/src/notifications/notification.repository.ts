import { Injectable } from '@nestjs/common';
import type {
  MarkNotificationReadResponse,
  NotificationDto,
  NotificationListResponse,
  NotificationUnreadCountResponse,
} from '@good-job/contracts';
import { database } from '@good-job/database';

import type { AuthenticatedPrincipal } from '../auth/authenticated-principal.js';
import { ApiException } from '../http/api.exception.js';

type Cursor = { createdAt: string; id: string };

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodeCursor(raw: string): Cursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf8'),
    ) as Cursor;
    if (!parsed.id || Number.isNaN(Date.parse(parsed.createdAt)))
      throw new Error();
    return parsed;
  } catch {
    throw new ApiException(400, {
      code: 'VALIDATION_ERROR',
      message: 'The notification cursor is invalid.',
    });
  }
}

@Injectable()
export class NotificationRepository {
  async list(
    principal: AuthenticatedPrincipal,
    rawCursor?: string,
    limit = 20,
  ): Promise<NotificationListResponse> {
    const cursor = rawCursor ? decodeCursor(rawCursor) : null;
    const rows = await database.notification.findMany({
      where: {
        recipientId: principal.employeeId,
        recipient: { organizationId: principal.organizationId },
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.createdAt) } },
                {
                  createdAt: new Date(cursor.createdAt),
                  id: { lt: cursor.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const hasNext = rows.length > limit;
    const page = hasNext ? rows.slice(0, limit) : rows;
    const last = page.at(-1);
    return {
      items: page.map((row) => this.map(row)),
      nextCursor:
        hasNext && last
          ? encodeCursor({
              createdAt: last.createdAt.toISOString(),
              id: last.id,
            })
          : null,
    };
  }

  async unreadCount(
    principal: AuthenticatedPrincipal,
  ): Promise<NotificationUnreadCountResponse> {
    return {
      unreadCount: await database.notification.count({
        where: {
          recipientId: principal.employeeId,
          recipient: { organizationId: principal.organizationId },
          readAt: null,
        },
      }),
    };
  }

  async markRead(
    principal: AuthenticatedPrincipal,
    notificationId: string,
  ): Promise<MarkNotificationReadResponse> {
    const existing = await database.notification.findFirst({
      where: {
        id: notificationId,
        recipientId: principal.employeeId,
        recipient: { organizationId: principal.organizationId },
      },
    });
    if (!existing) {
      throw new ApiException(404, {
        code: 'RESOURCE_NOT_FOUND',
        message: 'The notification is unavailable.',
      });
    }
    const notification =
      existing.readAt === null
        ? await database.notification.update({
            where: { id: existing.id },
            data: { readAt: new Date() },
          })
        : existing;
    return { notification: this.map(notification) };
  }

  private map(row: {
    id: string;
    eventId: string;
    type: string;
    payload: unknown;
    readAt: Date | null;
    createdAt: Date;
  }): NotificationDto {
    const payload =
      typeof row.payload === 'object' && row.payload !== null
        ? (row.payload as Record<string, unknown>)
        : {};
    const relatedKudoId =
      typeof payload['kudoId'] === 'string' ? payload['kudoId'] : null;
    return {
      id: row.id,
      eventId: row.eventId,
      type: row.type,
      payload,
      relatedKudoId,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
