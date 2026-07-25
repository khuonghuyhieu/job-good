import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { parseServerConfig } from '@good-job/config';

import { AppModule } from './app.module.js';
import { AuthenticatedSocketService } from './auth/authenticated-socket.service.js';
import { SessionService } from './auth/session/session.service.js';
import { ApiExceptionFilter } from './http/api-exception.filter.js';
import { requestIdMiddleware } from './request-id.middleware.js';

const config = parseServerConfig(process.env);
const app = await NestFactory.create(AppModule.register(config));

if (config.SESSION_TRUST_PROXY) {
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
}
app.use(requestIdMiddleware);
app.use(app.get(SessionService).middleware);
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
