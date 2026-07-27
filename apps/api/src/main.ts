import 'reflect-metadata';

import { Logger, type LogLevel } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { parseServerConfig } from '@good-job/config';

import { AppModule } from './app.module.js';
import { AuthenticatedSocketService } from './auth/authenticated-socket.service.js';
import { SessionService } from './auth/session/session.service.js';
import { ApiExceptionFilter } from './http/api-exception.filter.js';
import { requestIdMiddleware } from './request-id.middleware.js';
import {
  csrfOriginMiddleware,
  requestBoundaryErrorMiddleware,
  securityHeadersMiddleware,
} from './http/security.middleware.js';
import { rateLimitMiddleware } from './http/rate-limit.middleware.js';
import { requestLoggingMiddleware } from './http/request-logging.middleware.js';
import { RedisService } from './redis.service.js';

const config = parseServerConfig(process.env);
const logLevels: Record<typeof config.LOG_LEVEL, LogLevel[]> = {
  debug: ['debug', 'log', 'warn', 'error'],
  info: ['log', 'warn', 'error'],
  warn: ['warn', 'error'],
  error: ['error'],
};
const app = await NestFactory.create<NestExpressApplication>(
  AppModule.register(config),
  { bodyParser: false, logger: logLevels[config.LOG_LEVEL] },
);

if (config.SESSION_TRUST_PROXY) {
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
}
app.getHttpAdapter().getInstance().disable('x-powered-by');
app.use(requestIdMiddleware);
app.use(requestLoggingMiddleware);
app.use(securityHeadersMiddleware);
app.use(csrfOriginMiddleware(config));
app.useBodyParser('json', { limit: config.API_MAX_JSON_BYTES });
app.useBodyParser('urlencoded', {
  extended: false,
  limit: config.API_MAX_JSON_BYTES,
});
app.use(requestBoundaryErrorMiddleware);
app.use(app.get(SessionService).middleware);
app.use(rateLimitMiddleware(config, app.get(RedisService)));
app
  .getHttpAdapter()
  .getInstance()
  .set('sessionCookieName', config.SESSION_COOKIE_NAME);
app.useGlobalFilters(new ApiExceptionFilter());
app.enableCors({
  origin: config.WEB_ORIGIN,
  credentials: true,
});
app.enableShutdownHooks();
app.get(AuthenticatedSocketService).attach(app.getHttpServer());

await app.listen(config.API_PORT, '0.0.0.0');
Logger.log(`API listening on port ${config.API_PORT}`, 'Bootstrap');
