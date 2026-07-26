import { createHash, randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import {
  createCommentResponseSchema,
  type CreateCommentResponse,
  type ReactionResponse,
  type SupportedEmoji,
} from '@good-job/contracts';
import { database, KudoStatus, type Prisma } from '@good-job/database';

import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal.js';
import { CommunityRuleError } from '../domain/community-rule.error.js';
import { mapComment, mapReactionState } from './community-mapper.js';

const employeeSelect = {
  id: true,
  displayName: true,
  avatarUrl: true,
} as const;

type LockedIdempotencyRecord = {
  id: string;
  requestHash: string;
  responseBody: unknown | null;
  expiresAt: Date;
};

@Injectable()
export class CommunityRepository {
  async setReaction(
    principal: AuthenticatedPrincipal,
    kudoId: string,
    emojiCode: SupportedEmoji,
  ): Promise<ReactionResponse> {
    return database.$transaction(async (transaction) => {
      await this.requireKudo(transaction, principal, kudoId);
      await transaction.reaction.upsert({
        where: {
          kudoId_employeeId: {
            kudoId,
            employeeId: principal.employeeId,
          },
        },
        update: { emojiCode },
        create: { kudoId, employeeId: principal.employeeId, emojiCode },
      });
      return this.reactionResponse(transaction, principal.employeeId, kudoId);
    });
  }

  async removeReaction(
    principal: AuthenticatedPrincipal,
    kudoId: string,
  ): Promise<ReactionResponse> {
    return database.$transaction(async (transaction) => {
      await this.requireKudo(transaction, principal, kudoId);
      await transaction.reaction.deleteMany({
        where: { kudoId, employeeId: principal.employeeId },
      });
      return this.reactionResponse(transaction, principal.employeeId, kudoId);
    });
  }

  async createComment(
    principal: AuthenticatedPrincipal,
    kudoId: string,
    body: string,
    idempotencyKey: string,
  ): Promise<CreateCommentResponse> {
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ kudoId, body }))
      .digest('hex');
    return database.$transaction(async (transaction) => {
      const replay = await this.claimComment(
        transaction,
        principal,
        idempotencyKey,
        requestHash,
      );
      if (replay) {
        return replay;
      }
      await this.requireKudo(transaction, principal, kudoId);
      const comment = await transaction.comment.create({
        data: { kudoId, employeeId: principal.employeeId, body },
        include: { employee: { select: employeeSelect } },
      });
      const response: CreateCommentResponse = {
        comment: mapComment(comment, principal.employeeId),
      };
      await transaction.idempotencyRecord.update({
        where: {
          organizationId_employeeId_operation_key: {
            organizationId: principal.organizationId,
            employeeId: principal.employeeId,
            operation: 'create_comment',
            key: idempotencyKey,
          },
        },
        data: {
          resourceType: 'comment',
          resourceId: comment.id,
          responseCode: 201,
          responseBody: response,
        },
      });
      return response;
    });
  }

  async deleteComment(
    principal: AuthenticatedPrincipal,
    commentId: string,
  ): Promise<void> {
    await database.$transaction(async (transaction) => {
      const comment = await transaction.comment.findFirst({
        where: {
          id: commentId,
          kudo: {
            organizationId: principal.organizationId,
            status: KudoStatus.committed,
          },
        },
        select: { employeeId: true },
      });
      if (!comment) {
        throw new CommunityRuleError(
          404,
          'RESOURCE_NOT_FOUND',
          'The comment is unavailable.',
        );
      }
      if (comment.employeeId !== principal.employeeId) {
        throw new CommunityRuleError(
          403,
          'FORBIDDEN',
          'Only the comment author may delete it.',
        );
      }
      await transaction.comment.delete({ where: { id: commentId } });
    });
  }

  private async requireKudo(
    transaction: Prisma.TransactionClient,
    principal: AuthenticatedPrincipal,
    kudoId: string,
  ): Promise<void> {
    const kudo = await transaction.kudo.findFirst({
      where: {
        id: kudoId,
        organizationId: principal.organizationId,
        status: KudoStatus.committed,
      },
      select: { id: true },
    });
    if (!kudo) {
      throw new CommunityRuleError(
        404,
        'RESOURCE_NOT_FOUND',
        'The Kudo is unavailable.',
      );
    }
  }

  private async reactionResponse(
    transaction: Prisma.TransactionClient,
    employeeId: string,
    kudoId: string,
  ): Promise<ReactionResponse> {
    const reactions = await transaction.reaction.findMany({
      where: { kudoId },
      select: { employeeId: true, emojiCode: true },
    });
    return {
      kudoId,
      reactions: mapReactionState(reactions, employeeId),
    };
  }

  private async claimComment(
    transaction: Prisma.TransactionClient,
    principal: AuthenticatedPrincipal,
    key: string,
    requestHash: string,
  ): Promise<CreateCommentResponse | null> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    await transaction.$executeRaw`
      INSERT INTO "idempotency_records" (
        "id", "organization_id", "employee_id", "operation", "key",
        "request_hash", "expires_at"
      )
      VALUES (
        ${randomUUID()}::uuid,
        ${principal.organizationId}::uuid,
        ${principal.employeeId}::uuid,
        'create_comment',
        ${key}::uuid,
        ${requestHash},
        ${expiresAt}
      )
      ON CONFLICT ("organization_id", "employee_id", "operation", "key")
      DO NOTHING
    `;
    const [record] = await transaction.$queryRaw<LockedIdempotencyRecord[]>`
      SELECT
        "id",
        "request_hash" AS "requestHash",
        "response_body" AS "responseBody",
        "expires_at" AS "expiresAt"
      FROM "idempotency_records"
      WHERE "organization_id" = ${principal.organizationId}::uuid
        AND "employee_id" = ${principal.employeeId}::uuid
        AND "operation" = 'create_comment'
        AND "key" = ${key}::uuid
      FOR UPDATE
    `;
    if (!record) {
      throw new Error('The comment idempotency record could not be locked.');
    }
    if (record.expiresAt <= now && record.responseBody === null) {
      await transaction.idempotencyRecord.update({
        where: { id: record.id },
        data: {
          requestHash,
          resourceType: null,
          resourceId: null,
          responseCode: null,
          expiresAt,
        },
      });
      return null;
    }
    if (record.requestHash !== requestHash) {
      throw new CommunityRuleError(
        409,
        'IDEMPOTENCY_CONFLICT',
        'The Idempotency-Key was already used with a different request.',
      );
    }
    if (record.responseBody !== null) {
      const parsed = createCommentResponseSchema.safeParse(record.responseBody);
      if (!parsed.success) {
        throw new Error('The stored comment response is invalid.');
      }
      return parsed.data;
    }
    return null;
  }
}
