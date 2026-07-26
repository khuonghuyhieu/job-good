import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { database, MediaStatus } from '@good-job/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createRecognitionTestFixture,
  type RecognitionTestIds,
} from '../../recognition/tests/recognition-test-fixture.js';

describe('Phase 7 Kudo with processing media E2E', () => {
  let app: INestApplication;
  let ids: RecognitionTestIds;
  let login: Awaited<ReturnType<typeof createRecognitionTestFixture>>['login'];

  beforeAll(async () => {
    ({ app, ids, login } = await createRecognitionTestFixture(
      'phase-7-processing-media-e2e',
    ));
  });

  afterAll(async () => {
    await app.close();
  });

  it('commits the Kudo independently and preserves it after media failure', async () => {
    const processingVideo = await database.mediaAttachment.create({
      data: {
        organizationId: ids.organizationId,
        createdById: ids.senderId,
        ownerType: 'kudo',
        mediaType: 'video',
        status: MediaStatus.processing,
        mimeType: 'video/mp4',
        originalName: 'processing.mp4',
        sizeBytes: 4,
        objectKey: `${ids.organizationId}/${ids.senderId}/${randomUUID()}`,
      },
    });
    const agent = await login();
    const response = await agent
      .post('/kudos')
      .set('Idempotency-Key', randomUUID())
      .send({
        receiverId: ids.receiverId,
        points: 20,
        coreValueId: ids.coreValueId,
        description: 'Processing media does not block recognition.',
        attachmentIds: [processingVideo.id],
      });

    expect(response.status).toBe(201);
    expect(response.body.kudo.attachments).toEqual([
      expect.objectContaining({
        id: processingVideo.id,
        status: 'processing',
      }),
    ]);
    await database.mediaAttachment.update({
      where: { id: processingVideo.id },
      data: {
        status: MediaStatus.failed,
        failureCode: 'VIDEO_PROCESSING_FAILED',
      },
    });
    expect(
      await database.kudo.findUnique({ where: { id: response.body.kudo.id } }),
    ).toMatchObject({ status: 'committed' });
  });
});
