import { describe, expect, it } from 'vitest';
import { Button } from '../core/contracts';
import type { DamageEffect, DamageType, EffectCause, EffectVia, Entity, HeroEntity, StatusDef } from '../core/contracts';
import { respawnSeconds } from './damage';
import { createKit } from './testkit';
import type { Kit } from './testkit';

const cause = (source: Entity | null, via: EffectVia = 'ability', over: Partial<EffectCause> = {}): EffectCause => ({
  source: source?.id ?? null,
  team: source?.team ?? 'neutral',
  via,
  ability: via === 'ability' ? 'test.ability' : null,
  item: null,
  values: null,
  songPower: 0,
  proc: false,
  origin: { ...(source?.pos ?? { x: 0, y: 0, z: 0 }) },
  ...over,
});

const hit = (
  k: Kit,
  target: Entity,
  amount: number,
  type: DamageType,
  c: EffectCause,
  extra: Partial<DamageEffect> = {},
): void => {
  k.ctx.effects.apply({ kind: 'damage', amount, type, ...extra }, { entity: target.id, point: { ...target.pos }, dir: { x: 0, y: 0, z: 1 } }, c);
};

/** A dawn attacker and a dusk victim, both heroes, 10 m apart. */
function duel() {
  const k = createKit();
  const a = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
  const v = k.hero('albatross', 'dusk', { x: 0, y: 0, z: 10 }, Math.PI);
  return { k, a, v };
}

const last = (k: Kit) => k.of('damage.applied').at(-1);

describe('damage pipeline (GDD §5.2)', () => {
  it('queues requests and resolves them in the damage phase, in arrival order', () => {
    const { k, a, v } = duel();
    hit(k, v, 10, 'song', cause(a));
    hit(k, v, 20, 'talon', cause(a));
    expect(k.of('damage.applied')).toHaveLength(0);
    k.step();
    expect(k.of('damage.applied').map((e) => [e.amount, e.damageType])).toEqual([[10, 'song'], [20, 'talon']]);
    expect(v.health.hp).toBeCloseTo(720 - 30 + 2 / 60);
  });

  it('step 1: adds the missing-hp part to the base', () => {
    const { k, a, v } = duel();
    v.health.hp = 360;
    hit(k, v, 100, 'song', cause(a), { missingHpPct: 0.1 });
    k.step();
    expect(last(k)?.amount).toBeCloseTo(136);
  });

  it('step 4: gun % only for guns, Song % for Song, conditional bonuses add within the step', () => {
    const { k, a, v } = duel();
    k.mod(a, 'items:a', [['gunDamage', 'add', 0.3], ['songDamage', 'add', 0.2]]);
    hit(k, v, 100, 'song', cause(a), { bonus: [{ mult: 1.5, targetKinds: ['hero'] }, { mult: 2, targetHpBelow: 0.5 }] });
    hit(k, v, 100, 'talon', cause(a));
    hit(k, v, 100, 'talon', cause(a, 'weapon'));
    hit(k, v, 100, 'talon', cause(a), { bonus: [{ mult: 1.25, maxDistance: 5 }, { mult: 1.25, minDistance: 5 }] });
    k.step();
    expect(k.of('damage.applied').map((e) => e.amount)).toEqual([170, 100, 130, 125]);
  });

  it('step 5: incoming amplification adds up and caps at +50%', () => {
    const { k, a, v } = duel();
    k.mod(v, 'status:1', [['talonAmp', 'add', 0.3]]);
    k.mod(v, 'status:2', [['talonAmp', 'add', 0.4]]);
    hit(k, v, 100, 'talon', cause(a));
    hit(k, v, 100, 'song', cause(a));
    k.step();
    expect(k.of('damage.applied').map((e) => e.amount)).toEqual([150, 100]);
  });

  it('step 6: resists stack multiplicatively, shred subtracts after, clamped to [−50%, 85%]', () => {
    const { k, a, v } = duel();
    k.mod(v, 'items:1', [['talonResist', 'stack', 0.2]]);
    k.mod(v, 'items:2', [['talonResist', 'stack', 0.2]]);
    hit(k, v, 100, 'talon', cause(a));
    k.step();
    expect(last(k)?.amount).toBeCloseTo(64);
    k.mod(v, 'status:shred', [['talonShred', 'add', 0.1]]);
    hit(k, v, 100, 'talon', cause(a));
    k.step();
    expect(last(k)?.amount).toBeCloseTo(74); // 36% − 10% shred
    k.mod(v, 'items:3', [['talonResist', 'stack', 0.95]]);
    k.ctx.stats.set(v.id, 'status:shred', null);
    hit(k, v, 100, 'talon', cause(a));
    k.step();
    expect(last(k)?.amount).toBeCloseTo(15);
    const d2 = duel();
    d2.k.mod(d2.v, 'status:shred', [['songShred', 'add', 0.8]]);
    hit(d2.k, d2.v, 100, 'song', cause(d2.a));
    d2.k.step();
    expect(last(d2.k)?.amount).toBeCloseTo(150);
  });

  it('applies amplification, then resist, then shields', () => {
    const { k, a, v } = duel();
    k.mod(v, 'status:amp', [['talonAmp', 'add', 0.5]]);
    k.mod(v, 'items:res', [['talonResist', 'stack', 0.5]]);
    k.ctx.effects.apply({ kind: 'shield', absorbs: 'talon', amount: 30 }, { entity: v.id, point: v.pos, dir: v.pos }, cause(v));
    k.ctx.effects.apply({ kind: 'shield', absorbs: 'barrier', amount: 50 }, { entity: v.id, point: v.pos, dir: v.pos }, cause(v));
    expect(v.health).toMatchObject({ talonShield: 30, barrier: 50 });
    hit(k, v, 100, 'talon', cause(a));
    k.step();
    expect(last(k)).toMatchObject({ amount: 75, absorbed: 75 });
    expect(v.health).toMatchObject({ talonShield: 0, barrier: 5 });
    expect(v.health.hp).toBe(720);
    hit(k, v, 100, 'talon', cause(a));
    k.step();
    expect(last(k)).toMatchObject({ amount: 75, absorbed: 5 });
    expect(v.health.hp).toBeCloseTo(720 - 70 + 2 / 60);
  });

  it('step 8: Song skips Talon shields; barriers drain oldest first', () => {
    const { k, a, v } = duel();
    const shield = (absorbs: 'talon' | 'barrier', amount: number) =>
      k.ctx.effects.apply({ kind: 'shield', absorbs, amount }, { entity: v.id, point: v.pos, dir: v.pos }, cause(v));
    shield('talon', 40);
    shield('barrier', 30);
    shield('barrier', 30);
    hit(k, v, 45, 'song', cause(a));
    k.step();
    expect(v.health).toMatchObject({ talonShield: 40, barrier: 15 });
    expect(last(k)).toMatchObject({ amount: 45, absorbed: 45 });
  });

  it('step 7: structure rules — Brood Ward, invulnerable, melee and Song halved, no areas or DoTs, weak point', () => {
    const k = createKit();
    const a = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    const s = k.structure('dusk', 'hawk', { x: 0, y: 0, z: 20 }, 4500, 2, 10);
    for (const via of ['ability', 'melee', 'area', 'status'] as const) hit(k, s, 100, 'talon', cause(a, via));
    hit(k, s, 100, 'song', cause(a));
    k.step();
    expect(k.of('damage.applied').map((e) => [e.via, e.amount])).toEqual([['ability', 100], ['melee', 50], ['ability', 50]]);
    k.clear();
    k.mod(s, 'world:broodWard', [['damageTaken', 'mul', 0.35]]);
    hit(k, s, 100, 'talon', cause(a));
    k.step();
    expect(last(k)?.amount).toBeCloseTo(35);
    k.clear();
    k.ctx.stats.set(s.id, 'world:gate', { conditions: ['invulnerable'] });
    hit(k, s, 100, 'talon', cause(a));
    k.step();
    expect(k.of('damage.applied')).toHaveLength(0);
    expect(s.health.hp).toBeCloseTo(4500 - 100 - 50 - 50 - 35);
  });

  it('a gun hit on the Patron weak point deals ×1.5 and is flagged, never a beak shot', () => {
    const k = createKit();
    const me = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    const p = k.structure('dusk', 'patron', { x: 0, y: 0, z: 18 }, 20000, 3, 12);
    p.structure.weakPoint = { centre: { x: 0, y: 6, z: 15.5 }, radius: 1 };
    k.aimAt(me, { x: 0, y: 6, z: 15.5 });
    k.input(me, Button.Fire);
    k.step();
    expect(last(k)).toMatchObject({ target: p.id, weakPoint: true, beakShot: false });
    expect(last(k)?.amount).toBeCloseTo(22 * 1.5);
  });

  it('step 9: undying floors at 1, onLethal saves the holder, intangible takes nothing, execute kills', () => {
    const { k, a, v } = duel();
    k.ctx.stats.set(v.id, 'status:x', { conditions: ['undying'] });
    hit(k, v, 5000, 'song', cause(a));
    k.step();
    expect(v.health.hp).toBeCloseTo(1 + 2 / 60);
    expect(v.health.dead).toBe(false);
    k.ctx.stats.set(v.id, 'status:x', { conditions: ['intangible'] });
    hit(k, v, 5000, 'song', cause(a));
    k.clear();
    k.step();
    expect(k.of('damage.applied')).toHaveLength(0);
    k.ctx.stats.set(v.id, 'status:x', null);

    const save: StatusDef = {
      id: 'test.save',
      name: 'Last stand',
      negative: false,
      stacking: 'max',
      maxStacks: 1,
      durationS: 10,
      onLethal: [{ kind: 'heal', amount: 100 }],
    };
    k.ctx.effects.apply({ kind: 'applyStatus', status: save }, { entity: v.id, point: v.pos, dir: v.pos }, cause(v));
    hit(k, v, 5000, 'song', cause(a));
    k.step();
    expect(v.health.dead).toBe(false);
    expect(v.health.hp).toBeCloseTo(101 + 2 / 60);
    expect(v.statuses).toHaveLength(0);

    v.health.hp = 300;
    hit(k, v, 100, 'song', cause(a), { executeBelow: 0.3 });
    k.step();
    expect(last(k)).toMatchObject({ lethal: true });
    expect(v.health.dead).toBe(true);
  });

  it('step 9: lifesteal heals the source for its share of post-step-7 damage, half against non-heroes', () => {
    const k = createKit();
    const a = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    const v = k.hero('albatross', 'dusk', { x: 0, y: 0, z: 10 });
    const u = k.unit('dusk', { x: 2, y: 0, z: 10 }, 1000);
    k.mod(a, 'items:ls', [['talonLifesteal', 'add', 0.2]]);
    a.health.hp = 300;
    hit(k, v, 100, 'talon', cause(a, 'weapon'));
    hit(k, u, 100, 'talon', cause(a, 'weapon'));
    hit(k, u, 100, 'song', cause(a));
    k.step();
    expect(k.of('heal.applied').map((e) => [e.source, e.target, e.amount])).toEqual([[a.id, a.id, 20], [a.id, a.id, 10]]);
    expect(a.health.hp).toBeCloseTo(330 + 2 / 60);
  });

  it('puts both heroes in combat for 4 s', () => {
    const { k, a, v } = duel();
    hit(k, v, 10, 'talon', cause(a, 'weapon'));
    k.step();
    expect(v.health.inCombatUntil).toBe(1 + 240);
    expect(a.health.inCombatUntil).toBe(1 + 240);
  });
});

describe('kill credit and assists', () => {
  it('credits the killer; assists go to recent damagers and their supporters within 12 s', () => {
    const k = createKit();
    const killer = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    const helper = k.hero('shrike', 'dawn', { x: 2, y: 0, z: 0 });
    const old = k.hero('owl', 'dawn', { x: 4, y: 0, z: 0 });
    const support = k.hero('lyrebird', 'dawn', { x: 6, y: 0, z: 0 });
    const v = k.hero('albatross', 'dusk', { x: 0, y: 0, z: 10 });
    hit(k, v, 10, 'talon', cause(old, 'weapon'));
    k.step(13 * 60);
    hit(k, v, 10, 'talon', cause(helper, 'weapon'));
    k.ctx.effects.apply({ kind: 'shield', absorbs: 'barrier', amount: 50 }, { entity: helper.id, point: helper.pos, dir: helper.pos }, cause(support));
    k.step(60);
    hit(k, v, 5000, 'song', cause(killer));
    k.step();
    const died = k.of('entity.died')[0];
    expect(died).toMatchObject({
      victim: v.id,
      victimKind: 'hero',
      victimTeam: 'dusk',
      victimType: 'albatross',
      killer: killer.id,
      creditHero: killer.id,
      assisters: [helper.id, support.id],
      via: 'ability',
    });
  });

  it('credits the owner of a killing summon', () => {
    const k = createKit();
    const owner = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    const turret = k.unit('dawn', { x: 1, y: 0, z: 0 }, 300, 1, owner.id);
    const v = k.hero('albatross', 'dusk', { x: 0, y: 0, z: 10 });
    hit(k, v, 5000, 'talon', cause(turret, 'unit'));
    k.step();
    expect(k.of('entity.died')[0]).toMatchObject({ killer: turret.id, creditHero: owner.id, assisters: [] });
  });

  it('despawns dead units and reports their type', () => {
    const k = createKit();
    const a = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    const u = k.unit('dusk', { x: 0, y: 0, z: 5 }, 100);
    hit(k, u, 150, 'talon', cause(a, 'weapon'));
    k.step();
    expect(k.of('entity.died')[0]).toMatchObject({ victim: u.id, victimType: 'scrapper', creditHero: a.id, assisters: [] });
    expect(k.ctx.store.get(u.id)).toBeUndefined();
  });
});

describe('death and respawn (GDD §8.9)', () => {
  it('respawn time = min(55, 8 + 1.2 × minutes), rounded to 0.1 s, halved by the Ember', () => {
    expect(respawnSeconds(0, false)).toBe(8);
    expect(respawnSeconds(600, false)).toBeCloseTo(20);
    expect(respawnSeconds(1200, false)).toBeCloseTo(32);
    expect(respawnSeconds(10 * 60 + 30, false)).toBeCloseTo(20.6);
    expect(respawnSeconds(2350, false)).toBe(55);
    expect(respawnSeconds(600, true)).toBeCloseTo(10);
  });

  const killAt = (seconds: number, ember: boolean) => {
    const k = createKit();
    const a = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    const v = k.hero('albatross', 'dusk', { x: 3, y: 0, z: 12 });
    k.at(seconds);
    if (ember) k.ctx.teams.dusk.emberUntil = k.ctx.clock.tick + 100_000;
    v.pos.x = 30;
    v.weapon.ammo = 1;
    k.ctx.effects.apply({ kind: 'applyStatus', status: { id: 'x', name: 'x', negative: true, stacking: 'max', maxStacks: 1, durationS: 30 } }, { entity: v.id, point: v.pos, dir: v.pos }, cause(a));
    hit(k, v, 5000, 'talon', cause(a, 'weapon'));
    k.step();
    return { k, v, diedAt: k.ctx.clock.tick };
  };

  it('a dead hero waits its respawn time, then respawns at its Home Roost with full HP and magazine', () => {
    for (const [minutes, ember, expectS] of [[0, false, 8], [10, false, 20], [20, false, 32], [10, true, 10]] as const) {
      const { k, v, diedAt } = killAt(minutes * 60, ember);
      expect(v.health.dead).toBe(true);
      expect(v.health.respawnAt).toBe(diedAt + expectS * 60);
      expect(k.of('status.ended')).toEqual([{ type: 'status.ended', target: v.id, status: 'x', reason: 'death' }]);
      k.step(expectS * 60 - 1);
      expect(v.health.dead).toBe(true);
      k.step(1);
      expect(v.health).toMatchObject({ dead: false, respawnAt: null, hp: 720 });
      expect(v.weapon.ammo).toBe(6);
      expect(v.pos).toEqual({ x: 3, y: 0, z: 12 });
      expect(k.of('hero.respawned')).toEqual([{ type: 'hero.respawned', hero: v.id, pos: { x: 3, y: 0, z: 12 } }]);
    }
  });

  it('a dead hero cannot be damaged, fire or be healed', () => {
    const { k, v } = killAt(0, false);
    const before = k.of('damage.applied').length;
    hit(k, v, 10, 'talon', cause(null, 'objective'));
    k.input(v, Button.Fire);
    k.step(5);
    expect(k.of('damage.applied')).toHaveLength(before);
    expect(k.of('weapon.fired')).toHaveLength(0);
    expect(v.health.hp).toBe(0);
  });
});

describe('heal on level-up (GDD §8.6)', () => {
  it('heals by the max-HP gain whether Molts land before or after the event', () => {
    const k = createKit();
    const h: HeroEntity = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    h.health.hp = 400;
    k.mod(h, 'economy:molts', [['maxHealth', 'add', 30]]);
    k.ctx.bus.emit({ type: 'hero.level', hero: h.id, level: 2, ap: 1, unlockSlot: null });
    expect(h.health.hp).toBe(430);
    // Full HP, event first, Molts after: the heal waits for the max-HP growth.
    h.health.hp = 550;
    k.ctx.bus.emit({ type: 'hero.level', hero: h.id, level: 3, ap: 1, unlockSlot: null });
    expect(h.health.hp).toBe(550);
    k.mod(h, 'economy:molts', [['maxHealth', 'add', 60]]);
    k.step();
    expect(h.health.hp).toBe(580);
    expect(k.of('heal.applied').map((e) => e.amount)).toEqual([30, 30]);
  });
});
