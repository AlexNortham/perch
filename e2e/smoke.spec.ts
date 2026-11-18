import { expect, test } from '@playwright/test';

test('boots to a rendered WebGL scene without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');
  await page.waitForFunction('window.__perch?.ready === true');

  // A canvas that already holds a WebGL context refuses a 2D one.
  const webgl = await page.evaluate(() =>
    [...document.querySelectorAll('canvas')].some(
      (c) => c.getContext('2d') === null && (c.getContext('webgl2') ?? c.getContext('webgl')) !== null,
    ),
  );
  expect(webgl, 'a canvas with a WebGL context').toBe(true);
  expect(errors).toEqual([]);
});
