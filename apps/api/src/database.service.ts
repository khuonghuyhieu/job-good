import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { database } from '@good-job/database';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  async ping(): Promise<void> {
    await database.$queryRaw`SELECT 1`;
  }

  async onApplicationShutdown(): Promise<void> {
    await database.$disconnect();
  }
}
