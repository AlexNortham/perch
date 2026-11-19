// The Stage 2 playtest (Camera & Input's report): drop into the lane as Shrike, lock the pointer, run, dash and fire.
// Asserts on window.__perch.hero, the read-only hook src/client/app exposes.
import { expect, test } from '@playwright/test';

const READY_TIMEOUT_MS = 60_000;
const RUN_MS = 1000;
const DASH_MS = 150;
const MIN_RUN_M = 3;

interface Hook {
  hero: { pos: { x: number; y: number; z: number }; shotsFired: number } | null;
}
declare global {
  interface Window {
    __perch?: Hook & { ready: boolean };
  }
}

test.use({ viewport: { width: 1280, height: 720 } });

test('lane: lock the pointer, hold W, dash and fire', async ({ page }) => {
  test.setTimeout(READY_TIMEOUT_MS * 2);
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/?scene=lane&hero=shrike');
  await page.waitForFunction('window.__perch?.ready === true', null, { timeout: READY_TIMEOUT_MS });
  await page.mouse.click(640, 360);
  await page.waitForFunction('document.pointerLockElement !== null');

  const start = await page.evaluate(() => window.__perch?.hero);
  expect(start, 'the local hero is on the page hook').not.toBeNull();
  expect(start?.shotsFired).toBe(0);

  await page.keyboard.down('KeyW');
  await page.waitForTimeout(RUN_MS);
  await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(DASH_MS);
  await page.keyboard.up('ShiftLeft');
  await page.mouse.down();
  await page.waitForTimeout(DASH_MS);
  await page.mouse.up();
  await page.keyboard.up('KeyW');

  const end = await page.evaluate(() => window.__perch?.hero);
  const moved = Math.hypot((end?.pos.x ?? 0) - (start?.pos.x ?? 0), (end?.pos.z ?? 0) - (start?.pos.z ?? 0));
  expect(moved, 'metres run').toBeGreaterThan(MIN_RUN_M);
  expect(end?.shotsFired, 'shots fired').toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
