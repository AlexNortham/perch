// Real key routing (INTEG-WEB 3): in a siege match and in the Practice Hub, with real key presses, B opens the
// Magpie's Hoard, M toggles the big map and holding the upgrade key frees the pointer for the HUD ability bar. The scoreboard
// is always on (D-EP-041). After each panel the pointer goes back to the game.
import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_BINDINGS } from '../src/client/app/bindings';
import { lockPointer, open, pickHero, shot, VIEWPORT, READY_TIMEOUT_MS } from './game';

test.use({ viewport: VIEWPORT });
test.setTimeout(READY_TIMEOUT_MS * 2);

const locked = (page: Page) => page.evaluate(() => document.pointerLockElement !== null);

for (const mode of ['Play', 'Practice Hub'] as const) {
  test(`${mode}: B, M and an Alt hold open their panels from real key presses`, async ({ page }) => {
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

    // The scoreboard is always on (D-EP-041): no key shows it, and Tab does nothing.
    const board = page.getByRole('region', { name: 'Scoreboard' });
    await expect(board, 'the scoreboard is always visible').toBeVisible();
    await shot(page, `keys-${tag}-scoreboard`);
    await page.keyboard.press('Tab');
    expect(await locked(page), 'Tab keeps the pointer locked').toBe(true);

    const map = page.locator('.pu-bigmap');
    await expect(map).toBeHidden();
    await page.keyboard.press('KeyM');
    await expect(map, 'M opens the big map').toBeVisible();
    await shot(page, `keys-${tag}-map`);
    await page.keyboard.press('KeyM');
    await expect(map, 'M again closes it').toBeHidden();

    // Holding the upgrade key frees the pointer for the ability bar; releasing locks it again with no click (D-EP-038).
    await page.keyboard.down(DEFAULT_BINDINGS.upgradeModifier);
    await expect.poll(() => locked(page), { message: 'holding the upgrade key frees the pointer' }).toBe(false);
    await shot(page, `keys-${tag}-upgrades`);
    await page.keyboard.up(DEFAULT_BINDINGS.upgradeModifier);
    await expect.poll(() => locked(page), { message: 'releasing it locks the pointer again' }).toBe(true);
  });
}
