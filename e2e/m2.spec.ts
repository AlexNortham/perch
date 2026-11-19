import { expect, test, type Locator, type Page } from '@playwright/test';
import { DEFAULT_BINDINGS } from '../src/client/app/bindings';

import { CAMERA, TRAINING_TARGET } from '../src/sim/data/core';
import { ECONOMY } from '../src/sim/data/economy';
import { HEROES } from '../src/sim/heroes/registry';
import { afterTicks, aimAtDummy, crouchKey, shot, hero, lockPointer, open, pickHero, READY_TIMEOUT_MS, VIEWPORT } from './game';

const LYRE_ABILITIES = HEROES.lyrebird.def.abilities;
const INSPECT = DEFAULT_BINDINGS.upgradeModifier;
const TARGET_RESET_TIMEOUT_MS = 25_000;
const MAX_ACTION_TIMEOUT_MS = 5_000;
// Five ordinary Echo Lute hits exceed what the dummy's 2 HP/s passive regeneration could restore during the reset wait.
const DAMAGE_FOR_RESET = 60;
const AP = (page: Page) => page.locator('.pu-ap');
const seeds = (page: Page) => page.locator('.pu-seeds');

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

// The tap-to-open Ability Upgrades panel is gone (D-EP-038); hold-upgrade.spec.ts covers hold, click, 1-4, hover and release.

test('ordinary Play starts siege progression with zero AP and a locked ultimate', async ({ page }) => {
  await open(page);
  await pickHero(page, 'Play', 'Lyrebird');
  const start = await hero(page);
  await expect(page.getByText('Lv 1', { exact: true })).toBeVisible();
  await expect(AP(page)).toHaveText('AP 0');
  await expect(page.locator('.pu-slot.ult')).toHaveClass(/\block\b/);
  await expect(page.getByText(/Elder Raven/i).first(), 'ordinary Play presents the actual Dusk Patron').toBeVisible();

  await lockPointer(page);
  await page.keyboard.down(INSPECT);
  const ability = (n: number) => page.getByRole('button', { name: new RegExp(`^Upgrade ${LYRE_ABILITIES[n]!.name}\\b`, 'i') });
  await expect(ability(0), 'the normal match cannot buy a tier with zero AP').toHaveAttribute('aria-disabled', 'true');
  await expect(ability(3), 'ultimate is gated until level 6').toHaveAttribute('aria-disabled', 'true');
  await ability(3).hover();
  await expect(page.getByText(/level 6/i).first()).toBeVisible();
  await ability(0).hover();
  await expect(page.getByText(/not enough AP|insufficient AP|requires.*AP/i).first()).toBeVisible();
  await afterTicks(page, start.tick, 30);
  await expect(AP(page).first()).toHaveText('AP 0');
  await expect.poll(async () => Number((await seeds(page).innerText()).replace(/[^\d]/g, '')), {
    message: 'ordinary siege earns passive Seeds while the upgrade key is held', timeout: 60_000,
  }).toBeGreaterThan(ECONOMY.startSeeds);
  await page.keyboard.up(INSPECT);
});

test('Play picker exposes every implemented hero (the M2 twelve and any later batches)', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose your bird' })).toBeVisible();
  // Derived from the registry so new hero batches never break this test (EP, Stage 4).
  const implemented = (Object.keys(HEROES) as (keyof typeof HEROES)[]).filter((id) => HEROES[id].implemented === true);
  expect(implemented.length, 'at least the twelve M2 heroes are implemented').toBeGreaterThanOrEqual(12);
  await expect(page.locator('.pu-card:enabled'), 'one selectable card per implemented hero').toHaveCount(implemented.length);
  for (const id of implemented) {
    await expect(page.getByRole('button', { name: new RegExp(`^${HEROES[id].def.name}\\b`) })).toBeEnabled();
  }
});
