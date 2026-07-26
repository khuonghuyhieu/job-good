import { type DynamicModule, Module } from '@nestjs/common';
import type { ServerConfig } from '@good-job/config';

import { CONFIG } from '../config.js';
import { MediaService } from './application/media.service.js';
import { MediaController } from './http/media.controller.js';
import { MediaRepository } from './infrastructure/media.repository.js';
import { ObjectStorageService } from './infrastructure/object-storage.service.js';

@Module({})
export class MediaModule {
  static register(config: ServerConfig): DynamicModule {
    return {
      module: MediaModule,
      controllers: [MediaController],
      providers: [
        { provide: CONFIG, useValue: config },
        MediaService,
        MediaRepository,
        ObjectStorageService,
      ],
    };
  }
}
