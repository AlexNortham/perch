import { expect, type Page } from '@playwright/test';
import type {} from '../src/client/app/app';
import type { Vec3 } from '../src/sim/core/contracts';

export const READY_TIMEOUT_MS = 60_000;
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
  await page.waitForFunction('window.__perch?.hero != null', null, { timeout: READY_TIMEOUT_MS });
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

export async function fire(page: Page): Promise<void> {
  const before = await hero(page);
  await page.mouse.down();
  try {
    await page.waitForFunction((shots) => (window.__perch?.hero?.shotsFired ?? 0) > shots, before.shotsFired);
  } finally {
    await page.mouse.up();
  }
}
