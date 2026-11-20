// Captures the wiki's screenshots from the running game (dev server + installed Edge), skipping any image whose
// hash-named file already exists. Failures are copied from the spec's fallback image (a hero portrait) and reported.
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createServer } from 'vite';
import { args, channel } from '../browser';
import { DEFAULT_BINDINGS } from '../../src/client/app/bindings';
import { loadMap } from '../../src/sim/world/map';
import { ROOT } from './facts';
import { plan } from './imageplan';
import type { Cam, ImageSpec } from './imageplan';

const READY_MS = 240_000;
const QUALITY = 72;
const CONCURRENCY = 3;
const SETTLE_MS = 700;
const CAST_MS = 450;
/** Street-level lane shots stand this far down the lane from the Dawn gate and look this far ahead (m). */
const LANE_SHOT_AT = 35;
const LANE_SHOT_LOOK = 30;
const LANE_SHOT_AT_MID = 50;
const spawn = loadMap('arena').spawns.find((s) => s.team === 'dawn')?.pos ?? { x: 0, y: 0, z: 0 };

const abs = (c: Cam): string => [spawn.x + c[0], spawn.y + c[1], spawn.z + c[2], spawn.x + c[3], spawn.y + c[4], spawn.z + c[5]].map((n) => n.toFixed(2)).join(',');

/** Hide every HUD and menu layer, leaving the 3D canvas. */
const hideOverlays = async (page: Page): Promise<void> => {
  await page.addStyleTag({ content: '#app > div:not(:first-child) { display: none !important; }' });
};

async function open(page: Page, base: string, params: Record<string, string>): Promise<void> {
  await page.goto(`${base}?${new URLSearchParams(params)}`);
  await page.waitForFunction('window.__perch?.ready === true', null, { timeout: READY_MS });
  await page.waitForTimeout(SETTLE_MS);
}
const lock = async (page: Page): Promise<void> => {
  await page.mouse.click(640, 360);
  await page.waitForFunction('document.pointerLockElement !== null').catch(() => undefined);
};

async function laneShot(page: Page, base: string, lane: string): Promise<void> {
  const l = loadMap('main').lanes.find((x) => x.id === lane);
  if (!l) throw new Error(`no lane ${lane}`);
  /** The point `dist` metres along the lane polyline from the Dawn gate. */
  const at = (dist: number) => {
    let left = dist;
    for (let i = 1; i < l.path.length; i++) {
      const p = l.path[i - 1], q = l.path[i];
      if (!p || !q) break;
      const seg = Math.hypot(q.x - p.x, q.z - p.z);
      if (left <= seg || i === l.path.length - 1) { const f = Math.min(1, left / seg); return { x: p.x + (q.x - p.x) * f, y: p.y, z: p.z + (q.z - p.z) * f }; }
      left -= seg;
    }
    return l.path[0] ?? { x: 0, y: 0, z: 0 };
  };
  const from = lane === 'riverbank' ? LANE_SHOT_AT_MID : LANE_SHOT_AT;
  const a = at(from), b = at(from + LANE_SHOT_LOOK);
  const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1;
  const cam = [a.x - (dx / len) * 6, a.y + 3.2, a.z - (dz / len) * 6, b.x, b.y + 1.5, b.z].map((n) => n.toFixed(2)).join(',');
  await open(page, base, { scene: 'blockout', cam: 'overview', renderCam: cam });
  await hideOverlays(page);
}

const key = (slot: number): string => [DEFAULT_BINDINGS.ability1, DEFAULT_BINDINGS.ability2, DEFAULT_BINDINGS.ability3, DEFAULT_BINDINGS.ability4][slot] ?? 'Digit1';

async function run(page: Page, base: string, s: ImageSpec): Promise<Buffer> {
  const j = s.job;
  const clip = s.key === 'ui:minimap' ? { x: 10, y: 10, width: 220, height: 252 } : s.key === 'ui:scoreboard' ? { x: 0, y: 0, width: 1280, height: 160 } : undefined;
  switch (j.t) {
    case 'model':
      await open(page, base, { scene: 'sandbox', modelLineup: j.lineup.join(','), modelYaw: String(j.yaw), modelState: j.states.join(','), modelTeam: j.team, renderCam: abs(j.cam) });
      await hideOverlays(page);
      break;
    case 'structure':
      await open(page, base, { scene: 'sandbox', modelStructure: j.token, modelTeam: j.team, renderCam: abs(j.cam) });
      await hideOverlays(page);
      break;
    case 'wave':
      await open(page, base, { scene: 'sandbox', modelWave: String(j.n), renderCam: abs(j.cam) });
      await hideOverlays(page);
      break;
    case 'scene':
      await open(page, base, j.params);
      if (j.params.scene === 'blockout' || j.params.renderCam) await hideOverlays(page);
      break;
    case 'ability':
      await open(page, base, { scene: 'practice', hero: j.hero });
      await lock(page);
      await page.keyboard.press(key(j.slot));
      await page.waitForTimeout(CAST_MS);
      await hideOverlays(page);
      break;
    case 'ui':
      if (j.name.startsWith('lane-')) { await laneShot(page, base, j.name.slice(5)); break; }
      if (j.name === 'menu') { await open(page, base, { scene: 'menu' }); break; }
      if (j.name === 'options' || j.name === 'heroselect') {
        await open(page, base, { scene: 'menu' });
        await page.getByRole('button', { name: j.name === 'options' ? 'Options' : 'Play', exact: true }).first().click();
        if (j.name === 'heroselect') await page.getByRole('button', { name: /^Owl\b/ }).hover();
        await page.waitForTimeout(SETTLE_MS);
        break;
      }
      await open(page, base, { scene: j.name === 'practice' ? 'practice' : j.name === 'scoreboard' ? 'match' : 'lane', hero: 'lyrebird', ...(j.name === 'practice' ? {} : { renderCam: '0,3.4,-80,0,2.6,-45' }), t: j.name === 'hud' || j.name === 'minimap' || j.name === 'scoreboard' ? '95' : '5' });
      await lock(page);
      if (j.name === 'shop') await page.keyboard.press(DEFAULT_BINDINGS.shop);
      if (j.name === 'bigmap') await page.keyboard.press(DEFAULT_BINDINGS.bigMap);
      if (j.name === 'upgrades') await page.keyboard.down(DEFAULT_BINDINGS.upgradeModifier); // held: the cursor is free over the ability row
      await page.waitForTimeout(SETTLE_MS);
      break;
  }
  return page.screenshot({ type: 'jpeg', quality: QUALITY, ...(clip ? { clip } : {}) });
}

/** Capture every spec whose file is missing (or all, with force) into outDir. Returns the keys that fell back. */
export async function capture(outDir: string, force: boolean, only?: string): Promise<{ done: number; skipped: number; fallbacks: string[] }> {
  mkdirSync(join(outDir, 'img'), { recursive: true });
  const todo = [...plan.values()].filter((s) => (only ? s.key.includes(only) : force || !existsSync(join(outDir, s.file))));
  const skipped = plan.size - todo.length;
  const fallbacks: string[] = [];
  if (todo.length > 0) {
    const server = await createServer({ root: ROOT, server: { host: '127.0.0.1', port: 0, watch: null }, logLevel: 'error', clearScreen: false });
    await server.listen();
    const base = server.resolvedUrls?.local[0] ?? '';
    const browser = await chromium.launch({ channel, args });
    let next = 0;
    const worker = async (): Promise<void> => {
      for (let s = todo[next++]; s; s = todo[next++]) {
        const page = await browser.newPage({ viewport: { width: s.w, height: s.h } });
        try {
          const jpg = await run(page, base, s);
          (await import('node:fs')).writeFileSync(join(outDir, s.file), jpg);
        } catch (err) {
          fallbacks.push(`${s.key} (${err instanceof Error ? err.message.split('\n')[0] : String(err)})`);
        } finally {
          await page.close();
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    await browser.close();
    await server.close();
  }
  // Failed captures borrow their fallback image (a hero portrait) so pages never point at a missing file.
  for (const s of plan.values()) {
    const target = join(outDir, s.file);
    const fb = s.fallback ? plan.get(s.fallback) : undefined;
    if (!existsSync(target) && fb && existsSync(join(outDir, fb.file))) copyFileSync(join(outDir, fb.file), target);
  }
  // Drop jpgs no spec refers to any more.
  const wanted = new Set([...plan.values()].map((s) => resolve(outDir, s.file)));
  for (const f of readdirSync(join(outDir, 'img'))) {
    const p = resolve(outDir, 'img', f);
    if (f.endsWith('.jpg') && !wanted.has(p)) rmSync(p);
  }
  return { done: todo.length - fallbacks.length, skipped, fallbacks };
}
