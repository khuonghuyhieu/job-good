import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { database, MediaStatus } from '@good-job/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import {
  createRecognitionTestFixture,
  type RecognitionTestIds,
} from '../../recognition/tests/recognition-test-fixture.js';

const png = new Uint8Array(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4gAAAABJRU5ErkJggg==',
    'base64',
  ),
);

describe('Phase 7 direct media upload', () => {
  let app: INestApplication;
  let ids: RecognitionTestIds;
  let login: Awaited<ReturnType<typeof createRecognitionTestFixture>>['login'];

  beforeAll(async () => {
    ({ app, ids, login } = await createRecognitionTestFixture('phase-7-media'));
  });

  afterAll(async () => {
    await app.close();
  });

  async function intent(
    agent: Awaited<ReturnType<typeof request.agent>>,
    overrides: Record<string, unknown> = {},
  ) {
    return agent.post('/media/upload-intents').send({
      ownerType: 'kudo',
      mediaType: 'image',
      mimeType: 'image/png',
      originalName: 'proof.png',
      sizeBytes: png.byteLength,
      ...overrides,
    });
  }

  it('protects upload intents and rejects unsupported or oversized metadata', async () => {
    expect(
      (await request(app.getHttpServer()).post('/media/upload-intents')).status,
    ).toBe(401);
    const agent = await login();
    const unsupported = await intent(agent, { mimeType: 'image/svg+xml' });
    const oversized = await intent(agent, { sizeBytes: 10_485_761 });
    expect(unsupported.status).toBe(415);
    expect(unsupported.body.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(oversized.status).toBe(413);
    expect(oversized.body.code).toBe('MEDIA_TOO_LARGE');
  });

  it('uploads directly to MinIO and completes an image from uploading to ready', async () => {
    const agent = await login();
    const created = await intent(agent);
    expect(created.status).toBe(201);
    expect(created.body.attachment.status).toBe('uploading');
    expect(new URL(created.body.upload.url).port).toBe('9000');

    const upload = await fetch(created.body.upload.url, {
      method: 'PUT',
      headers: created.body.upload.headers,
      body: png,
    });
    expect(upload.ok).toBe(true);
    const completed = await agent.post(
      `/media/${created.body.attachment.id}/complete`,
    );
    expect(completed.status).toBe(201);
    expect(completed.body.attachment).toMatchObject({
      status: 'ready',
      mediaType: 'image',
    });
    expect(completed.body.attachment.contentUrl).toContain('X-Amz-Signature');
  });

  it('rejects corrupt image content and a PUT whose signed length does not match', async () => {
    const agent = await login();
    const corrupt = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 0, 0, 0, 0,
    ]);
    const created = await intent(agent, { sizeBytes: corrupt.byteLength });
    expect(
      (
        await fetch(created.body.upload.url, {
          method: 'PUT',
          headers: created.body.upload.headers,
          body: png,
        })
      ).ok,
    ).toBe(false);
    const matching = await intent(agent, { sizeBytes: corrupt.byteLength });
    expect(
      (
        await fetch(matching.body.upload.url, {
          method: 'PUT',
          headers: matching.body.upload.headers,
          body: corrupt,
        })
      ).ok,
    ).toBe(true);
    const completed = await agent.post(
      `/media/${matching.body.attachment.id}/complete`,
    );
    expect(completed.status).toBe(415);
    expect(completed.body.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('keeps unbound uploads private and queues video without processing it in API', async () => {
    const owner = await login();
    const other = await login(ids.poorSenderId);
    const created = await intent(owner, {
      mediaType: 'video',
      mimeType: 'video/mp4',
      originalName: 'clip.mp4',
      sizeBytes: 4,
    });
    await fetch(created.body.upload.url, {
      method: 'PUT',
      headers: created.body.upload.headers,
      body: new Uint8Array([0, 0, 0, 0]),
    });
    const startedAt = performance.now();
    const completed = await owner.post(
      `/media/${created.body.attachment.id}/complete`,
    );
    expect(performance.now() - startedAt).toBeLessThan(1000);
    expect(completed.body.attachment.status).toBe('processing');
    expect(
      (await other.get(`/media/${created.body.attachment.id}`)).status,
    ).toBe(404);
    expect(
      await database.transactionalOutbox.count({
        where: {
          aggregateId: created.body.attachment.id,
          eventType: 'media.video_processing_requested',
        },
      }),
    ).toBe(1);
  });

  it('enforces the media transition graph and never permits an overlong ready video', async () => {
    const image = await database.mediaAttachment.create({
      data: {
        organizationId: ids.organizationId,
        createdById: ids.senderId,
        ownerType: 'kudo',
        mediaType: 'image',
        mimeType: 'image/png',
        originalName: 'guard.png',
        sizeBytes: 1,
        objectKey: `${ids.organizationId}/${ids.senderId}/${randomUUID()}`,
      },
    });
    await expect(
      database.mediaAttachment.update({
        where: { id: image.id },
        data: { status: MediaStatus.processing },
      }),
    ).rejects.toThrow();
    await expect(
      database.mediaAttachment.create({
        data: {
          organizationId: ids.organizationId,
          createdById: ids.senderId,
          ownerType: 'kudo',
          mediaType: 'video',
          status: MediaStatus.ready,
          mimeType: 'video/mp4',
          originalName: 'too-long.mp4',
          sizeBytes: 1,
          durationSeconds: 180.001,
          objectKey: `${ids.organizationId}/${ids.senderId}/${randomUUID()}`,
        },
      }),
    ).rejects.toThrow();
  });

  it('binds authorized media atomically and media failure does not roll back Kudo', async () => {
    const agent = await login();
    const created = await intent(agent);
    await fetch(created.body.upload.url, {
      method: 'PUT',
      headers: created.body.upload.headers,
      body: png,
    });
    await agent.post(`/media/${created.body.attachment.id}/complete`);
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
    const kudo = await agent
      .post('/kudos')
      .set('Idempotency-Key', randomUUID())
      .send({
        receiverId: ids.receiverId,
        points: 20,
        coreValueId: ids.coreValueId,
        description: 'Kudo media remains independent.',
        attachmentIds: [created.body.attachment.id, processingVideo.id],
      });
    expect(kudo.status).toBe(201);
    expect(kudo.body.kudo.attachments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.body.attachment.id,
          status: 'ready',
        }),
        expect.objectContaining({
          id: processingVideo.id,
          status: 'processing',
        }),
      ]),
    );
    expect(
      (
        await database.mediaAttachment.findUniqueOrThrow({
          where: { id: created.body.attachment.id },
        })
      ).ownerId,
    ).toBe(kudo.body.kudo.id);

    await database.mediaAttachment.update({
      where: { id: processingVideo.id },
      data: {
        status: MediaStatus.failed,
        failureCode: 'VIDEO_PROCESSING_FAILED',
      },
    });
    expect(
      await database.kudo.findUnique({ where: { id: kudo.body.kudo.id } }),
    ).not.toBeNull();
  });
});
