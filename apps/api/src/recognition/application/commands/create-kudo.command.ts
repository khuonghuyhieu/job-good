import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateKudoRequest,
  CreateKudoResponse,
} from '@good-job/contracts';

import type { AuthenticatedPrincipal } from '../../../auth/authenticated-principal.js';
import { ApiException } from '../../../http/api.exception.js';
import { CreateKudoRuleError } from '../../domain/create-kudo.rules.js';
import { CreateKudoRepository } from '../../infrastructure/create-kudo.repository.js';

@Injectable()
export class CreateKudoCommand {
  constructor(
    @Inject(CreateKudoRepository)
    private readonly repository: CreateKudoRepository,
  ) {}

  async execute(
    principal: AuthenticatedPrincipal,
    input: CreateKudoRequest,
    idempotencyKey: string,
  ): Promise<CreateKudoResponse> {
    try {
      return await this.repository.executeAtomic(
        principal,
        input,
        idempotencyKey,
      );
    } catch (error: unknown) {
      if (error instanceof CreateKudoRuleError) {
        throw new ApiException(error.status, {
          code: error.code,
          message: error.message,
          ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
          ...(error.details ? { details: error.details } : {}),
        });
      }
      throw error;
    }
  }
}
