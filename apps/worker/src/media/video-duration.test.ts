import { describe, expect, it } from 'vitest';

import {
  validateVideoDuration,
  validateVideoMetadata,
} from './video-duration.js';
import { shouldPersistTerminalFailure } from './media-worker.service.js';

describe('video duration policy', () => {
  it('accepts exactly 180 seconds and rejects any greater duration', () => {
    expect(validateVideoDuration(180, 180)).toEqual({ accepted: true });
    expect(validateVideoDuration(180.001, 180)).toEqual({
      accepted: false,
      failureCode: 'VIDEO_DURATION_EXCEEDED',
    });
  });

  it('requires a supported container and at least one supported video stream', () => {
    expect(validateVideoMetadata('video/mp4', ['mov', 'mp4'], ['h264'])).toBe(
      true,
    );
    expect(
      validateVideoMetadata('video/webm', ['matroska', 'webm'], ['vp9']),
    ).toBe(true);
    expect(validateVideoMetadata('video/mp4', ['mov', 'mp4'], [])).toBe(false);
    expect(validateVideoMetadata('video/mp4', ['mp3'], ['h264'])).toBe(false);
    expect(
      validateVideoMetadata('video/mp4', ['mov', 'mp4'], ['mpeg2video']),
    ).toBe(false);
  });

  it('persists failure only on the final configured Worker attempt', () => {
    expect(shouldPersistTerminalFailure(0, 3)).toBe(false);
    expect(shouldPersistTerminalFailure(1, 3)).toBe(false);
    expect(shouldPersistTerminalFailure(2, 3)).toBe(true);
  });
});
