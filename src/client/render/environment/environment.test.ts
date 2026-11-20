import { Box3, Frustum, Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { ARENA, loadMap } from '../../../sim/world/map';
import type { MapData } from '../../../sim/core/contracts';
import { generate } from './index';
import { BAND_REACH } from './constants';
import type { World } from './world';

const main = loadMap('main');
let world: World;
const built: { band: number; pass: string; box: Box3; tris: number; hash: number }[] = [];

beforeAll(() => {
  world = generate(main);
  for (const b of world.buckets.values()) {
    const g = b.mesher.build();
    if (!g) continue;
    const pos = g.getAttribute('position').array;
    let h = 0;
    for (let i = 0; i < pos.length; i += 97) h = (h * 31 + Math.round((pos[i] ?? 0) * 1000)) | 0;
    built.push({ band: b.band, pass: b.pass, box: g.boundingBox ?? new Box3(), tris: (g.index?.count ?? 0) / 3, hash: h });
  }
}, 120_000);

/** Environment triangles drawn from a camera at Medium: frustum and band reach, as the renderer culls them. */
function visible(cam: readonly number[]): number {
  const [x, y, z, tx, ty, tz] = cam as [number, number, number, number, number, number];
  const camera = new PerspectiveCamera(59, 16 / 9, 0.1, 400);
  camera.position.set(x, y, z);
  camera.lookAt(tx, ty, tz);
  camera.updateMatrixWorld();
  const frustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const reach = BAND_REACH.medium;
  return built.filter((b) => {
    const d = b.box.distanceToPoint(new Vector3(x, y, z));
    return (b.band === 2 || d < (b.band === 0 ? reach.near : reach.mid)) && frustum.intersectsBox(b.box);
  }).reduce((s, b) => s + b.tris, 0);
}

describe('environment layer', () => {
  it('builds the same geometry every run (stable screenshots, §4.4)', { timeout: 120_000 }, () => {
    const again = generate(main);
    const hashes = [...again.buckets.values()].map((b) => b.mesher.build()).filter((g) => g !== null).map((g) => {
      const pos = g.getAttribute('position').array;
      let h = 0;
      for (let i = 0; i < pos.length; i += 97) h = (h * 31 + Math.round((pos[i] ?? 0) * 1000)) | 0;
      return h;
    });
    expect(hashes).toEqual(built.map((b) => b.hash));
  });

  it('stays inside the Medium triangle budget in the budget scenes (§11.3)', () => {
    // QA's lane budget camera, and street level in each lane. The map row is 450k at Medium; the blockout's share
    // of it is about 45k, so the environment keeps under 400k.
    for (const cam of [[-95, 10, -20, -95, 0, 6], [-92, 2.5, -70, -95, 3, -20], [3, 2.2, -80, 0, 2, -40], [95, 2.2, -60, 95, 2, -20]]) {
      expect(visible(cam), `camera ${cam.join(',')}`).toBeLessThan(400_000);
    }
  });

  it('dresses every building and objective in the shot list', () => {
    const near = (x: number, z: number, r: number): number => built.filter((b) => b.box.distanceToPoint(new Vector3(x, b.box.min.y, z)) < r).reduce((s, b) => s + b.tris, 0);
    for (const b of main.buildings ?? []) expect(near(b.footprint.centre.x, b.footprint.centre.z, 1), b.id).toBeGreaterThan(500);
    expect(main.hollow).not.toBeNull();
    for (const t of main.thickets) expect(near(t.pos.x, t.pos.z, 1)).toBeGreaterThan(0);
  });

  it('hands the blockout a map without what it re-skins, and adds no solids (D-EP-047)', () => {
    const env = world.covered;
    const blockout: MapData = { ...main, prims: main.prims.filter((_, i) => !env.has(i)) };
    expect(blockout.prims.length).toBeLessThan(main.prims.length);
    // Ivy curtains and shot-window fillers are drawn as ivy and open windows (§5.2, §5.3).
    main.prims.forEach((q, i) => {
      if (q.blocks) expect(env.has(i), `prim ${i} (${q.blocks})`).toBe(true);
    });
    // Covered prims are only decoration skins: the collision list itself is untouched.
    expect(main.prims.filter((q) => q.solid).length).toBeGreaterThan(0);
  });

  it('builds a bare map without a dressing descriptor', () => {
    const arena = generate(ARENA);
    expect(arena.buckets.size).toBeGreaterThan(0);
  });
});
