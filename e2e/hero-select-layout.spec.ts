// Hero select layout shift (user-reported bug, Stage 3 playtest; W4.5 QA): hovering or focusing a card must not move
// any card, even by 1 px. Applies to both pickers (Play and Practice Hub), mouse hover and keyboard focus.
// GDD §12.3: a grid of 24 portraits in 8 columns x 3 rows. Pending until the fix lands (UI/HUD, wave 5):
//   PERCH_PENDING=1 npx playwright test e2e/hero-select-layout.spec.ts --workers=1
import { expect, test, type Page } from '@playwright/test';
import { open, VIEWPORT, READY_TIMEOUT_MS } from './game';
import { isPending, PENDING_REASON } from './pending';

test.use({ viewport: VIEWPORT });
test.setTimeout(READY_TIMEOUT_MS * 3);
test.skip(isPending, PENDING_REASON);

const CARD_COUNT = 24;
/** Zero tolerance: "no card's bounding box moves by even 1 px". Sub-pixel float noise from one layout pass is not a shift. */
const EPSILON_PX = 0.01;

interface Box { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

/** Every card's border box, plus the page scroll, in one round trip. */
const boxes = (page: Page): Promise<{ cards: Box[]; scrollX: number; scrollY: number }> =>
  page.evaluate(() => ({
    cards: [...document.querySelectorAll('.pu-card')].map((c) => {
      const r = c.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }),
    scrollX: window.scrollX,
    scrollY: window.scrollY,
  }));

function expectNoShift(now: Awaited<ReturnType<typeof boxes>>, base: Awaited<ReturnType<typeof boxes>>, what: string): void {
  expect(now.cards, `${what}: still ${CARD_COUNT} cards`).toHaveLength(CARD_COUNT);
  expect([now.scrollX, now.scrollY], `${what}: the page did not scroll`).toEqual([base.scrollX, base.scrollY]);
  now.cards.forEach((box, i) => {
    for (const key of ['x', 'y', 'w', 'h'] as const) {
      expect(Math.abs(box[key] - base.cards[i]![key]), `${what}: card ${i + 1} ${key} (${box[key]} vs ${base.cards[i]![key]})`).toBeLessThanOrEqual(EPSILON_PX);
    }
  });
}

for (const mode of ['Play', 'Practice Hub'] as const) {
  test.describe(`${mode} picker`, () => {
    async function arrive(page: Page) {
      await open(page);
      await page.getByRole('button', { name: mode, exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Choose your bird' })).toBeVisible();
      await expect(page.locator('.pu-card')).toHaveCount(CARD_COUNT);
      await page.mouse.move(2, 2);
      await page.waitForTimeout(300);
      return boxes(page);
    }

    test(`hovering each card in turn moves no card (${mode})`, async ({ page }) => {
      const base = await arrive(page);
      const cards = page.locator('.pu-card');
      for (let i = 0; i < CARD_COUNT; i++) {
        await cards.nth(i).hover();
        await page.waitForTimeout(120); // longer than any hover transition
        expectNoShift(await boxes(page), base, `hover card ${i + 1}`);
      }
      await page.mouse.move(2, 2);
      await page.waitForTimeout(150);
      expectNoShift(await boxes(page), base, 'pointer leaves the grid');
    });

    test(`focusing each card in turn moves no card, by script focus and by the Tab key (${mode})`, async ({ page }) => {
      const base = await arrive(page);
      const cards = page.locator('.pu-card');
      for (let i = 0; i < CARD_COUNT; i++) {
        await cards.nth(i).focus();
        await page.waitForTimeout(120);
        expectNoShift(await boxes(page), base, `focus card ${i + 1}`);
      }
      await cards.first().focus();
      for (let i = 1; i < CARD_COUNT; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(80);
        expectNoShift(await boxes(page), base, `Tab to card ${i + 1}`);
      }
    });

    test(`hover plus focus together, and a hover that arrives while another card is focused, move nothing (${mode})`, async ({ page }) => {
      const base = await arrive(page);
      const cards = page.locator('.pu-card');
      await cards.nth(0).focus();
      for (const i of [1, 8, 17, 23, 12]) {
        await cards.nth(i).hover();
        await page.waitForTimeout(120);
        expectNoShift(await boxes(page), base, `focus 1 + hover ${i + 1}`);
      }
    });
  });
}
