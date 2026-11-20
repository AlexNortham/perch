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

  it('keeps still entries (structures) right as they spawn, move, resize and despawn between rebuilds (D-ARCH-029)', () => {
    const rng = createRng(4, 'spatial-still');
    const still = (id: number): Entity =>
      ({ ...point(id, rng.range(-60, 60), 0, rng.range(-60, 60), rng.range(0.5, 4)), kind: 'structure' }) as unknown as Entity;
    let entities: Entity[] = Array.from({ length: 120 }, (_, i) =>
      i % 2 === 0 ? still(i + 1) : point(i + 1, rng.range(-60, 60), rng.range(0, 6), rng.range(-60, 60), rng.range(0, 2)),
    );
    let nextId = 121;
    const grid = createSpatialHash(8);
    const out: number[] = [];
    for (let tick = 0; tick < 12; tick++) {
      if (tick % 3 === 1) entities = entities.filter((_, i) => i !== tick); // a despawn
      if (tick % 3 === 2) entities.push(still(nextId++)); // a spawn, last as the store lists it
      const structures = entities.filter((e) => e.kind === 'structure');
      if (tick % 4 === 3) structures[1]!.pos = { x: rng.range(-60, 60), y: 0, z: rng.range(-60, 60) }; // one moves
      if (tick === 5) (structures[2] as { radius: number }).radius = 9;
      for (const e of entities) if (e.kind !== 'structure') e.pos.x += 1;
      grid.rebuild(entities);
      for (let q = 0; q < 20; q++) {
        const c = { x: rng.range(-70, 70), y: rng.range(0, 6), z: rng.range(-70, 70) };
        const r = rng.range(1, 25);
        const expected = entities
          .filter((e) => Math.hypot(e.pos.x - c.x, e.pos.y - c.y, e.pos.z - c.z) <= r + e.radius)
          .map((e) => e.id)
          .sort((a, b) => a - b);
        expect(grid.query(c, r, out)).toEqual(expected);
      }
    }
  });

  it('finds entities past the packed-key range, and ignores non-finite ones', () => {
    const grid = createSpatialHash(8);
    grid.rebuild([point(1, 1e9, 0, -1e9, 1), point(2, Number.NaN, 0, 0, 1), point(3, 0, 0, 0)]);
    expect(grid.query({ x: 1e9, y: 0, z: -1e9 }, 2, [])).toEqual([1]);
    expect(grid.query({ x: 0, y: 0, z: 0 }, 2, [])).toEqual([3]);
  });
});
