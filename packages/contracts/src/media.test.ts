import { describe, expect, it } from 'vitest';

import {
  createUploadIntentRequestSchema,
  mediaAttachmentSchema,
} from './media.js';

describe('media contracts', () => {
  it('accepts bounded Kudo media metadata and rejects identity or comment ownership', () => {
    const input = {
      ownerType: 'kudo',
      mediaType: 'image',
      mimeType: 'image/png',
      originalName: 'team.png',
      sizeBytes: 1024,
    };
    expect(createUploadIntentRequestSchema.parse(input)).toEqual(input);
    expect(
      createUploadIntentRequestSchema.safeParse({
        ...input,
        ownerType: 'comment',
      }).success,
    ).toBe(false);
    expect(
      createUploadIntentRequestSchema.safeParse({
        ...input,
        organizationId: crypto.randomUUID(),
      }).success,
    ).toBe(false);
  });

  it('represents processing without a content URL and ready media with one', () => {
    const base = {
      id: crypto.randomUUID(),
      ownerType: 'kudo',
      ownerId: null,
      mediaType: 'video',
      mimeType: 'video/mp4',
      originalName: 'demo.mp4',
      sizeBytes: 2048,
      durationSeconds: null,
      failureCode: null,
    };
    expect(
      mediaAttachmentSchema.parse({
        ...base,
        status: 'processing',
        contentUrl: null,
      }).contentUrl,
    ).toBeNull();
  });
});
