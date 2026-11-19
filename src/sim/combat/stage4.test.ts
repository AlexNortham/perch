/**
 * Stage 4 combat (W5 follow-ups and the wave 5a framework gaps): melee on pickups, breakables, neutral damage regions,
 * melee damage taken, %HP damage, trigger hits and repeats (D-SYS-014), zero-length statuses, Rekindle (GDD §7.12)
 * and full spin (D-SYS-013).
 */
import { describe, expect, it } from 'vitest';
import { Button } from '../core/contracts';
import type { DamageEffect, EffectCause, Entity, EntityId, PickupEntity, StatusDef, Vec3 } from '../core/contracts';
import { COMBAT, STUN } from '../data/combat';
import { TICK_RATE } from '../data/core';
import { KINGFISHER, PELICAN, createKit } from './testkit';
import type { Kit } from './testkit';

const cause = (source: Entity, over: Partial<EffectCause> = {}): EffectCause => ({
  source: source.id,
  team: source.team,
  via: 'ability',
  ability: null,
  item: null,
  values: null,
  songPower: 0,
  proc: false,
  origin: { ...source.pos },
  ...over,
});
const at = (e: Entity) => ({ entity: e.id, point: { ...e.pos }, dir: { x: 0, y: 0, z: 1 } });
const hits = (k: Kit, target: EntityId) => k.of('damage.applied').filter((e) => e.target === target);
const pickup = (k: Kit, pos: Vec3, melee: 'any' | 'heavy', extra: Partial<PickupEntity['pickup']> = {}): PickupEntity =>
  k.ctx.store.spawn({
    kind: 'pickup', team: 'neutral', pos: { ...pos }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, radius: 0.5,
    pickup: { type: melee === 'any' ? 'egg' : 'rune', variant: '', value: 0, expiresAt: null, carrier: null, melee, ...extra },
  });
const swing = (k: Kit, me: Parameters<Kit['input']>[0], heavy: boolean): void => {
  if (heavy) {
    k.input(me, Button.Melee, Button.Melee);
    k.step(22);
    k.input(me, 0);
    k.step(40);
  } else {
    k.input(me, 0, Button.Melee);
    k.step(40);
  }
};

describe('melee on pickups (D-EP-039, PickupInfo.melee)', () => {
  it('a swing reports a melee pickup, damages nothing on it, and still reaches the hero behind it', () => {
    const k = createKit();
    const me = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    const foe = k.hero('albatross', 'dusk', { x: 0, y: 0, z: 2.2 }, Math.PI);
    const egg = pickup(k, { x: 0, y: 1.2, z: 1 }, 'any');
    swing(k, me, false);
    expect(k.of('melee').map((e) => e.target)).toEqual([egg.id, foe.id]);
    expect(hits(k, foe.id)).toHaveLength(1);
    expect(hits(k, egg.id)).toHaveLength(0);
  });

  it("'heavy' pickups (runes, Embers) answer only a heavy swing; carried or not yet claimable ones are skipped", () => {
    const k = createKit();
    const me = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    const rune = pickup(k, { x: 0, y: 1.2, z: 1.2 }, 'heavy');
    swing(k, me, false);
    expect(k.of('melee').map((e) => e.target), 'a light swing whiffs').toEqual([null]);
    k.clear();
    swing(k, me, true);
    expect(k.of('melee').map((e) => e.target)).toEqual([rune.id]);
    const later = pickup(k, { x: 0.2, y: 1.2, z: 1.2 }, 'any', { claimableAt: 1_000_000 });
    const carried = pickup(k, { x: -0.2, y: 1.2, z: 1.2 }, 'any', { carrier: me.id });
    k.ctx.store.despawn(rune.id);
    k.step();
    k.clear();
    swing(k, me, false);
    expect(k.of('melee').map((e) => e.target)).toEqual([null]);
    expect([later.id, carried.id]).toHaveLength(2);
  });
});

describe('breakables and neutral damage regions (GDD §§7.8, 7.9, 7.12, 7.14)', () => {
  it("breakable 'heavyMelee' (Woven Nest) ignores bullets, abilities and light melee; a heavy swing breaks it", () => {
    const k = createKit();
    const me = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    const nest = k.structure('neutral', 'nest', { x: 0, y: 0, z: 1.6 }, 50, 0.6, 1);
    (nest.structure as { breakable?: unknown }).breakable = { by: 'heavyMelee' };
    k.ctx.effects.apply({ kind: 'damage', amount: 500, type: 'talon' }, at(nest), cause(me, { via: 'weapon' }));
    k.ctx.effects.apply({ kind: 'damage', amount: 500, type: 'song' }, at(nest), cause(me));
    k.step();
    k.aimAt(me, { x: 0, y: 0.5, z: 1.6 });
    swing(k, me, false);
    expect(nest.health.hp).toBe(50);
    swing(k, me, true);
    expect(k.of('melee').map((e) => [e.heavy, e.target])).toEqual([[false, nest.id], [true, nest.id]]);
    expect(nest.health.dead).toBe(true);
  });

  it("breakable 'melee' with light/heavy amounts (Bell Feeder): 60 and 120 whatever the hero's stats; guns do nothing", () => {
    const k = createKit();
    const me = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    k.mod(me, 'big', [['meleeDamage', 'add', 400]]);
    const feeder = k.structure('neutral', 'nest', { x: 0, y: 0, z: 1.6 }, 480, 0.6, 2);
    (feeder.structure as { breakable?: unknown }).breakable = { by: 'melee', light: 60, heavy: 120 };
    k.ctx.effects.apply({ kind: 'damage', amount: 500, type: 'talon' }, at(feeder), cause(me, { via: 'weapon' }));
    k.step();
    swing(k, me, false);
    swing(k, me, true);
    expect(hits(k, feeder.id).map((e) => e.amount)).toEqual([60, 120]);
  });

  it('UnitInfo.damageFrom: a hit counts only while its credited hero stands inside the region (cut off above maxY)', () => {
    const k = createKit();
    const me = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    const roc = k.unit('neutral', { x: 0, y: -4, z: 20 }, 1000);
    (roc.unit as { damageFrom?: unknown }).damageFrom = { centre: { x: 0, y: -4, z: 20 }, radius: 15, maxY: -2 };
    const hit = () => k.ctx.effects.apply({ kind: 'damage', amount: 10, type: 'talon' }, at(roc), cause(me, { via: 'weapon' }));
    hit();
    k.step();
    expect(hits(k, roc.id), 'outside: above the cut-off').toHaveLength(0);
    me.pos.y = -4;
    me.pos.z = 10;
    hit();
    k.step();
    expect(hits(k, roc.id)).toHaveLength(1);
    me.pos.z = -30;
    hit();
    k.step();
    expect(hits(k, roc.id), 'outside: too far').toHaveLength(1);
  });
});

describe('damage pipeline additions', () => {
  it('meleeDamageTaken is step 5 for light and heavy melee only; "+x% melee damage" is pct on meleeDamage', () => {
    const k = createKit({ heroes: { kingfisher: { def: { ...KINGFISHER.def, stats: { ...KINGFISHER.def.stats, meleeDamage: 50 } } } } });
    const me = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    const foe = k.hero('albatross', 'dusk', { x: 0, y: 0, z: 2 }, Math.PI);
    k.mod(foe, 'bark', [['meleeDamageTaken', 'add', -0.3]]);
    swing(k, me, false);
    k.ctx.effects.apply({ kind: 'damage', amount: 50, type: 'talon' }, at(foe), cause(me, { via: 'weapon' }));
    k.step();
    expect(hits(k, foe.id).map((e) => e.amount)).toEqual([35, 50]);
    k.clear();
    k.mod(me, 'spur', [['meleeDamage', 'pct', 0.2]]);
    swing(k, me, false);
    expect(hits(k, foe.id)[0]?.amount).toBeCloseTo(me.stats.final.meleeDamage * 0.7, 6);
  });

  it('currentHpPct and maxHpPct add shares of the target\'s hp when the hit resolves', () => {
    const k = createKit();
    const me = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    const foe = k.hero('albatross', 'dusk', { x: 0, y: 0, z: 10 });
    foe.health.hp = 400;
    const max = foe.stats.final.maxHealth;
    k.ctx.effects.apply({ kind: 'damage', amount: 0, type: 'talon', currentHpPct: 0.1 }, at(foe), cause(me));
    k.step();
    k.ctx.effects.apply({ kind: 'damage', amount: 5, type: 'talon', maxHpPct: 0.02 }, at(foe), cause(me));
    k.step();
    expect(hits(k, foe.id).map((e) => e.amount)).toEqual([40, 5 + 0.02 * max]);
  });

  it('a resolved duration ≤ 0 applies nothing (applyStatus and statMod), so a tier can switch a status on', () => {
    const k = createKit();
    const me = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    k.ctx.effects.apply({ kind: 'applyStatus', status: STUN, durationS: 0 }, at(me), cause(me));
    k.ctx.effects.apply({ kind: 'statMod', id: 'test', name: 'Test', stats: [{ stat: 'gunDamage', op: 'add', value: 1 }], durationS: 'off' }, at(me), cause(me, { values: { off: 0 } }));
    k.step();
    expect(me.statuses).toEqual([]);
    expect(k.of('status.applied')).toEqual([]);
  });
});

describe('trigger hits (DamageEffect.triggerPct, D-SYS-014)', () => {
  /** A Dawn hero `holder` and a Dusk `foe` 10 m apart, with 20% Song resist on both. */
  function duel() {
    const k = createKit();
    const holder = k.hero('albatross', 'dawn', { x: 0, y: 0, z: 0 });
    const foe = k.hero('kingfisher', 'dusk', { x: 0, y: 0, z: 10 });
    for (const h of [holder, foe]) k.mod(h, 'resist', [['songResist', 'stack', 0.2], ['talonResist', 'stack', 0.5]]);
    return { k, holder, foe };
  }
  const thorns: DamageEffect = { kind: 'damage', amount: 0, type: 'song', triggerPct: 0.2 };

  it('on another entity it is a new hit worth that share of the triggering hit before its target\'s resists (Bristle, Burr Coat)', () => {
    const { k, holder, foe } = duel();
    k.ctx.bus.on('damage.applied', (e) => {
      if (e.target === holder.id && !e.proc) k.ctx.effects.apply(thorns, at(foe), cause(holder, { proc: true }));
    });
    k.ctx.effects.apply({ kind: 'damage', amount: 100, type: 'talon' }, at(holder), cause(foe, { via: 'weapon' }));
    k.step();
    expect(hits(k, holder.id)[0]?.amount).toBeCloseTo(50, 6);
    expect(hits(k, foe.id)[0]?.amount, '20% of 100, then the foe\'s 20% Song resist').toBeCloseTo(16, 6);
  });

  it('on the triggering hit\'s own target it repeats that hit, resisted once (Crescendo)', () => {
    const { k, holder, foe } = duel();
    k.ctx.bus.on('damage.applied', (e) => {
      if (e.target === foe.id && !e.proc) k.ctx.effects.apply(thorns, at(foe), cause(holder, { proc: true, via: 'item' }));
    });
    k.ctx.effects.apply({ kind: 'damage', amount: 100, type: 'song' }, at(foe), cause(holder));
    k.step();
    expect(hits(k, foe.id).map((e) => e.amount)).toEqual([80, 16]);
  });

  it('a status applied while the hit is reported binds it: triggerPct in its onExpire repeats it later (Echo Chamber)', () => {
    const { k, holder, foe } = duel();
    const echo: StatusDef = {
      id: 'echo', name: 'Echo', negative: false, stacking: 'independent', maxStacks: 1, durationS: 1,
      onExpire: [{ kind: 'damage', amount: 0, type: 'song', triggerPct: 0.25 }],
    };
    k.ctx.bus.on('damage.applied', (e) => {
      if (e.target === foe.id && !e.proc) k.ctx.effects.apply({ kind: 'applyStatus', status: echo }, at(foe), cause(holder, { proc: true, via: 'item' }));
    });
    k.ctx.effects.apply({ kind: 'damage', amount: 100, type: 'song' }, at(foe), cause(holder));
    k.step();
    k.mod(foe, 'resist', [['songResist', 'stack', 0.6]]);
    k.step(TICK_RATE + 1);
    expect(hits(k, foe.id).map((e) => e.amount), '25% of the 80 dealt, whatever the resist is now').toEqual([80, 20]);
  });
});

describe('Rekindle (GDD §7.12)', () => {
  it('a hero who dies while its flock holds a charge revives where it fell 3 s later at full HP, once per buff', () => {
    const k = createKit();
    const me = k.hero('kingfisher', 'dawn', { x: 5, y: 2, z: 7 });
    const foe = k.hero('albatross', 'dusk', { x: 0, y: 0, z: 0 });
    k.ctx.teams.dawn.rekindle = { until: 100 * TICK_RATE, charges: 2 };
    const kill = () => {
      k.ctx.effects.apply({ kind: 'damage', amount: 10_000, type: 'talon' }, at(me), cause(foe, { via: 'weapon' }));
      k.step();
    };
    kill();
    expect(k.of('entity.died')[0]).toMatchObject({ victim: me.id, revives: true });
    expect(me.health.respawnAt).toBe(k.ctx.clock.tick + COMBAT.reviveS * TICK_RATE);
    k.step(COMBAT.reviveS * TICK_RATE);
    expect(k.of('hero.respawned')).toEqual([{ type: 'hero.respawned', hero: me.id, pos: { x: 5, y: 2, z: 7 }, revived: true }]);
    expect(me.health.hp).toBe(me.stats.final.maxHealth);
    k.clear();
    kill();
    expect(k.of('entity.died')[0]?.revives, 'once per hero under one buff').toBeUndefined();
    expect(me.health.respawnAt).toBeGreaterThan(k.ctx.clock.tick + COMBAT.reviveS * TICK_RATE);
  });

  it('no charge, or the buff over: an ordinary death', () => {
    const k = createKit();
    const me = k.hero('kingfisher', 'dawn', { x: 5, y: 2, z: 7 });
    k.ctx.teams.dawn.rekindle = { until: 100 * TICK_RATE, charges: 0 };
    k.ctx.effects.apply({ kind: 'damage', amount: 10_000, type: 'talon' }, at(me), cause(me, { via: 'weapon' }));
    k.step();
    expect(k.of('entity.died')[0]?.revives).toBeUndefined();
  });
});

describe('spin-up (GDD §9.19, D-SYS-013)', () => {
  const drum = { def: { ...PELICAN.def, weapon: { ...PELICAN.def.weapon, spreadDeg: 0, fireRate: 14, spinUp: { fromRate: 6, seconds: 1.5 } } } };

  it('a status with id COMBAT.fullSpinStatus spins the gun up at once and holds it while it lasts', () => {
    const k = createKit({ heroes: { pelican: drum } });
    const me = k.hero('pelican', 'dawn', { x: 0, y: 0, z: 0 });
    me.weapon.ammo = 200;
    const spin = { kind: 'statMod', id: COMBAT.fullSpinStatus, name: 'Drumroll', stats: [], durationS: 3 } as const;
    k.ctx.effects.apply(spin, at(me), cause(me));
    k.input(me, Button.Fire);
    k.step(60);
    expect(Math.abs(k.of('weapon.fired').length - 14)).toBeLessThanOrEqual(1);
    k.input(me, 0);
    k.step(60);
    k.clear();
    k.input(me, Button.Fire);
    k.step(30);
    expect(Math.abs(k.of('weapon.fired').length - 7), 'no spin-down while it lasts').toBeLessThanOrEqual(1);
  });
});
