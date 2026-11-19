// A siege match from the real menu (INTEG-WEB 6): Play, pick a bird, earn Seeds, level up, buy an item in the shop
// zone and sell it back, open the scoreboard and map, and see damage numbers. `?t=900` fast-forwards the sim
// 15 minutes before the first frame (the passive income and levels of a long game without the wait); every
// action after the hero appears is a real key press or mouse click.
import { expect, test, type Page } from '@playwright/test';
import { HEALTH_CSS } from '../src/client/ui/constants';
import { lockPointer, open, pickHero, shot, walkTo, VIEWPORT, READY_TIMEOUT_MS } from './game';

test.use({ viewport: VIEWPORT });
test.setTimeout(READY_TIMEOUT_MS * 3);

const FAST_FORWARD_S = 900;
const ITEM = 'Quill Clip';
const WALK_LIMIT_MS = 120_000;
const HEDGEROW_ROUTE = [{ x: -40, z: -114 }, { x: -95, z: -80 }, { x: -95, z: 15 }] as const;
const SWEEP_STEPS = 24;
const SWEEP_DEG = 15;
const SWEEP_MS = 700;
const COUNTS_PER_DEGREE = 1 / 0.06;
const seedsOf = async (page: Page) => Number((await page.locator('.pu-seeds').innerText()).replace(/[^\d]/g, ''));

test('Play from the menu as Kingfisher: earn, level, buy and sell in the shop zone, scoreboard, map, damage numbers', async ({ page }) => {
  await open(page, `/?t=${FAST_FORWARD_S}`);
  await pickHero(page, 'Play', 'Kingfisher');
  await lockPointer(page);

  const start = await seedsOf(page);
  expect(start, 'passive income earned Seeds by minute 15').toBeGreaterThanOrEqual(800);
  await expect(page.getByText('Lv 2', { exact: true }), 'Seeds levelled the hero up').toBeVisible();
  await shot(page, 'match-earned');

  const shop = page.getByRole('dialog', { name: "Magpie's Hoard" });
  await page.keyboard.press('KeyB');
  await expect(shop).toBeVisible();
  const card = shop.locator('.pu-item', { hasText: ITEM });
  await card.click();
  await expect.poll(() => seedsOf(page), { message: 'buying spends Seeds' }).toBeLessThan(start);
  const spent = await seedsOf(page);
  await expect(shop.locator('.pu-shop-slots')).toContainText(ITEM);
  await shot(page, 'match-shop-bought');
  await card.click({ button: 'right' });
  await expect.poll(() => seedsOf(page), { message: 'selling in the shop zone refunds' }).toBeGreaterThan(spent);
  await shot(page, 'match-shop-sold');
  await page.keyboard.press('KeyB');
  await expect(shop).toBeHidden();
  await lockPointer(page);

  await page.keyboard.down('Tab');
  await expect(page.getByRole('region', { name: 'Scoreboard' })).toBeVisible();
  await shot(page, 'match-scoreboard');
  await page.keyboard.up('Tab');
  await page.keyboard.press('KeyM');
  await expect(page.locator('.pu-bigmap')).toBeVisible();
  await shot(page, 'match-map');
  await page.keyboard.press('KeyM');

  // Walk the Hedgerow lane to the fledgling clash with W and mouse steering, then sweep the view while firing until a shot lands: a damage number appears.
  await walkTo(page, HEDGEROW_ROUTE, WALK_LIMIT_MS);
  // Record any damage number the moment it is added (they fade), whatever the machine's load.
  await page.evaluate((heal) => {
    const probe = document.createElement('div');
    probe.style.color = heal; // heal numbers are green; a damage number is any other colour
    new MutationObserver((records) => {
      for (const r of records) {
        for (const n of r.addedNodes) {
          if (n instanceof HTMLElement && n.classList.contains('pu-num') && n.style.color !== probe.style.color) (window as { sawDamage?: boolean }).sawDamage = true;
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  }, HEALTH_CSS);
  await page.mouse.down();
  let seen = false;
  try {
    for (let i = 0; i < SWEEP_STEPS && !seen; i++) {
      await page.mouse.move(640 + (i + 1) * SWEEP_DEG * COUNTS_PER_DEGREE, 360);
      seen = await page.waitForFunction('window.sawDamage === true', null, { timeout: SWEEP_MS }).then(() => true, () => false);
    }
    await shot(page, 'match-damage-numbers');
    expect(seen, 'a shot landed and showed a damage number').toBe(true);
  } finally {
    await page.mouse.up();
  }
});
