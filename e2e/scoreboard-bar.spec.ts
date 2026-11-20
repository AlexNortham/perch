// The always-on top scoreboard (D-EP-041, GDD §12.4/§12.7; W4.5 QA, test-first). The HUD's top bar is the
// scoreboard: the match timer in the centre between each flock's total Seeds, six circular portraits per side (own flock
// left, enemy right) with a slim health bar and a Seeds total, a dead bird darkened with a respawn countdown, and no Tab
// scoreboard and no Tab binding. Pending until UI/HUD lands it (wave 5):
//   PERCH_PENDING=1 npx playwright test e2e/scoreboard-bar.spec.ts --workers=1
//
// The markup contract these specs ask for (QA's request to UI/HUD, in the Log entry):
//   region "Scoreboard"                       the whole bar
//   [data-portrait]                           one per hero (12): data-side="own"|"enemy", data-hero="<heroId>",
//                                             data-dead="true"|"false"
//     [role=progressbar]                      the health bar (aria-valuenow / aria-valuemax)
//     [data-field="seeds"]                    the hero's Seeds total (digits)
//     [data-field="respawn"]                  only while dead: the countdown in whole seconds
//   [data-field="flock-seeds"][data-side]     each flock's total Seeds; [data-field="clock"] the match timer
import { expect, test, type Page } from '@playwright/test';
import { matchConfig } from '../src/client/app/router';
import { ECONOMY } from '../src/sim/data/economy';
import { createSim } from '../src/sim/index';
import { open, pickHero, lockPointer, VIEWPORT, READY_TIMEOUT_MS } from './game';

test.use({ viewport: VIEWPORT, actionTimeout: 8_000 });
test.setTimeout(READY_TIMEOUT_MS * 3);

const FAST_FORWARD_S = 600;
const PER_SIDE = 6;
const CENTRE_TOLERANCE_PX = 24;
const DEATH_WAIT_MS = 10_000;
const board = (page: Page) => page.getByRole('region', { name: 'Scoreboard' });
const portraits = (page: Page, side?: 'own' | 'enemy') => board(page).locator(side ? `[data-portrait][data-side="${side}"]` : '[data-portrait]');
const digits = (text: string | null) => Number((text ?? '').replace(/[^\d]/g, ''));

async function match(page: Page, seconds = FAST_FORWARD_S): Promise<void> {
  await open(page, `/?t=${seconds}&seed=1`);
  await pickHero(page, 'Play', 'Kingfisher');
  await lockPointer(page);
}

test.describe('top scoreboard (D-EP-041)', () => {
  test('it is always visible, with no key held, and stays visible over the shop, the map and the upgrade hold', async ({ page }) => {
    await match(page);
    await expect(board(page)).toBeVisible();
    await page.keyboard.press('KeyB');
    await expect(board(page), 'with the shop open').toBeVisible();
    await page.keyboard.press('KeyB');
    await lockPointer(page);
    await page.keyboard.down('AltLeft');
    await expect(board(page), 'while holding to upgrade').toBeVisible();
    await page.keyboard.up('AltLeft');
  });

  test('six portraits per side: own flock on the left, the enemy flock on the right, with the timer and both flocks\' Seeds in the middle', async ({ page }) => {
    await match(page);
    await expect(portraits(page)).toHaveCount(PER_SIDE * 2);
    await expect(portraits(page, 'own')).toHaveCount(PER_SIDE);
    await expect(portraits(page, 'enemy')).toHaveCount(PER_SIDE);
    const clock = await board(page).locator('[data-field="clock"]').boundingBox();
    expect(clock, 'the match timer').not.toBeNull();
    expect(Math.abs(clock!.x + clock!.width / 2 - VIEWPORT.width / 2), 'the timer is centred').toBeLessThan(CENTRE_TOLERANCE_PX);
    for (const side of ['own', 'enemy'] as const) {
      const flock = await board(page).locator(`[data-field="flock-seeds"][data-side="${side}"]`).boundingBox();
      expect(flock, `${side} flock Seeds`).not.toBeNull();
      expect(flock!.x < clock!.x, `${side} Seeds sit ${side === 'own' ? 'left' : 'right'} of the timer`).toBe(side === 'own');
      for (let i = 0; i < PER_SIDE; i++) {
        const box = await portraits(page, side).nth(i).boundingBox();
        expect(box, `${side} portrait ${i + 1}`).not.toBeNull();
        expect(box!.x < clock!.x, `${side} portraits stay on their side`).toBe(side === 'own');
      }
    }
  });

  test('each portrait carries a hero, a health bar with real values and a Seeds total; the local bird\'s total matches the HUD', async ({ page }) => {
    await match(page);
    const all = portraits(page);
    for (let i = 0; i < PER_SIDE * 2; i++) {
      const p = all.nth(i);
      await expect(p, `portrait ${i + 1} names its hero`).toHaveAttribute('data-hero', /^[a-z]+$/);
      const bar = p.getByRole('progressbar');
      const now = Number(await bar.getAttribute('aria-valuenow'));
      const max = Number(await bar.getAttribute('aria-valuemax'));
      expect(max, `portrait ${i + 1} max health`).toBeGreaterThan(0);
      expect(now, `portrait ${i + 1} health`).toBeGreaterThanOrEqual(0);
      expect(now).toBeLessThanOrEqual(max);
      await expect(p.locator('[data-field="seeds"]'), `portrait ${i + 1} Seeds`).toHaveText(/\d/);
    }
    const mine = board(page).locator('[data-portrait][data-side="own"][data-hero="kingfisher"]');
    await expect(mine).toHaveCount(1);
    const hud = digits(await page.locator('.pu-seeds').innerText());
    // Nothing bought yet: the HUD wallet is net worth (the portrait, D-UI-008) plus the unspent purse (D-ECON-005).
    expect(digits(await mine.locator('[data-field="seeds"]').innerText()), 'the portrait shows the HUD less the purse').toBe(hud - ECONOMY.startSeeds);
  });

  test('a dead bird\'s portrait is darkened with a red respawn countdown that runs down', async ({ page }) => {
    // Deterministic (D-QA-017): the fast-forward is the same ticks Node can run, so find in Node the second after the
    // first bird of the seed-1 match dies, and open the browser match there instead of waiting for a death in real time.
    const sim = await createSim(matchConfig({ seed: 1, hero: 'kingfisher', team: 'dawn', difficulty: 'normal', bots: PER_SIDE * 2 - 1 }));
    while (!sim.ctx.store.list('hero').some((h) => h.health.dead) && sim.view.seconds < 1_200) sim.step();
    const diesAt = Math.ceil(sim.view.seconds) + 1;
    expect(diesAt, 'a bird dies in the first 20 minutes of the seeded bot match').toBeLessThan(1_200);
    await match(page, diesAt);
    await expect(portraits(page), 'the bar has its portraits').toHaveCount(PER_SIDE * 2);
    const dead = portraits(page).and(page.locator('[data-dead="true"]'));
    await expect(dead.first(), 'a bird is down at that moment').toBeVisible({ timeout: DEATH_WAIT_MS });
    const first = dead.first();
    const hero = await first.getAttribute('data-hero');
    const countdown = first.locator('[data-field="respawn"]');
    await expect(countdown).toHaveText(/^\d+$/);
    const t0 = digits(await countdown.innerText());
    expect(t0, 'a positive respawn time').toBeGreaterThan(0);
    const colour = await countdown.evaluate((e) => getComputedStyle(e).color);
    const [r, g, b] = (colour.match(/\d+/g) ?? []).map(Number) as [number, number, number];
    expect(r > g * 1.5 && r > b * 1.5, `the countdown is red (${colour})`).toBe(true);
    await page.waitForTimeout(2_200);
    const still = portraits(page).and(page.locator(`[data-hero="${hero}"][data-dead="true"]`));
    if (await still.count() > 0) expect(digits(await still.first().locator('[data-field="respawn"]').innerText()), 'it counts down').toBeLessThan(t0);
  });

  test('Tab does nothing: no second scoreboard, no change to the bar, and the pointer stays locked', async ({ page }) => {
    await match(page);
    const box = await board(page).boundingBox();
    await page.keyboard.down('Tab');
    await page.waitForTimeout(300);
    await expect(board(page), 'still exactly one scoreboard').toHaveCount(1);
    expect(await board(page).boundingBox(), 'the bar did not change').toEqual(box);
    expect(await page.evaluate(() => document.pointerLockElement !== null), 'Tab does not free the pointer').toBe(true);
    await page.keyboard.up('Tab');
    await expect(board(page)).toHaveCount(1);
  });

  test('Tab is not bindable: Options has no scoreboard row, and capturing Tab for another action is refused', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Options' }).click();
    await expect(page.locator('button.pu-key[data-action="scoreboard"]'), 'no Scoreboard binding').toHaveCount(0);
    const jump = page.locator('button.pu-key[data-action="jump"]');
    await expect(jump).toHaveText('Space');
    await jump.click();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Escape');
    await expect(jump, 'Tab was not accepted as a binding').toHaveText('Space');
  });
});
