// Real key routing (INTEG-WEB 3): in a siege match and in the Practice Hub, with real key presses, B opens the
// Magpie's Hoard, Tab (held) shows the scoreboard, M toggles the big map and a tap of the upgrade key opens
// Ability Upgrades. After each panel the pointer goes back to the game.
import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_BINDINGS } from '../src/client/app/bindings';
import { lockPointer, open, pickHero, shot, VIEWPORT, READY_TIMEOUT_MS } from './game';

test.use({ viewport: VIEWPORT });
test.setTimeout(READY_TIMEOUT_MS * 2);

const locked = (page: Page) => page.evaluate(() => document.pointerLockElement !== null);

for (const mode of ['Play', 'Practice Hub'] as const) {
  test(`${mode}: B, Tab, M and an Alt tap open their panels from real key presses`, async ({ page }) => {
    const tag = mode === 'Play' ? 'match' : 'practice';
    await open(page);
    await pickHero(page, mode, 'Lyrebird');
    await lockPointer(page);

    const shop = page.getByRole('dialog', { name: "Magpie's Hoard" });
    await page.keyboard.press('KeyB');
    await expect(shop, 'B opens the Magpie\'s Hoard').toBeVisible();
    expect(await locked(page), 'the shop frees the pointer').toBe(false);
    await shot(page, `keys-${tag}-shop`);
    await page.keyboard.press('KeyB');
    await expect(shop, 'B again closes it').toBeHidden();
    await lockPointer(page);

    const board = page.getByRole('region', { name: 'Scoreboard' });
    await page.keyboard.down('Tab');
    await expect(board, 'holding Tab shows the scoreboard').toBeVisible();
    await shot(page, `keys-${tag}-scoreboard`);
    await page.keyboard.up('Tab');
    await expect(board, 'releasing Tab hides it').toBeHidden();
    expect(await locked(page), 'the scoreboard keeps the pointer locked').toBe(true);

    const map = page.locator('.pu-bigmap');
    await expect(map).toBeHidden();
    await page.keyboard.press('KeyM');
    await expect(map, 'M opens the big map').toBeVisible();
    await shot(page, `keys-${tag}-map`);
    await page.keyboard.press('KeyM');
    await expect(map, 'M again closes it').toBeHidden();

    const upgrades = page.getByRole('dialog', { name: /Ability Upgrades/i });
    await page.keyboard.press(DEFAULT_BINDINGS.upgradeModifier);
    await expect(upgrades, 'tapping Alt opens Ability Upgrades').toBeVisible();
    expect(await locked(page), 'upgrades free the pointer').toBe(false);
    await shot(page, `keys-${tag}-upgrades`);
    await page.keyboard.press('Escape');
    await expect(upgrades).toBeHidden();
    await lockPointer(page);
  });
}
