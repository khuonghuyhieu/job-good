import { Inject, Injectable } from '@nestjs/common';
import type { ServerConfig } from '@good-job/config';
import type {
  CompleteMediaResponse,
  CreateUploadIntentRequest,
  CreateUploadIntentResponse,
  MediaAttachmentDto,
  MediaStatusResponse,
} from '@good-job/contracts';
import { MediaStatus, MediaType } from '@good-job/database';

import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal.js';
import { CONFIG } from '../../config.js';
import { ApiException } from '../../http/api.exception.js';
import {
  matchesImageSignature,
  validateMediaPolicy,
} from '../domain/media-policy.js';
import { MediaRepository } from '../infrastructure/media.repository.js';
import { ObjectStorageService } from '../infrastructure/object-storage.service.js';

type AttachmentRow = Awaited<ReturnType<MediaRepository['findAuthorized']>>;

@Injectable()
export class MediaService {
  constructor(
    @Inject(CONFIG) private readonly config: ServerConfig,
    @Inject(MediaRepository) private readonly media: MediaRepository,
    @Inject(ObjectStorageService)
    private readonly storage: ObjectStorageService,
  ) {}

  async createIntent(
    principal: AuthenticatedPrincipal,
    input: CreateUploadIntentRequest,
  ): Promise<CreateUploadIntentResponse> {
    validateMediaPolicy(input, this.config);
    const objectKey = this.storage.objectKey(
      principal.organizationId,
      principal.employeeId,
    );
    const attachment = await this.media.create(principal, input, objectKey);
    return {
      attachment: await this.toDto(attachment),
      upload: {
        method: 'PUT',
        ...this.storage.presignUpload(
          objectKey,
          input.mimeType,
          input.sizeBytes,
        ),
      },
    };
  }

  async complete(
    principal: AuthenticatedPrincipal,
    attachmentId: string,
  ): Promise<CompleteMediaResponse> {
    const attachment = await this.requireAuthorized(principal, attachmentId);
    if (
      attachment.status === MediaStatus.ready ||
      attachment.status === MediaStatus.processing
    ) {
      return { attachment: await this.toDto(attachment) };
    }
    if (attachment.status === MediaStatus.failed) {
      throw new ApiException(409, {
        code: 'MEDIA_TERMINAL',
        message: 'The failed upload cannot be completed again.',
      });
    }
    let actual: { sizeBytes: number; mimeType: string };
    try {
      actual = await this.storage.head(attachment.objectKey);
    } catch {
      throw new ApiException(503, {
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'The uploaded object could not be verified.',
      });
    }
    if (
      actual.sizeBytes !== Number(attachment.sizeBytes) ||
      actual.mimeType !== attachment.mimeType
    ) {
      throw new ApiException(400, {
        code: 'VALIDATION_ERROR',
        message: 'The uploaded object does not match the upload intent.',
      });
    }
    const updated =
      attachment.mediaType === MediaType.image
        ? await this.completeImage(attachment)
        : await this.media.queueVideo(principal.organizationId, attachment.id);
    return { attachment: await this.toDto(updated) };
  }

  async status(
    principal: AuthenticatedPrincipal,
    attachmentId: string,
  ): Promise<MediaStatusResponse> {
    return {
      attachment: await this.toDto(
        await this.requireAuthorized(principal, attachmentId),
      ),
    };
  }

  async remove(
    principal: AuthenticatedPrincipal,
    attachmentId: string,
  ): Promise<void> {
    const attachment = await this.requireAuthorized(principal, attachmentId);
    if (attachment.ownerId || attachment.createdById !== principal.employeeId) {
      throw new ApiException(403, {
        code: 'FORBIDDEN',
        message: 'Only an unbound upload owner may remove this attachment.',
      });
    }
    await this.storage.remove(attachment.objectKey).catch(() => undefined);
    await this.media.removeUnbound(principal, attachmentId);
  }

  private async completeImage(attachment: NonNullable<AttachmentRow>) {
    const bytes = await this.storage
      .readBounded(attachment.objectKey, this.config.MEDIA_MAX_IMAGE_BYTES)
      .catch(() => null);
    if (!bytes || !matchesImageSignature(attachment.mimeType, bytes)) {
      throw new ApiException(415, {
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'The uploaded image content is not supported.',
      });
    }
    return this.media.completeImage(attachment.id);
  }

  private async requireAuthorized(
    principal: AuthenticatedPrincipal,
    attachmentId: string,
  ) {
    const attachment = await this.media.findAuthorized(principal, attachmentId);
    if (!attachment) {
      throw new ApiException(404, {
        code: 'RESOURCE_NOT_FOUND',
        message: 'The media attachment is unavailable.',
      });
    }
    return attachment;
  }

  private async toDto(
    attachment: NonNullable<AttachmentRow>,
  ): Promise<MediaAttachmentDto> {
    return {
      id: attachment.id,
      ownerType: 'kudo',
      ownerId: attachment.ownerId,
      mediaType: attachment.mediaType,
      status: attachment.status,
      mimeType: attachment.mimeType as MediaAttachmentDto['mimeType'],
      originalName: attachment.originalName,
      sizeBytes: Number(attachment.sizeBytes),
      durationSeconds: attachment.durationSeconds,
      failureCode: attachment.failureCode,
      contentUrl:
        attachment.status === MediaStatus.ready
          ? this.storage.presignRead(attachment.objectKey)
          : null,
    };
  }
}
