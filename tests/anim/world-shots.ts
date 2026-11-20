// World model frames (D-ART-014): `npx tsx tests/anim/world-shots.ts --frame "name=hawk&items=structure:hawk:dawn" … [--out dir]`.
// Serves the app with Vite, opens tests/anim/world.html per frame and saves <out>/<name>.png (default out/world),
// printing the frame's draw calls and triangles. See world.ts for the query.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { args, channel } from '../../tools/browser';

const READY_TIMEOUT_MS = 120_000;
const { values } = parseArgs({ options: { out: { type: 'string' }, frame: { type: 'string', multiple: true } } });
const dir = resolve(values.out ?? 'out/world');
mkdirSync(dir, { recursive: true });

const server = await createServer({ server: { host: '127.0.0.1', port: 0, watch: null }, logLevel: 'error', clearScreen: false });
await server.listen();
const base = server.resolvedUrls?.local[0] ?? '';
const browser = await chromium.launch({ channel, args });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', (err) => console.error(`[page error] ${err.message}`));
  page.on('console', (msg) => msg.type() === 'error' && console.error(`[page] ${msg.text()}`));
  for (const query of values.frame ?? []) {
    const name = new URLSearchParams(query).get('name') ?? 'frame';
    await page.goto(`${base}tests/anim/world.html?${query}`);
    await page.waitForFunction('window.__frameReady === true', null, { timeout: READY_TIMEOUT_MS });
    const png = `${dir}/${name}.png`;
    await page.locator('#frame').screenshot({ path: png });
    console.log(`world: ${png} ${JSON.stringify(await page.evaluate('window.__frameStats'))}`);
  }
} finally {
  await browser.close();
  await server.close();
}
