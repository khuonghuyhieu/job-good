import { describe, expect, it } from 'vitest';
import { parseServerConfig } from '@good-job/config';
import { ApiException } from '../../http/api.exception.js';

import { matchesImageSignature, validateMediaPolicy } from './media-policy.js';

const config = parseServerConfig({
  NODE_ENV: 'test',
  WEB_ORIGIN: 'http://localhost:8080',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/database',
  REDIS_URL: 'redis://localhost:6379',
  SESSION_SECRET: 'test-session-secret-at-least-32-characters',
  OBJECT_STORAGE_ENDPOINT: 'http://localhost:9000',
  OBJECT_STORAGE_REGION: 'us-east-1',
  OBJECT_STORAGE_BUCKET: 'good-job-media',
  OBJECT_STORAGE_ACCESS_KEY: 'test',
  OBJECT_STORAGE_SECRET_KEY: 'test-secret',
  OBJECT_STORAGE_FORCE_PATH_STYLE: 'true',
  MEDIA_MAX_IMAGE_BYTES: '100',
  MEDIA_MAX_VIDEO_BYTES: '200',
  MEDIA_MAX_VIDEO_DURATION_SECONDS: '180',
  WEBSOCKET_PATH: '/socket.io',
  ORGANIZATION_TIMEZONE: 'UTC',
});

describe('media policy', () => {
  it('rejects mismatched MIME and excessive size with stable errors', () => {
    expect(() =>
      validateMediaPolicy(
        {
          ownerType: 'kudo',
          mediaType: 'image',
          mimeType: 'video/mp4',
          originalName: 'bad.mp4',
          sizeBytes: 10,
        },
        config,
      ),
    ).toThrow(ApiException);
    try {
      validateMediaPolicy(
        {
          ownerType: 'kudo',
          mediaType: 'image',
          mimeType: 'image/png',
          originalName: 'large.png',
          sizeBytes: 101,
        },
        config,
      );
    } catch (error) {
      expect((error as ApiException).getStatus()).toBe(413);
    }
  });

  it('recognizes JPEG, PNG and WebP signatures without trusting the filename', () => {
    expect(
      matchesImageSignature(
        'image/jpeg',
        new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0xff, 0xd9]),
      ),
    ).toBe(true);
    expect(
      matchesImageSignature(
        'image/png',
        new Uint8Array(
          Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4gAAAABJRU5ErkJggg==',
            'base64',
          ),
        ),
      ),
    ).toBe(true);
    const webp = new Uint8Array(16);
    webp.set(new TextEncoder().encode('RIFF'), 0);
    new DataView(webp.buffer).setUint32(4, 8, true);
    webp.set(new TextEncoder().encode('WEBPVP8L'), 8);
    expect(matchesImageSignature('image/webp', webp)).toBe(true);
    expect(
      matchesImageSignature('image/png', new TextEncoder().encode('not png')),
    ).toBe(false);
  });
});
