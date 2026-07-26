import { type DynamicModule, Module } from '@nestjs/common';
import type { ServerConfig } from '@good-job/config';

import { CONFIG } from './config.js';
import { HealthController } from './health.controller.js';
import { QueueHealthService } from './queue-health.service.js';
import { FfprobeService } from './media/ffprobe.service.js';
import { MediaWorkerService } from './media/media-worker.service.js';
import { WorkerObjectStorageService } from './media/worker-object-storage.service.js';
import { OutboxPublisherService } from './outbox/outbox-publisher.service.js';

@Module({})
export class AppModule {
  static register(config: ServerConfig): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController],
      providers: [
        { provide: CONFIG, useValue: config },
        QueueHealthService,
        FfprobeService,
        WorkerObjectStorageService,
        MediaWorkerService,
        OutboxPublisherService,
      ],
    };
  }
}
