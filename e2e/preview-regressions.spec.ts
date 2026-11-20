import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { ViewFlag } from '../src/sim/core/contracts';
import { crouchKey } from './game';

const ready = (page: Page) =>
  page.waitForFunction('window.__perch?.ready === true', null, { timeout: 60_000 });
const binding = (page: Page, action: string) =>
  page.locator('button.pu-key[data-action="' + action + '"]');

test.describe('M1 preview fixes', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  for (const legacy of [false, true]) {
    test(legacy ? 'migrates legacy crouch and item keys and retains custom bindings' : 'uses browser-safe default keys', async ({ page }) => {
      if (legacy) {
        await page.addInitScript(() => {
          const key = 'perch.settings.v1';
          if (!localStorage.getItem(key)) {
            localStorage.setItem(key, JSON.stringify({ bindings: { crouch: 'ControlLeft', item3: 'KeyC', reload: 'KeyJ' } }));
          }
        });
      }
      await page.goto('/');
      await ready(page);
      await page.getByRole('button', { name: 'Options' }).click();
      // D-EP-030: crouch is Left Ctrl where fullscreen keyboard lock exists (Chrome, Edge), C elsewhere.
      const locked = await page.evaluate(() => typeof (navigator as { keyboard?: { lock?: unknown } }).keyboard?.lock === 'function');
      for (const [action, label] of [
        ['forward', 'W'],
        ['dash', 'Left Shift'],
        ['jump', 'Space'],
        ['crouch', locked ? 'Left Ctrl' : 'C'],
        ['item3', 'N'],
        ['reload', legacy ? 'J' : 'R'],
      ] as const) {
        await expect(binding(page, action)).toHaveText(label);
      }
    });
  }

  test('binds side buttons in Options without traversing browser history', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'CDP generates trusted back/forward mouse button input in Edge');
    const cdp = await context.newCDPSession(page);
    // Both directions have an actual history entry, so a native navigation can be detected. Menu scenes keep each load
    // cheap: the lane and blockout scenes cost about 4 s a load, and five loads timed out under load (QA W6).
    await page.goto('/');
    await page.goto('/?scene=menu&h=1');
    await page.goto('/?scene=menu&h=2');
    await page.goBack();
    await ready(page);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Options' }).click();

    for (const [action, button, mask, label] of [
      ['melee', 'back', 8, 'Mouse 4'],
      ['parry', 'forward', 16, 'Mouse 5'],
    ] as const) {
      await binding(page, action).click();
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', button, buttons: mask, x: 640, y: 360, clickCount: 1 });
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button, buttons: 0, x: 640, y: 360, clickCount: 1 });
      await expect(binding(page, action)).toHaveText(label);
      await expect(page).toHaveURL(new RegExp('h=1'));
    }
    await page.reload();
    await ready(page);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Options' }).click();
    await expect(binding(page, 'melee')).toHaveText('Mouse 4');
    await expect(binding(page, 'parry')).toHaveText('Mouse 5');
  });

  test('rebound mouse actions tap, charge, release and parry through pointer lock', async ({ page }) => {
    await page.goto('/?scene=sandbox&hero=shrike');
    await ready(page);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Options' }).click();
    await binding(page, 'melee').click();
    await page.mouse.click(1100, 285);
    await expect(binding(page, 'melee')).toHaveText('Left Mouse');
    await expect(binding(page, 'fire')).toHaveText('Q');
    await page.locator('button[data-reset="melee"]').click();
    await expect(binding(page, 'fire')).toHaveText('Left Mouse');

    await binding(page, 'melee').click();
    await page.mouse.click(1100, 285, { button: 'right' });
    await expect(binding(page, 'melee')).toHaveText('Right Mouse');
    await expect(binding(page, 'aim')).toHaveText('Q');
    await binding(page, 'parry').click();
    await page.mouse.click(1100, 285, { button: 'middle' });
    await expect(binding(page, 'parry')).toHaveText('Middle Mouse');
    await expect(binding(page, 'ping')).toHaveText('F');
    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'Resume' }).click();

    if (await page.evaluate(() => document.pointerLockElement === null)) await page.mouse.click(640, 360);
    await page.waitForFunction(() => document.pointerLockElement !== null);
    await page.mouse.move(640, 360);
    await page.mouse.click(640, 360, { button: 'right', delay: 80 });
    await page.waitForFunction('window.__perch.hero.lastMelee?.heavy === false && window.__perch.hero.lastMelee.target === null');
    await page.waitForFunction('window.__perch.hero.meleePose === null');
    const start = await page.evaluate<{ z: number }>('window.__perch.hero.pos');

    await page.mouse.down({ button: 'right' });
    await page.waitForFunction('window.__perch.hero.meleePose === "charging"');
    await page.waitForFunction('window.__perch.hero.lastMelee?.heavy === true && window.__perch.hero.lastMelee.target === null');
    await page.mouse.up({ button: 'right' });
    await page.waitForFunction('window.__perch.hero.meleePose === null');
    const end = await page.evaluate<{ z: number }>('window.__perch.hero.pos');
    expect(end.z - start.z, 'the charged attack lunges in the look direction').toBeGreaterThan(1);

    await page.mouse.click(640, 360, { button: 'middle', delay: 50 });
    await page.waitForFunction('window.__perch.hero.meleePose === "parry" && window.__perch.hero.lastParry?.outcome === "start"');
    await page.waitForFunction('window.__perch.hero.lastParry?.outcome === "whiff" && window.__perch.hero.meleePose === null');
  });

  test('production lane keeps playing while the player runs, dashes, jumps and slides', async ({ page }) => {
    test.setTimeout(100_000);
    const errors: string[] = [];
    page.on('crash', () => errors.push('page crashed'));
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.addInitScript(() => {
      document.addEventListener('webglcontextlost', () => document.documentElement.setAttribute('data-qa-webgl-lost', ''), true);
    });
    const lane = '/?scene=lane&hero=shrike&t=100&seed=1';
    const productionUrl = process.env.PERCH_PREVIEW_URL;
    await page.goto(productionUrl ? new URL(lane, productionUrl).href : lane);
    await ready(page);
    if (await page.evaluate(() => document.pointerLockElement === null)) await page.mouse.click(640, 360);
    await page.waitForFunction(() => document.pointerLockElement !== null);
    const url = page.url();

    // Go around the Home Roost pillar, take the centre gate and stop in Riverbank.
    for (const [code, positionReached] of [
      ['KeyD', 'x <= -12'],
      ['KeyW', 'z >= -123'],
      ['KeyA', 'x >= -4.5'],
      ['KeyW', 'z >= -104'],
    ] as const) {
      await page.keyboard.down(code);
      try {
        await page.waitForFunction('window.__perch.hero.pos.' + positionReached, null, { timeout: 12_000 });
      } finally {
        await page.keyboard.up(code);
      }
    }

    const crouch = await crouchKey(page);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(400);
    await page.keyboard.down(crouch);
    await page.waitForFunction('Boolean(window.__perch.hero.flags & ' + ViewFlag.Sliding + ')');
    await page.keyboard.up(crouch);
    await page.keyboard.up('KeyW');

    const firstTick = await page.evaluate<number>('window.__perch.hero.tick');
    const start = Date.now();
    let round = 0;
    while (Date.now() - start < 45_000) {
      const move = round++ % 2 ? 'KeyS' : 'KeyW';
      await page.keyboard.down(move);
      await page.waitForTimeout(350);
      await page.keyboard.press('ShiftLeft');
      await page.waitForTimeout(150);
      await page.keyboard.press('Space');
      await page.waitForTimeout(450);
      await page.keyboard.press(crouch, { delay: 250 });
      await page.waitForTimeout(350);
      await page.keyboard.up(move);
    }

    expect(page.isClosed()).toBe(false);
    expect(page.url()).toBe(url);
    expect(await page.evaluate<number>('window.__perch.hero.tick')).toBeGreaterThan(firstTick + 60);
    expect(await page.evaluate(() => document.pointerLockElement !== null)).toBe(true);
    await expect(page.locator('html[data-qa-webgl-lost]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
