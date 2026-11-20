import { defineConfig } from 'vitest/config';

// `npm run slow`: only the slow tier (*.slow.test.ts), one file at a time. These are deterministic (seeded) suites that
// take minutes, so `npm test` skips them; run them once per release candidate and after any change to src/sim/ai.
export default defineConfig({
  test: {
    include: ['src/**/*.slow.test.ts', 'tests/**/*.slow.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 900_000,
    hookTimeout: 900_000,
  },
});
