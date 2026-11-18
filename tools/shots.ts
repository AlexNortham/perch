// npm run shots -- --scene <name> [--cam <preset>] [--hero <id>] [--seed <n>] [--t <seconds>] [--quality <q>]
//                  [--out <file>] [--file <path/to/perch.html>]
// Serves the app on a free port (or opens --file over file://), loads ?scene=…&cam=…, waits for
// window.__perch.ready === true and saves a 1920×1080 PNG (default out/shots/<scene>[-<cam>].png).
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import { args, channel } from './browser';

const READY_TIMEOUT_MS = 60_000;
const { values } = parseArgs({
  options: {
    scene: { type: 'string' },
    cam: { type: 'string' },
    hero: { type: 'string' },
    seed: { type: 'string' },
    t: { type: 'string' },
    quality: { type: 'string' },
    out: { type: 'string' },
    file: { type: 'string' },
  },
});
const { out, file, ...params } = values;
if (!params.scene) {
  console.error('usage: npm run shots -- --scene <name> [--cam <preset>] [--hero <id>] [--seed <n>] [--t <s>] [--quality <q>] [--out <png>] [--file <html>]');
  process.exit(2);
}
const png = resolve(out ?? `out/shots/${params.scene}${params.cam ? `-${params.cam}` : ''}.png`);
const query = new URLSearchParams(params as Record<string, string>);

const started = performance.now();
let server: ViteDevServer | undefined;
let base: string;
if (file) {
  base = pathToFileURL(resolve(file)).href;
} else {
  server = await createServer({ server: { host: '127.0.0.1', port: 0, watch: null }, logLevel: 'error', clearScreen: false });
  await server.listen();
  base = server.resolvedUrls?.local[0] ?? '';
}
const browser = await chromium.launch({ channel, args });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') console.error(`[page ${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => console.error(`[page error] ${err.message}`));
  const url = `${base}?${query}`;
  await page.goto(url);
  await page.waitForFunction('window.__perch?.ready === true', null, { timeout: READY_TIMEOUT_MS }).catch(() => {
    throw new Error(`shots: window.__perch.ready was not true ${READY_TIMEOUT_MS / 1000}s after loading ${url}`);
  });
  mkdirSync(dirname(png), { recursive: true });
  await page.screenshot({ path: png });
  console.log(`shots: ${png} (${((performance.now() - started) / 1000).toFixed(1)}s)`);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await browser.close();
  await server?.close();
}
