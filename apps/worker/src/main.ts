import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { parseServerConfig } from '@good-job/config';

import { AppModule } from './app.module.js';

const config = parseServerConfig(process.env);
const app = await NestFactory.create(AppModule.register(config));
app.enableShutdownHooks();

await app.listen(config.WORKER_HEALTH_PORT, '0.0.0.0');
Logger.log(
  `Worker health server listening on port ${config.WORKER_HEALTH_PORT}`,
  'Bootstrap',
);
