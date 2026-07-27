import 'reflect-metadata';

import { Logger, type LogLevel } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { parseServerConfig } from '@good-job/config';

import { AppModule } from './app.module.js';

const config = parseServerConfig(process.env);
const logLevels: Record<typeof config.LOG_LEVEL, LogLevel[]> = {
  debug: ['debug', 'log', 'warn', 'error'],
  info: ['log', 'warn', 'error'],
  warn: ['warn', 'error'],
  error: ['error'],
};
const app = await NestFactory.create(AppModule.register(config), {
  logger: logLevels[config.LOG_LEVEL],
});
app.enableShutdownHooks();

await app.listen(config.WORKER_HEALTH_PORT, '0.0.0.0');
Logger.log(
  `Worker health server listening on port ${config.WORKER_HEALTH_PORT}`,
  'Bootstrap',
);
