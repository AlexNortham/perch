import { describe, expect, it } from 'vitest';
import { Button } from '../core/contracts';
import type { AreaEffect, Effect, EffectCause, EffectTarget, HeroEntity, SummonEffect, Vec3 } from '../core/contracts';
import { inside, isEmpty, resolveShape, sideOf } from './shapes';
import { ability, createHarness, kit } from './testkit';

const O = { x: 0, y: 0, z: 0 };
const FWD = { x: 0, y: 0, z: 1 };
const hit: Effect = { kind: 'damage', amount: 'dmg', type: 'song' };
const mark = (id: string): Effect => ({ kind: 'statMod', id, name: id, stats: [], durationS: 1 });

function causeOf(h: HeroEntity, values: Record<string, number> = { dmg: 10 }): EffectCause {
  return { source: h.id, team: h.team, via: 'ability', ability: 'test', item: null, values, songPower: 5, proc: false, origin: { ...h.pos } };
}
const at = (point: Vec3, entity: number | null = null, dir: Vec3 = FWD): EffectTarget => ({ entity, point, dir });

/** A harness with a Dawn caster at the origin and a Dusk hero at `enemy`, spatial index built. */
function arena(enemy: Vec3 = { x: 0, y: 0, z: 10 }, hooks?: Parameters<typeof kit>[1]) {
  const t = createHarness({ heroes: { shrike: kit([], hooks) }, unlockAbilities: true });
  const me = t.hero('shrike', 'dawn', O);
  const foe = t.hero('owl', 'dusk', enemy);
  t.step(1);
  return { t, me, foe, cause: causeOf(me) };
}

const zone = (over: Partial<AreaEffect>): AreaEffect => ({
  kind: 'area',
  shape: { kind: 'cylinder', radius: 4, height: 4 },
  durationS: 2,
  attach: 'point',
  affects: { teams: 'enemies' },
  effects: [hit],
  ...over,
});

describe('area shapes', () => {
  const mag = (m: unknown) => m as number;
  const test = (s: AreaEffect['shape'], p: Vec3, r = 0) => inside(resolveShape(s, mag), O, 0, 1, p, r);

  it('sphere and cylinder', () => {
    const sphere = { kind: 'sphere', radius: 5 } as const;
    expect([test(sphere, { x: 4, y: 0, z: 0 }), test(sphere, { x: 5.5, y: 0, z: 0 }), test(sphere, { x: 5.3, y: 0, z: 0 }, 0.4)]).toEqual([true, false, true]);
    expect(test(sphere, { x: 3, y: 4.5, z: 0 })).toBe(false);
    const cyl = { kind: 'cylinder', radius: 5, height: 4 } as const;
    expect([test(cyl, { x: 4, y: 1.9, z: 0 }), test(cyl, { x: 4, y: 2.1, z: 0 }), test(cyl, { x: 0, y: -1.9, z: 4 })]).toEqual([true, false, true]);
  });

  it('cone opens along the forward, with a fixed height', () => {
    const cone = { kind: 'cone', length: 10, angleDeg: 60 } as const;
    const pts = [{ x: 0, y: 0, z: 9 }, { x: 5, y: 0, z: 5 }, { x: 2, y: 0, z: 8 }, { x: 0, y: 0, z: -3 }, { x: 0, y: 4, z: 5 }, { x: 0, y: 0, z: 10.3 }];
    expect(pts.map((p) => test(cone, p, 0.4))).toEqual([true, false, true, false, false, true]);
  });

  it('ring band, and the side of its mid line for onCross', () => {
    const ring = { kind: 'ring', inner: 8, outer: 10, height: 2 } as const;
    expect([test(ring, { x: 9, y: 0, z: 0 }), test(ring, { x: 5, y: 0, z: 0 }), test(ring, { x: 0, y: 0, z: 10.3 }, 0.4)]).toEqual([true, false, true]);
    const r = resolveShape(ring, mag);
    expect([sideOf(r, O, 0, 1, { x: 5, y: 0, z: 0 }, 0), sideOf(r, O, 0, 1, { x: 11, y: 0, z: 0 }, 0), sideOf(r, O, 0, 1, { x: 9, y: 5, z: 0 }, 0)]).toEqual([true, false, null]);
  });

  it('box: width across, length along the forward, centred', () => {
    const box = { kind: 'box', size: { x: 4, y: 2, z: 10 } } as const;
    const pts = [{ x: 1.9, y: 0, z: 4.9 }, { x: 2.5, y: 0, z: 0 }, { x: 0, y: 0, z: 5.5 }, { x: 0, y: 0, z: -5.3 }, { x: 0, y: 1.5, z: 0 }];
    expect(pts.map((p) => test(box, p, 0.4))).toEqual([true, false, false, true, false]);
  });

  it('a shape sized 0 is empty and spawns nothing', () => {
    expect(isEmpty(resolveShape({ kind: 'sphere', radius: 0 }, mag))).toBe(true);
    const { t, cause } = arena();
    t.ctx.effects.apply(zone({ shape: { kind: 'sphere', radius: 'r' } }), at({ x: 0, y: 0, z: 10 }), { ...cause, values: { r: 0 } });
    expect(t.ctx.store.list('area')).toHaveLength(0);
  });
});

describe('area effects', () => {
  it('a burst hits matching entities inside once, with via area and the centre as origin', () => {
    const { t, me, foe, cause } = arena({ x: 3, y: 0, z: 10 });
    t.hero('pelican', 'dusk', { x: 0, y: 0, z: 18 });
    t.hero('swan', 'dawn', { x: 1, y: 0, z: 10 });
    t.step(1);
    t.ctx.effects.apply(zone({ durationS: 0, shape: { kind: 'sphere', radius: 5 } }), at({ x: 0, y: 0, z: 10 }), cause);
    const dmg = t.of('damage');
    expect(dmg.map((a) => a.target.entity)).toEqual([foe.id]);
    expect(dmg[0]?.cause).toMatchObject({ source: me.id, ability: 'test', via: 'area', values: { dmg: 10 }, songPower: 5, origin: { x: 0, y: 0, z: 10 } });
    expect(t.ctx.store.list('area')).toHaveLength(0);
  });

  it('a lasting area: enter at once, tick effects every interval, exit on leaving, entity until it ends', () => {
    const { t, foe, cause } = arena();
    const e = zone({ onEnter: [mark('enter')], onExit: [mark('exit')] });
    t.ctx.effects.apply(e, at({ x: 0, y: 0, z: 10 }), cause);
    const [area] = t.ctx.store.list('area');
    expect(area?.area).toMatchObject({ shape: 'cylinder', expiresAt: 121, owner: cause.source, ability: 'test' });
    expect(area?.radius).toBeCloseTo(Math.hypot(4, 2));
    t.step(1);
    expect(t.of('statMod').map((a) => a.effect.kind === 'statMod' && a.effect.id)).toEqual(['enter']);
    t.step(59);
    expect(t.of('damage').map((a) => [a.tick, a.target.entity])).toEqual([[31, foe.id], [61, foe.id]]);
    foe.pos.z = 30;
    t.step(1);
    expect(t.of('statMod').map((a) => a.effect.kind === 'statMod' && a.effect.id)).toEqual(['enter', 'exit']);
    foe.pos.z = 10;
    t.step(60);
    expect(t.of('damage').map((a) => a.tick)).toEqual([31, 61, 91, 121]);
    expect(t.of('statMod').map((a) => a.effect.kind === 'statMod' && a.effect.id)).toEqual(['enter', 'exit', 'enter', 'exit']);
    expect(t.ctx.store.list('area')).toHaveLength(0);
  });

  it('hits a target once per tick per AreaEffect, however many overlap', () => {
    const { t, cause } = arena();
    const e = zone({});
    t.ctx.effects.apply(e, at({ x: 0, y: 0, z: 10 }), cause);
    t.ctx.effects.apply(e, at({ x: 1, y: 0, z: 10 }), cause);
    t.ctx.effects.apply(zone({}), at({ x: 0, y: 0, z: 10 }), cause);
    t.step(30);
    expect(t.of('damage')).toHaveLength(2);
  });

  it('ring: onCross on crossing the line either way, at most once per interval', () => {
    const { t, foe, cause } = arena({ x: 0, y: 0, z: 5 });
    const ring = zone({ shape: { kind: 'ring', inner: 8.75, outer: 9.25, height: 3 }, durationS: 6, intervalS: 1.5, effects: [], onCross: [hit] });
    t.ctx.effects.apply(ring, at(O), cause);
    t.step(1);
    foe.pos.z = 9.8;
    t.step(1);
    expect(t.of('damage')).toHaveLength(1);
    foe.pos.z = 8;
    t.step(1);
    expect(t.of('damage')).toHaveLength(1);
    t.step(90);
    foe.pos.z = 9.8;
    t.step(1);
    expect(t.of('damage')).toHaveLength(2);
  });

  it('attach source: follows the caster and ends when it dies', () => {
    const { t, me, cause } = arena();
    t.ctx.effects.apply(zone({ attach: 'source', durationS: 5 }), at({ x: 0, y: 0, z: 10 }), cause);
    const [area] = t.ctx.store.list('area');
    expect(area?.pos).toEqual(O);
    me.pos.x = 4;
    t.step(1);
    expect(area?.pos.x).toBe(4);
    me.health.dead = true;
    t.step(1);
    expect(t.ctx.store.list('area')).toHaveLength(0);
  });

  it('a moving area travels along its direction and carries what it reaches', () => {
    const { t, foe, cause } = arena({ x: 0, y: 0, z: 6 });
    const wave = zone({ shape: { kind: 'box', size: { x: 16, y: 4, z: 2 } }, durationS: 1, move: { speed: 12, carry: true }, effects: [] });
    t.ctx.effects.apply(wave, at({ x: 0, y: 0, z: 5 }), cause);
    t.step(5);
    expect(t.ctx.store.list('area')[0]?.pos.z).toBeCloseTo(6);
    const carried = t.of('displace');
    expect(carried).toHaveLength(5);
    expect(carried[0]?.effect).toEqual({ kind: 'displace', mode: 'along', distance: 0.2 });
    expect(carried.every((a) => a.target.entity === foe.id && a.target.dir.z === 1)).toBe(true);
  });

  it('a lasting area from an ability scales with abilityDuration', () => {
    const { t, me, cause } = arena();
    t.ctx.stats.set(me.id, 'test', { stats: [{ stat: 'abilityDuration', op: 'add', value: 0.5 }] });
    t.ctx.effects.apply(zone({}), at({ x: 0, y: 0, z: 10 }), cause);
    expect(t.ctx.store.list('area')[0]?.area.expiresAt).toBe(1 + 180);
  });
});

describe('summons', () => {
  const summon = (over: Partial<SummonEffect>): SummonEffect => ({
    kind: 'summon',
    summon: 'trap',
    health: 0,
    durationS: 60,
    maxCount: 4,
    behaviour: 'trap',
    effects: [hit],
    ...over,
  });

  it('trap: hidden, undamageable, fires on the first enemy hero in range, then goes', () => {
    const { t, me, foe, cause } = arena({ x: 0, y: 0, z: 20 });
    t.ctx.effects.apply(summon({ trigger: { radius: 1.5, affects: { teams: 'enemies', heroesOnly: true } } }), at({ x: 0, y: 0, z: 10 }), cause);
    const [trap] = t.ctx.store.list('unit');
    expect(trap?.unit).toMatchObject({ type: 'summon', summon: 'trap', owner: me.id });
    expect([...(trap?.stats.conditions ?? [])]).toEqual(['invulnerable', 'invisible']);
    t.step(5);
    expect(t.of('damage')).toHaveLength(0);
    foe.pos.z = 11;
    t.step(1);
    const [d] = t.of('damage');
    expect(d?.target.entity).toBe(foe.id);
    expect(d?.cause).toMatchObject({ source: me.id, ability: 'test', via: 'ability', origin: { x: 0, y: 0, z: 10 } });
    expect(t.ctx.store.list('unit')).toHaveLength(0);
  });

  it('maxCount despawns the oldest; duration ends them', () => {
    const { t, cause } = arena({ x: 30, y: 0, z: 30 });
    const s = summon({ maxCount: 2, durationS: 1 });
    for (const z of [5, 6, 7]) t.ctx.effects.apply(s, at({ x: 0, y: 0, z }), cause);
    t.step(1);
    expect(t.ctx.store.list('unit').map((u) => u.pos.z)).toEqual([6, 7]);
    t.step(60);
    expect(t.ctx.store.list('unit')).toHaveLength(0);
  });

  it('turret: shoots the nearest visible enemy every 0.5 s, heroes first', () => {
    const { t, me, foe, cause } = arena({ x: 0, y: 0, z: 15 });
    const fledgling = t.ctx.store.spawn({
      kind: 'unit',
      team: 'dusk',
      pos: { x: 0, y: 0, z: 8 },
      vel: { x: 0, y: 0, z: 0 },
      yaw: 0,
      radius: 0.4,
      unit: { type: 'scrapper', lane: null, height: 1, owner: null, summon: null, target: null, attacking: false },
      health: { hp: 100, talonShield: 0, songShield: 0, barrier: 0, dead: false, respawnAt: null, inCombatUntil: 0 },
      stats: t.ctx.stats.create({ maxHealth: 100 }),
      statuses: [],
    });
    t.ctx.effects.apply(summon({ summon: 'turret', behaviour: 'turret', health: 200, durationS: 20, trigger: { radius: 18, affects: { teams: 'enemies' } } }), at({ x: 0, y: 0, z: 5 }), cause);
    const turret = t.ctx.store.list('unit').find((u) => u.unit.summon === 'turret');
    expect(turret?.health.hp).toBe(200);
    t.step(30);
    expect(t.of('damage').map((a) => [a.tick, a.target.entity])).toEqual([[31, foe.id]]);
    expect(turret?.unit.target).toBe(foe.id);
    foe.seenBy = 0;
    t.step(30);
    expect(t.of('damage').map((a) => a.target.entity)).toEqual([foe.id, fledgling.id]);
    expect(t.of('damage')[1]?.cause.source).toBe(me.id);
  });

  it('decoy: runs along the aim at its owner’s speed and shoots', () => {
    const { t, cause } = arena({ x: 0, y: 0, z: 20 });
    t.ctx.effects.apply(summon({ summon: 'decoy', behaviour: 'decoy', health: 150, durationS: 6 }), at(O, null, { x: 0, y: 0.3, z: 1 }), cause);
    t.step(60);
    const decoy = t.ctx.store.list('unit')[0];
    expect(decoy?.pos.z).toBeCloseTo(7);
    expect(decoy?.vel.z).toBe(7);
    expect(t.of('damage').length).toBe(2);
  });

  it('wall: sized from data, stands still, expires', () => {
    const { t, cause } = arena({ x: 30, y: 0, z: 30 });
    t.ctx.effects.apply(summon({ summon: 'wall', behaviour: 'wall', health: 400, durationS: 4, size: { x: 6, y: 3, z: 0.5 }, effects: [] }), at({ x: 0, y: 0, z: 2 }), cause);
    const wall = t.ctx.store.list('unit')[0];
    expect([wall?.radius, wall?.unit.height, wall?.unit.summon]).toEqual([3, 3, 'wall']);
    t.step(239);
    expect(t.ctx.store.list('unit')).toHaveLength(1);
    t.step(1);
    expect(t.ctx.store.list('unit')).toHaveLength(0);
  });

  it('a custom behaviour runs the owner’s hook every tick', () => {
    const calls: [string, number | null][] = [];
    const { t, cause } = arena(undefined, () => ({ onEffect: (name, target) => calls.push([name, target.entity]) }));
    t.ctx.effects.apply(summon({ summon: 'wall', behaviour: 'galeShield', health: 400 }), at(O), cause);
    const id = t.ctx.store.list('unit')[0]?.id ?? -1;
    t.step(3);
    expect(calls).toEqual([['galeShield', id], ['galeShield', id], ['galeShield', id]]);
  });
});

describe('tether, delay, cooldownMod, hook', () => {
  it('tether: ticks both ends each interval until it breaks beyond its distance', () => {
    const { t, me, foe, cause } = arena({ x: 0, y: 0, z: 6 });
    const tether: Effect = { kind: 'tether', durationS: 2, breakDistance: 12, onSourceTick: [{ kind: 'heal', amount: 'dmg' }], onTargetTick: [hit] };
    t.ctx.effects.apply(tether, at(foe.pos, foe.id), cause);
    t.step(60);
    expect(t.of('heal').map((a) => a.target.entity)).toEqual([me.id, me.id]);
    expect(t.of('damage').map((a) => a.target.entity)).toEqual([foe.id, foe.id]);
    foe.pos.z = 13;
    t.step(60);
    expect(t.of('damage')).toHaveLength(2);
  });

  it('tether: ends after its duration', () => {
    const { t, foe, cause } = arena({ x: 0, y: 0, z: 6 });
    t.ctx.effects.apply({ kind: 'tether', durationS: 1, breakDistance: 12, onTargetTick: [hit] }, at(foe.pos, foe.id), cause);
    t.step(200);
    expect(t.of('damage').map((a) => a.tick)).toEqual([31, 61]);
  });

  it('delay: applies later to the same target and cause; 0 s applies now', () => {
    const { t, foe, cause } = arena();
    const target = at(foe.pos, foe.id);
    t.ctx.effects.apply({ kind: 'delay', seconds: 0.8, effects: [hit] }, target, cause);
    t.ctx.effects.apply({ kind: 'delay', seconds: 0, effects: [mark('now')] }, target, cause);
    expect(t.of('statMod')).toHaveLength(1);
    t.step(47);
    expect(t.of('damage')).toHaveLength(0);
    t.step(1);
    const [d] = t.of('damage');
    expect([d?.tick, d?.target.entity, d?.cause]).toEqual([49, foe.id, cause]);
  });

  it('cooldownMod: changes the source’s cooldowns (refund a slot, reset all, item actives), whatever the target', () => {
    const { t, me, foe, cause } = arena();
    t.step(1, [[me, { pressed: Button.Ability1 | Button.Ability2 }]]);
    const [s0, s1] = me.abilities.slots;
    expect([s0?.readyAt, s1?.readyAt]).toEqual([602, 602]);
    t.ctx.effects.apply({ kind: 'cooldownMod', scope: 'slot', slot: 0, mode: 'refund', seconds: 4 }, at(foe.pos, foe.id), cause);
    expect([s0?.readyAt, s1?.readyAt]).toEqual([362, 602]);
    t.ctx.effects.apply({ kind: 'cooldownMod', scope: 'slot', slot: 0, mode: 'refund', seconds: 60 }, at(me.pos, me.id), cause);
    expect([s0?.charges, s0?.readyAt]).toEqual([1, 0]);
    t.ctx.effects.apply({ kind: 'cooldownMod', scope: 'abilities', mode: 'reset' }, at(me.pos, me.id), cause);
    expect([s1?.charges, s1?.readyAt]).toEqual([1, 0]);
    me.inventory.items.push({ item: 'bell', readyAt: 1000 }, { item: 'cap', readyAt: 0 });
    t.ctx.effects.apply({ kind: 'cooldownMod', scope: 'items', mode: 'refund', seconds: 5 }, at(me.pos, me.id), cause);
    expect(me.inventory.items.map((i) => i.readyAt)).toEqual([700, 0]);
    t.ctx.effects.apply({ kind: 'cooldownMod', scope: 'items', mode: 'reset' }, at(me.pos, me.id), cause);
    expect(me.inventory.items.map((i) => i.readyAt)).toEqual([0, 0]);
  });

  it('hook: HookEffect calls onEffect, then onCast runs after the effects; onTick every tick', () => {
    const log: string[] = [];
    const t = createHarness({
      heroes: {
        shrike: kit([ability({ hook: true, effects: [{ kind: 'hook', name: 'boom' }] })], () => ({
          onEffect: (name, target, cause) => log.push(`effect ${name} ${target.entity} ${cause.ability}`),
          onCast: (cast) => log.push(`cast ${cast.slot} ${cast.tier} ${cast.ability.id}`),
          onTick: (h) => log.push(`tick ${h.id}`),
        })),
      },
      unlockAbilities: true,
    });
    const me = t.hero('shrike', 'dawn', O);
    t.step(1, [[me, { pressed: Button.Ability1 }]]);
    expect(log).toEqual([`effect boom ${me.id} test`, 'cast 0 0 test', `tick ${me.id}`]);
  });

  it('the cause survives a chain: cast → delay → burst', () => {
    const chain = ability({
      targeting: 'point',
      range: 20,
      values: { dmg: 42, r: 3 },
      effects: [{ kind: 'delay', seconds: 0.5, effects: [zone({ durationS: 0, shape: { kind: 'sphere', radius: 'r' } })] }],
    });
    const t = createHarness({ heroes: { shrike: kit([chain]) }, unlockAbilities: true });
    const me = t.hero('shrike', 'dawn', O);
    const foe = t.hero('owl', 'dusk', { x: 0, y: 0, z: 20 });
    t.ctx.stats.setBase(me.id, { ...me.stats.base, songPower: 9 });
    t.step(1, [[me, { pressed: Button.Ability1 }]]);
    t.step(30);
    const [d] = t.of('damage');
    expect(d?.target.entity).toBe(foe.id);
    expect(d?.cause).toMatchObject({ source: me.id, ability: 'test', via: 'area', songPower: 9, values: { dmg: 42, r: 3 } });
    expect(d && t.ctx.effects.magnitude(d.effect.amount, d.cause)).toBe(42);
  });
});
