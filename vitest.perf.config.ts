import { defineConfig } from 'vitest/config';

// `npm run perf`: only the timing tests (*.perf.test.ts), one file at a time so nothing else competes for the CPU
// (D-EP-022). Each test takes the median of several runs (tests/helpers/perf.ts).
export default defineConfig({
  test: {
    include: ['src/**/*.perf.test.ts', 'tests/**/*.perf.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 300_000,
  },
});
