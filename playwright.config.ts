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

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  use: { baseURL, channel, launchOptions: { args } },
  webServer: {
    command: `npx vite --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
  },
});
