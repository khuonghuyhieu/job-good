const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type FeedCursor = {
  committedAt: Date;
  id: string;
};

export class InvalidFeedCursorError extends Error {}

export function encodeFeedCursor(cursor: FeedCursor): string {
  return Buffer.from(
    JSON.stringify({
      version: 1,
      committedAt: cursor.committedAt.toISOString(),
      id: cursor.id,
    }),
  ).toString('base64url');
}

export function decodeFeedCursor(cursor: string): FeedCursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as unknown;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('version' in parsed) ||
      parsed.version !== 1 ||
      !('committedAt' in parsed) ||
      typeof parsed.committedAt !== 'string' ||
      !('id' in parsed) ||
      typeof parsed.id !== 'string' ||
      !uuidPattern.test(parsed.id)
    ) {
      throw new Error('Invalid cursor payload.');
    }
    const committedAt = new Date(parsed.committedAt);
    if (
      !Number.isFinite(committedAt.getTime()) ||
      committedAt.toISOString() !== parsed.committedAt
    ) {
      throw new Error('Invalid cursor timestamp.');
    }
    return { committedAt, id: parsed.id };
  } catch {
    throw new InvalidFeedCursorError('The Feed cursor is invalid.');
  }
}
