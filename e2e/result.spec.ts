// The end-of-match screen in the browser (W4 gate). Victory: `?scene=replay` plays the Play match with the
// siege-proof Owl agent writing the local hero's ordinary commands through the app's normal step loop, fast-forwarded,
// until the real end screen appears. Defeat: a real match from the menu, conceded from the pause menu by real clicks.
import { expect, test, type Page } from '@playwright/test';
import type { PerchState } from '../src/client/app/app';
import { CONCEDE_AFTER_SECONDS } from '../src/sim/data/core';
import { open, pickHero, READY_TIMEOUT_MS, shot, VIEWPORT } from './game';

test.use({ viewport: VIEWPORT });

const REPLAY_TIMEOUT_MS = 240_000;
/** The match starts this long before Concede opens. */
const EARLY_S = 4;
const state = (page: Page) => page.evaluate<PerchState>('window.__perch.state');

test('replay: the siege-proof Owl wins on ordinary commands and the Victory screen shows its stats', async ({ page }) => {
  test.setTimeout(REPLAY_TIMEOUT_MS);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  const started = Date.now();
  await open(page, '/?scene=replay&seed=1');
  expect((await state(page)).screen).toBe('match');
  await page.waitForFunction('window.__perch.state.screen === "end"', null, { timeout: REPLAY_TIMEOUT_MS, polling: 1000 });
  const end = await state(page);
  const note = `seed 1, tick ${end.tick}, hash ${end.hash}, ${Math.round((Date.now() - started) / 1000)} s`;
  test.info().annotations.push({ type: 'replay', description: note });
  console.log(`replay: ${note}`);

  expect(end).toMatchObject({ over: true, winner: 'dawn' });
  const standing = (team: string, type: string) => end.structures.some((s) => s.team === team && s.type === type && s.hp > 0);
  expect(standing('dusk', 'patron'), 'the Dusk Patron has fallen').toBe(false);
  expect(standing('dusk', 'hawk') && standing('dawn', 'patron'), 'other lanes and the Dawn base still stand').toBe(true);
  const screen = page.locator('.pu-end');
  await expect(screen.getByRole('heading', { name: 'Victory' })).toBeVisible();
  await expect(screen.getByText('Dawn Flock wins')).toBeVisible();
  await expect(screen.getByText(/Match length \d+:\d\d\s+seed 1/)).toBeVisible();
  const owl = screen.locator('tr', { hasText: 'Owl (Dawn)' });
  await expect(owl).toBeVisible();
  const structureDamage = Number((await owl.locator('td').nth(3).innerText()).replace(/[^\d]/g, ''));
  expect(structureDamage, 'the Owl damaged structures').toBeGreaterThan(0);
  await expect(screen.getByRole('img', { name: 'Flock net worth over time' })).toBeVisible();
  await expect(screen.getByRole('button', { name: 'Play again' })).toBeVisible();
  await shot(page, 'result-victory');
  expect(errors).toEqual([]);
});

test('Play from the menu, Concede from the pause menu at 15:00, and the Defeat screen shows the stats', async ({ page }) => {
  test.setTimeout(READY_TIMEOUT_MS * 2);
  await open(page, `/?t=${CONCEDE_AFTER_SECONDS - EARLY_S}`);
  await pickHero(page, 'Play', 'Albatross');
  const concede = page.getByRole('button', { name: 'Concede' });

  await page.keyboard.press('Escape');
  await expect(page.getByText('Paused')).toBeVisible();
  await expect(concede, 'Concede is locked before 15:00').toBeDisabled();
  await expect(page.getByText(/Concede is available from 15:00 \(now 14:5\d\)/)).toBeVisible();
  await shot(page, 'result-concede-locked');
  await page.getByRole('button', { name: 'Resume' }).click();
  await page.waitForFunction((s) => window.__perch!.state.seconds >= s, CONCEDE_AFTER_SECONDS, { timeout: READY_TIMEOUT_MS });

  await page.keyboard.press('Escape');
  await expect(concede).toBeEnabled();
  await concede.click();
  await expect(state(page).then((s) => s.screen), 'one click only arms it').resolves.toBe('pause');
  await page.getByRole('button', { name: 'Confirm concede' }).click();

  const screen = page.locator('.pu-end');
  await expect(screen.getByRole('heading', { name: 'Defeat' })).toBeVisible();
  await expect(screen.getByText('Dusk Flock wins')).toBeVisible();
  await expect(screen.getByText(/Match length 15:\d\d\s+seed 1/)).toBeVisible();
  const row = screen.locator('tr', { hasText: 'Albatross (Dawn)' });
  await expect(row).toBeVisible();
  await expect(row.locator('td').nth(1), 'K/D/A').toHaveText(/^\d+\/\d+\/\d+$/);
  await expect(screen.getByRole('img', { name: 'Flock net worth over time' })).toBeVisible();
  expect(await state(page)).toMatchObject({ screen: 'end', over: true, winner: 'dusk' });
  await shot(page, 'result-defeat');
});
