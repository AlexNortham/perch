// The zipline start (D-EP-053, D-ARCH-034/035; brief W8-start): in Play the local bird starts the match already riding
// its assigned lane's Updraft, with no input, and a banner names the lane.
import { expect, test } from '@playwright/test';
import { ViewFlag } from '../src/sim/core/contracts';
import { open, pickHero, READY_TIMEOUT_MS, VIEWPORT } from './game';

test.use({ viewport: VIEWPORT });
test.setTimeout(READY_TIMEOUT_MS * 2);

/** The ride lasts several seconds; the first look must land inside it (the sim test pins tick 1). */
const FIRST_LOOK_MAX_TICKS = 240;

test('Play: the local bird rides its lane\'s Updraft from the start with no input, and the lane banner shows', async ({ page }) => {
  await open(page, '/');
  await pickHero(page, 'Play', 'Kingfisher');
  const first = await page.evaluate(() => {
    const h = window.__perch!.hero!;
    return { tick: h.tick, flags: h.flags, y: h.pos.y };
  });
  expect(first.tick, 'looked within the ride').toBeLessThanOrEqual(FIRST_LOOK_MAX_TICKS);
  expect(first.flags & ViewFlag.OnUpdraft, `riding at tick ${first.tick}`).toBe(ViewFlag.OnUpdraft);
  await expect(page.getByRole('status', { name: 'Your lane' })).toContainText(/You're on (Hedgerow|Riverbank|Pinewood)/);
  await expect(page.getByRole('status', { name: 'Your lane' })).toContainText('Jump or Crouch to drop off');
});
