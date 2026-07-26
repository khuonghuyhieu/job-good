import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import type { CreateUploadIntentRequest } from '@good-job/contracts';
import {
  database,
  MediaOwnerType,
  MediaStatus,
  MediaType,
  OutboxStatus,
} from '@good-job/database';

import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal.js';

@Injectable()
export class MediaRepository {
  create(
    principal: AuthenticatedPrincipal,
    input: CreateUploadIntentRequest,
    objectKey: string,
  ) {
    return database.mediaAttachment.create({
      data: {
        organizationId: principal.organizationId,
        createdById: principal.employeeId,
        ownerType: MediaOwnerType.kudo,
        mediaType:
          input.mediaType === 'image' ? MediaType.image : MediaType.video,
        mimeType: input.mimeType,
        originalName: input.originalName,
        sizeBytes: BigInt(input.sizeBytes),
        objectKey,
      },
    });
  }

  findAuthorized(principal: AuthenticatedPrincipal, attachmentId: string) {
    return database.mediaAttachment.findFirst({
      where: {
        id: attachmentId,
        organizationId: principal.organizationId,
        OR: [{ createdById: principal.employeeId }, { ownerId: { not: null } }],
      },
    });
  }

  async completeImage(attachmentId: string) {
    return database.mediaAttachment.update({
      where: { id: attachmentId, status: MediaStatus.uploading },
      data: { status: MediaStatus.ready, failureCode: null },
    });
  }

  async queueVideo(organizationId: string, attachmentId: string) {
    return database.$transaction(async (transaction) => {
      const attachment = await transaction.mediaAttachment.update({
        where: { id: attachmentId, status: MediaStatus.uploading },
        data: { status: MediaStatus.processing, failureCode: null },
      });
      await transaction.transactionalOutbox.create({
        data: {
          id: randomUUID(),
          organizationId,
          eventType: 'media.video_processing_requested',
          aggregateType: 'media_attachment',
          aggregateId: attachmentId,
          payload: { attachmentId },
          status: OutboxStatus.pending,
        },
      });
      return attachment;
    });
  }

  removeUnbound(principal: AuthenticatedPrincipal, attachmentId: string) {
    return database.mediaAttachment.delete({
      where: {
        id: attachmentId,
        organizationId: principal.organizationId,
        createdById: principal.employeeId,
        ownerId: null,
      },
    });
  }
}
