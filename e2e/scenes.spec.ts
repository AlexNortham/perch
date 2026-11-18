// Every ?scene= loads without console errors and reaches window.__perch.ready; each run also saves a 1920×1080
// review screenshot of every scene to out/shots/review/<scene>.png (pictures for review, no pixel comparison).
import { expect, test } from '@playwright/test';
import { SCENES } from '../src/client/app/router';

const READY_TIMEOUT_MS = 60_000;
const REVIEW_DIR = 'out/shots/review';

test.use({ viewport: { width: 1920, height: 1080 } });

for (const scene of SCENES) {
  test(`scene ${scene} loads, gets ready and has no console errors`, async ({ page }) => {
    test.setTimeout(READY_TIMEOUT_MS * 2);
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(`/?scene=${scene}`);
    await page.waitForFunction('window.__perch?.ready === true', null, { timeout: READY_TIMEOUT_MS });
    expect(await page.evaluate('window.__perch.scene')).toBe(scene);
    await page.screenshot({ path: `${REVIEW_DIR}/${scene}.png` });
    expect(errors).toEqual([]);
  });
}
