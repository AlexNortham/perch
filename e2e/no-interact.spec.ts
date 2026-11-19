// No Interact key (D-EP-039, INTERFACES §14.4; W4.5 QA, test-first): the Options list has no Interact entry, and a
// profile saved by Stage 3 (which had one) loads with every other binding intact. Pending until Camera & Input, UI and
// the app shell land it (wave 5):
//   PERCH_PENDING=1 npx playwright test e2e/no-interact.spec.ts --workers=1
import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_BINDINGS } from '../src/client/app/bindings';
import { open, READY_TIMEOUT_MS } from './game';

test.use({ viewport: { width: 1280, height: 720 }, actionTimeout: 8_000 });
test.setTimeout(READY_TIMEOUT_MS * 2);

const STORAGE_KEY = 'perch.settings.v3';
const keyButtons = (page: Page) => page.locator('button.pu-key[data-action]');
const button = (page: Page, action: string) => page.locator(`button.pu-key[data-action="${action}"]`);

/** action → the text its key button shows, for every row on the Options screen. */
async function rows(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => Object.fromEntries(
    [...document.querySelectorAll<HTMLButtonElement>('button.pu-key[data-action]')].map((b) => [b.dataset['action'] ?? '', b.innerText.trim()]),
  ));
}

async function options(page: Page): Promise<void> {
  await open(page);
  await page.getByRole('button', { name: 'Options' }).click();
  await expect(keyButtons(page).first()).toBeVisible();
}

test.describe('no Interact (D-EP-039)', () => {
  test('the Options list has no Interact entry, and no Scoreboard entry either', async ({ page }) => {
    await options(page);
    const actions = Object.keys(await rows(page));
    expect(actions, 'the real rows are there').toEqual(expect.arrayContaining(['jump', 'dash', 'fire', 'melee']));
    expect(actions).not.toContain('interact');
    expect(actions).not.toContain('scoreboard');
    await expect(page.getByText(/interact/i), 'no label mentions it').toHaveCount(0);
  });

  test('a Stage 3 profile with an Interact binding loads with every other binding intact', async ({ browser }) => {
    const fresh = await (await browser.newContext()).newPage();
    await options(fresh);
    const baseline = await rows(fresh);

    const context = await browser.newContext();
    await context.addInitScript(({ key, saved }) => {
      if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, JSON.stringify(saved));
    }, {
      key: STORAGE_KEY,
      // What Stage 3 wrote: every default, an Interact binding, and a player's own choice for Jump and Melee.
      saved: { bindings: { ...DEFAULT_BINDINGS, interact: 'KeyE', jump: 'KeyJ', melee: 'KeyT' } },
    });
    const page = await context.newPage();
    await options(page);
    const loaded = await rows(page);

    expect(Object.keys(loaded), 'no Interact row').not.toContain('interact');
    expect(loaded['jump'], 'the player\'s Jump choice survives').toBe('J');
    expect(loaded['melee'], 'the player\'s Melee choice survives').toBe('T');
    // Crouch is left out: this saved profile names C itself, a choice a profile keeps, while a fresh profile gets Left Ctrl where keyboard lock exists (D-EP-030).
    const keep = Object.keys(baseline).filter((a) => a !== 'jump' && a !== 'melee' && a !== 'crouch');
    for (const action of keep) expect(loaded[action], `${action} is untouched`).toBe(baseline[action]);
    expect(Object.keys(loaded).sort(), 'the same rows as a fresh profile').toEqual(Object.keys(baseline).sort());
    await context.close();
  });

  test('E is an ordinary key now: binding Jump to E swaps nothing', async ({ page }) => {
    await options(page);
    const before = await rows(page);
    await button(page, 'jump').click();
    await page.keyboard.press('KeyE');
    await expect(button(page, 'jump')).toHaveText('E');
    await expect(page.locator('.pu-status'), 'no swap message: nothing else held E').not.toContainText('swapped');
    const after = await rows(page);
    for (const action of Object.keys(before).filter((a) => a !== 'jump')) expect(after[action], `${action} is unchanged`).toBe(before[action]);
  });
});
