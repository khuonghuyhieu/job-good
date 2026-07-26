import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  decodeRedemptionCursor,
  encodeRedemptionCursor,
  InvalidRedemptionCursorError,
} from './redemption-cursor.js';

describe('redemption history cursor', () => {
  it('round-trips deterministic committedAt and id fields', () => {
    const value = {
      committedAt: new Date('2026-07-26T12:00:00.000Z'),
      id: randomUUID(),
    };
    expect(decodeRedemptionCursor(encodeRedemptionCursor(value))).toEqual(
      value,
    );
  });

  it('rejects malformed and unsupported cursors', () => {
    for (const cursor of [
      'bad',
      Buffer.from(JSON.stringify({ version: 2 })).toString('base64url'),
    ]) {
      expect(() => decodeRedemptionCursor(cursor)).toThrow(
        InvalidRedemptionCursorError,
      );
    }
  });
});
