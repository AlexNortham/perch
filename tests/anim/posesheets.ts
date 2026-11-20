// Pose sheets: `npx tsx tests/anim/posesheets.ts [hero…] [--states a,b] [--views 3/4,side,left,back] [--cols n] [--size px]
// [--look golden] [--out dir] [--suffix s]`
// Serves the app with Vite, opens tests/anim/sheet.html for each playable bird (or those named) and saves
// out/anim/<hero>.png: every animation state from three-quarter and side views (D-EP-035 review).
// Art frames: `--frame "name=x&mode=player&hero=peacock"` (repeatable) captures tests/anim/frame.html instead, saving
// <out>/<name>.png and printing the frame's measured stats (see frame.ts for the modes).
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { args, channel } from '../../tools/browser';
import { PLAYABLE } from './states';

const READY_TIMEOUT_MS = 60_000;
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    states: { type: 'string' }, cols: { type: 'string' }, size: { type: 'string' }, views: { type: 'string' }, look: { type: 'string' },
    out: { type: 'string' }, suffix: { type: 'string' }, frame: { type: 'string', multiple: true },
  },
});
const heroes = positionals.length > 0 ? positionals : PLAYABLE;
const dir = resolve(values.out ?? 'out/anim');
mkdirSync(dir, { recursive: true });

const server = await createServer({ server: { host: '127.0.0.1', port: 0, watch: null }, logLevel: 'error', clearScreen: false });
await server.listen();
const base = server.resolvedUrls?.local[0] ?? '';
const browser = await chromium.launch({ channel, args });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', (err) => console.error(`[page error] ${err.message}`));
  page.on('console', (msg) => msg.type() === 'error' && console.error(`[page] ${msg.text()}`));
  if (values.frame) {
    for (const query of values.frame) {
      const name = new URLSearchParams(query).get('name') ?? 'frame';
      await page.goto(`${base}tests/anim/frame.html?${query}`);
      await page.waitForFunction('window.__frameReady === true', null, { timeout: READY_TIMEOUT_MS });
      const png = `${dir}/${name}.png`;
      await page.locator('#frame').screenshot({ path: png });
      console.log(`frame: ${png} ${JSON.stringify(await page.evaluate('window.__frameStats'))}`);
    }
  } else {
    for (const hero of heroes) {
      const q = new URLSearchParams({ hero });
      for (const k of ['states', 'cols', 'size', 'views', 'look'] as const) if (values[k]) q.set(k, values[k]);
      await page.goto(`${base}tests/anim/sheet.html?${q}`);
      await page.waitForFunction('window.__sheetReady === true', null, { timeout: READY_TIMEOUT_MS });
      const png = `${dir}/${hero}${values.suffix ?? ''}.png`;
      await page.locator('#sheet').screenshot({ path: png });
      console.log(`posesheets: ${png}`);
    }
  }
} finally {
  await browser.close();
  await server.close();
}
