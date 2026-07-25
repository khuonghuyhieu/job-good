import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    extends: './vitest.unit.config.ts',
    test: { name: 'unit' },
  },
  {
    extends: './vitest.integration.config.ts',
    test: { name: 'integration' },
  },
  {
    extends: './vitest.e2e.config.ts',
    test: { name: 'e2e' },
  },
]);
