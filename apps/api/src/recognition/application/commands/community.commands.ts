import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateCommentResponse,
  ReactionResponse,
  SupportedEmoji,
} from '@good-job/contracts';

import type { AuthenticatedPrincipal } from '../../../auth/authenticated-principal.js';
import { ApiException } from '../../../http/api.exception.js';
import { CommunityRuleError } from '../../domain/community-rule.error.js';
import { CommunityRepository } from '../../infrastructure/community.repository.js';

async function mapCommunityError<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error: unknown) {
    if (error instanceof CommunityRuleError) {
      throw new ApiException(error.status, {
        code: error.code,
        message: error.message,
        ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
      });
    }
    throw error;
  }
}

@Injectable()
export class SetReactionCommand {
  constructor(
    @Inject(CommunityRepository)
    private readonly repository: CommunityRepository,
  ) {}

  execute(
    principal: AuthenticatedPrincipal,
    kudoId: string,
    emojiCode: SupportedEmoji,
  ): Promise<ReactionResponse> {
    return mapCommunityError(() =>
      this.repository.setReaction(principal, kudoId, emojiCode),
    );
  }
}

@Injectable()
export class RemoveReactionCommand {
  constructor(
    @Inject(CommunityRepository)
    private readonly repository: CommunityRepository,
  ) {}

  execute(
    principal: AuthenticatedPrincipal,
    kudoId: string,
  ): Promise<ReactionResponse> {
    return mapCommunityError(() =>
      this.repository.removeReaction(principal, kudoId),
    );
  }
}

@Injectable()
export class CreateCommentCommand {
  constructor(
    @Inject(CommunityRepository)
    private readonly repository: CommunityRepository,
  ) {}

  execute(
    principal: AuthenticatedPrincipal,
    kudoId: string,
    body: string,
    idempotencyKey: string,
  ): Promise<CreateCommentResponse> {
    return mapCommunityError(() =>
      this.repository.createComment(principal, kudoId, body, idempotencyKey),
    );
  }
}

@Injectable()
export class DeleteCommentCommand {
  constructor(
    @Inject(CommunityRepository)
    private readonly repository: CommunityRepository,
  ) {}

  execute(principal: AuthenticatedPrincipal, commentId: string): Promise<void> {
    return mapCommunityError(() =>
      this.repository.deleteComment(principal, commentId),
    );
  }
}
