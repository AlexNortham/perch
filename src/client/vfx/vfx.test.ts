import { Group } from 'three';
import { describe, expect, it } from 'vitest';
import type { EntityId, EntityView, SimEvent, Team, Vec3 } from '../../sim/core/contracts';
import { ViewFlag } from '../../sim/core/contracts';
import type { Frame } from '../app/contracts';
import { Bound } from './bound';
import type { Source } from './bound';
import { CAPACITY, TRACER, TRANSIENT_CAPACITY } from './constants';
import type { BurstKind } from './constants';
import { drawnByVfx } from '../app/drawn';
import { createDraw, Transients } from './fx';
import { mapEvents } from './mapping';
import type { FxSink, Lookup } from './mapping';

const v = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
const ent = (id: number, kind: EntityView['kind'], type: string, team: Team = 'dawn', pos: Vec3 = v(), flags = 0): EntityView => ({
  id, kind, team, type, pos, vel: v(), yaw: 0, pitch: 0, radius: 0.5, hp: 1, maxHp: 1, shield: 0, flags, mode: null, seenBy: 3,
});

function harness(entities: EntityView[], hitscan: number[] = []) {
  const byId = new Map<EntityId, EntityView>(entities.map((e) => [e.id, e]));
  const lookup: Lookup = { entity: (id) => byId.get(id), hitscan: (id) => hitscan.includes(id), localTeam: 'dawn' };
  const log: { kind: string; detail?: unknown }[] = [];
  const sink: FxSink = {
    burst: (kind: BurstKind, pos) => log.push({ kind: `burst:${kind}`, detail: pos }),
    tracer: (from, to, colour) => log.push({ kind: 'tracer', detail: { from, to, colour } }),
    hitFlash: (id) => log.push({ kind: 'hitFlash', detail: id }),
    tether: (s, t, on) => log.push({ kind: on ? 'tether' : 'untether', detail: [s, t] }),
  };
  const run = (events: SimEvent[]): string[] => {
    log.length = 0;
    mapEvents(events, lookup, sink);
    return log.map((l) => l.kind);
  };
  return { run, log };
}

const fired = (shooter: number): SimEvent => ({ type: 'weapon.fired', shooter, muzzle: v(0, 1, 0), dir: v(0, 0, 1) });
const impact = (owner: number, target: number | null, beakShot = false, via?: 'weapon' | 'ability'): SimEvent => ({
  type: 'projectile.impact', owner, pos: v(0, 1, 20), normal: v(0, 0, -1), target, beakShot, ...(via ? { via } : {}),
});
const damage = (source: number, target: number, via: 'unit' | 'structure' | 'weapon' | 'status'): SimEvent => ({
  type: 'damage.applied', source, sourceTeam: 'dawn', target, targetKind: 'hero', amount: 1, absorbed: 0, damageType: 'talon', via,
  ability: null, item: null, beakShot: false, weakPoint: false, proc: false, lethal: false, pos: v(0, 1, 3),
});

describe('event to effect mapping', () => {
  const world = [ent(1, 'hero', 'shrike'), ent(2, 'hero', 'owl', 'dusk'), ent(3, 'structure', 'warden', 'dusk'), ent(4, 'pickup', 'pod', 'dusk'), ent(5, 'unit', 'scrapper'), ent(6, 'unit', 'slinger'), ent(7, 'unit', 'scrapper', 'dusk', v(0, 0, 1.2))];

  it('draws a muzzle flash and one tracer per hitscan impact, none for projectile guns', () => {
    const h = harness(world, [1]);
    expect(h.run([fired(1), impact(1, 2), impact(1, null)])).toEqual(['burst:muzzle', 'tracer', 'tracer', 'burst:impactBody', 'burst:impactWorld']);
    expect(h.run([fired(2), impact(2, null)])).toEqual(['burst:muzzle', 'burst:impactWorld']);
  });

  it('draws a tracer to full range when a hitscan shot hits nothing, and passes through pods', () => {
    const h = harness(world, [1]);
    h.run([fired(1)]);
    const miss = h.log.find((l) => l.kind === 'tracer')?.detail as { to: Vec3 };
    expect(miss.to.z).toBeCloseTo(TRACER.missLength);
    expect(h.run([fired(1), impact(1, 4)])).toEqual(['burst:muzzle', 'tracer']);
  });

  it('tints enemy tracers red-ish and allied ones gold-white', () => {
    const h = harness(world, [1, 2]);
    h.run([fired(1)]);
    expect((h.log[1]?.detail as { colour: number }).colour).toBe(TRACER.ally);
    h.run([fired(2)]);
    expect((h.log[1]?.detail as { colour: number }).colour).toBe(TRACER.enemy);
  });

  it('gives beak shots their own flash, structures chips and pods nothing at the impact', () => {
    const h = harness(world, [1]);
    expect(h.run([impact(1, 2, true)])).toEqual(['burst:beakFlash', 'burst:impactBody']);
    expect(h.run([impact(1, 3)])).toEqual(['burst:impactStructure']);
    expect(h.run([impact(1, 4)])).toEqual([]);
  });

  it('flashes whatever is hit, except by status ticks', () => {
    const h = harness(world);
    expect(h.run([damage(1, 2, 'weapon')])).toEqual(['hitFlash']);
    expect(h.run([damage(1, 2, 'status')])).toEqual([]);
  });

  it('draws fledgling attacks: a swipe up close, a tracer for slingers and structures', () => {
    const h = harness(world);
    expect(h.run([damage(5, 2, 'unit')])).toEqual(['hitFlash', 'burst:swipe']);
    expect(h.run([damage(6, 2, 'unit')])).toEqual(['hitFlash', 'tracer']);
    expect(h.run([damage(3, 1, 'structure')])).toEqual(['hitFlash', 'tracer']);
  });

  it('pops secured pods and crunches denied ones', () => {
    const h = harness(world);
    const pod = (outcome: 'secured' | 'denied'): SimEvent => ({ type: 'pod.resolved', pod: 4, by: 1, outcome, pos: v(0, 1, 0) });
    expect(h.run([pod('secured')])).toEqual(['burst:podSecured']);
    expect(h.run([pod('denied')])).toEqual(['burst:podDenied']);
  });

  it('maps movement and tethers', () => {
    const h = harness(world);
    const move = (action: 'dash' | 'land' | 'updraftBoost' | 'slide'): SimEvent => ({ type: 'movement', hero: 1, action });
    expect(h.run([move('dash'), move('land'), move('updraftBoost'), move('slide')])).toEqual(['burst:dash', 'burst:dust', 'burst:updraftBoost']);
    expect(h.run([{ type: 'tether', source: 1, target: 2, ability: null, stage: 'start' }, { type: 'tether', source: 1, target: 2, ability: null, stage: 'end' }])).toEqual(['tether', 'untether']);
  });

  it('ignores events about entities it cannot find', () => {
    expect(harness([]).run([{ type: 'movement', hero: 99, action: 'dash' }, { type: 'melee', attacker: 99, heavy: false, target: null, parried: false }])).toEqual([]);
  });
});

describe('pooling', () => {
  it('never grows under sustained fire: the ring and the instance buffers stay at their capacity', () => {
    const fx = new Transients();
    const draw = createDraw(new Group());
    const recs = fx.recs;
    const buffers = Object.values(draw.layers).map((l) => l.mesh.instanceMatrix.array);
    for (let frame = 0; frame < 600; frame++) {
      for (let i = 0; i < 10; i++) {
        fx.tracer(v(), v(0, 0, 50), TRACER.ally, TRACER.width, TRACER.life);
        fx.burst('impactBody', v(0, 1, 50), v(0, 0, -1), 0);
        fx.burst('beakFlash', v(0, 1, 50), null, 0);
      }
      for (const l of Object.values(draw.layers)) l.reset();
      fx.update(1 / 60, draw);
      for (const l of Object.values(draw.layers)) l.commit();
    }
    expect(fx.recs).toBe(recs);
    expect(fx.recs.length).toBe(TRANSIENT_CAPACITY);
    expect(fx.liveCount).toBeLessThanOrEqual(TRANSIENT_CAPACITY);
    for (const [shape, l] of Object.entries(draw.layers)) {
      expect(l.mesh.count).toBeLessThanOrEqual(CAPACITY[shape as keyof typeof CAPACITY]);
    }
    expect(Object.values(draw.layers).map((l) => l.mesh.instanceMatrix.array)).toEqual(buffers);
  });

  it('retires effects after their life and draws nothing once they are gone', () => {
    const fx = new Transients();
    const draw = createDraw(new Group());
    fx.tracer(v(), v(0, 0, 10), TRACER.ally, TRACER.width, TRACER.life);
    expect(fx.liveCount).toBe(1);
    fx.update(TRACER.life * 2, draw);
    expect(fx.liveCount).toBe(0);
  });

  it('drops instances past capacity instead of growing', () => {
    const draw = createDraw(new Group());
    const q = draw.layers.sphere.mesh.quaternion;
    for (let i = 0; i < CAPACITY.sphere + 50; i++) draw.layers.sphere.push(q, 0, 0, 0, 1, 1, 1, 1, 1, 1);
    expect(draw.layers.sphere.n).toBe(CAPACITY.sphere);
  });
});

describe('bound visuals', () => {
  const frameOf = (entities: EntityView[]): Frame => {
    const view = { entities, seconds: 1 } as unknown as Frame['curr'];
    return { prev: view, curr: view, alpha: 1, dt: 1 / 60 };
  };
  const source = (entities: EntityView[]): Source => ({
    entity: (id) => entities.find((e) => e.id === id), entities, statusBits: new Map(), localTeam: 'dawn', now: null, podBorn: null, timeScale: 1,
  });
  const drawn = (entities: EntityView[]): number => {
    const draw = createDraw(new Group());
    const bound = new Bound(draw, new Transients());
    bound.frame(frameOf(entities), source(entities));
    return Object.values(draw.layers).reduce((n, l) => n + l.n, 0);
  };

  it('draws projectiles, pods, areas and summons from the view, and markers from flags', () => {
    expect(drawn([ent(1, 'projectile', '')])).toBeGreaterThan(0);
    expect(drawn([ent(2, 'pickup', 'pod')])).toBe(2);
    for (const shape of ['sphere', 'cylinder', 'cone', 'ring', 'box']) expect(drawn([ent(3, 'area', shape)])).toBeGreaterThan(0);
    for (const summon of ['trap', 'turret', 'wall']) expect(drawn([ent(4, 'unit', summon)])).toBeGreaterThan(0);
    expect(drawn([ent(5, 'unit', 'scrapper')])).toBe(0);
    expect(drawn([ent(5, 'unit', 'scrapper', 'dusk', v(), ViewFlag.Stunned)])).toBe(3);
    expect(drawn([ent(5, 'unit', 'scrapper', 'dusk', v(), ViewFlag.Stunned | ViewFlag.Dead)])).toBe(0);
  });

  it('leaves the shapes it draws to the entity layer to skip', () => {
    expect(drawnByVfx(ent(1, 'projectile', ''))).toBe(true);
    expect(drawnByVfx(ent(1, 'pickup', 'pod'))).toBe(true);
    expect(drawnByVfx(ent(1, 'pickup', 'egg'))).toBe(false);
    expect(drawnByVfx(ent(1, 'unit', 'decoy'))).toBe(false);
    expect(drawnByVfx(ent(1, 'hero', 'shrike'))).toBe(false);
  });
});
