import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@good-job/config/browser',
        replacement: fileURLToPath(
          new URL('./packages/config/src/browser.ts', import.meta.url),
        ),
      },
      {
        find: '@good-job/config',
        replacement: fileURLToPath(
          new URL('./packages/config/src/index.ts', import.meta.url),
        ),
      },
      {
        find: '@good-job/contracts',
        replacement: fileURLToPath(
          new URL('./packages/contracts/src/index.ts', import.meta.url),
        ),
      },
      {
        find: '@good-job/database',
        replacement: fileURLToPath(
          new URL('./packages/database/src/index.ts', import.meta.url),
        ),
      },
    ],
  },
  test: {
    env: {
      VITE_API_URL: 'http://localhost:3000',
    },
    environment: 'node',
    include: ['packages/**/*.test.ts', 'apps/**/*.test.{ts,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.integration.test.ts',
      '**/*.e2e.test.ts',
    ],
  },
});
