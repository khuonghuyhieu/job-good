import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  createUploadIntentRequestSchema,
  type CompleteMediaResponse,
  type CreateUploadIntentResponse,
  type MediaStatusResponse,
} from '@good-job/contracts';

import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal.js';
import { CurrentPrincipal } from '../../auth/current-principal.decorator.js';
import { SessionAuthGuard } from '../../auth/session-auth.guard.js';
import { ApiException } from '../../http/api.exception.js';
import { MediaService } from '../application/media.service.js';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

@Controller('media')
@UseGuards(SessionAuthGuard)
export class MediaController {
  constructor(@Inject(MediaService) private readonly media: MediaService) {}

  @Post('upload-intents')
  createIntent(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: unknown,
  ): Promise<CreateUploadIntentResponse> {
    const parsed = createUploadIntentRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiException(400, {
        code: 'VALIDATION_ERROR',
        message: 'The upload metadata is invalid.',
      });
    }
    return this.media.createIntent(principal, parsed.data);
  }

  @Post(':attachmentId/complete')
  complete(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('attachmentId') rawId: string,
  ): Promise<CompleteMediaResponse> {
    return this.media.complete(principal, this.id(rawId));
  }

  @Get(':attachmentId')
  status(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('attachmentId') rawId: string,
  ): Promise<MediaStatusResponse> {
    return this.media.status(principal, this.id(rawId));
  }

  @Delete(':attachmentId')
  @HttpCode(204)
  remove(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('attachmentId') rawId: string,
  ): Promise<void> {
    return this.media.remove(principal, this.id(rawId));
  }

  private id(value: string): string {
    if (!uuidPattern.test(value)) {
      throw new ApiException(400, {
        code: 'VALIDATION_ERROR',
        message: 'The attachment identifier is invalid.',
      });
    }
    return value;
  }
}
