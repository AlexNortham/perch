import { describe, expect, it } from 'vitest';
import type { Entity } from './contracts';
import { createRng } from './rng';
import { createSpatialHash } from './spatial';

function point(id: number, x: number, y: number, z: number, radius = 0): Entity {
  return {
    id,
    kind: 'area',
    team: 'neutral',
    pos: { x, y, z },
    vel: { x: 0, y: 0, z: 0 },
    yaw: 0,
    radius,
    removed: false,
    seenBy: 3,
    area: { owner: null, ability: null, shape: 'sphere', expiresAt: 0 },
  };
}

describe('spatial hash', () => {
  it('matches a brute-force search, ascending id', () => {
    const rng = createRng(9, 'spatial');
    const entities = Array.from({ length: 300 }, (_, i) =>
      point(i + 1, rng.range(-100, 100), rng.range(0, 10), rng.range(-100, 100), rng.range(0, 3)),
    );
    const grid = createSpatialHash(8);
    grid.rebuild(entities);
    const out: number[] = [];
    for (let q = 0; q < 50; q++) {
      const c = { x: rng.range(-100, 100), y: rng.range(0, 10), z: rng.range(-100, 100) };
      const r = rng.range(1, 30);
      const expected = entities
        .filter((e) => Math.hypot(e.pos.x - c.x, e.pos.y - c.y, e.pos.z - c.z) <= r + e.radius)
        .map((e) => e.id);
      expect(grid.query(c, r, out)).toEqual(expected);
    }
  });

  it('forgets entities after a rebuild without them', () => {
    const grid = createSpatialHash(8);
    grid.rebuild([point(1, 0, 0, 0)]);
    grid.rebuild([point(2, 50, 0, 50)]);
    expect(grid.query({ x: 0, y: 0, z: 0 }, 5, [])).toEqual([]);
    expect(grid.query({ x: 50, y: 0, z: 50 }, 1, [])).toEqual([2]);
  });
});
