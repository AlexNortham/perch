// The lane helpers the rules suites lean on.
import { describe, expect, it } from 'vitest';
import type { Lane } from '../../src/sim/core/contracts';
import { laneLength, offset, pointAt, progress, project } from './lanes';

// Dawn gate at (0, 0, −50), 30 m north, then 40 m west-ish to +x (east on the GDD's axes), then north to Dusk.
const L: Lane = {
  id: 'hedgerow',
  halfWidth: 4,
  path: [
    { x: 0, y: 0, z: -50 },
    { x: 0, y: 0, z: -20 },
    { x: 40, y: 0, z: -20 },
    { x: 40, y: 2, z: 30 },
  ],
};

describe('lane helpers', () => {
  it('measures the polyline and walks it from either gate', () => {
    expect(laneLength(L)).toBe(120);
    expect(progress(L, 'dawn', { x: 0, y: 0, z: -40 })).toBeCloseTo(10);
    expect(progress(L, 'dusk', { x: 0, y: 0, z: -40 })).toBeCloseTo(110);
    expect(progress(L, 'dawn', { x: 20, y: 0, z: -18 })).toBeCloseTo(50);
  });

  it('projects a point onto the nearest segment with its distance and direction', () => {
    const p = project(L, { x: 43, y: 0, z: 5 });
    expect(p.arc).toBeCloseTo(95);
    expect(p.off).toBeCloseTo(3);
    expect(p.dir).toEqual({ x: 0, y: 0, z: 1 });
    expect(p.point.y).toBeCloseTo(1);
  });

  it('finds points along the lane and offsets from them', () => {
    expect(pointAt(L, 0).point).toEqual({ x: 0, y: 0, z: -50 });
    expect(pointAt(L, 45)).toEqual({ point: { x: 15, y: 0, z: -20 }, dir: { x: 1, y: 0, z: 0 } });
    expect(pointAt(L, 999).point).toEqual({ x: 40, y: 2, z: 30 });
    // Facing +z, the right-hand side is −x (base.ts: right = (−cos yaw, 0, sin yaw)).
    expect(offset({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, 2, 3)).toEqual({ x: -3, y: 0, z: 2 });
  });
});
