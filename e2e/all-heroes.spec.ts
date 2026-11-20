// Gate M3 (D-EP-050): every implemented hero starts a 1 + 11 match from the real menu. The hero list comes from the
// registry, so the four Hero B3 birds are covered the moment their `implemented` flag turns on. Each bird: Play, pick
// it, and the top bar shows six portraits a side with the pick on our side; the sim then ticks for two seconds
// (the 11 bots included) with no page error.
import { expect, test } from '@playwright/test';
import { HERO_IDS } from '../src/sim/core/contracts';
import { HEROES } from '../src/sim/heroes/registry';
import { open, pickHero, VIEWPORT, READY_TIMEOUT_MS } from './game';

test.use({ viewport: VIEWPORT });
test.setTimeout(READY_TIMEOUT_MS * 2);

const PER_SIDE = 6;
const TICK_RATE = 60;

for (const id of HERO_IDS.filter((h) => HEROES[h].implemented === true)) {
  test(`${id}: starts a 1 + 11 match from the menu`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await open(page, '/?seed=1');
    await pickHero(page, 'Play', HEROES[id].def.name);
    const bar = page.getByRole('region', { name: 'Scoreboard' });
    await expect(bar.locator('[data-portrait][data-side="own"]'), 'our flock').toHaveCount(PER_SIDE);
    await expect(bar.locator('[data-portrait][data-side="enemy"]'), 'their flock').toHaveCount(PER_SIDE);
    await expect(bar.locator(`[data-portrait][data-side="own"][data-hero="${id}"]`), 'the pick is on our side').toHaveCount(1);
    const t0 = await page.evaluate(() => window.__perch!.state.tick);
    await page.waitForFunction((t) => window.__perch!.state.tick >= t, t0 + 2 * TICK_RATE, { timeout: READY_TIMEOUT_MS });
    expect(errors, 'no page errors').toEqual([]);
  });
}
