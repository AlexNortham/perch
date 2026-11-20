import { expect, type Page } from '@playwright/test';
import type {} from '../src/client/app/app';
import type { Vec3 } from '../src/sim/core/contracts';

export const READY_TIMEOUT_MS = 60_000;
/** Wall-clock allowance per skipped match second when `?t=` fast-forwards (about 50 ms measured under load, D-ARCH-033). */
const FAST_FORWARD_MS_PER_S = 100;
export const VIEWPORT = { width: 1280, height: 720 };

export interface HeroHook {
  pos: Vec3;
  tick: number;
  flags: number;
  shotsFired: number;
}

export async function open(page: Page, url = '/'): Promise<void> {
  await page.goto(url);
  await page.waitForFunction('window.__perch?.ready === true', null, { timeout: READY_TIMEOUT_MS });
}

export async function pickHero(page: Page, mode: 'Play' | 'Practice Hub', name: string): Promise<void> {
  await expect(page.getByRole('button', { name: mode, exact: true }), `menu offers ${mode}`).toBeVisible();
  await page.getByRole('button', { name: mode, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose your bird' })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`^${name}\\b`) }).click();
  // Play fast-forwards the 12-bot match to `?t=` before the local hero exists (D-ARCH-033): 18–45 s at t=900 with
  // bots fighting, so the wait scales with the seconds being skipped.
  const skip = Number(new URL(page.url()).searchParams.get('t') ?? 0);
  await page.waitForFunction('window.__perch?.hero != null', null, { timeout: READY_TIMEOUT_MS + skip * FAST_FORWARD_MS_PER_S });
}

export const hero = (page: Page) => page.evaluate<HeroHook>('window.__perch.hero');

export async function afterTicks(page: Page, firstTick: number, ticks: number): Promise<HeroHook> {
  const snapshot = await page.waitForFunction(
    (tick) => {
      const hero = window.__perch?.hero;
      return hero && hero.tick >= tick && hero;
    },
    firstTick + ticks,
  );
  return await snapshot.jsonValue() as HeroHook;
}

export async function lockPointer(page: Page): Promise<void> {
  await page.mouse.click(VIEWPORT.width / 2, VIEWPORT.height / 2);
  await page.waitForFunction('document.pointerLockElement !== null');
}

/** Evidence screenshots live under out/web (gitignored); returns the path written. */
export async function shot(page: Page, name: string): Promise<string> {
  const path = `out/web/${name}.png`;
  await page.screenshot({ path });
  return path;
}

/** The crouch key a fresh profile gets in this browser (D-EP-030): Left Ctrl where keyboard lock exists, C elsewhere. */
export const crouchKey = (page: Page) =>
  page.evaluate(() => (typeof (navigator as { keyboard?: { lock?: unknown } }).keyboard?.lock === 'function' ? 'ControlLeft' : 'KeyC'));

const COUNTS_PER_PIXEL = 2.65; // 0.06 deg per count at sensitivity 1, 90 degree vertical FOV on a 720 px viewport
const DUMMY_BODY_BELOW_LABEL_PX = 95;
const AIM_TOLERANCE_PX = 8;
const mousePos = new WeakMap<Page, { x: number; y: number }>();

/** Turn with real mouse movement until the crosshair sits on a practice dummy's body (found by its world label). */
export async function aimAtDummy(page: Page, which: 'enemy' | 'ally'): Promise<void> {
  const label = page.locator(which === 'enemy' ? '.pu-dlabel.enemy' : '.pu-dlabel:not(.enemy)');
  const at = mousePos.get(page) ?? { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 };
  for (let i = 0; i < 10; i++) {
    const box = await label.boundingBox();
    expect(box, `${which} dummy label is on screen`).not.toBeNull();
    const dx = box!.x + box!.width / 2 - VIEWPORT.width / 2;
    const dy = box!.y + box!.height / 2 + DUMMY_BODY_BELOW_LABEL_PX - VIEWPORT.height / 2;
    if (Math.abs(dx) < AIM_TOLERANCE_PX && Math.abs(dy) < AIM_TOLERANCE_PX) break;
    at.x += dx * COUNTS_PER_PIXEL;
    at.y += dy * COUNTS_PER_PIXEL;
    await page.mouse.move(at.x, at.y);
    await page.waitForTimeout(150);
  }
  mousePos.set(page, at);
}

const STEER_MS = 250;
const WAYPOINT_RADIUS_M = 6;
const MIN_STEP_M = 0.3;
const DEGREES_PER_COUNT = 0.06;
const PITCH_LIMIT_DEG = 80;

/**
 * Level the view whatever earlier mouse movement did to the pitch (a click while the pointer is locked turns the
 * camera too): look up past the +80° clamp, then down exactly 80°. walkTo and later steering keep that mouse height.
 */
export async function levelView(page: Page): Promise<void> {
  const at = mousePos.get(page) ?? { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 };
  at.y -= (2 * PITCH_LIMIT_DEG) / DEGREES_PER_COUNT;
  await page.mouse.move(at.x, at.y);
  at.y += PITCH_LIMIT_DEG / DEGREES_PER_COUNT;
  await page.mouse.move(at.x, at.y);
  mousePos.set(page, at);
}

/** Turn the view right by `degrees` (left when negative) with real mouse movement, keeping the pitch. */
export async function turn(page: Page, degrees: number): Promise<void> {
  const at = mousePos.get(page) ?? { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 };
  at.x += degrees / DEGREES_PER_COUNT;
  await page.mouse.move(at.x, at.y);
  mousePos.set(page, at);
}

/**
 * Hold W and steer with real mouse movement through (x, z) waypoints. The heading is read from the hero's motion
 * (`__perch.hero.pos`); a left turn is mouse movement to the left. Stops W when the last waypoint is reached.
 */
export async function walkTo(page: Page, waypoints: readonly { x: number; z: number }[], timeoutMs: number): Promise<void> {
  const at = mousePos.get(page) ?? { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 };
  const deadline = Date.now() + timeoutMs;
  let prev = (await hero(page)).pos;
  let heading: number | null = null;
  let next = 0;
  await page.keyboard.down('KeyW');
  try {
    while (next < waypoints.length) {
      expect(Date.now(), 'reached the waypoints in time').toBeLessThan(deadline);
      await page.waitForTimeout(STEER_MS);
      const pos = (await hero(page)).pos;
      const goal = waypoints[next]!;
      if (Math.hypot(goal.x - pos.x, goal.z - pos.z) < WAYPOINT_RADIUS_M) { next++; continue; }
      if (Math.hypot(pos.x - prev.x, pos.z - prev.z) >= MIN_STEP_M) heading = Math.atan2(pos.x - prev.x, pos.z - prev.z);
      prev = pos;
      if (heading === null) continue;
      let error = Math.atan2(goal.x - pos.x, goal.z - pos.z) - heading;
      error = Math.atan2(Math.sin(error), Math.cos(error));
      at.x -= (error * 180 / Math.PI) / DEGREES_PER_COUNT;
      await page.mouse.move(at.x, at.y);
    }
  } finally {
    await page.keyboard.up('KeyW');
    mousePos.set(page, at);
  }
}

export async function fire(page: Page): Promise<void> {
  const before = await hero(page);
  await page.mouse.down();
  try {
    await page.waitForFunction((shots) => (window.__perch?.hero?.shotsFired ?? 0) > shots, before.shotsFired);
  } finally {
    await page.mouse.up();
  }
}
