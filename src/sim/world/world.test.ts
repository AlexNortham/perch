import { describe, expect, it } from 'vitest';
import { SeenBy } from '../core/contracts';
import type { EntityId, UnitEntity, Vec3 } from '../core/contracts';
import { canSee } from '../core/vision';
import { createSim } from '../index';
import { TICK_RATE } from '../data/core';
import { FLEDGLING_AI, STRUCTURE_RADIUS } from '../data/world';
import { createSandbox } from '../../../tests/helpers/sandbox';
import type { Sandbox } from '../../../tests/helpers/sandbox';
import { buildTrack, isFledgling, pointAt, project } from './fledglings';

const T = 120_000;
const RETARGET = FLEDGLING_AI.retargetS * TICK_RATE + 2;
const flat = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.z - b.z);
const fledglings = (sb: Sandbox): UnitEntity[] => sb.ctx.store.list('unit').filter(isFledgling);

/** A 'main' match stepped to the first wave, with no further waves. */
async function firstWave(heroes: Parameters<typeof createSandbox>[0]['heroes'] = []): Promise<Sandbox> {
  const sb = await createSandbox({ map: 'main', heroes, options: { waves: true, neutrals: false } });
  sb.stepUntil(() => fledglings(sb).length > 0, 31 * TICK_RATE);
  sb.ctx.objectives.nextWaveAt = Number.MAX_SAFE_INTEGER;
  return sb;
}

describe('marching (GDD §7.1)', () => {
  it('steps round every structure footprint on the way and stays in the lane', async () => {
    const sb = await firstWave();
    const anchors = sb.ctx.map.structures;
    let closest = Infinity;
    for (let i = 0; i < 20 * TICK_RATE; i++) {
      sb.step();
      for (const u of fledglings(sb)) {
        const lane = sb.ctx.map.lanes.find((l) => l.id === u.unit.lane);
        if (!lane) throw new Error('fledgling without a lane');
        const track = buildTrack(sb.ctx, lane, u.team === 'dawn' ? 'dawn' : 'dusk');
        expect(project(track, u.pos.x, u.pos.z, { s: 0, lat: 0, off: 0 }).off).toBeLessThanOrEqual(lane.halfWidth);
        for (const a of anchors) closest = Math.min(closest, flat(u.pos, a.pos) - STRUCTURE_RADIUS[a.type] - u.radius);
      }
    }
    // The Dawn and Dusk side-lane Wardens stand 0.25 m from the path, the Riverbank Herons on it (Level Designer).
    expect(closest).toBeGreaterThan(0);
  }, T);

  it('holds at the enemy Wardens until structures exist, queued 1.5 m apart in its file', async () => {
    const sb = await firstWave();
    for (const u of fledglings(sb)) if (u.team === 'dusk') sb.ctx.store.despawn(u.id);
    const lane = sb.ctx.map.lanes.find((l) => l.id === 'riverbank');
    if (!lane) throw new Error('no riverbank');
    const track = buildTrack(sb.ctx, lane, 'dawn');
    const wardenS = Math.min(
      ...sb.ctx.map.structures
        .filter((a) => a.type === 'warden' && a.team === 'dusk' && a.lane === 'riverbank')
        .map((a) => project(track, a.pos.x, a.pos.z, { s: 0, lat: 0, off: 0 }).s),
    );
    const hold = wardenS - STRUCTURE_RADIUS.warden - FLEDGLING_AI.holdStandoff;
    expect(track.holdS).toBeCloseTo(hold, 6);
    // Two Dawn Riverbank Scrappers of one file, put 10 m and 12 m short of the hold line.
    const latOf = (u: UnitEntity): number => project(track, u.pos.x, u.pos.z, { s: 0, lat: 0, off: 0 }).lat;
    const scrappers = fledglings(sb).filter((u) => u.team === 'dawn' && u.unit.lane === 'riverbank' && u.unit.type === 'scrapper');
    const a = scrappers[0];
    const b = scrappers.find((u) => u !== a && a && Math.abs(latOf(u) - latOf(a)) < 1e-6);
    if (!a || !b) throw new Error('two scrappers in one file');
    const lat = latOf(a);
    sb.place(a.id, pointAt(track, hold - 10, lat, { x: 0, y: 0, z: 0 }));
    sb.place(b.id, pointAt(track, hold - 12, lat, { x: 0, y: 0, z: 0 }));
    sb.step(5 * TICK_RATE);
    const s = (u: UnitEntity): number => project(track, u.pos.x, u.pos.z, { s: 0, lat: 0, off: 0 }).s;
    expect(s(a)).toBeCloseTo(hold, 3);
    expect(s(b)).toBeCloseTo(hold - 1.5, 3);
    const at = { ...a.pos };
    sb.step(TICK_RATE);
    expect(flat(a.pos, at)).toBeLessThan(1e-6);
  }, T);
});

describe('lanes trade (GDD §7.1, §15.3)', () => {
  it('even waves fight each other down mid-lane instead of piling up', async () => {
    const sim = await createSim({ seed: 1, map: 'main', roster: [], options: { waves: true, neutrals: false } });
    let deaths = 0;
    sim.ctx.bus.on('entity.died', (e) => {
      if (e.victimKind === 'unit') deaths++;
    });
    for (let i = 0; i < 10 * 60 * TICK_RATE; i++) sim.step();
    // Nineteen waves of 24 have spawned; at most three waves' worth may still be walking or fighting.
    expect(deaths).toBeGreaterThan(300);
    expect(sim.ctx.store.list('unit').filter(isFledgling).length).toBeLessThanOrEqual(3 * 24);
  }, T);
});

describe('target priority (GDD §7.1)', () => {
  it('a structure in reach beats a nearer plain hero; a hero who hurt an ally beats both; targets are sticky', async () => {
    const sb = await firstWave([
      { hero: 'albatross', team: 'dawn' },
      { hero: 'shrike', team: 'dusk' },
      { hero: 'kingfisher', team: 'dusk' },
    ]);
    const [ally, foe, other] = sb.heroes as [EntityId, EntityId, EntityId];
    const f = fledglings(sb).find((u) => u.team === 'dawn' && u.unit.lane === 'riverbank' && u.unit.type === 'scrapper');
    if (!f) throw new Error('no Dawn Riverbank Scrapper');
    const near = (d: number, side: number): Vec3 => ({ x: f.pos.x + side, y: f.pos.y, z: f.pos.z + d });
    const keep = (id: EntityId, d: number, side = 0): (() => void) => () => sb.place(id, near(d, side));
    sb.place(ally, near(-25, 0));
    sb.place(other, near(40, 0));
    // Sticky: Kingfisher at 8 m first; Shrike then 3 m away doesn't take over (same rule 4).
    const until = (each: () => void, done: () => boolean): number | null => {
      for (let i = 0; i < RETARGET; i++) {
        each();
        sb.step();
        if (done()) return i;
      }
      return null;
    };
    expect(until(() => { keep(other, 8)(); keep(foe, 30)(); }, () => f.unit.target === other)).not.toBeNull();
    expect(until(() => { keep(other, 8)(); keep(foe, 3, 1)(); }, () => f.unit.target !== other)).toBeNull();
    // A Dusk structure in reach beats both heroes (rule 3 over rule 4).
    const tower = sb.dummy({ kind: 'structure', type: 'hawk', team: 'dusk', at: near(3, 0), hp: 50_000, radius: 1.5, height: 6 });
    expect(until(() => { keep(other, 8)(); keep(foe, 3, 1)(); sb.place(tower, near(3, 0)); }, () => f.unit.target === tower)).not.toBeNull();
    // Shrike hurts the Albatross: rule 2 beats the structure.
    sb.apply({ kind: 'damage', amount: 10, type: 'talon' }, ally, sb.cause(foe, { via: 'weapon' }));
    expect(until(() => { keep(other, 8)(); keep(foe, 3, 1)(); sb.place(tower, near(3, 0)); }, () => f.unit.target === foe)).not.toBeNull();
  }, T);
});

describe('vision (GDD §11.1, §5.9)', () => {
  async function arena(): Promise<{ sb: Sandbox; a: EntityId; b: EntityId }> {
    const sb = await createSandbox({ heroes: [{ hero: 'albatross', team: 'dawn' }, { hero: 'shrike', team: 'dusk' }] });
    const [a, b] = sb.heroes as [EntityId, EntityId];
    return { sb, a, b };
  }
  const put = (sb: Sandbox, id: EntityId, z: number): void => sb.place(id, { x: 20, y: 0, z });

  it('allied heroes see 40 m with line of sight; a structure in between blocks it', async () => {
    const { sb, a, b } = await arena();
    put(sb, a, -20);
    put(sb, b, 15);
    sb.step();
    expect(canSee('dawn', sb.entity(b))).toBe(true);
    expect(canSee('dusk', sb.entity(a))).toBe(true);
    put(sb, b, 25);
    sb.step();
    expect(canSee('dawn', sb.entity(b))).toBe(false);
    expect(canSee('dusk', sb.entity(b))).toBe(true);
    put(sb, b, 15);
    sb.dummy({ kind: 'structure', type: 'nest', team: 'neutral', at: { x: 20, y: 0, z: -2 }, hp: 100, radius: 2, height: 6 });
    sb.step();
    expect(canSee('dawn', sb.entity(b))).toBe(false);
  }, T);

  it('fledglings see 20 m without line of sight; units refresh within the stagger', async () => {
    const { sb, a, b } = await arena();
    put(sb, a, -30);
    put(sb, b, 30);
    const eye = sb.dummy({ kind: 'unit', type: 'scrapper', team: 'dawn', at: { x: 20, y: 0, z: 12 }, hp: 100 });
    const foe = sb.dummy({ kind: 'unit', type: 'slinger', team: 'dusk', at: { x: 20, y: 0, z: 35 }, hp: 100 });
    sb.step(7);
    expect(canSee('dawn', sb.entity(b))).toBe(true);
    expect(canSee('dawn', sb.entity(foe))).toBe(false);
    expect(sb.entity(eye).seenBy).toBe(SeenBy.dawn | SeenBy.dusk);
    sb.place(eye, { x: 20, y: 0, z: 30 });
    sb.step(7);
    expect(canSee('dawn', sb.entity(foe))).toBe(true);
  }, T);

  it('Fog Bank conceals its ally from outside eyes and admits an eye inside the same resolved volume', async () => {
    const { sb, a, b } = await arena();
    put(sb, a, -17);
    put(sb, b, 5);
    sb.ctx.store.spawn({
      kind: 'area', team: 'dusk', pos: { x: 20, y: 0, z: 0 }, yaw: 0, vel: { x: 0, y: 0, z: 0 }, radius: 7,
      area: { owner: b, ability: null, shape: 'cylinder', dimensions: { kind: 'cylinder', radius: 7, half: 5 },
        concealsAlliesOutside: true, expiresAt: 100 },
    });
    sb.step();
    expect(canSee('dawn', sb.entity(b))).toBe(false);
    put(sb, a, -6);
    sb.step();
    expect(canSee('dawn', sb.entity(b))).toBe(true);
  }, T);

  it('invisible enemies show within 8 m or tiered true sight; reveal shows them on the minimap', async () => {
    const { sb, a, b } = await arena();
    put(sb, a, 0);
    put(sb, b, 20);
    sb.modify(b, 'invisible', { conditions: ['invisible'] });
    sb.step();
    expect(canSee('dawn', sb.entity(b))).toBe(false);
    expect(canSee('dusk', sb.entity(b))).toBe(true);
    put(sb, b, 7);
    sb.step();
    expect(canSee('dawn', sb.entity(b))).toBe(true);
    put(sb, b, 20);
    sb.modify(a, 'trueSight', { conditions: ['trueSight'] });
    sb.step();
    expect(canSee('dawn', sb.entity(b))).toBe(true);
    sb.modify(a, 'trueSight', { conditions: ['trueSight'], stats: [{ stat: 'trueSightRadius', op: 'max', value: 12 }] });
    sb.step();
    expect(canSee('dawn', sb.entity(b))).toBe(false);
    sb.modify(a, 'trueSight', null);
    sb.modify(b, 'revealed', { conditions: ['revealed'] });
    put(sb, b, 39);
    put(sb, a, -39);
    sb.step();
    expect(sb.entity(b).seenBy).toBe(SeenBy.dusk);
    expect(sb.entity(b).mapOnlySeenBy).toBe(SeenBy.dawn);
    expect(sb.view.entities.find((e) => e.id === b)?.mapSeenBy).toBe(SeenBy.all);
    sb.modify(b, 'invisible', null);
    sb.step();
    expect(sb.entity(b).seenBy).toBe(SeenBy.all);
  }, T);
});
