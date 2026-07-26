import {
  Body,
  Controller,
  Delete,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  createCommentRequestSchema,
  idempotencyKeySchema,
  setReactionRequestSchema,
  type CreateCommentResponse,
  type ReactionResponse,
} from '@good-job/contracts';

import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal.js';
import { CurrentPrincipal } from '../../auth/current-principal.decorator.js';
import { SessionAuthGuard } from '../../auth/session-auth.guard.js';
import { ApiException } from '../../http/api.exception.js';
import {
  CreateCommentCommand,
  DeleteCommentCommand,
  RemoveReactionCommand,
  SetReactionCommand,
} from '../application/commands/community.commands.js';

function parseId(rawId: string, resource: string): string {
  const parsed = idempotencyKeySchema.safeParse(rawId);
  if (!parsed.success) {
    throw new ApiException(404, {
      code: 'RESOURCE_NOT_FOUND',
      message: `The ${resource} is unavailable.`,
    });
  }
  return parsed.data;
}

@Controller()
@UseGuards(SessionAuthGuard)
export class CommunityController {
  constructor(
    @Inject(SetReactionCommand)
    private readonly setReaction: SetReactionCommand,
    @Inject(RemoveReactionCommand)
    private readonly removeReaction: RemoveReactionCommand,
    @Inject(CreateCommentCommand)
    private readonly createComment: CreateCommentCommand,
    @Inject(DeleteCommentCommand)
    private readonly deleteComment: DeleteCommentCommand,
  ) {}

  @Put('kudos/:id/reaction')
  set(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') rawId: string,
    @Body() rawBody: unknown,
  ): Promise<ReactionResponse> {
    const body = setReactionRequestSchema.safeParse(rawBody);
    if (!body.success) {
      throw new ApiException(400, {
        code: 'VALIDATION_ERROR',
        message: 'The reaction is invalid.',
        fieldErrors: { emojiCode: 'Choose a supported reaction.' },
      });
    }
    return this.setReaction.execute(
      principal,
      parseId(rawId, 'Kudo'),
      body.data.emojiCode,
    );
  }

  @Delete('kudos/:id/reaction')
  remove(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') rawId: string,
  ): Promise<ReactionResponse> {
    return this.removeReaction.execute(principal, parseId(rawId, 'Kudo'));
  }

  @Post('kudos/:id/comments')
  create(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') rawId: string,
    @Body() rawBody: unknown,
    @Headers('idempotency-key') rawKey: string | undefined,
  ): Promise<CreateCommentResponse> {
    const body = createCommentRequestSchema.safeParse(rawBody);
    if (!body.success) {
      throw new ApiException(400, {
        code: 'VALIDATION_ERROR',
        message: 'The comment is invalid.',
        fieldErrors: { body: 'Comment text is required.' },
      });
    }
    const key = idempotencyKeySchema.safeParse(rawKey);
    if (!key.success) {
      throw new ApiException(400, {
        code: 'VALIDATION_ERROR',
        message: 'A valid Idempotency-Key header is required.',
        fieldErrors: { idempotencyKey: 'Idempotency-Key must be a UUID.' },
      });
    }
    return this.createComment.execute(
      principal,
      parseId(rawId, 'Kudo'),
      body.data.body,
      key.data,
    );
  }

  @Delete('comments/:id')
  @HttpCode(204)
  async delete(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') rawId: string,
  ): Promise<void> {
    await this.deleteComment.execute(principal, parseId(rawId, 'comment'));
  }
}
