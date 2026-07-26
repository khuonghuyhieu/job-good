import { describe, expect, it } from 'vitest';

import {
  createCommentRequestSchema,
  feedQuerySchema,
  setReactionRequestSchema,
} from './community.js';

describe('Phase 4 community contracts', () => {
  it('bounds Feed pages and accepts opaque cursors', () => {
    expect(feedQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(feedQuerySchema.parse({ cursor: 'opaque', limit: '50' })).toEqual({
      cursor: 'opaque',
      limit: 50,
    });
    expect(feedQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(feedQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
  });

  it('allows only the fixed supported emoji set', () => {
    expect(setReactionRequestSchema.parse({ emojiCode: 'celebrate' })).toEqual({
      emojiCode: 'celebrate',
    });
    expect(
      setReactionRequestSchema.safeParse({ emojiCode: 'thumbs-up' }).success,
    ).toBe(false);
  });

  it('trims comments and rejects empty text or media fields', () => {
    expect(createCommentRequestSchema.parse({ body: '  Thank you  ' })).toEqual(
      {
        body: 'Thank you',
      },
    );
    expect(createCommentRequestSchema.safeParse({ body: '   ' }).success).toBe(
      false,
    );
    expect(
      createCommentRequestSchema.safeParse({
        body: 'Hello',
        attachmentIds: [],
      }).success,
    ).toBe(false);
  });
});
