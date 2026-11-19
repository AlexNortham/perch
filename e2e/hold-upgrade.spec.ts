// Hold to upgrade (D-EP-038, supersedes the tap-to-open Ability Upgrades panel of D-EP-028; W4.5 QA, test-first).
// Holding the upgrade binding pauses aiming and frees a cursor over the HUD ability bar; clicking an icon or pressing
// 1-4 buys the next tier when affordable; hovering shows the next tier; releasing returns to aiming with no extra
// click; there is no separate upgrade dialog. Pending until UI/HUD and Camera & Input land it (wave 5):
//   PERCH_PENDING=1 npx playwright test e2e/hold-upgrade.spec.ts --workers=1
//
// Contract the specs lean on (so the implementers know what to provide; all are D-EP-038 text):
//  - each HUD ability icon is a button named `Upgrade <ability>` (the unavailable reason is part of its name, D-EP-038);
//  - the freed cursor is either the real one (`document.pointerLockElement === null`) or a game-drawn `.pu-cursor`
//    element that is visible only while the key is held;
//  - the hover card (description, next tier, AP cost, unspent AP, or why it is locked / maxed) is plain text.
import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_BINDINGS } from '../src/client/app/bindings';
import { ViewFlag } from '../src/sim/core/contracts';
import { HEROES } from '../src/sim/heroes/registry';
import { hero, lockPointer, open, pickHero, VIEWPORT, READY_TIMEOUT_MS } from './game';

test.use({ viewport: VIEWPORT, actionTimeout: 8_000 });
test.setTimeout(READY_TIMEOUT_MS * 2);

const ABILITIES = HEROES.lyrebird.def.abilities;
const UPGRADE_KEY = DEFAULT_BINDINGS.upgradeModifier;
const SLOT_KEYS = [DEFAULT_BINDINGS.ability1, DEFAULT_BINDINGS.ability2, DEFAULT_BINDINGS.ability3, DEFAULT_BINDINGS.ability4] as const;
const TIER_COSTS = [1, 2, 5] as const;
const PRACTICE_AP = 32;
const AIM_SETTLE_MS = 300;
const TURN_COUNTS = 240;
const MOVED_PX = 20;
const STILL_PX = 1;

const AP = (page: Page) => page.locator('.pu-ap').first();
const tiers = (page: Page, slot: number) => page.locator('.pu-slot').nth(slot).locator('.tiers .on');
const icon = (page: Page, slot: number) => page.getByRole('button', { name: new RegExp(`^Upgrade ${ABILITIES[slot]!.name}\\b`, 'i') });
const dialog = (page: Page) => page.getByRole('dialog', { name: /Ability Upgrades/i });
const label = (page: Page) => page.locator('.pu-dlabel.enemy');

async function labelX(page: Page): Promise<number> {
  const box = await label(page).boundingBox();
  expect(box, 'the enemy dummy label is on screen').not.toBeNull();
  return box!.x + box!.width / 2;
}

/** The cursor is free: the browser's own (no pointer lock) or the game-drawn one. */
const cursorFree = (page: Page) =>
  page.evaluate(() => document.pointerLockElement === null || (document.querySelector('.pu-cursor')?.getBoundingClientRect().width ?? 0) > 0);

async function practice(page: Page): Promise<void> {
  await open(page);
  await pickHero(page, 'Practice Hub', 'Lyrebird');
  await lockPointer(page);
  await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2);
}

test.describe('hold to upgrade (D-EP-038)', () => {
  test('holding the key pauses aiming and frees a cursor; there is no upgrade dialog at any point', async ({ page }) => {
    await practice(page);
    expect(await cursorFree(page), 'aiming: the cursor is captured').toBe(false);
    const x0 = await labelX(page);
    await page.keyboard.down(UPGRADE_KEY);
    try {
      await expect.poll(() => cursorFree(page), { message: 'holding frees a cursor' }).toBe(true);
      await page.mouse.move(VIEWPORT.width / 2 + TURN_COUNTS, VIEWPORT.height / 2);
      await page.waitForTimeout(AIM_SETTLE_MS);
      expect(Math.abs(await labelX(page) - x0), 'aiming is paused: the view does not turn').toBeLessThan(STILL_PX);
      await expect(dialog(page), 'no separate upgrade dialog').toHaveCount(0);
    } finally {
      await page.keyboard.up(UPGRADE_KEY);
    }
    await expect(dialog(page)).toHaveCount(0);
  });

  test('a tap of the key opens nothing (the old tap-to-open panel is gone)', async ({ page }) => {
    await practice(page);
    await page.keyboard.press(UPGRADE_KEY);
    await page.waitForTimeout(AIM_SETTLE_MS);
    await expect(dialog(page)).toHaveCount(0);
    expect(await page.evaluate(() => document.pointerLockElement !== null), 'a tap leaves the pointer locked').toBe(true);
  });

  test('clicking an HUD icon while holding buys one tier for one AP, never shoots, and keeps the key held', async ({ page }) => {
    await practice(page);
    await expect(AP(page)).toHaveText(`AP ${PRACTICE_AP}`);
    const shots = (await hero(page)).shotsFired;
    await page.keyboard.down(UPGRADE_KEY);
    try {
      await expect(icon(page, 0)).toBeEnabled();
      await icon(page, 0).click();
      await expect(AP(page), 'one click costs the tier-1 price').toHaveText(`AP ${PRACTICE_AP - TIER_COSTS[0]}`);
      await expect(tiers(page, 0)).toHaveCount(1);
      await icon(page, 0).click();
      await expect(AP(page), 'the next click costs the tier-2 price').toHaveText(`AP ${PRACTICE_AP - TIER_COSTS[0] - TIER_COSTS[1]}`);
      await expect(tiers(page, 0)).toHaveCount(2);
    } finally {
      await page.keyboard.up(UPGRADE_KEY);
    }
    expect((await hero(page)).shotsFired, 'clicks on the bar never fire the weapon').toBe(shots);
  });

  test('pressing 1-4 while holding upgrades that ability and does not cast it', async ({ page }) => {
    await practice(page);
    await page.keyboard.down(UPGRADE_KEY);
    try {
      for (const [slot, key] of SLOT_KEYS.entries()) {
        const ap = PRACTICE_AP - slot * TIER_COSTS[0];
        await expect(AP(page)).toHaveText(`AP ${ap}`);
        await page.keyboard.press(key);
        await expect(AP(page), `ability ${slot + 1}`).toHaveText(`AP ${ap - TIER_COSTS[0]}`);
        await expect(tiers(page, slot)).toHaveCount(1);
        expect((await hero(page)).flags & ViewFlag.Casting, 'upgrading is not casting').toBe(0);
      }
    } finally {
      await page.keyboard.up(UPGRADE_KEY);
    }
  });

  test('hovering an icon shows its description, the next tier, the AP cost and the unspent AP; a maxed ability says so', async ({ page }) => {
    await practice(page);
    await page.keyboard.down(UPGRADE_KEY);
    try {
      const a = ABILITIES[0]!;
      await icon(page, 0).hover();
      await expect(page.getByText(a.description, { exact: false }).first(), 'the ability text').toBeVisible();
      await expect(page.getByText(a.upgrades[0]!.description, { exact: false }).first(), 'the next tier').toBeVisible();
      await expect(page.getByText(new RegExp(`\\b${TIER_COSTS[0]}\\s*AP\\b|AP\\s*${TIER_COSTS[0]}\\b`)).first(), 'its AP cost').toBeVisible();
      await expect(page.getByText(new RegExp(`\\b${PRACTICE_AP}\\b`)).first(), 'unspent AP').toBeVisible();
      for (let tier = 0; tier < TIER_COSTS.length; tier++) await icon(page, 0).click();
      await expect(tiers(page, 0)).toHaveCount(3);
      await page.mouse.move(1, 1);
      await icon(page, 0).hover();
      await expect(page.getByText(/fully upgraded/i).first(), 'a maxed ability says so').toBeVisible();
      await icon(page, 0).click({ force: true });
      await expect(AP(page), 'a click on a maxed ability spends nothing').toHaveText(`AP ${PRACTICE_AP - TIER_COSTS.reduce((s, c) => s + c, 0)}`);
    } finally {
      await page.keyboard.up(UPGRADE_KEY);
    }
  });

  test('releasing the key returns to aiming at once with no extra click: the view turns and aim works', async ({ page }) => {
    await practice(page);
    await page.keyboard.down(UPGRADE_KEY);
    await expect.poll(() => cursorFree(page)).toBe(true);
    await page.keyboard.up(UPGRADE_KEY);
    await expect.poll(() => cursorFree(page), { message: 'the pointer is captured again without a click', timeout: 1_000 }).toBe(false);
    const x0 = await labelX(page);
    await page.mouse.move(VIEWPORT.width / 2 + TURN_COUNTS, VIEWPORT.height / 2);
    await page.waitForTimeout(AIM_SETTLE_MS);
    expect(Math.abs(await labelX(page) - x0), 'aiming turns the view again').toBeGreaterThan(MOVED_PX);
    await page.mouse.down({ button: 'right' });
    try {
      await expect.poll(async () => (await hero(page)).flags & ViewFlag.Aiming, { message: 'aim input resumes' }).toBeTruthy();
    } finally {
      await page.mouse.up({ button: 'right' });
    }
  });

  test('Play at level 1: icons are blocked with their reason in the name and a hover reason; a click spends nothing', async ({ page }) => {
    await open(page);
    await pickHero(page, 'Play', 'Lyrebird');
    await lockPointer(page);
    await expect(AP(page)).toHaveText('AP 0');
    await page.keyboard.down(UPGRADE_KEY);
    try {
      const first = icon(page, 0);
      await expect(first, 'no AP: not available').toHaveAttribute('aria-disabled', 'true');
      await expect(first).toHaveAccessibleName(/Upgrade .+(AP|level|locked|unavailable)/i);
      await first.click({ force: true });
      await expect(AP(page)).toHaveText('AP 0');
      await expect(tiers(page, 0)).toHaveCount(0);
      const ult = icon(page, 3);
      await ult.hover();
      await expect(page.getByText(/\b6\b/).first(), 'the ultimate says what unlocks it').toBeVisible();
    } finally {
      await page.keyboard.up(UPGRADE_KEY);
    }
  });
});

