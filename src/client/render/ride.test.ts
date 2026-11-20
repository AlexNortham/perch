import { Color, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import type { WebGLRenderer } from 'three';
import { describe, expect, it } from 'vitest';
import { ViewFlag } from '../../sim/core/contracts';
import type { EntityView, SimView } from '../../sim/core/contracts';
import type { Frame } from '../app/contracts';
import { RideOverlay } from './ride';

const [W, H] = [1920, 1080];
const hero = (speed: number, flags: number): EntityView =>
  ({ id: 1, kind: 'hero', team: 'dawn', type: 'shrike', pos: { x: 0, y: 12, z: 0 }, vel: { x: 0, y: 0, z: speed }, yaw: 0, pitch: 0, radius: 0.5, hp: 1, maxHp: 1, shield: 0, flags, mode: null, seenBy: 3 }) as EntityView;
const frame = (e: EntityView): Frame => {
  const view = { entities: [e], heroes: [], localHero: 1, seconds: 0 } as unknown as SimView;
  return { prev: view, curr: view, alpha: 1, dt: 1 / 60 };
};
const gl = { autoClear: true, render: () => undefined } as unknown as WebGLRenderer;

describe('Updraft ride overlay (G16)', () => {
  for (const [name, speed] of [['ride', 11], ['boost', 18]] as const) {
    it(`${name}: lines stay outside the central 50 %, at most 3 px wide, 15 % of the height long and 25 % strong`, () => {
      const overlay = new RideOverlay();
      const mesh = (overlay as unknown as { mesh: InstancedMesh }).mesh;
      const m = new Matrix4();
      const p = new Vector3();
      const q = new Quaternion();
      const s = new Vector3();
      const c = new Color();
      let drawn = 0;
      for (let f = 0; f < 240; f++) {
        overlay.render(gl, frame(hero(speed, ViewFlag.OnUpdraft)), W, H);
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, m);
          m.decompose(p, q, s);
          const inside = Math.abs(p.x - W / 2) < W / 4 - 0.5 && Math.abs(p.y - H / 2) < H / 4 - 0.5;
          expect(inside, `line ${i} starts inside the central box`).toBe(false);
          expect(s.x).toBeLessThanOrEqual(0.15 * H + 1e-3);
          expect(s.y).toBeLessThanOrEqual(3 + 1e-6);
          mesh.getColorAt(i, c);
          expect(Math.max(c.r, c.g, c.b)).toBeLessThanOrEqual(0.25 + 1e-6);
          drawn++;
        }
      }
      expect(drawn).toBeGreaterThan(0);
      if (speed > 14) expect(mesh.count).toBeGreaterThan(30);
    });
  }

  it('draws nothing when the local bird is not on a line, and fades out after it leaves', () => {
    const overlay = new RideOverlay();
    const mesh = (overlay as unknown as { mesh: InstancedMesh }).mesh;
    let calls = 0;
    const counting = { autoClear: true, render: () => void calls++ } as unknown as WebGLRenderer;
    overlay.render(counting, frame(hero(5, 0)), W, H);
    expect(calls).toBe(0);
    for (let f = 0; f < 30; f++) overlay.render(counting, frame(hero(11, ViewFlag.OnUpdraft)), W, H);
    expect(mesh.count).toBeGreaterThan(0);
    calls = 0;
    for (let f = 0; f < 60; f++) overlay.render(counting, frame(hero(5, 0)), W, H);
    expect(calls).toBeLessThan(60);
  });
});
