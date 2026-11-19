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

export async function fire(page: Page): Promise<void> {
  const before = await hero(page);
  await page.mouse.down();
  try {
    await page.waitForFunction((shots) => (window.__perch?.hero?.shotsFired ?? 0) > shots, before.shotsFired);
  } finally {
    await page.mouse.up();
  }
}
