import { createServer, type AddressInfo } from 'node:net';
import { defineConfig } from '@playwright/test';
import { args, channel } from './tools/browser';

// Every run serves the app on its own free port, so parallel runs (one per agent or worktree) never collide.
// Workers re-evaluate this file; the env var hands them the runner's port.
process.env.PERCH_E2E_PORT ??= String(
  await new Promise<number>((resolve, reject) => {
    const probe = createServer().once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => resolve(port));
    });
  }),
);
const port = process.env.PERCH_E2E_PORT;
const baseURL = `http://127.0.0.1:${port}`;
/**
 * Suites that must not share the machine with the parallel ones: offline audio renders, the replay's fast-forward, and
 * preview-regressions, whose side-button test chains four page loads (about 4 s each since the Rendering merge) inside
 * 30 s. Its place here is temporary: the renderer-ready hook round fixes the load time and moves it back (D-BUILD-011).
 */
const SERIAL = /(audio|result|preview-regressions)\.spec\.ts$/;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  use: { baseURL, channel, launchOptions: { args } },
  // The offline audio renders stall past 30 s when they share the machine with the parallel browser suites, so they
  // run alone, one worker, after everything else (D-QA-010). `--no-deps` runs a serial file without the rest.
  projects: [
    { name: 'app', testIgnore: SERIAL },
    { name: 'serial', testMatch: SERIAL, dependencies: ['app'], workers: 1 },
  ],
  webServer: {
    command: `npx vite --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
  },
});
