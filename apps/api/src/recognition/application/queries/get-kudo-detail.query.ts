import { Inject, Injectable } from '@nestjs/common';
import type { KudoDetailResponse } from '@good-job/contracts';

import type { AuthenticatedPrincipal } from '../../../auth/authenticated-principal.js';
import { ApiException } from '../../../http/api.exception.js';
import { FeedRepository } from '../../infrastructure/feed.repository.js';

@Injectable()
export class GetKudoDetailQuery {
  constructor(
    @Inject(FeedRepository) private readonly repository: FeedRepository,
  ) {}

  async execute(
    principal: AuthenticatedPrincipal,
    kudoId: string,
  ): Promise<KudoDetailResponse> {
    const result = await this.repository.detail(principal, kudoId);
    if (!result) {
      throw new ApiException(404, {
        code: 'RESOURCE_NOT_FOUND',
        message: 'The Kudo is unavailable.',
      });
    }
    return result;
  }
}
