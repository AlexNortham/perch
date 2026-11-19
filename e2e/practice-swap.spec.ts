// Swap bird in the Practice Hub (D-EP-040; W4.5 QA, test-first): a Swap bird option in the pause menu and as an
// on-screen button opens the same 24-card picker without going back to the main menu; choosing a playable bird
// respawns the player as that bird at their current spot with a fresh 32 practice AP and the dummies reset.
// Pending until UI/HUD and the app shell land it (wave 5):
//   PERCH_PENDING=1 npx playwright test e2e/practice-swap.spec.ts --workers=1
import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_BINDINGS } from '../src/client/app/bindings';
import { HEROES } from '../src/sim/heroes/registry';
import { aimAtDummy, crouchKey, hero, lockPointer, open, pickHero, VIEWPORT, READY_TIMEOUT_MS } from './game';
import { isPending, PENDING_REASON } from './pending';

test.use({ viewport: VIEWPORT, actionTimeout: 8_000 });
test.setTimeout(READY_TIMEOUT_MS * 2);
test.skip(isPending, PENDING_REASON);

const PRACTICE_AP = 32;
const SPOT_TOLERANCE_M = 3;
const RESET_TIMEOUT_MS = 6_000;
const NEW_BIRD = 'Kingfisher';
const NEW_BIRD_ABILITIES = HEROES.kingfisher.def.abilities;
const AP = (page: Page) => page.locator('.pu-ap').first();
const swapButton = (page: Page) => page.getByRole('button', { name: /^Swap bird$/i });
const picker = (page: Page) => page.getByRole('heading', { name: 'Choose your bird' });
const mainMenuPractice = (page: Page) => page.getByRole('button', { name: 'Practice Hub', exact: true });
const bar = (page: Page, which: 'Enemy' | 'Ally') => page.getByRole('progressbar', { name: new RegExp(`${which} dummy`, 'i') });
const hp = async (b: ReturnType<typeof bar>, attr: 'aria-valuenow' | 'aria-valuemax') => Number(await b.getAttribute(attr));

/** A locked pointer sends every click to the game, so the on-screen button is clicked with the upgrade key held (the cursor is free, D-EP-038). */
async function clickSwap(page: Page): Promise<void> {
  await page.keyboard.down(DEFAULT_BINDINGS.upgradeModifier);
  try {
    await swapButton(page).click();
  } finally {
    await page.keyboard.up(DEFAULT_BINDINGS.upgradeModifier);
  }
}

async function hub(page: Page): Promise<void> {
  await open(page);
  await pickHero(page, 'Practice Hub', 'Lyrebird');
  await expect(AP(page)).toHaveText(`AP ${PRACTICE_AP}`);
  await lockPointer(page);
}

test.describe('Swap bird (D-EP-040)', () => {
  test('there is an on-screen Swap bird button in the hub, and one in the pause menu', async ({ page }) => {
    await hub(page);
    await expect(swapButton(page), 'on-screen button while playing').toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
    await expect(swapButton(page), 'pause menu option').toBeVisible();
  });

  test('Play has no Swap bird: it is a Practice Hub feature', async ({ page }) => {
    await open(page);
    await pickHero(page, 'Play', 'Lyrebird');
    await expect(swapButton(page), 'no on-screen swap in a real match').toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
    await expect(swapButton(page), 'no pause-menu swap in a real match').toHaveCount(0);
  });

  test('the on-screen button opens the same 24-card picker without leaving the hub', async ({ page }) => {
    await hub(page);
    const url = page.url();
    await clickSwap(page);
    await expect(picker(page)).toBeVisible();
    await expect(page.locator('.pu-card'), 'the same 24-card picker').toHaveCount(24);
    await expect(mainMenuPractice(page), 'the main menu is never shown').toHaveCount(0);
    expect(page.url(), 'same page').toBe(url);
  });

  test('swapping respawns as the new bird at the same spot, with 32 fresh AP and its own ability bar', async ({ page }) => {
    await hub(page);
    // Spend AP and walk a little, so "same spot" and "fresh AP" mean something.
    await page.keyboard.press(`${DEFAULT_BINDINGS.upgradeModifier}+${DEFAULT_BINDINGS.ability1}`);
    await expect(AP(page)).toHaveText(`AP ${PRACTICE_AP - 1}`);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(700);
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(300);
    const before = (await hero(page)).pos;

    await clickSwap(page);
    await expect(picker(page)).toBeVisible();
    await page.getByRole('button', { name: new RegExp(`^${NEW_BIRD}\\b`) }).click();
    await page.waitForFunction('window.__perch?.hero != null');
    await expect(AP(page), 'a fresh 32 practice AP').toHaveText(`AP ${PRACTICE_AP}`);
    for (const ability of NEW_BIRD_ABILITIES) {
      await expect(page.getByText(ability.name, { exact: true }), `${ability.name} is on the bar`).toBeVisible();
    }
    const after = (await hero(page)).pos;
    expect(Math.hypot(after.x - before.x, after.z - before.z), 'respawned at the current spot').toBeLessThan(SPOT_TOLERANCE_M);
    await expect(picker(page), 'back in the hub').toBeHidden();
    await expect(mainMenuPractice(page)).toHaveCount(0);
  });

  test('swapping from the pause menu works the same way, and Resume is not needed afterwards', async ({ page }) => {
    await hub(page);
    await page.keyboard.press('Escape');
    await clickSwap(page);
    await expect(picker(page)).toBeVisible();
    await page.getByRole('button', { name: new RegExp(`^${NEW_BIRD}\\b`) }).click();
    await page.waitForFunction('window.__perch?.hero != null');
    await expect(AP(page)).toHaveText(`AP ${PRACTICE_AP}`);
    await expect(page.getByText('Paused'), 'the game is running again').toHaveCount(0);
  });

  test('the dummies reset: a wounded enemy dummy is back at full health after the swap', async ({ page }) => {
    await hub(page);
    const crouch = await crouchKey(page);
    const spawn = await hero(page);
    await page.keyboard.down(crouch);
    try {
      // At Dawn's spawn the sightline is offset toward -X; strafe it onto the enemy dummy (as m2.spec does).
      const x = spawn.pos.x + 4 - 0.6;
      await page.keyboard.down('KeyA');
      try {
        await page.waitForFunction((target) => (window.__perch?.hero?.pos.x ?? 0) - target >= -0.15, x);
      } finally {
        await page.keyboard.up('KeyA');
      }
      await aimAtDummy(page, 'enemy');
      const enemy = bar(page, 'Enemy');
      const max = await hp(enemy, 'aria-valuemax');
      await page.mouse.down();
      try {
        await expect.poll(() => hp(enemy, 'aria-valuenow'), { message: 'the dummy is wounded' }).toBeLessThan(max - 60);
      } finally {
        await page.mouse.up();
      }
    } finally {
      await page.keyboard.up(crouch);
    }
    await clickSwap(page);
    await page.getByRole('button', { name: new RegExp(`^${NEW_BIRD}\\b`) }).click();
    await page.waitForFunction('window.__perch?.hero != null');
    const enemy = bar(page, 'Enemy');
    const max = await hp(enemy, 'aria-valuemax');
    await expect.poll(() => hp(enemy, 'aria-valuenow'), { message: 'the enemy dummy reset', timeout: RESET_TIMEOUT_MS }).toBe(max);
  });
});
