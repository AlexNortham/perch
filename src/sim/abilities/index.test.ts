import { describe, expect, it } from 'vitest';
import { Button, IDLE_COMMAND } from '../core/contracts';
import type { AbilityDef, Effect, SimEvent } from '../core/contracts';
import { createSim, humanRoster } from '../index';
import { BUFF as buff, ability, createHarness, kit } from './testkit';
import type { Harness } from './testkit';

const hit: Effect = { kind: 'damage', amount: 'dmg', type: 'song' };

function setup(a: AbilityDef, unlock = true) {
  const t = createHarness({ heroes: { shrike: kit([a]) }, unlockAbilities: unlock });
  const me = t.hero('shrike', 'dawn', { x: 0, y: 0, z: 0 });
  return { t, me, slot: me.abilities.slots[0] };
}

const stages = (t: Harness, type = 'ability'): string[] =>
  t.events.flatMap((e: SimEvent) => (e.type === type && e.type === 'ability' ? [e.stage] : []));
const press = (b: number) => ({ pressed: b });

describe('targeting', () => {
  it('self: lands on the caster at once, with the ability cause', () => {
    const { t, me } = setup(ability());
    t.step(1, [[me, press(Button.Ability1)]]);
    const [a] = t.of('statMod');
    expect(a?.target.entity).toBe(me.id);
    expect(a?.target.point).toEqual({ x: 0, y: 0, z: 0 });
    expect(a?.cause).toMatchObject({ source: me.id, team: 'dawn', via: 'ability', ability: 'test', values: { dmg: 10 } });
    expect(stages(t)).toEqual(['start', 'land']);
  });

  it('direction: aims from the muzzle at the aim point', () => {
    const { t, me } = setup(ability({ targeting: 'direction', effects: [hit] }));
    t.step(1, [[me, { pressed: Button.Ability1, pitch: -0.2 }]]);
    const [a] = t.of('damage');
    expect(a?.target.entity).toBe(me.id);
    expect(a?.target.point.y).toBeCloseTo(0);
    const o = a?.cause.origin ?? { x: 0, y: 0, z: 0 };
    const p = a?.target.point ?? o;
    const len = Math.hypot(p.x - o.x, p.y - o.y, p.z - o.z);
    expect(a?.target.dir.z).toBeCloseTo((p.z - o.z) / len);
    expect(a?.target.dir.y).toBeLessThan(0);
  });

  it('point: the aim point clamped to range and put on the ground', () => {
    const { t, me } = setup(ability({ targeting: 'point', range: 10 }));
    t.step(1, [[me, press(Button.Ability1)]]);
    const p = t.of('statMod')[0]?.target.point;
    expect(Math.hypot(p?.x ?? 0, p?.z ?? 0)).toBeCloseTo(10);
    expect(p?.y).toBe(0);
  });

  it('point: abilityRange stretches the range', () => {
    const { t, me } = setup(ability({ targeting: 'point', range: 10 }));
    t.ctx.stats.set(me.id, 'test', { stats: [{ stat: 'abilityRange', op: 'add', value: 0.5 }] });
    t.step(1, [[me, press(Button.Ability1)]]);
    const p = t.of('statMod')[0]?.target.point;
    expect(Math.hypot(p?.x ?? 0, p?.z ?? 0)).toBeCloseTo(15);
  });

  it('unit: the enemy nearest the crosshair inside the cone and range; no target, no cast', () => {
    const { t, me, slot } = setup(ability({ targeting: 'unit', range: 30, affects: { teams: 'enemies' }, effects: [hit] }));
    const owl = t.hero('owl', 'dusk', { x: -0.75, y: 0, z: 20 });
    t.hero('pelican', 'dusk', { x: 4, y: 0, z: 20 });
    t.hero('swan', 'dawn', { x: -0.75, y: 0, z: 15 });
    t.step(1, [[me, press(Button.Ability1)]]);
    expect(t.of('damage').map((a) => a.target.entity)).toEqual([owl.id]);
    expect(t.of('damage')[0]?.target.point).toEqual(owl.pos);

    const { t: t2, me: me2, slot: slot2 } = setup(ability({ targeting: 'unit', range: 10, affects: { teams: 'enemies' } }));
    t2.hero('owl', 'dusk', { x: -0.75, y: 0, z: 20 });
    t2.step(1, [[me2, press(Button.Ability1)]]);
    expect(stages(t2)).toEqual([]);
    expect(slot2?.charges).toBe(1);
    expect(slot?.charges).toBe(0);
  });

  it('unit: needs line of sight', () => {
    const { t, me } = setup(ability({ targeting: 'unit', range: 30, affects: { teams: 'enemies' } }));
    me.yaw = Math.PI / 2;
    t.hero('owl', 'dusk', { x: 20, y: 0, z: 0.75 });
    t.walls.push({ x: 10, z0: -5, z1: 5 });
    t.step(1, [[me, { pressed: Button.Ability1, yaw: Math.PI / 2 }]]);
    expect(stages(t)).toEqual([]);
    t.walls.length = 0;
    t.step(1, [[me, { pressed: Button.Ability1, yaw: Math.PI / 2 }]]);
    expect(stages(t)).toEqual(['start', 'land']);
  });

  it('unit (ally; self if none) falls back to the caster', () => {
    const { t, me } = setup(ability({ targeting: 'unit', range: 30, affects: { teams: 'allies', self: true } }));
    t.step(1, [[me, press(Button.Ability1)]]);
    expect(t.of('statMod')[0]?.target.entity).toBe(me.id);
  });
});

describe('cooldowns and charges', () => {
  it('a cast spends the charge; it comes back after the cooldown', () => {
    const { t, me, slot } = setup(ability({ cooldownS: 10 }));
    t.step(1, [[me, press(Button.Ability1)]]);
    expect(slot).toMatchObject({ charges: 0, readyAt: 601, cooldownTicks: 600 });
    t.step(1, [[me, press(Button.Ability1)]]);
    expect(t.of('statMod')).toHaveLength(1);
    t.step(598);
    expect(slot?.charges).toBe(0);
    t.step(1);
    expect(slot).toMatchObject({ charges: 1, readyAt: 0, cooldownTicks: 0 });
  });

  it('charges: one returns per cooldown, with a lockout between uses', () => {
    const { t, me, slot } = setup(ability({ cooldownS: 5, charges: 2 }));
    t.step(1, [[me, press(Button.Ability1)]]);
    t.step(1, [[me, press(Button.Ability1)]]);
    expect(slot?.charges).toBe(1);
    t.step(23);
    t.step(1, [[me, press(Button.Ability1)]]);
    expect(slot?.charges).toBe(0);
    expect(t.of('statMod')).toHaveLength(2);
    expect(slot?.readyAt).toBe(301);
    t.step(275);
    expect(slot?.charges).toBe(1);
    t.step(300);
    expect(slot?.charges).toBe(2);
  });

  it('abilityCharges adds charges only to abilities that have them', () => {
    const { t, me, slot } = setup(ability({ charges: 2 }));
    const one = me.abilities.slots[1];
    t.ctx.stats.set(me.id, 'test', { stats: [{ stat: 'abilityCharges', op: 'add', value: 2 }] });
    t.step(1);
    expect(slot?.charges).toBe(2);
    t.step(600);
    expect(slot?.charges).toBe(3);
    t.step(600);
    expect(slot?.charges).toBe(4);
    expect(one?.charges).toBe(1);
  });

  it('cooldown reduction shortens cooldowns, capped at 50%', () => {
    const { t, me, slot } = setup(ability({ cooldownS: 10 }));
    t.ctx.stats.set(me.id, 'test', { stats: [{ stat: 'cooldownReduction', op: 'add', value: 0.8 }] });
    t.step(1, [[me, press(Button.Ability1)]]);
    expect(slot?.cooldownTicks).toBe(300);
  });
});

describe('cast time and channels', () => {
  it('wind-up: effects land after castS; a rooted cast roots the caster meanwhile', () => {
    const { t, me, slot } = setup(ability({ castS: 0.5, rooted: true }));
    t.step(1, [[me, press(Button.Ability1)]]);
    expect(me.abilities.casting).toBe(0);
    expect(t.ctx.stats.has(me.id, 'rooted')).toBe(true);
    t.step(29);
    expect(t.of('statMod')).toHaveLength(0);
    t.step(1);
    expect(t.of('statMod')).toHaveLength(1);
    expect(t.ctx.stats.has(me.id, 'rooted')).toBe(false);
    expect(me.abilities.casting).toBeNull();
    expect(slot?.charges).toBe(0);
  });

  it('stun during the wind-up interrupts it and spends nothing', () => {
    const { t, me, slot } = setup(ability({ castS: 0.5, rooted: true }));
    t.step(1, [[me, press(Button.Ability1)]]);
    t.step(10);
    t.ctx.stats.set(me.id, 'test:stun', { conditions: ['stunned'] });
    t.step(1);
    expect(stages(t)).toEqual(['start', 'interrupted']);
    expect(t.of('statMod')).toHaveLength(0);
    expect(slot?.charges).toBe(1);
    expect(t.ctx.stats.has(me.id, 'rooted')).toBe(false);
  });

  it('silence blocks a cast', () => {
    const { t, me, slot } = setup(ability());
    t.ctx.stats.set(me.id, 'test', { conditions: ['silenced'] });
    t.step(1, [[me, press(Button.Ability1)]]);
    expect(stages(t)).toEqual([]);
    expect(slot?.charges).toBe(1);
  });

  it('root and grounded block abilities that move the caster, not others', () => {
    const dash: Effect = { kind: 'dash', distance: 8, durationS: 0.2, dir: 'aim' };
    const t = createHarness({ heroes: { shrike: kit([ability({ id: 'hop', effects: [dash] })]) }, unlockAbilities: true });
    const me = t.hero('shrike', 'dawn', { x: 0, y: 0, z: 0 });
    t.ctx.stats.set(me.id, 'test', { conditions: ['grounded'] });
    t.step(1, [[me, press(Button.Ability1 | Button.Ability2)]]);
    expect(t.of('dash')).toHaveLength(0);
    expect(t.of('statMod')).toHaveLength(1);
  });

  it('a channel pulses every interval and ends on time', () => {
    const { t, me, slot } = setup(ability({ channelS: 2, channelIntervalS: 0.5, effects: [], channelEffects: [buff] }));
    t.step(1, [[me, press(Button.Ability1)]]);
    expect(me.abilities.channelling).toBe(true);
    expect(slot?.charges).toBe(0);
    t.step(119);
    expect(t.of('statMod')).toHaveLength(3);
    t.step(1);
    expect(t.of('statMod')).toHaveLength(4);
    expect(stages(t)).toEqual(['start', 'land', 'end']);
    expect(me.abilities.casting).toBeNull();
    expect(me.abilities.channelling).toBe(false);
  });

  it('a second press ends a channel early; a stun interrupts it', () => {
    const a = ability({ channelS: 2, channelIntervalS: 0.5, effects: [], channelEffects: [buff], charges: 2 });
    const { t, me } = setup(a);
    t.step(1, [[me, press(Button.Ability1)]]);
    t.step(39);
    t.step(1, [[me, press(Button.Ability1)]]);
    expect(stages(t)).toEqual(['start', 'land', 'end']);
    expect(t.of('statMod')).toHaveLength(1);
    t.step(1, [[me, press(Button.Ability1)]]);
    t.ctx.stats.set(me.id, 'test:stun', { conditions: ['stunned'] });
    t.step(1);
    expect(stages(t)).toEqual(['start', 'land', 'end', 'start', 'land', 'interrupted']);
  });

  it('death interrupts a cast and blocks new ones', () => {
    const { t, me } = setup(ability({ castS: 1 }));
    t.step(1, [[me, press(Button.Ability1)]]);
    me.health.dead = true;
    t.step(1, [[me, press(Button.Ability2)]]);
    expect(stages(t)).toEqual(['start', 'interrupted']);
  });
});

describe('progression', () => {
  const tiered = ability({
    effects: [hit],
    range: 10,
    upgrades: [
      { description: '+5 damage', values: { dmg: 5 } },
      { description: '−2 s', cooldownS: -2 },
      { description: '+1 charge, +5 m, buff', charges: 1, range: 5, effects: [buff] },
    ],
  });

  it('tiers cost 1, 2 and 5 AP, in order, and apply their deltas', () => {
    const { t, me, slot } = setup(tiered);
    me.abilities.ap = 8;
    t.step(1, [[me, { upgrade: 0 }]]);
    expect([slot?.tier, me.abilities.ap]).toEqual([1, 7]);
    t.step(1, [[me, { upgrade: 0 }]]);
    expect([slot?.tier, me.abilities.ap]).toEqual([2, 5]);
    t.step(1, [[me, { upgrade: 0 }]]);
    expect([slot?.tier, me.abilities.ap, slot?.charges]).toEqual([3, 0, 2]);
    me.abilities.ap = 9;
    t.step(1, [[me, { upgrade: 0 }]]);
    expect([slot?.tier, me.abilities.ap]).toEqual([3, 9]);
    const upgraded = t.events.flatMap((e) => (e.type === 'ability.upgraded' ? [e.tier] : []));
    expect(upgraded).toEqual([1, 2, 3]);

    t.step(1, [[me, press(Button.Ability1)]]);
    const [d] = t.of('damage');
    expect(d && t.ctx.effects.magnitude(d.effect.amount, d.cause)).toBe(15);
    expect(t.of('statMod')).toHaveLength(1);
    expect(slot?.cooldownTicks).toBe(480);
  });

  it('not enough AP buys nothing', () => {
    const { t, me, slot } = setup(tiered);
    me.abilities.ap = 2;
    t.step(1, [[me, { upgrade: 0 }]]);
    t.step(1, [[me, { upgrade: 0 }]]);
    expect([slot?.tier, me.abilities.ap]).toEqual([1, 1]);
  });

  it('upgrades work while dead', () => {
    const { t, me, slot } = setup(tiered);
    me.abilities.ap = 1;
    me.health.dead = true;
    t.step(1, [[me, { upgrade: 0 }]]);
    expect(slot?.tier).toBe(1);
  });

  it('the ultimate is locked before level 6; hero.level grants AP and unlocks it', () => {
    const { t, me } = setup(ability(), false);
    const ult = me.abilities.slots[3];
    expect(me.abilities.slots.map((s) => s.unlocked)).toEqual([true, true, true, false]);
    me.abilities.ap = 5;
    t.step(1, [[me, { pressed: Button.Ability4, upgrade: 3 }]]);
    expect([ult?.tier, me.abilities.ap, stages(t)]).toEqual([0, 5, []]);
    t.ctx.bus.emit({ type: 'hero.level', hero: me.id, level: 5, ap: 1, unlockSlot: null });
    expect([ult?.unlocked, me.abilities.ap]).toEqual([false, 6]);
    t.ctx.bus.emit({ type: 'hero.level', hero: me.id, level: 6, ap: 1, unlockSlot: 3 });
    expect([ult?.unlocked, me.abilities.ap]).toEqual([true, 7]);
    t.step(1, [[me, { pressed: Button.Ability4, upgrade: 3 }]]);
    expect([ult?.tier, me.abilities.ap, stages(t)]).toEqual([1, 6, ['start', 'land']]);
    const upgraded = t.events.flatMap((e) => (e.type === 'ability.upgraded' ? [[e.slot, e.tier]] : []));
    expect(upgraded).toEqual([[3, 0], [3, 1]]);
  });
});

describe('in a real sim', () => {
  it('casts from commands; unlockAbilities unlocks the ultimate', async () => {
    const roster = humanRoster(1, 'shrike', { bots: 1 });
    const locked = await createSim({ seed: 1, map: 'arena', roster });
    const sim = await createSim({ seed: 1, map: 'arena', roster, options: { unlockAbilities: true } });
    const me = sim.view.localHero ?? 0;
    sim.drainEvents();
    for (const s of [locked, sim]) s.step([{ hero: me, command: { ...IDLE_COMMAND, pressed: Button.Ability4 } }]);
    expect(locked.drainEvents().filter((e) => e.type === 'ability')).toHaveLength(0);
    expect(sim.drainEvents().flatMap((e) => (e.type === 'ability' ? [e.stage] : []))).toEqual(['start', 'land']);
    expect(sim.view.heroes[0]?.abilities[3]?.readyAt).toBe(1 + 90 * 60);
  });
});
