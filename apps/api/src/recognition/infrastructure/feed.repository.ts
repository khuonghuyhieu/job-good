import { Injectable } from '@nestjs/common';
import type {
  FeedQuery,
  FeedResponse,
  KudoDetailResponse,
} from '@good-job/contracts';
import { database, KudoStatus } from '@good-job/database';

import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal.js';
import { decodeFeedCursor, encodeFeedCursor } from '../domain/feed-cursor.js';
import { mapComment, mapFeedKudo } from './community-mapper.js';

const employeeSelect = {
  id: true,
  displayName: true,
  avatarUrl: true,
} as const;

const feedInclude = {
  sender: { select: employeeSelect },
  receiver: { select: employeeSelect },
  coreValue: { select: { id: true, code: true, name: true } },
  reactions: { select: { employeeId: true, emojiCode: true } },
  _count: { select: { comments: true } },
} as const;

@Injectable()
export class FeedRepository {
  async page(
    principal: AuthenticatedPrincipal,
    query: FeedQuery,
  ): Promise<FeedResponse> {
    const cursor = query.cursor ? decodeFeedCursor(query.cursor) : null;
    const rows = await database.kudo.findMany({
      where: {
        organizationId: principal.organizationId,
        status: KudoStatus.committed,
        ...(cursor
          ? {
              OR: [
                { committedAt: { lt: cursor.committedAt } },
                {
                  committedAt: cursor.committedAt,
                  id: { lt: cursor.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ committedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      include: feedInclude,
    });
    const hasNextPage = rows.length > query.limit;
    const pageRows = hasNextPage ? rows.slice(0, query.limit) : rows;
    const last = pageRows.at(-1);
    return {
      items: pageRows.map((row) => mapFeedKudo(row, principal.employeeId)),
      nextCursor:
        hasNextPage && last
          ? encodeFeedCursor({ committedAt: last.committedAt, id: last.id })
          : null,
    };
  }

  async detail(
    principal: AuthenticatedPrincipal,
    kudoId: string,
  ): Promise<KudoDetailResponse | null> {
    const row = await database.kudo.findFirst({
      where: {
        id: kudoId,
        organizationId: principal.organizationId,
        status: KudoStatus.committed,
      },
      include: {
        ...feedInclude,
        comments: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          include: { employee: { select: employeeSelect } },
        },
      },
    });
    if (!row) {
      return null;
    }
    return {
      ...mapFeedKudo(row, principal.employeeId),
      comments: row.comments.map((comment) =>
        mapComment(comment, principal.employeeId),
      ),
    };
  }
}
