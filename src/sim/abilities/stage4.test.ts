/**
 * Stage 4 targeting and areas (W5 follow-ups, GDD §§6.8, 6.11, and the wave 5a framework gaps): the floor under the
 * crosshair, surface casts (D-SYS-012), selfFallback, hidden and curtained targets, and areas that keep to a storey.
 */
import { describe, expect, it } from 'vitest';
import { Button, SeenBy } from '../core/contracts';
import type { AbilityDef, Effect } from '../core/contracts';
import { SURFACE_VALUE } from '../data/abilities';
import { ability, createHarness, kit } from './testkit';
import { resolveShape } from './shapes';

const hit: Effect = { kind: 'damage', amount: 'dmg', type: 'song' };
const EAST = Math.PI / 2;

function setup(a: AbilityDef) {
  const t = createHarness({ heroes: { shrike: kit([a]) }, unlockAbilities: true });
  const me = t.hero('shrike', 'dawn', { x: 0, y: 0, z: 0 });
  return { t, me };
}
const cast = (t: ReturnType<typeof setup>['t'], me: ReturnType<typeof setup>['me'], yaw = 0, pitch = 0): void =>
  t.step(1, [[me, { pressed: Button.Ability1, yaw, pitch }]]);
const landed = (t: ReturnType<typeof setup>['t']) => t.of('statMod')[0]?.target.point;

describe("'point' placement (GDD §6.11)", () => {
  it('clamps to the floor under the crosshair, never through a ceiling', () => {
    const { t, me } = setup(ability({ targeting: 'point', range: 20 }));
    t.floors.push({ y: 4, x0: -30, x1: 30, z0: -30, z1: 30 });
    cast(t, me, 0, 0.3);
    const p = landed(t);
    expect(p?.y, 'the aim hits the ceiling; the point drops to the floor below it').toBe(0);
    expect(p?.z).toBeGreaterThan(2);
  });

  it('on an upper floor, beyond range, it stays on that floor', () => {
    const { t, me } = setup(ability({ targeting: 'point', range: 10 }));
    t.floors.push({ y: 4, x0: -30, x1: 30, z0: -30, z1: 30 });
    me.pos.y = 4;
    cast(t, me);
    const p = landed(t);
    expect(p?.y).toBe(4);
    expect(Math.hypot(p?.x ?? 0, p?.z ?? 0)).toBeCloseTo(10, 1);
  });

  it(`a cast whose values hold ${SURFACE_VALUE} ≥ 1 takes the wall under the crosshair within range; else the floor`, () => {
    const wall = (values: Record<string, number>, range: number) => {
      const { t, me } = setup(ability({ targeting: 'point', range, values }));
      t.walls.push({ x: 6, z0: -10, z1: 10 });
      cast(t, me, EAST);
      return landed(t);
    };
    const on = wall({ [SURFACE_VALUE]: 1 }, 12);
    expect(on?.x).toBeCloseTo(6, 6);
    expect(on?.y, 'at crosshair height').toBeGreaterThan(1);
    const floor = wall({}, 12);
    expect(floor?.y).toBe(0);
    expect(floor?.x).toBeLessThan(6);
    const far = wall({ [SURFACE_VALUE]: 1 }, 3);
    expect(far?.y, 'beyond range: the ordinary floor point').toBe(0);
  });
});

describe("'unit' targeting", () => {
  it('selfFallback: an ally cast with no ally in the cone lands on the caster; without it the cast fails', () => {
    const allies = { teams: 'allies', heroesOnly: true } as const;
    const a = setup(ability({ targeting: 'unit', range: 25, affects: allies, selfFallback: true }));
    cast(a.t, a.me);
    expect(a.t.of('statMod')[0]?.target.entity).toBe(a.me.id);
    const b = setup(ability({ targeting: 'unit', range: 25, affects: allies }));
    cast(b.t, b.me);
    expect(b.t.of('statMod')).toHaveLength(0);
  });

  it("skips enemies the caster's flock can't see (hidden, invisible): seenBy", () => {
    const { t, me } = setup(ability({ targeting: 'unit', range: 30, affects: { teams: 'enemies' }, effects: [hit] }));
    const foe = t.hero('owl', 'dusk', { x: 20, y: 0, z: 0.75 });
    foe.seenBy = SeenBy.dusk;
    cast(t, me, EAST);
    expect(t.of('damage')).toHaveLength(0);
    foe.seenBy = SeenBy.all;
    cast(t, me, EAST);
    expect(t.of('damage').map((x) => x.target.entity)).toEqual([foe.id]);
  });

  it('an ivy curtain blocks it both ways, except within 3 m of the curtain (GDD §6.8)', () => {
    const { t, me } = setup(ability({ targeting: 'unit', range: 30, affects: { teams: 'enemies' }, effects: [hit] }));
    const foe = t.hero('owl', 'dusk', { x: 20, y: 0, z: 0.75 });
    t.curtains.push({ x: 10, z0: -5, z1: 5 });
    cast(t, me, EAST);
    expect(t.of('damage'), '10 m either side').toHaveLength(0);
    foe.pos.x = 12;
    t.step(700);
    cast(t, me, EAST);
    expect(t.of('damage').map((x) => x.target.entity), 'the target 2 m behind it').toEqual([foe.id]);
  });
});

describe('areas keep to their storey (GDD §6.11)', () => {
  it('a cylinder with no height of its own is 3 m tall', () => {
    expect(resolveShape({ kind: 'cylinder', radius: 5, height: 0 }, Number)).toEqual({ kind: 'cylinder', radius: 5, half: 1.5 });
    expect(resolveShape({ kind: 'cylinder', radius: 5, height: 8 }, Number)).toEqual({ kind: 'cylinder', radius: 5, half: 4 });
  });

  it('a ground burst never reaches through a floor; a hero jumping over it, or in the open air above, is still inside', () => {
    const burst: Effect = { kind: 'area', shape: { kind: 'sphere', radius: 6 }, durationS: 0, attach: 'source', affects: { teams: 'enemies' }, effects: [hit] };
    const { t, me } = setup(ability({ effects: [burst] }));
    t.floors.push({ y: 4, x0: 1.5, x1: 30, z0: -30, z1: 30 });
    const above = t.hero('owl', 'dusk', { x: 0, y: 4, z: 2 });
    const jumping = t.hero('pelican', 'dusk', { x: 1, y: 1.8, z: 1 });
    const upstairs = t.hero('swan', 'dusk', { x: 2, y: 4, z: 1 });
    cast(t, me);
    const struck = t.of('damage').map((x) => x.target.entity);
    expect(struck).toContain(above.id);
    expect(struck).toContain(jumping.id);
    expect(struck, 'on the slab over the burst').not.toContain(upstairs.id);
  });
});
