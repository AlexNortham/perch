// In-browser soak (Stage 4 Release 1 gate, D-QA-0xx).
//   npm run soak -- [--minutes 30] [--hero kingfisher] [--seed 1] [--out out/soak/soak.json]
// Serves the app on a free port, opens a real 1 + 11 Play match in Edge and lets it run in real time, sampling the JS
// heap, the frame time (rAF deltas) and the sim tick every 10 s. Prints a table and the trend: heap growth per minute
// over the second half (a leak shows as a steady climb after the first GC cycles) and the frame-time p95 of the first
// versus last quarter. Exit 1 on a page error, a heap that grows more than HEAP_MB_PER_MIN_MAX a minute over the second
// half, or a last-quarter p95 frame time more than 1.5x the first quarter's.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { args, channel } from './browser';

const { values } = parseArgs({
  options: {
    minutes: { type: 'string', default: '30' },
    hero: { type: 'string', default: 'Kingfisher' },
    seed: { type: 'string', default: '1' },
    out: { type: 'string', default: 'out/soak/soak.json' },
  },
});
const minutes = Number(values.minutes);
const SAMPLE_MS = 10_000;
const HEAP_MB_PER_MIN_MAX = 2;
const FRAME_GROWTH_MAX = 1.5;

const port = await new Promise<number>((done) => {
  const probe = createServer().listen(0, '127.0.0.1', () => {
    const p = (probe.address() as { port: number }).port;
    probe.close(() => done(p));
  });
});
const server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { shell: true, stdio: 'ignore' });
const stop = (): void => {
  server.kill();
};
process.on('exit', stop);

interface Sample { minute: number; heapMB: number; tick: number; frameMean: number; frameP95: number; frameMax: number }
const samples: Sample[] = [];
const errors: string[] = [];
try {
  for (let i = 0; i < 60; i++) {
    if (await fetch(`http://127.0.0.1:${port}/`).then((r) => r.ok, () => false)) break;
    await new Promise((r) => setTimeout(r, 1_000));
  }
  const browser = await chromium.launch({ channel, args: [...args, '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/?seed=${values.seed}`);
  await page.waitForFunction('window.__perch?.ready === true', null, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^${values.hero}\\b`) }).click();
  await page.waitForFunction('window.__perch?.hero != null', null, { timeout: 60_000 });
  await page.evaluate(() => {
    const w = window as unknown as { __frames: number[] };
    w.__frames = [];
    let last = performance.now();
    const tick = (now: number): void => {
      w.__frames.push(now - last);
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const started = Date.now();
  while (Date.now() - started < minutes * 60_000) {
    await page.waitForTimeout(SAMPLE_MS);
    const s = await page.evaluate(() => {
      const w = window as unknown as { __frames: number[]; gc?: () => void; __perch: { state: { tick: number } } };
      const f = w.__frames.splice(0).sort((a, b) => a - b);
      w.gc?.();
      const heap = (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize / 1_048_576;
      const at = (q: number): number => f[Math.min(f.length - 1, Math.floor(f.length * q))] ?? 0;
      return { heapMB: heap, tick: w.__perch.state.tick, frameMean: f.reduce((a, b) => a + b, 0) / (f.length || 1), frameP95: at(0.95), frameMax: f[f.length - 1] ?? 0 };
    });
    const row = { minute: (Date.now() - started) / 60_000, ...s };
    samples.push(row);
    console.log(`${row.minute.toFixed(1).padStart(5)} min  heap ${row.heapMB.toFixed(1)} MB  tick ${row.tick}  frame mean ${row.frameMean.toFixed(1)} p95 ${row.frameP95.toFixed(1)} max ${row.frameMax.toFixed(0)} ms`);
  }
  await browser.close();
} finally {
  stop();
}

const half = samples.slice(Math.floor(samples.length / 2));
const slope = (() => {
  if (half.length < 2) return 0;
  const a = half[0]!, b = half[half.length - 1]!;
  return (b.heapMB - a.heapMB) / Math.max(1e-6, b.minute - a.minute);
})();
const q = Math.max(1, Math.floor(samples.length / 4));
const p95 = (xs: Sample[]): number => xs.reduce((a, s) => a + s.frameP95, 0) / (xs.length || 1);
const frameGrowth = p95(samples.slice(-q)) / Math.max(1e-6, p95(samples.slice(0, q)));
const verdict = { minutes, heapMBPerMinSecondHalf: slope, frameP95Growth: frameGrowth, pageErrors: errors, samples };
mkdirSync(dirname(resolve(values.out)), { recursive: true });
writeFileSync(resolve(values.out), JSON.stringify(verdict, null, 2));
console.log(`soak: heap ${slope.toFixed(2)} MB/min over the second half, frame p95 x${frameGrowth.toFixed(2)} first to last quarter, ${errors.length} page errors → ${values.out}`);
if (errors.length || slope > HEAP_MB_PER_MIN_MAX || frameGrowth > FRAME_GROWTH_MAX) process.exitCode = 1;
