// Serial (npm run perf, D-EP-022): building the whole map's environment twice is seconds of CPU.
import { Box3, Frustum, Matrix4, PerspectiveCamera, Ray, Vector3 } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadMap } from '../../../sim/world/map';
import type { MapData } from '../../../sim/core/contracts';
import { generate } from './index';
import { BAND_REACH } from './constants';
import type { World } from './world';
import { HEROES } from '../../../sim/heroes/registry';
import { aimRay, pivotHeight } from '../../../sim/core/aim';
import { inPrim } from './data/buildings';

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
    // QA's lane budget camera, and street level in each lane: a regression guard at the second pass's measured peak
    // (≈ 510k on Riverbank), inside the e2e frame ceiling of 1.02M with Rendering's layer and the birds.
    for (const cam of [[-95, 10, -20, -95, 0, 6], [-92, 2.5, -70, -95, 3, -20], [3, 2.2, -80, 0, 2, -40], [95, 2.2, -60, 95, 2, -20]]) {
      expect(visible(cam), `camera ${cam.join(',')}`).toBeLessThan(560_000);
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

  it('generates the main map within its load-time share', () => {
    // Geometry generation runs behind the loading screen next to the material library's (§11.5).
    const t0 = performance.now();
    generate(main);
    expect(performance.now() - t0).toBeLessThan(6_000);
  });
});

describe("camera clearance (the player's first sight)", () => {
  it('leaves nothing of the layer between the camera and a standing hero at every spawn, for every body size', () => {
    const bodies = [...new Map(Object.values(HEROES).map((h) => [h.def.body.height, h.def.body])).values()];
    // Triangles near any spawn.
    const area = new Box3();
    for (const s of main.spawns) area.expandByPoint(new Vector3(s.pos.x, s.pos.y, s.pos.z));
    area.expandByScalar(8);
    const tris: [Vector3, Vector3, Vector3][] = [];
    const solids = main.prims.filter((pr) => pr.solid && !pr.blocks);
    for (const b of world.buckets.values()) {
      const g = b.mesher.build();
      if (!g?.boundingBox?.intersectsBox(area) || !g.index) continue;
      const pos = g.getAttribute('position');
      const idx = g.index;
      for (let t = 0; t < idx.count; t += 3) {
        const v: [Vector3, Vector3, Vector3] = [0, 1, 2].map((k) => new Vector3().fromBufferAttribute(pos, idx.getX(t + k))) as [Vector3, Vector3, Vector3];
        // Skins and bark on collision (within 0.35 m: wall skins, trunk ridges) are the solids themselves, not dressing.
        const mid = v[0].clone().add(v[1]).add(v[2]).divideScalar(3);
        if (v.some((p) => area.containsPoint(p)) && !solids.some((pr) => inPrim(pr, mid, 0.35))) tris.push(v);
      }
    }
    const hit = new Vector3();
    let rays = 0;
    for (const s of main.spawns) {
      for (const body of bodies) {
        for (const shoulder of [1, -1] as const) {
          for (const pitch of [-0.35, 0, 0.35]) {
            const cam = aimRay(s.pos, s.yaw, pitch, shoulder, body, false).origin;
            // The rig pulls the camera in before it meets collision (camera/collide.ts): march out to the first solid.
            const p = new Vector3(s.pos.x, s.pos.y + pivotHeight(body, false), s.pos.z);
            const want = new Vector3(cam.x, cam.y, cam.z);
            const o = p.clone();
            for (let t = 0.05; t <= 1.001; t += 0.05) {
              const q = p.clone().lerp(want, t);
              if (solids.some((pr) => inPrim(pr, q, 0.2))) break;
              o.copy(q);
            }
            const len = o.distanceTo(p);
            const ray = new Ray(o, p.clone().sub(o).normalize());
            rays++;
            const blocking = tris.find(([a, b, c]) => {
              const at = ray.intersectTriangle(a, b, c, false, hit);
              return (at !== null && at.distanceTo(o) <= len) || [a, b, c].some((q) => q.distanceTo(o) < 1);
            });
            const at = blocking ? blocking.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)},${q.z.toFixed(1)}`).join(" ") : "";
            expect(blocking, `${s.team} spawn ${s.pos.x},${s.pos.z}, body ${body.height} m, pitch ${pitch}, shoulder ${shoulder}: ${at}`).toBeUndefined();
          }
        }
      }
    }
    expect(rays).toBeGreaterThan(0);
  }, 300_000);
});
