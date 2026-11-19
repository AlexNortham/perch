/**
 * Wave 3 contract follow-ups for sim/abilities (docs/briefs/W3-contract-followups.md, Ability Systems 1–9).
 */
import { describe, expect, it } from 'vitest';
import { Button } from '../core/contracts';
import type { Effect, EffectCause, EffectTarget, HeroEntity, SimEvent, SummonEffect, Vec3 } from '../core/contracts';
import { ability, createHarness, kit } from './testkit';
import type { Harness } from './testkit';
import { validateKit } from './index';

const O = { x: 0, y: 0, z: 0 };
const FWD = { x: 0, y: 0, z: 1 };
const hit: Effect = { kind: 'damage', amount: 'dmg', type: 'song' };
const mark = (id: string): Effect => ({ kind: 'statMod', id, name: id, stats: [], durationS: 1 });
const at = (point: Vec3, entity: number | null = null, dir: Vec3 = FWD): EffectTarget => ({ entity, point, dir });
const causeOf = (h: HeroEntity): EffectCause => ({
  source: h.id,
  team: h.team,
  via: 'ability',
  ability: 'test',
  item: null,
  values: { dmg: 10, n: 2 },
  songPower: 0,
  proc: false,
  origin: { ...h.pos },
});
const eventsOf = <T extends SimEvent['type']>(t: Harness, type: T) =>
  t.events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);

function arena(abilities: Parameters<typeof kit>[0] = [], hooks?: Parameters<typeof kit>[1]) {
  const t = createHarness({ heroes: { shrike: kit(abilities, hooks) }, unlockAbilities: true });
  const me = t.hero('shrike', 'dawn', O);
  const foe = t.hero('owl', 'dusk', { x: -0.75, y: 0, z: 20 });
  t.step(1);
  return { t, me, foe, cause: causeOf(me) };
}

describe('selfEffects (Ability Systems 1)', () => {
  it('a unit cast lands effects on the target, then selfEffects on the caster, then onCast; tiers append', () => {
    const order: string[] = [];
    const a = ability({
      targeting: 'unit',
      range: 30,
      affects: { teams: 'enemies' },
      effects: [hit],
      selfEffects: [mark('self')],
      hook: true,
      upgrades: [{ description: 'T1' }, { description: 'T2' }, { description: 'T3', selfEffects: [mark('t3')] }],
    });
    const { t, me, foe } = arena([a], () => ({ onCast: () => order.push('onCast') }));
    t.ctx.effects.handle('statMod', 'combat', (e) => order.push(e.id));
    t.ctx.effects.handle('damage', 'combat', () => order.push('damage'));
    t.step(1, [[me, { pressed: Button.Ability1 }]]);
    expect(order).toEqual(['damage', 'self', 'onCast']);
    const self = t.of('statMod')[0];
    expect(self?.target).toEqual({ entity: me.id, point: me.pos, dir: t.of('damage')[0]?.target.dir });
    expect(t.of('damage')[0]?.target.entity).toBe(foe.id);

    me.abilities.ap = 8;
    for (let i = 0; i < 3; i++) t.step(1, [[me, { upgrade: 0 }]]);
    t.step(700);
    order.length = 0;
    t.step(1, [[me, { pressed: Button.Ability1 }]]);
    expect(order).toEqual(['damage', 'self', 't3', 'onCast']);
  });

  it('the validator walks selfEffects, onWall and onEnd', () => {
    const bad = { kind: 'damage', amount: 'missing', type: 'song' } as const;
    const a = ability({
      selfEffects: [bad],
      effects: [
        { kind: 'displace', mode: 'push', distance: 3, onWall: [bad] },
        { kind: 'summon', summon: 'decoy', health: 1, durationS: 1, maxCount: 1, behaviour: 'decoy', effects: [], onEnd: [bad], count: 'missing' },
      ],
    });
    expect(validateKit(kit([a])).filter((m) => m.includes("unknown value 'missing'"))).toHaveLength(4);
  });
});

describe('summons (Ability Systems 2, 3, 4, 9)', () => {
  const summon = (over: Partial<SummonEffect>): SummonEffect => ({
    kind: 'summon',
    summon: 'decoy',
    health: 150,
    durationS: 1,
    maxCount: 1,
    behaviour: 'decoy',
    effects: [],
    onEnd: [mark('burst')],
    ...over,
  });

  it('count and spreadDeg fan the summons evenly around the target direction; one cast never replaces its own', () => {
    const { t, cause } = arena();
    t.ctx.effects.apply(summon({ count: 'n', spreadDeg: 30, durationS: 6 }), at(O), cause);
    const yaws = t.ctx.store.list('unit').map((u) => (u.yaw * 180) / Math.PI);
    expect(yaws.map((y) => Math.round(y))).toEqual([-15, 15]);
    t.ctx.effects.apply(summon({ count: 3, spreadDeg: 60, durationS: 6 }), at(O, null, { x: 1, y: 0, z: 0 }), cause);
    const fan = t.ctx.store.list('unit').filter((u) => !u.removed).map((u) => Math.round((u.yaw * 180) / Math.PI));
    expect(fan).toEqual([60, 90, 120]);
    // The second cast replaced both of the first (cap max(maxCount 1, count 3) = 3), each bursting.
    expect(t.of('statMod').filter((a) => a.effect.kind === 'statMod' && a.effect.id === 'burst')).toHaveLength(2);
  });

  it('onEnd fires on expiry, on death and on replacement: at the last position, entity null, the summon’s cause', () => {
    const { t, me, cause } = arena();
    const bursts = () => t.of('statMod').filter((a) => a.effect.id === 'burst');
    // Expiry, after running 1 s along +z at the owner's 7 m/s.
    t.ctx.effects.apply(summon({}), at(O), cause);
    t.step(60);
    expect(bursts()).toHaveLength(1);
    expect(bursts()[0]?.target.entity).toBeNull();
    expect(bursts()[0]?.target.point.z).toBeCloseTo((59 * 7) / 60); // it expires on its 60th tick, before moving
    expect(bursts()[0]?.cause).toMatchObject({ source: me.id, ability: 'test', origin: bursts()[0]?.target.point });
    // Death (combat's entity.died).
    t.ctx.effects.apply(summon({ durationS: 10 }), at({ x: 5, y: 0, z: 0 }), cause);
    const u = t.ctx.store.list('unit')[0];
    if (!u) throw new Error('no summon');
    t.ctx.bus.emit({
      type: 'entity.died', victim: u.id, victimKind: 'unit', victimTeam: 'dawn', victimType: 'summon', killer: null,
      creditHero: null, assisters: [], via: 'weapon', pos: { x: 5, y: 0, z: 3 },
    });
    expect(bursts()[1]?.target.point).toEqual({ x: 5, y: 0, z: 3 });
    t.ctx.store.despawn(u.id);
    t.step(1);
    expect(bursts()).toHaveLength(2);
    // Replacement past maxCount.
    t.ctx.effects.apply(summon({ durationS: 10 }), at({ x: -5, y: 0, z: 0 }), cause);
    t.ctx.effects.apply(summon({ durationS: 10 }), at({ x: 9, y: 0, z: 0 }), cause);
    expect(bursts()[2]?.target.point.x).toBe(-5);
    expect(t.ctx.store.list('unit').filter((x) => !x.removed)).toHaveLength(1);
  });

  it('a wall summon carries its size onto UnitInfo.size', () => {
    const { t, cause } = arena();
    t.ctx.effects.apply(summon({ summon: 'wall', behaviour: 'wall', size: { x: 6, y: 3, z: 0.5 } }), at(O), cause);
    expect(t.ctx.store.list('unit')[0]?.unit.size).toEqual({ x: 6, y: 3, z: 0.5 });
  });

  it('a wall a hook turns and moves (Gale Shield follows the aim) ends facing its current yaw, where it stands', () => {
    // The hook's behaviour runs every tick with the summon as target.entity, as Gale Shield's follow hook does.
    const turn = (_name: string, target: EffectTarget) => {
      const w = target.entity === null ? undefined : t.ctx.store.get(target.entity);
      if (!w) return;
      w.yaw = Math.PI / 2;
      w.pos.x = 4;
    };
    const { t, cause } = arena([], () => ({ onEffect: turn }));
    t.ctx.effects.apply(summon({ summon: 'wall', behaviour: 'galeShield', size: { x: 6, y: 3, z: 0.5 } }), at(O), cause);
    t.step(60);
    const end = t.of('statMod').find((a) => a.effect.id === 'burst');
    expect(end?.target.dir.x).toBeCloseTo(1);
    expect(end?.target.dir.z).toBeCloseTo(0);
    expect(end?.target.point.x).toBe(4);
  });

  it('a rooted or stunned decoy stands still', () => {
    const { t, cause } = arena();
    t.ctx.effects.apply(summon({ durationS: 6 }), at(O), cause);
    const d = t.ctx.store.list('unit')[0];
    if (!d) throw new Error('no decoy');
    t.ctx.stats.set(d.id, 'physics:displaced', { conditions: ['rooted'] });
    t.step(30);
    expect(d.pos.z).toBe(0);
    t.ctx.stats.set(d.id, 'physics:displaced', null);
    t.ctx.stats.set(d.id, 'test', { conditions: ['stunned'] });
    t.step(30);
    expect(d.pos.z).toBe(0);
    t.ctx.stats.set(d.id, 'test', null);
    t.step(30);
    expect(d.pos.z).toBeCloseTo(3.5);
  });
});

describe('tethers, channels, modes (Ability Systems 5–8)', () => {
  it('tether events: start when linked, end on expiry, on breaking and when an end dies', () => {
    const { t, me, foe, cause } = arena();
    foe.pos = { x: 0, y: 0, z: 6 };
    const stages = () => eventsOf(t, 'tether').map((e) => [e.stage, e.source, e.target, e.ability]);
    t.ctx.effects.apply({ kind: 'tether', durationS: 1, breakDistance: 12 }, at(foe.pos, foe.id), cause);
    t.step(1);
    expect(stages()).toEqual([['start', me.id, foe.id, 'test']]);
    t.step(60);
    expect(stages()).toHaveLength(2);
    t.ctx.effects.apply({ kind: 'tether', durationS: 5, breakDistance: 12 }, at(foe.pos, foe.id), cause);
    foe.pos.z = 13;
    t.step(1);
    t.ctx.effects.apply({ kind: 'tether', durationS: 5, breakDistance: 12 }, at(foe.pos, foe.id), cause);
    foe.health.dead = true;
    t.step(1);
    expect(stages().map((s) => s[0])).toEqual(['start', 'end', 'start', 'end', 'start', 'end']);
  });

  it('a movement "displaced" event ends the hero’s channel; a wind-up is not a channel', () => {
    const { t, me } = arena([ability({ channelS: 3, channelIntervalS: 0.5, channelEffects: [hit] })]);
    t.step(1, [[me, { pressed: Button.Ability1 }]]);
    expect(me.abilities.channelling).toBe(true);
    t.ctx.bus.emit({ type: 'movement', hero: me.id, action: 'displaced' });
    expect(me.abilities.channelling).toBe(false);
    t.step(1);
    expect(eventsOf(t, 'ability').map((e) => e.stage)).toEqual(['start', 'land', 'interrupted']);
  });

  it('modeAllowsAbilities false blocks new casts but the channelling slot’s re-press still ends it', () => {
    const { t, me } = arena([ability({ channelS: 5 }), ability({ id: 'second' })]);
    t.step(1, [[me, { pressed: Button.Ability1 }]]);
    expect(me.abilities.channelling).toBe(true);
    me.motor.modeAllowsAbilities = false;
    t.step(1, [[me, { pressed: Button.Ability2 }]]);
    expect(eventsOf(t, 'ability').filter((e) => e.slot === 1)).toHaveLength(0);
    t.step(1, [[me, { pressed: Button.Ability1 }]]);
    expect(me.abilities.channelling).toBe(false);
    t.step(1, [[me, { pressed: Button.Ability2 }]]);
    expect(eventsOf(t, 'ability').filter((e) => e.slot === 1)).toHaveLength(0);
    me.motor.modeAllowsAbilities = true;
    t.step(1, [[me, { pressed: Button.Ability2 }]]);
    expect(eventsOf(t, 'ability').filter((e) => e.slot === 1).map((e) => e.stage)).toEqual(['start', 'land']);
  });
});

describe('W4 consumers (Ability Systems)', () => {
  it('extraCount raises the summon cap so a second cast keeps the first', () => {
    const { t, cause } = arena();
    const s: SummonEffect = { kind: 'summon', summon: 'trap', health: 0, durationS: 6, maxCount: 1, extraCount: 1, behaviour: 'trap', effects: [] };
    t.ctx.effects.apply(s, at(O), cause);
    t.ctx.effects.apply(s, at({ x: 5, y: 0, z: 0 }), cause);
    expect(t.ctx.store.list('unit').filter((u) => !u.removed)).toHaveLength(2);
  });

  it('a lasting area publishes its resolved dimensions and concealment on the entity', () => {
    const { t, cause } = arena();
    t.ctx.effects.apply(
      { kind: 'area', shape: { kind: 'cylinder', radius: 4, height: 6 }, durationS: 3, attach: 'point', concealsAlliesOutside: true, affects: { teams: 'allies' }, effects: [] },
      at(O),
      cause,
    );
    const area = t.ctx.store.list('area')[0]?.area;
    expect(area?.dimensions).toEqual({ kind: 'cylinder', radius: 4, half: 3 });
    expect(area?.concealsAlliesOutside).toBe(true);
  });
});
