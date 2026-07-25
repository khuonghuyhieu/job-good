import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import type { ServerConfig } from '@good-job/config';
import session from 'express-session';
import { Redis } from 'ioredis';

import { CONFIG } from '../../config.js';
import { RedisSessionStore } from './redis-session.store.js';

@Injectable()
export class SessionService implements OnApplicationShutdown {
  private readonly redis: Redis;
  readonly middleware: ReturnType<typeof session>;

  constructor(@Inject(CONFIG) config: ServerConfig) {
    this.redis = new Redis(config.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    this.middleware = session({
      name: config.SESSION_COOKIE_NAME,
      secret: config.SESSION_SECRET,
      store: new RedisSessionStore(
        this.redis,
        config.SESSION_REDIS_PREFIX,
        config.SESSION_TTL_SECONDS,
      ),
      resave: false,
      saveUninitialized: false,
      rolling: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.SESSION_COOKIE_SECURE,
        maxAge: config.SESSION_TTL_SECONDS * 1000,
        path: '/',
      },
    });
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.redis.status !== 'end') {
      this.redis.disconnect();
    }
  }
}
