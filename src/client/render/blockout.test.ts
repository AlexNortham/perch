import { InstancedMesh, Mesh, PerspectiveCamera } from 'three';
import type { BufferGeometry, Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import type { BlockoutPrim, MapData } from '../../sim/core/contracts';
import { loadMap } from '../../sim/world/map';
import { buildBlockout } from './blockout';
import { FIXTURE_MAP } from './fixture';
import { getMaterialLibrary, layerOf } from './materials';
import type { MaterialId } from './materials';

const lib = getMaterialLibrary('low');
const meshes = (root: Object3D): Mesh[] => {
  const out: Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof Mesh) out.push(o);
  });
  return out;
};
const layers = (g: BufferGeometry): Set<number> => new Set(Array.from(g.getAttribute('matLayer')?.array ?? []));
const uses = (root: Object3D, id: MaterialId): boolean => meshes(root).some((m) => !(m instanceof InstancedMesh) && layers(m.geometry).has(layerOf(id)));
const map = (prims: BlockoutPrim[]): MapData => ({ ...loadMap('arena'), prims });

describe('map layer', () => {
  for (const m of [loadMap('arena'), loadMap('main'), FIXTURE_MAP]) {
    it(`builds ${m.name} merged per 64 m cell, painted, AO-baked and free of NaNs`, () => {
      const b = buildBlockout(m, lib);
      const all = meshes(b.root);
      const cells = new Set(all.filter((x) => x.name.startsWith('map:')).map((x) => x.name.split(':')[1]));
      // At most opaque, trims and cards per cell, plus the shimmer, the floor and three instanced forest meshes.
      expect(all.length).toBeLessThanOrEqual(cells.size * 3 + 5);
      for (const x of all.filter((x) => !(x instanceof InstancedMesh) && x.name.startsWith('map:'))) {
        for (const name of ['position', 'normal', 'uv', 'color']) {
          expect(Array.from(x.geometry.getAttribute(name).array).every(Number.isFinite), `${x.name}.${name}`).toBe(true);
        }
        for (const l of layers(x.geometry)) expect(l >= 0 && l < 64, `${x.name} layer ${l}`).toBe(true);
        expect(x.material === lib.opaque || x.material === lib.cutout, x.name).toBe(true);
      }
      const colours = all.filter((x) => x.name.endsWith(':opaque:far')).flatMap((x) => Array.from(x.geometry.getAttribute('color').array));
      expect(colours.reduce((a, c) => Math.min(a, c), 1), 'baked AO darkens somewhere').toBeLessThan(0.8);
      b.dispose();
    });
  }

  it('paints the fixture with its features: paved lanes, rope cables, Vines with leaves, stalls, chimney shimmer', () => {
    const b = buildBlockout(FIXTURE_MAP, lib);
    for (const id of ['flagstone', 'rope', 'timberDark', 'canvas', 'leafCard', 'bark'] as const) expect(uses(b.root, id), id).toBe(true);
    expect(meshes(b.root).some((m) => m.name === 'chimneys')).toBe(true);
    b.dispose();
  });

  it('turns roof ramps by yaw: the slope rises toward (sin yaw, cos yaw)', () => {
    const ramp = (yaw: number): BlockoutPrim => ({ shape: 'ramp', centre: { x: 0, y: 1, z: 0 }, size: { x: 2, y: 2, z: 4 }, yaw, material: 'roof', solid: true });
    const top = (yaw: number): { x: number; z: number } => {
      const g = meshes(buildBlockout(map([ramp(yaw)]), lib).root).find((x) => x.name.endsWith(':opaque:far'))!.geometry;
      const pos = g.getAttribute('position');
      const xs: number[] = [];
      const zs: number[] = [];
      for (let i = 0; i < pos.count; i++) {
        if (pos.getY(i) < 1.99 || Math.abs(pos.getX(i)) > 3 || Math.abs(pos.getZ(i)) > 3) continue;
        xs.push(pos.getX(i));
        zs.push(pos.getZ(i));
      }
      const mid = (v: number[]): number => (Math.min(...v) + Math.max(...v)) / 2;
      return { x: mid(xs), z: mid(zs) };
    };
    expect(top(0).z).toBeCloseTo(2);
    expect(top(0).x).toBeCloseTo(0);
    expect(top(Math.PI / 2).x).toBeCloseTo(2);
    expect(top(Math.PI / 2).z).toBeCloseTo(0);
  });

  it('builds stone ramps at stair pitch as steps whose risers the collision slope cuts through', () => {
    const stair: BlockoutPrim = { shape: 'ramp', centre: { x: 0, y: 1, z: 0 }, size: { x: 2, y: 2, z: 4 }, yaw: 0, material: 'stone', solid: true };
    const g = meshes(buildBlockout(map([stair]), lib).root).find((x) => x.name.endsWith(':opaque:far'))!.geometry;
    const pos = g.getAttribute('position');
    let worst = 0;
    for (let i = 0; i < pos.count; i++) {
      const [y, z] = [pos.getY(i), pos.getZ(i)];
      if (Math.abs(pos.getX(i)) > 1.01 || Math.abs(z) > 2.01) continue;
      // Tread tops (normal up) must stay within half a riser of the slope y = (z + 2) / 2.
      if (g.getAttribute('normal').getY(i) > 0.99 && y > 0.01) worst = Math.max(worst, Math.abs(y - (z + 2) / 2));
    }
    expect(worst).toBeGreaterThan(0);
    expect(worst).toBeLessThanOrEqual(0.2 + 1e-6);
  });

  it('shows trims and cards only within their distance bands', () => {
    const b = buildBlockout(loadMap('main'), lib);
    const cam = new PerspectiveCamera(70, 1, 0.1, 1000);
    cam.position.set(0, 400, 0);
    cam.updateMatrixWorld();
    b.update(cam, 0);
    const trims = meshes(b.root).filter((x) => x.name.endsWith(':opaque:mid'));
    expect(trims.length).toBeGreaterThan(0);
    expect(trims.every((x) => !x.visible)).toBe(true);
    b.dispose();
  });
});
