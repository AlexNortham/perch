// The Options screen end to end (UI's report): rebind, swap on conflict, Esc cancels, settings survive a reload, a
// rebound Pause key pauses, and a rebound Jump key jumps in the lane.
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const READY_TIMEOUT_MS = 60_000;
const JUMP_MIN_RISE_M = 0.5;
const SETTLE_MS = 600;
const JUMP_MS = 400;

declare global {
  interface Window {
    __perch?: { ready: boolean; hero: { pos: { y: number } } | null };
  }
}

test.use({ viewport: { width: 1280, height: 720 } });

const keyButton = (page: Page, action: string) => page.locator(`button.pu-key[data-action="${action}"]`);

async function open(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForFunction('window.__perch?.ready === true', null, { timeout: READY_TIMEOUT_MS });
}

/** Click an action's key button, then press the key. */
async function rebind(page: Page, action: string, key: string): Promise<void> {
  await keyButton(page, action).click();
  await page.keyboard.press(key);
}

const heroY = (page: Page) => page.evaluate(() => window.__perch?.hero?.pos.y ?? 0);

test('menu Options: rebind, swap on conflict, cancel, and the choice survives a reload', async ({ page }) => {
  await open(page, '/');
  await page.getByRole('button', { name: 'Options' }).click();
  await expect(keyButton(page, 'jump')).toHaveText('Space');

  await rebind(page, 'jump', 'KeyJ');
  await expect(keyButton(page, 'jump')).toHaveText('J');

  // Dash takes J: Jump swaps to Dash's old key, Left Shift.
  await rebind(page, 'dash', 'KeyJ');
  await expect(keyButton(page, 'dash')).toHaveText('J');
  await expect(keyButton(page, 'jump')).toHaveText('Left Shift');
  await expect(page.locator('.pu-status')).toContainText('swapped');

  // Esc cancels a capture.
  await rebind(page, 'fire', 'Escape');
  await expect(keyButton(page, 'fire')).toHaveText('Left Mouse');
  await expect(page.locator('.pu-status')).toHaveText('Cancelled.');

  await page.reload();
  await page.waitForFunction('window.__perch?.ready === true', null, { timeout: READY_TIMEOUT_MS });
  await page.getByRole('button', { name: 'Options' }).click();
  await expect(keyButton(page, 'dash')).toHaveText('J');
  await expect(keyButton(page, 'jump')).toHaveText('Left Shift');
});

test('a rebound Pause key pauses the lane', async ({ page }) => {
  await open(page, '/?scene=lane&hero=shrike');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Options' }).click();
  await rebind(page, 'pause', 'KeyP');
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByText('Paused')).toHaveCount(0);

  await page.keyboard.press('KeyP');
  await expect(page.getByText('Paused')).toBeVisible();
});

test('a rebound Jump key jumps in the lane, and the old key no longer does', async ({ page }) => {
  test.setTimeout(READY_TIMEOUT_MS * 2);
  await open(page, '/?scene=lane&hero=shrike');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Options' }).click();
  await rebind(page, 'jump', 'KeyJ');
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Resume' }).click();
  await page.waitForTimeout(SETTLE_MS);

  const ground = await heroY(page);
  await page.keyboard.press('Space');
  await page.waitForTimeout(JUMP_MS);
  expect(await heroY(page) - ground, 'Space no longer jumps').toBeLessThan(JUMP_MIN_RISE_M);

  await page.waitForTimeout(SETTLE_MS);
  await page.keyboard.down('KeyJ');
  await page.waitForTimeout(JUMP_MS);
  await page.keyboard.up('KeyJ');
  expect(await heroY(page) - ground, 'J jumps').toBeGreaterThan(JUMP_MIN_RISE_M);
});
