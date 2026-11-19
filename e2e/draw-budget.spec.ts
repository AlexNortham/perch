import { expect, test } from '@playwright/test';
import { open, READY_TIMEOUT_MS } from './game';

// Seed 1, 100 sim seconds (6000 ticks): the first three waves are active, including a lane fight at the crossing.
// Frame the map along Hedgerow through that crossing. Medium includes shadows and is the default quality.
// Baseline peaks: 25, 41 and 217. The ceilings allow 7 extra calls on lane and 31 across the full roster.
const scenarios = [
  { scene: 'lane', quality: 'low', ceiling: 32 },
  { scene: 'lane', quality: 'medium', ceiling: 48 },
  { scene: 'match', quality: 'medium', ceiling: 248 },
] as const;
const CAMERA = '-95,10,-20,-95,0,6';
const SAMPLE_FRAMES = 12;

test.use({ viewport: { width: 1920, height: 1080 } });
test.setTimeout(READY_TIMEOUT_MS * 2);

for (const { scene, quality, ceiling } of scenarios) {
  test(`draw budget: 100-second ${scene}, ${quality} quality`, async ({ page }, info) => {
    await open(page, `/?scene=${scene}&quality=${quality}&seed=1&t=100&renderCam=${CAMERA}`);
    const counts = await page.evaluate(async (frames) => {
      const counts: { calls: number; triangles: number }[] = [];
      for (let i = 0; i < frames; i++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        counts.push(window.__perchRender!.info());
      }
      return counts;
    }, SAMPLE_FRAMES);
    const peak = Math.max(...counts.map(({ calls }) => calls));
    await info.attach('renderer counters', { body: JSON.stringify({ scene, quality, peak, counts }), contentType: 'application/json' });
    expect(Math.min(...counts.map(({ triangles }) => triangles)), 'samples contain the populated 3D scene').toBeGreaterThan(25_000);
    expect(peak, `${scene}/${quality} peak over ${SAMPLE_FRAMES} frames (camera ${CAMERA})`).toBeLessThanOrEqual(ceiling);
    await page.screenshot({ path: info.outputPath(`${scene}-${quality}.png`) });
  });
}
