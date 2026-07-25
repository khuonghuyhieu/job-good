import session from 'express-session';
import type { Redis } from 'ioredis';

export class RedisSessionStore extends session.Store {
  constructor(
    private readonly redis: Redis,
    private readonly prefix: string,
    private readonly ttlSeconds: number,
  ) {
    super();
  }

  override get(
    sessionId: string,
    callback: (error: unknown, session?: session.SessionData | null) => void,
  ): void {
    void this.redis
      .get(this.key(sessionId))
      .then((value) => callback(null, value ? JSON.parse(value) : null))
      .catch(callback);
  }

  override set(
    sessionId: string,
    value: session.SessionData,
    callback?: (error?: unknown) => void,
  ): void {
    void this.redis
      .set(this.key(sessionId), JSON.stringify(value), 'EX', this.getTtl(value))
      .then(() => callback?.())
      .catch((error: unknown) => callback?.(error));
  }

  override destroy(
    sessionId: string,
    callback?: (error?: unknown) => void,
  ): void {
    void this.redis
      .del(this.key(sessionId))
      .then(() => callback?.())
      .catch((error: unknown) => callback?.(error));
  }

  override touch(
    sessionId: string,
    value: session.SessionData,
    callback?: () => void,
  ): void {
    void this.redis
      .expire(this.key(sessionId), this.getTtl(value))
      .then(() => callback?.())
      .catch(() => callback?.());
  }

  private key(sessionId: string): string {
    return `${this.prefix}${sessionId}`;
  }

  private getTtl(value: session.SessionData): number {
    const expiresAt = value.cookie.expires?.getTime();
    if (!expiresAt) {
      return this.ttlSeconds;
    }
    return Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
  }
}
