import { expect, test } from '@playwright/test';
import { open, READY_TIMEOUT_MS } from './game';

// Seed 1, 100 sim seconds (6000 ticks): the first three waves are active, including a lane fight at the crossing.
// Frame the map along Hedgerow through that crossing. Medium includes shadows, post and is the default quality.
// Ceilings follow the art style guide (docs/art/style-guide.md §11.3, §11.5; D-DIR-015), all passes counted:
// - draw calls: map ≤ 70 + birds ≤ 3 each (+1 friend-or-foe overlay) + 1 per fledgling type and team + effects and
//   post; the whole frame ≤ 240 (under the old 248 full-match ceiling, D-QA-BROWSER-002). Rendering & VFX set these
//   for QA in W5b (D-RENDER-013); measured peaks then: 46 lane/low, 84 lane/medium, 105 match/medium.
// - triangles: map + birds + fledglings + structures, plus a shadow pass of at most half that at Medium.
// - texture memory from the material library: ≤ 32 MB at Low, ≤ 80 MB at Medium.
const scenarios = [
  { scene: 'lane', quality: 'low', ceiling: 100, triangles: (200 + 40 + 50 + 40) * 1000, textureMB: 32 },
  { scene: 'lane', quality: 'medium', ceiling: 120, triangles: (450 + 80 + 90 + 60) * 1500, textureMB: 80 },
  { scene: 'match', quality: 'medium', ceiling: 240, triangles: (450 + 80 + 90 + 60) * 1500, textureMB: 80 },
] as const;
const CAMERA = '-95,10,-20,-95,0,6';
const SAMPLE_FRAMES = 12;

test.use({ viewport: { width: 1920, height: 1080 } });
test.setTimeout(READY_TIMEOUT_MS * 2);

for (const { scene, quality, ceiling, triangles, textureMB } of scenarios) {
  test(`draw budget: 100-second ${scene}, ${quality} quality`, async ({ page }, info) => {
    await open(page, `/?scene=${scene}&quality=${quality}&seed=1&t=100&renderCam=${CAMERA}`);
    const { counts, budget } = await page.evaluate(async (frames) => {
      const counts: { calls: number; triangles: number }[] = [];
      for (let i = 0; i < frames; i++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        counts.push(window.__perchRender!.info());
      }
      return { counts, budget: window.__perchRender!.budget() };
    }, SAMPLE_FRAMES);
    const peak = Math.max(...counts.map(({ calls }) => calls));
    const peakTriangles = Math.max(...counts.map((c) => c.triangles));
    await info.attach('renderer counters', { body: JSON.stringify({ scene, quality, peak, peakTriangles, counts, budget }), contentType: 'application/json' });
    expect(Math.min(...counts.map(({ triangles }) => triangles)), 'samples contain the populated 3D scene').toBeGreaterThan(25_000);
    expect(peak, `${scene}/${quality} peak over ${SAMPLE_FRAMES} frames (camera ${CAMERA})`).toBeLessThanOrEqual(ceiling);
    expect(peakTriangles, `${scene}/${quality} triangles, all passes`).toBeLessThanOrEqual(triangles);
    expect(budget.textureMB, `${quality} material library texture memory`).toBeLessThanOrEqual(textureMB);
    await page.screenshot({ path: info.outputPath(`${scene}-${quality}.png`) });
  });
}
