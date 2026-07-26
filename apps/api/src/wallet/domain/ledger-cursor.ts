const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type LedgerCursor = {
  createdAt: Date;
  id: string;
};

export class InvalidLedgerCursorError extends Error {}

export function encodeLedgerCursor(cursor: LedgerCursor): string {
  return Buffer.from(
    JSON.stringify({
      version: 1,
      createdAt: cursor.createdAt.toISOString(),
      id: cursor.id,
    }),
  ).toString('base64url');
}

export function decodeLedgerCursor(cursor: string): LedgerCursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as unknown;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('version' in parsed) ||
      parsed.version !== 1 ||
      !('createdAt' in parsed) ||
      typeof parsed.createdAt !== 'string' ||
      !('id' in parsed) ||
      typeof parsed.id !== 'string' ||
      !uuidPattern.test(parsed.id)
    ) {
      throw new Error('Invalid cursor payload.');
    }
    const createdAt = new Date(parsed.createdAt);
    if (
      !Number.isFinite(createdAt.getTime()) ||
      createdAt.toISOString() !== parsed.createdAt
    ) {
      throw new Error('Invalid cursor timestamp.');
    }
    return { createdAt, id: parsed.id };
  } catch {
    throw new InvalidLedgerCursorError('The Wallet cursor is invalid.');
  }
}
