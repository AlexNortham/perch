// Tracers versus the crosshair (INTEG-WEB 4). VFX draws Combat's weapon.traces; this freezes the render loop two
// frames after a shot so the tracer is on screen, then saves the frame for inspection under out/web.
import { expect, test, type Page } from '@playwright/test';
import { aimAtDummy, lockPointer, open, pickHero, shot, VIEWPORT, READY_TIMEOUT_MS } from './game';

test.use({ viewport: VIEWPORT });
test.setTimeout(READY_TIMEOUT_MS * 2);

const FRAMES_AFTER_SHOT = 2;

/** Wrap requestAnimationFrame: once the hero's shot count rises, run two more frames, then stop the loop. */
async function armFreeze(page: Page): Promise<void> {
  await page.addInitScript((framesAfter) => {
    const raf = window.requestAnimationFrame.bind(window);
    let last = -1;
    let left = -1;
    window.requestAnimationFrame = (cb) => raf((t) => {
      if (left === 0) return;
      cb(t);
      const shots = window.__perch?.hero?.shotsFired ?? 0;
      if (last >= 0 && shots > last && left < 0) left = framesAfter;
      last = shots;
      if (left > 0) left -= 1;
    });
  }, FRAMES_AFTER_SHOT);
}

const COUNTS_PER_DEGREE = 1 / 0.06;
const STUCK_MS = 500;

async function holdFireOneShot(page: Page): Promise<void> {
  await page.mouse.down();
  await page.waitForFunction(() => (window.__perch?.hero?.shotsFired ?? 0) > 0);
  await page.waitForTimeout(300);
  await page.mouse.up();
}

/** Walk forward until the hero stops advancing (pressed against whatever is ahead). */
async function walkIntoCover(page: Page): Promise<void> {
  await page.keyboard.down('KeyW');
  let prev = Number.NaN;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(STUCK_MS);
    const pos = (await page.evaluate<{ x: number; z: number }>('window.__perch.hero.pos'));
    const here = pos.x * 1000 + pos.z;
    if (Math.abs(here - prev) < 0.05) break;
    prev = here;
  }
  await page.keyboard.up('KeyW');
}

test('albatross: tracers with the muzzle against cover, and beside it', async ({ page }) => {
  await armFreeze(page);
  await open(page, '/?scene=lane&hero=albatross');
  await lockPointer(page);
  await walkIntoCover(page);
  await page.mouse.move(640, 360);
  // Turn along the wall first so the shot is taken with cover beside the muzzle, not in front of it.
  await page.mouse.move(640 + 90 * COUNTS_PER_DEGREE, 360);
  await holdFireOneShot(page);
  await shot(page, 'tracer-albatross-beside-cover');
});

test('kingfisher: tracer with the muzzle against cover', async ({ page }) => {
  await armFreeze(page);
  await open(page, '/?scene=lane&hero=kingfisher');
  await lockPointer(page);
  await walkIntoCover(page);
  await holdFireOneShot(page);
  await shot(page, 'tracer-kingfisher-blocked');
});

test('kingfisher: tracer ends on the enemy dummy under the reticle', async ({ page }) => {
  await armFreeze(page);
  await open(page);
  await pickHero(page, 'Practice Hub', 'Kingfisher');
  await lockPointer(page);
  await aimAtDummy(page, 'enemy');
  await holdFireOneShot(page);
  await shot(page, 'tracer-kingfisher-dummy');
});

const heroes = ['albatross', 'kingfisher'] as const;

for (const id of heroes) {
  test(`${id}: tracer leaves the muzzle and meets the centre reticle on a distant open sightline`, async ({ page }) => {
    await armFreeze(page);
    await open(page, `/?scene=lane&hero=${id}`);
    await lockPointer(page);
    await page.mouse.down();
    await page.waitForFunction(() => (window.__perch?.hero?.shotsFired ?? 0) > 0);
    await page.waitForTimeout(300);
    await page.mouse.up();
    const path = await shot(page, `tracer-${id}-open`);
    expect(path).toContain(id);
  });
}
