import { expect, test, type Locator, type Page } from '@playwright/test';
import { DEFAULT_BINDINGS } from '../src/client/app/bindings';
import { ViewFlag } from '../src/sim/core/contracts';
import { CAMERA, TRAINING_TARGET } from '../src/sim/data/core';
import { ECONOMY } from '../src/sim/data/economy';
import { HEROES } from '../src/sim/heroes/registry';
import { afterTicks, aimAtDummy, crouchKey, fire, shot, hero, lockPointer, open, pickHero, READY_TIMEOUT_MS, VIEWPORT } from './game';

const LYRE_ABILITIES = HEROES.lyrebird.def.abilities;
const INSPECT = DEFAULT_BINDINGS.upgradeModifier;
const TARGET_RESET_TIMEOUT_MS = 25_000;
const MAX_ACTION_TIMEOUT_MS = 5_000;
// Five ordinary Echo Lute hits exceed what the dummy's 2 HP/s passive regeneration could restore during the reset wait.
const DAMAGE_FOR_RESET = 60;
const AP = (page: Page) => page.locator('.pu-ap');
const seeds = (page: Page) => page.locator('.pu-seeds');
const tier = (page: Page, slot: number) => page.locator('.pu-slot').nth(slot).locator('.tiers .on');
const upgradePanel = (page: Page) => page.getByRole('dialog', { name: /Ability Upgrades/i });
const upgrade = (panel: Locator, ability: string) => panel.getByRole('button', { name: new RegExp(`^Upgrade ${ability}\\b`, 'i') });

test.use({ viewport: VIEWPORT });
test.setTimeout(READY_TIMEOUT_MS * 2);

async function strafeToDummy(page: Page, side: -1 | 1, spawnX: number): Promise<void> {
  // At Dawn's spawn we face +Z. The right-shoulder sightline is offset toward −X; strafe it onto the dummy.
  const x = spawnX + side * TRAINING_TARGET.side + CAMERA.shoulderRight;
  await page.keyboard.down(side === 1 ? 'KeyA' : 'KeyD');
  try {
    await page.waitForFunction(
      ({ x, side }) => {
        const pos = window.__perch?.hero?.pos.x;
        return pos !== undefined && (pos - x) * side >= -0.15;
      },
      { x, side },
    );
  } finally {
    await page.keyboard.up(side === 1 ? 'KeyA' : 'KeyD');
  }
  await afterTicks(page, (await hero(page)).tick, 12);
}

async function hp(bar: Locator, attr: 'aria-valuenow' | 'aria-valuemax'): Promise<number> {
  const value = await bar.getAttribute(attr);
  return value === null ? NaN : Number(value);
}

test('Practice Hub from the menu: Lyrebird shoots and heals twice with a reset between trials', async ({ page }) => {
  await open(page);
  await pickHero(page, 'Practice Hub', 'Lyrebird');
  await expect(AP(page)).toHaveText('AP 32');
  for (const ability of LYRE_ABILITIES) {
    await expect(page.getByText(ability.name, { exact: true })).toBeVisible();
  }
  await expect(page.locator('.pu-slot.lock')).toHaveCount(0);

  const ally = page.getByRole('progressbar', { name: /Ally dummy/i });
  const enemy = page.getByRole('progressbar', { name: /Enemy dummy/i });
  const spawn = await hero(page);
  await lockPointer(page);
  const crouch = await crouchKey(page);
  await page.keyboard.down(crouch);
  try {
    await strafeToDummy(page, 1, spawn.pos.x);
    await expect(enemy, 'enemy dummy publishes a live HP bar').toBeVisible();
    await aimAtDummy(page, 'enemy');
    const enemyMax = await hp(enemy, 'aria-valuemax');
    expect(enemyMax).toBeGreaterThan(0);
    for (const attempt of [1, 2]) {
      await expect.poll(() => hp(enemy, 'aria-valuenow'), {
        message: `enemy dummy resets to full for trial ${attempt}`, timeout: TARGET_RESET_TIMEOUT_MS,
      }).toBe(enemyMax);
      await page.mouse.down();
      try {
        await expect.poll(() => hp(enemy, 'aria-valuenow'), {
          message: `ordinary weapon fire lowers enemy HP in trial ${attempt}`, timeout: MAX_ACTION_TIMEOUT_MS,
        }).toBeLessThan(enemyMax - DAMAGE_FOR_RESET);
      } finally {
        await page.mouse.up();
      }
    }
    await strafeToDummy(page, -1, spawn.pos.x);
    await expect(ally, 'allied dummy publishes a live HP bar').toBeVisible();
    await aimAtDummy(page, 'ally');
    const allyMax = await hp(ally, 'aria-valuemax');
    expect(allyMax).toBeGreaterThan(0);
    for (const attempt of [1, 2]) {
      await expect.poll(async () => (await hp(ally, 'aria-valuenow')) / allyMax, {
        message: `ally dummy settles back to its 40% wound for trial ${attempt}`, timeout: TARGET_RESET_TIMEOUT_MS,
      }).toBeCloseTo(TRAINING_TARGET.alliedHpFraction, 2);
      await page.keyboard.press(DEFAULT_BINDINGS.ability1);
      await expect.poll(() => hp(ally, 'aria-valuenow'), {
        message: `real Mended Song raises allied HP in trial ${attempt}`, timeout: MAX_ACTION_TIMEOUT_MS,
      }).toBeGreaterThan(allyMax * TRAINING_TARGET.alliedHpFraction + 20);
    }
    await shot(page, 'practice-heal');
  } finally {
    await page.keyboard.up(crouch);
  }

  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Quit to menu|Main menu/i }).click();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate('window.__perch.hero'), { message: 'return clears the practice hero' }).toBeNull();
  await pickHero(page, 'Play', 'Lyrebird');
  await expect(AP(page)).toHaveText('AP 0');
  await expect(page.getByText('Lv 1', { exact: true })).toBeVisible();
  await expect(page.locator('.pu-slot.ult')).toHaveClass(/\block\b/);
  expect((await hero(page)).shotsFired, 'new siege session clears practice shot count').toBe(0);
  await expect(page.getByRole('progressbar', { name: /dummy/i })).toHaveCount(0);
});

test('inspect upgrades: pointer release, descriptions, one AP transaction, quick chord and return to fire', async ({ page }) => {
  // Use the real practice route to isolate upgrades from the separately tested menu button.
  await open(page, '/?scene=practice&hero=lyrebird');
  await lockPointer(page);
  const before = await hero(page);
  await page.keyboard.press(INSPECT);
  const panel = upgradePanel(page);
  await expect(panel, 'tapping Inspect opens Ability Upgrades').toBeVisible();
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
  await afterTicks(page, before.tick, 20);

  for (const ability of LYRE_ABILITIES) {
    const card = panel.getByRole('button', { name: new RegExp(ability.name, 'i') }).first();
    const description = panel.getByText(ability.description, { exact: false });
    const nextTier = panel.getByText(ability.upgrades[0]!.description, { exact: false });
    await card.hover();
    await expect(description, `${ability.name} description on hover`).toBeVisible();
    await expect(nextTier, `${ability.name} first-tier effect on hover`).toBeVisible();
    await page.mouse.move(0, 0);
    await card.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(card).toBeFocused();
    await expect(description, `${ability.name} description on keyboard focus`).toBeVisible();
    await expect(nextTier, `${ability.name} first-tier effect on keyboard focus`).toBeVisible();
  }

  const mended = LYRE_ABILITIES[0]!.name;
  const purchase = upgrade(panel, mended);
  await expect(AP(page).first()).toHaveText('AP 32');
  await expect(purchase).toBeEnabled();
  await expect(purchase).toContainText(/\b1\b/);
  await purchase.click();
  await afterTicks(page, (await hero(page)).tick, 16);
  await expect(AP(page).first(), 'one click costs exactly one AP').toHaveText('AP 31');
  await expect(tier(page, 0), 'one click buys exactly one tier').toHaveCount(1);
  await expect(purchase).toContainText(/\b2\b/);
  expect((await hero(page)).shotsFired, 'panel clicks never shoot').toBe(before.shotsFired);
  await shot(page, 'ability-upgrades');

  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await lockPointer(page);
  await page.mouse.down({ button: 'right' });
  try {
    await expect.poll(async () => (await hero(page)).flags & ViewFlag.Aiming, { message: 'aim input resumes' }).toBeTruthy();
  } finally {
    await page.mouse.up({ button: 'right' });
  }
  await fire(page);
  await page.keyboard.press(`${INSPECT}+${DEFAULT_BINDINGS.ability1}`);
  await expect(AP(page).first()).toHaveText('AP 29');
  await expect(tier(page, 0)).toHaveCount(2);
  await expect(panel, 'quick chord buys the next tier while keeping the panel closed').toBeHidden();
  expect(await page.evaluate(() => document.pointerLockElement !== null)).toBe(true);
});

test('ordinary Play starts siege progression with zero AP and a locked ultimate', async ({ page }) => {
  await open(page);
  await pickHero(page, 'Play', 'Lyrebird');
  const start = await hero(page);
  await expect(page.getByText('Lv 1', { exact: true })).toBeVisible();
  await expect(AP(page)).toHaveText('AP 0');
  await expect(page.locator('.pu-slot.ult')).toHaveClass(/\block\b/);
  await expect(page.getByText(/Elder Raven/i).first(), 'ordinary Play presents the actual Dusk Patron').toBeVisible();

  await lockPointer(page);
  await page.keyboard.press(INSPECT);
  const panel = upgradePanel(page);
  await expect(panel).toBeVisible();
  await expect(upgrade(panel, LYRE_ABILITIES[0]!.name), 'the normal match cannot buy a tier with zero AP').toBeDisabled();
  await expect(upgrade(panel, LYRE_ABILITIES[3]!.name), 'ultimate is gated until level 6').toBeDisabled();
  await expect(panel.getByText(/level 6/i).first()).toBeVisible();
  await expect(panel.getByText(/not enough AP|insufficient AP|requires.*AP/i).first()).toBeVisible();
  await afterTicks(page, start.tick, 30);
  await expect(AP(page).first()).toHaveText('AP 0');
  await expect.poll(async () => Number((await seeds(page).innerText()).replace(/[^\d]/g, '')), {
    message: 'ordinary siege earns passive Seeds while the inspect panel is open', timeout: 60_000,
  }).toBeGreaterThan(ECONOMY.startSeeds);
  await expect(panel).toBeVisible();
});

test('Play picker exposes all twelve M2 heroes across A1, A2 and B1', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose your bird' })).toBeVisible();
  await expect(page.locator('.pu-card:enabled'), 'there are twelve selectable M2 hero cards').toHaveCount(12);
  for (const id of [
    'shrike', 'albatross', 'kingfisher', 'lyrebird',
    'hornbill', 'flamingo', 'penguin', 'puffin',
    'owl', 'pelican', 'secretarybird', 'starling',
  ] as const) {
    await expect(page.getByRole('button', { name: new RegExp(`^${HEROES[id].def.name}\\b`) })).toBeEnabled();
  }
});
