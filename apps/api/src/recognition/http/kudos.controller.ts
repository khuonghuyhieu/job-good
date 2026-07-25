import {
  Body,
  Controller,
  Headers,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  createKudoRequestSchema,
  idempotencyKeySchema,
  type CreateKudoResponse,
} from '@good-job/contracts';

import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal.js';
import { CurrentPrincipal } from '../../auth/current-principal.decorator.js';
import { SessionAuthGuard } from '../../auth/session-auth.guard.js';
import { ApiException } from '../../http/api.exception.js';
import { CreateKudoCommand } from '../application/commands/create-kudo.command.js';

@Controller('kudos')
@UseGuards(SessionAuthGuard)
export class KudosController {
  constructor(
    @Inject(CreateKudoCommand)
    private readonly createKudo: CreateKudoCommand,
  ) {}

  @Post()
  execute(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: unknown,
    @Headers('idempotency-key') rawIdempotencyKey: string | undefined,
  ): Promise<CreateKudoResponse> {
    const parsed = createKudoRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiException(400, {
        code: 'VALIDATION_ERROR',
        message: 'The Kudo request is invalid.',
        fieldErrors: Object.fromEntries(
          parsed.error.issues.map((issue) => [
            issue.path.join('.') || 'request',
            issue.message,
          ]),
        ),
      });
    }
    const idempotencyKey = idempotencyKeySchema.safeParse(rawIdempotencyKey);
    if (!idempotencyKey.success) {
      throw new ApiException(400, {
        code: 'VALIDATION_ERROR',
        message: 'A valid Idempotency-Key header is required.',
        fieldErrors: {
          idempotencyKey: 'Idempotency-Key must be a UUID.',
        },
      });
    }
    return this.createKudo.execute(principal, parsed.data, idempotencyKey.data);
  }
}
