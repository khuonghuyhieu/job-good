import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { parseServerConfig } from '@good-job/config';

import { AppModule } from './app.module.js';
import { requestIdMiddleware } from './request-id.middleware.js';

const config = parseServerConfig(process.env);
const app = await NestFactory.create(AppModule.register(config));

app.use(requestIdMiddleware);
app.enableCors({
  origin: config.WEB_ORIGIN,
  credentials: true,
});
app.enableShutdownHooks();

await app.listen(config.API_PORT, '0.0.0.0');
Logger.log(`API listening on port ${config.API_PORT}`, 'Bootstrap');
