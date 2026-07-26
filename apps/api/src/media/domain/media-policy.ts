import type { ServerConfig } from '@good-job/config';
import {
  supportedMediaMimeTypes,
  type CreateUploadIntentRequest,
} from '@good-job/contracts';

import { ApiException } from '../../http/api.exception.js';

const imageMimes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const videoMimes = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

export function validateMediaPolicy(
  input: CreateUploadIntentRequest,
  config: ServerConfig,
): void {
  if (
    !supportedMediaMimeTypes.includes(
      input.mimeType as (typeof supportedMediaMimeTypes)[number],
    ) ||
    (input.mediaType === 'image' && !imageMimes.has(input.mimeType)) ||
    (input.mediaType === 'video' && !videoMimes.has(input.mimeType))
  ) {
    throw new ApiException(415, {
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: 'The selected media type is not supported.',
    });
  }
  const maximum =
    input.mediaType === 'image'
      ? config.MEDIA_MAX_IMAGE_BYTES
      : config.MEDIA_MAX_VIDEO_BYTES;
  if (input.sizeBytes > maximum) {
    throw new ApiException(413, {
      code: 'MEDIA_TOO_LARGE',
      message: 'The selected media exceeds the configured size limit.',
      details: { maximumBytes: maximum, actualBytes: input.sizeBytes },
    });
  }
}

export function matchesImageSignature(
  mimeType: string,
  bytes: Uint8Array,
): boolean {
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  const text = new TextDecoder().decode(bytes.slice(0, 12));
  const isWebpHeader =
    text.slice(0, 4) === 'RIFF' && text.slice(8, 12) === 'WEBP';
  const webpDeclaredSize =
    bytes.length >= 12
      ? new DataView(
          bytes.buffer,
          bytes.byteOffset,
          bytes.byteLength,
        ).getUint32(4, true) + 8
      : 0;
  const hasWebpChunk =
    bytes.length >= 16 &&
    ['VP8 ', 'VP8L', 'VP8X'].includes(
      new TextDecoder().decode(bytes.slice(12, 16)),
    );
  const isCompleteWebp =
    isWebpHeader && webpDeclaredSize === bytes.length && hasWebpChunk;
  const isCompleteJpeg =
    isJpeg &&
    bytes.length >= 4 &&
    bytes.at(-2) === 0xff &&
    bytes.at(-1) === 0xd9;
  const isCompletePng =
    isPng &&
    bytes.length >= 20 &&
    new TextDecoder().decode(bytes.slice(-8, -4)) === 'IEND';
  return (
    (mimeType === 'image/jpeg' && isCompleteJpeg) ||
    (mimeType === 'image/png' && isCompletePng) ||
    (mimeType === 'image/webp' && isCompleteWebp)
  );
}
