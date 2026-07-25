import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  goodJobPrisma?: PrismaClient;
};

export const database =
  globalForPrisma.goodJobPrisma ??
  new PrismaClient({
    log: process.env['NODE_ENV'] === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.goodJobPrisma = database;
}

export * from '@prisma/client';
