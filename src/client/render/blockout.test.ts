import { InstancedMesh, Mesh } from 'three';
import type { BufferGeometry, Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import type { BlockoutPrim, MapData } from '../../sim/core/contracts';
import { loadMap } from '../../sim/world/map';
import { buildBlockout } from './blockout';
import { CYLINDER_SEGMENTS } from './constants';
import { FIXTURE_MAP } from './fixture';

const meshes = (root: Object3D): Mesh[] => {
  const out: Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof Mesh) out.push(o);
  });
  return out;
};
const tris = (g: BufferGeometry): number => g.getAttribute('position').count / 3;
/** Triangles each prim shape becomes (non-indexed, capped cylinders). */
const primTris = (p: BlockoutPrim): number => (p.shape === 'box' ? 12 : p.shape === 'ramp' ? 8 : CYLINDER_SEGMENTS * 4);
const map = (prims: BlockoutPrim[]): MapData => ({ ...loadMap('arena'), prims });

describe('blockout', () => {
  for (const m of [loadMap('arena'), loadMap('main'), FIXTURE_MAP]) {
    it(`builds ${m.name} in a handful of draw calls with every prim and no NaNs`, () => {
      const b = buildBlockout(m);
      const all = meshes(b.root);
      // Prims, water, two team groups, features, lanes, chimneys, markers, floor, trunks, canopies.
      expect(all.length).toBeLessThanOrEqual(11);
      const prims = all.filter((x) => x.name.startsWith('prims'));
      expect(prims.reduce((n, x) => n + tris(x.geometry), 0)).toBe(m.prims.reduce((n, p) => n + primTris(p), 0));
      for (const x of all.filter((x) => !(x instanceof InstancedMesh))) {
        for (const name of ['position', 'normal']) {
          expect(Array.from(x.geometry.getAttribute(name).array).every(Number.isFinite), `${x.name}.${name}`).toBe(true);
        }
      }
      b.dispose();
    });
  }

  it('draws every map feature of the fixture', () => {
    const names = meshes(buildBlockout(FIXTURE_MAP).root).map((x) => x.name);
    for (const n of ['prims', 'prims-water', 'prims-dawn', 'prims-dusk', 'features', 'lanes', 'chimneys', 'structure-markers']) {
      expect(names).toContain(n);
    }
  });

  it('places structure markers only when the map has anchors', () => {
    expect(buildBlockout(loadMap('arena')).markers).not.toBeInstanceOf(Mesh);
    expect(buildBlockout(FIXTURE_MAP).markers).toBeInstanceOf(Mesh);
  });

  it('turns ramps by yaw: the slope rises toward (sin yaw, cos yaw)', () => {
    const ramp = (yaw: number): BlockoutPrim => ({ shape: 'ramp', centre: { x: 0, y: 1, z: 0 }, size: { x: 2, y: 2, z: 4 }, yaw, material: 'stone', solid: true });
    const top = (yaw: number): { x: number; z: number } => {
      const g = meshes(buildBlockout(map([ramp(yaw)])).root).find((x) => x.name === 'prims')!.geometry;
      const pos = g.getAttribute('position');
      // Centre of the top edge: the middle of the highest vertices' extent.
      const xs: number[] = [];
      const zs: number[] = [];
      for (let i = 0; i < pos.count; i++) {
        if (pos.getY(i) < 1.99) continue;
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
    // Floor and top edge: the ramp spans y 0..2 inside its box.
    const g = meshes(buildBlockout(map([ramp(0)])).root).find((x) => x.name === 'prims')!.geometry;
    g.computeBoundingBox();
    expect(g.boundingBox!.min.y).toBeCloseTo(0);
    expect(g.boundingBox!.max.y).toBeCloseTo(2);
  });
});
