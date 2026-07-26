import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  decodeFeedCursor,
  encodeFeedCursor,
  InvalidFeedCursorError,
} from './feed-cursor.js';

describe('Feed cursor', () => {
  it('round-trips the deterministic ordering boundary', () => {
    const boundary = {
      committedAt: new Date('2026-07-25T12:30:00.000Z'),
      id: randomUUID(),
    };
    expect(decodeFeedCursor(encodeFeedCursor(boundary))).toEqual(boundary);
  });

  it('rejects malformed and unsupported cursors', () => {
    expect(() => decodeFeedCursor('not-json')).toThrow(InvalidFeedCursorError);
    expect(() =>
      decodeFeedCursor(
        Buffer.from(
          JSON.stringify({
            version: 2,
            committedAt: new Date().toISOString(),
            id: randomUUID(),
          }),
        ).toString('base64url'),
      ),
    ).toThrow(InvalidFeedCursorError);
  });
});
