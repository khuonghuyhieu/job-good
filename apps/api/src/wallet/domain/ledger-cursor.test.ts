import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  decodeLedgerCursor,
  encodeLedgerCursor,
  InvalidLedgerCursorError,
} from './ledger-cursor.js';

describe('Wallet ledger cursor', () => {
  it('round-trips the stable createdAt and id boundary', () => {
    const boundary = {
      createdAt: new Date('2026-07-26T10:00:00.000Z'),
      id: randomUUID(),
    };
    expect(decodeLedgerCursor(encodeLedgerCursor(boundary))).toEqual(boundary);
  });

  it('rejects malformed and unsupported cursors', () => {
    expect(() => decodeLedgerCursor('broken')).toThrow(
      InvalidLedgerCursorError,
    );
    expect(() =>
      decodeLedgerCursor(
        Buffer.from(
          JSON.stringify({
            version: 2,
            createdAt: new Date().toISOString(),
            id: randomUUID(),
          }),
        ).toString('base64url'),
      ),
    ).toThrow(InvalidLedgerCursorError);
  });
});
