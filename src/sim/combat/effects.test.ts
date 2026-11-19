import { describe, expect, it } from 'vitest';
import { Button } from '../core/contracts';
import type { Effect, EffectCause, EffectTarget, Entity, ProjectileEffect, Vec3, WeaponModEffect } from '../core/contracts';
import { HEAL_REDUCTION, SLOW } from '../data/combat';
import { createKit } from './testkit';
import type { Kit } from './testkit';

const cause = (source: Entity | null, origin: Vec3 = { x: 0, y: 0, z: 0 }): EffectCause => ({
  source: source?.id ?? null,
  team: source?.team ?? 'neutral',
  via: 'ability',
  ability: 'test.ability',
  item: null,
  values: { dmg: 50 },
  songPower: 0,
  proc: false,
  origin,
});
const on = (e: Entity): EffectTarget => ({ entity: e.id, point: { ...e.pos }, dir: { x: 0, y: 0, z: 1 } });
const apply = (k: Kit, e: Entity, fx: Effect, c: EffectCause): void => k.ctx.effects.apply(fx, on(e), c);

describe('heal', () => {
  it('heals at once, scaled by healAmp and the strongest heal reduction, never above max', () => {
    const k = createKit();
    const h = k.hero('albatross', 'dawn', { x: 0, y: 0, z: 0 });
    h.health.hp = 300;
    apply(k, h, { kind: 'heal', amount: 100 }, cause(h));
    expect(h.health.hp).toBe(400);
    k.mod(h, 'items:amp', [['healAmp', 'add', 0.5]]);
    apply(k, h, { kind: 'heal', amount: 100 }, cause(h));
    expect(h.health.hp).toBe(550);
    apply(k, h, { kind: 'applyStatus', status: HEAL_REDUCTION, magnitude: 0.3 }, cause(null));
    apply(k, h, { kind: 'applyStatus', status: HEAL_REDUCTION, magnitude: 0.6 }, cause(null));
    apply(k, h, { kind: 'heal', amount: 100 }, cause(h));
    expect(h.health.hp).toBeCloseTo(550 + 150 * 0.4);
    apply(k, h, { kind: 'heal', amount: 1000 }, cause(h));
    expect(h.health.hp).toBe(720);
    expect(k.of('heal.applied').map((e) => e.amount)).toEqual([100, 150, 60, 110]);
  });

  it('heals over time in 0.5 s ticks', () => {
    const k = createKit();
    const h = k.hero('albatross', 'dawn', { x: 0, y: 0, z: 0 });
    h.health.hp = 300;
    h.stats.base.healthRegen = 0;
    k.ctx.stats.setBase(h.id, { ...h.stats.base, healthRegen: 0 });
    apply(k, h, { kind: 'heal', amount: 100, overS: 2 }, cause(h));
    k.step(130);
    expect(k.of('heal.applied').map((e) => e.amount)).toEqual([25, 25, 25, 25]);
    expect(h.health.hp).toBe(400);
  });
});

describe('shield', () => {
  it('expires after its duration; a recharging shield refills after rechargeS without damage', () => {
    const k = createKit();
    const h = k.hero('albatross', 'dusk', { x: 0, y: 0, z: 0 });
    apply(k, h, { kind: 'shield', absorbs: 'song', amount: 80, durationS: 1 }, cause(h));
    apply(k, h, { kind: 'shield', absorbs: 'barrier', amount: 100, rechargeS: 2 }, cause(h));
    expect(h.health).toMatchObject({ songShield: 80, barrier: 100 });
    k.step(60);
    expect(h.health).toMatchObject({ songShield: 0, barrier: 100 });
    apply(k, h, { kind: 'damage', amount: 70, type: 'talon' }, cause(null));
    k.step(1);
    expect(h.health.barrier).toBe(30);
    k.step(119);
    expect(h.health.barrier).toBe(30);
    k.step(1);
    expect(h.health.barrier).toBe(100);
  });
});

describe('statMod', () => {
  it('is a positive status that refreshes when reapplied', () => {
    const k = createKit();
    const h = k.hero('albatross', 'dawn', { x: 0, y: 0, z: 0 });
    const fx: Effect = { kind: 'statMod', id: 'test.hide', name: 'Salt Hide', stats: [{ stat: 'talonResist', op: 'stack', value: 0.3 }], durationS: 6 };
    apply(k, h, fx, cause(h));
    expect(h.stats.final.talonResist).toBeCloseTo(0.3);
    k.step(100);
    apply(k, h, fx, cause(h));
    expect(h.statuses).toHaveLength(1);
    expect(h.statuses[0]).toMatchObject({ stacks: 1, expiresAt: 100 + 360, def: { negative: false } });
    k.step(360);
    expect(h.stats.final.talonResist).toBe(0);
  });
});

describe('weaponMod', () => {
  /** Kingfisher with a mod, firing once at a dusk Albatross `dist` m ahead at body height. */
  function fireWith(mod: Partial<WeaponModEffect>, dist = 10, extra?: (k: Kit) => void) {
    const k = createKit();
    const me = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    const foe = k.hero('albatross', 'dusk', { x: 0, y: 0, z: dist }, Math.PI);
    extra?.(k);
    apply(k, me, { kind: 'weaponMod', durationS: 5, ...mod }, cause(me));
    k.aimAt(me, { x: 0, y: 1.0, z: dist });
    k.input(me, Button.Fire);
    k.step();
    return { k, me, foe, hits: k.of('damage.applied') };
  }

  it('ammoFree keeps the magazine full; reload refills at once', () => {
    const { k, me } = fireWith({ ammoFree: true });
    k.step(60);
    expect(k.of('weapon.fired').length).toBeGreaterThan(4);
    expect(me.weapon.ammo).toBe(12);
    me.weapon.ammo = 2;
    apply(k, me, { kind: 'weaponMod', durationS: 0, reload: true }, cause(me));
    expect(me.weapon.ammo).toBe(12);
  });

  it('reloadFraction adds part of a magazine, capped, and ends a reload in progress (Hop)', () => {
    const { k, me } = fireWith({});
    me.weapon.ammo = 2;
    apply(k, me, { kind: 'weaponMod', durationS: 0, reloadFraction: 0.5 }, cause(me));
    expect(me.weapon.ammo).toBe(8);
    apply(k, me, { kind: 'weaponMod', durationS: 0, reloadFraction: 0.5 }, cause(me));
    expect(me.weapon.ammo).toBe(12);
    me.weapon.ammo = 1;
    k.input(me, 0, Button.Reload);
    k.step();
    expect(me.weapon.reloading).toBe(true);
    apply(k, me, { kind: 'weaponMod', durationS: 0, reloadFraction: 0.5 }, cause(me));
    expect(me.weapon.ammo).toBe(7);
    expect(me.weapon.reloading).toBe(false);
  });

  it('gunDamage adds to the step-four gun bonus, only against its status when it names one (Heavy Rounds, Marked Prey)', () => {
    expect(fireWith({ gunDamage: 0.4 }).hits[0]?.amount).toBeCloseTo(22 * 1.4);
    expect(fireWith({ gunDamage: 0.4, onlyVsStatus: 'stunned' }).hits[0]?.amount).toBeCloseTo(22);
  });

  it('splash hits others near the impact for a fraction, without a beak shot', () => {
    let near = 0;
    const { hits } = fireWith({ splash: { radius: 1.5, fraction: 0.35 } }, 10, (k) => {
      near = k.unit('dusk', { x: 1, y: 0, z: 10 }).id;
    });
    expect(hits.map((e) => e.target)).toContain(near);
    expect(hits.find((e) => e.target === near)?.amount).toBeCloseTo(22 * 0.35);
  });

  it('bounces to the nearest other enemy within 8 m for 45%', () => {
    let near = 0;
    const { hits } = fireWith({ bounces: 1 }, 10, (k) => {
      near = k.unit('dusk', { x: 5, y: 0, z: 10 }).id;
      k.unit('dusk', { x: 30, y: 0, z: 10 });
    });
    expect(hits).toHaveLength(2);
    expect(hits[1]).toMatchObject({ target: near, beakShot: false });
    expect(hits[1]?.amount).toBeCloseTo(22 * 0.45);
  });

  it('pierce passes through that many targets', () => {
    const k = createKit();
    const me = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    const u1 = k.unit('dusk', { x: 0, y: 0, z: 6 });
    const u2 = k.unit('dusk', { x: 0, y: 0, z: 10 });
    k.aimAt(me, { x: 0, y: 0.5, z: 10 });
    k.input(me, Button.Fire);
    k.step();
    expect(k.of('damage.applied').map((e) => e.target)).toEqual([u1.id]);
    apply(k, me, { kind: 'weaponMod', durationS: 5, pierce: 1 }, cause(me));
    k.clear();
    k.step(15);
    expect(k.of('damage.applied').map((e) => e.target)).toEqual([u1.id, u2.id]);
  });

  it('ignoreFalloff, optionally only against targets with a status', () => {
    expect(fireWith({}, 60).hits[0]?.amount).toBeCloseTo(5.5);
    expect(fireWith({ ignoreFalloff: true }, 60).hits[0]?.amount).toBeCloseTo(22);
    expect(fireWith({ ignoreFalloff: true, onlyVsStatus: 'test.prey' }, 60).hits[0]?.amount).toBeCloseTo(5.5);
    const marked = fireWith({ ignoreFalloff: true, onlyVsStatus: 'test.prey' }, 60, (k) => {
      const foe = k.ctx.store.list('hero')[1];
      if (!foe) return;
      const mark = { id: 'test.prey', name: 'Marked Prey', negative: true, stacking: 'perSource' as const, maxStacks: 1, durationS: 10 };
      apply(k, foe, { kind: 'applyStatus', status: mark }, cause(null));
    });
    expect(marked.hits[0]?.amount).toBeCloseTo(22);
  });

  it('onBulletHit applies effects to each target hit; everyNth on every Nth hit', () => {
    const { k, foe } = fireWith({ onBulletHit: [{ kind: 'applyStatus', status: SLOW, magnitude: 0.15 }], everyNth: { n: 3, effects: [{ kind: 'damage', amount: 100, type: 'song' }] } });
    expect(foe.stats.final.slow).toBeCloseTo(0.15);
    k.step(40);
    const all = k.of('damage.applied');
    expect(all.map((e) => e.damageType)).toEqual(['talon', 'talon', 'talon', 'song']);
  });
});

describe('projectile (ability projectiles)', () => {
  function launch(fx: Partial<ProjectileEffect>, setup: (k: Kit) => void) {
    const k = createKit();
    const me = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    const areas: Vec3[] = [];
    k.ctx.effects.handle('area', 'abilities', (_fx, t) => areas.push(t.point));
    setup(k);
    const effect: ProjectileEffect = {
      kind: 'projectile',
      speed: 60,
      radius: 0.3,
      range: 30,
      gravity: 0,
      pierce: 'none',
      affects: { teams: 'enemies' },
      onHit: [{ kind: 'damage', amount: 'dmg', type: 'song' }],
      onExpire: [{ kind: 'area', shape: { kind: 'sphere', radius: 3 }, durationS: 0, attach: 'point', affects: { teams: 'enemies' }, effects: [] }],
      ...fx,
    };
    k.ctx.effects.apply(effect, { entity: null, point: { x: 0, y: 1, z: 30 }, dir: { x: 0, y: 0, z: 1 } }, cause(me, { x: 0, y: 1, z: 0 }));
    return { k, me, areas };
  }

  it('flies, applies onHit to the first enemy, stops there and bursts (onExpire)', () => {
    let foe = 0;
    const { k, areas } = launch({}, (kk) => {
      foe = kk.hero('albatross', 'dusk', { x: 0, y: 0, z: 10 }).id;
    });
    expect(k.ctx.store.list('projectile')[0]?.projectile).toMatchObject({ source: 'ability', ability: 'test.ability' });
    k.step(12);
    expect(k.of('damage.applied')).toMatchObject([{ target: foe, amount: 50, via: 'ability' }]);
    expect(k.of('projectile.impact')[0]).toMatchObject({ target: foe });
    expect(areas).toHaveLength(1);
    expect(areas[0]?.z).toBeCloseTo(9.2, 1);
    expect(k.ctx.store.list('projectile')).toHaveLength(0);
  });

  it("pierce 'units' passes units and stops at a hero; 'none' stops at the unit", () => {
    const ids: number[] = [];
    const hit = (pierce: ProjectileEffect['pierce']) => {
      const { k } = launch({ pierce }, (kk) => {
        ids[0] = kk.unit('dusk', { x: 0, y: 0.5, z: 5 }, 260, 1).id;
        ids[1] = kk.hero('albatross', 'dusk', { x: 0, y: 0, z: 10 }).id;
        ids[2] = kk.unit('dusk', { x: 0, y: 0.5, z: 15 }, 260, 1).id;
      });
      k.step(30);
      return k.of('damage.applied').map((e) => e.target);
    };
    expect(hit('none')).toEqual([ids[0]]);
    expect(hit('units')).toEqual([ids[0], ids[1]]);
    expect(hit('all')).toEqual([ids[0], ids[1], ids[2]]);
  });

  it('expires at range with onExpire at the end point; gravity bends it down', () => {
    const { k, areas } = launch({}, () => undefined);
    k.step(31);
    expect(areas).toHaveLength(1);
    expect(areas[0]?.z).toBeCloseTo(30);
    const lob = launch({ gravity: 10 }, () => undefined);
    lob.k.step(20);
    const p = lob.k.ctx.store.list('projectile')[0];
    // 1 m launch height − ½·10·(20/60)² ≈ 0.44 m after 20 ticks.
    expect(p?.pos.y).toBeCloseTo(1 - 0.5 * 10 * (20 / 60) ** 2, 1);
  });

  it('returns to the caster, hitting again on the way back', () => {
    const { k, me } = launch({ returns: true, maxHitsPerTarget: 2, range: 15, pierce: 'all', onExpire: [] }, (kk) => {
      kk.hero('albatross', 'dusk', { x: 0, y: 0, z: 10 });
    });
    k.step(60);
    expect(k.of('damage.applied')).toHaveLength(2);
    expect(k.ctx.store.list('projectile')).toHaveLength(0);
    expect(me.health.hp).toBe(520);
  });

  it('a beakShot-flagged hit on the head deals ×1.5', () => {
    const k = createKit();
    const me = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    k.hero('albatross', 'dusk', { x: 0, y: 0, z: 10 });
    const fx: ProjectileEffect = {
      kind: 'projectile',
      speed: 220,
      radius: 0.3,
      range: 120,
      gravity: 0,
      pierce: 'units',
      affects: { teams: 'enemies' },
      onHit: [{ kind: 'damage', amount: 100, type: 'song', beakShot: true }],
    };
    k.ctx.effects.apply(fx, { entity: null, point: { x: 0, y: 2.05, z: 10 }, dir: { x: 0, y: 0, z: 1 } }, cause(me, { x: 0, y: 2.05, z: 0 }));
    k.step(5);
    expect(k.of('damage.applied')[0]).toMatchObject({ amount: 150, beakShot: true });
    expect(k.of('projectile.impact')[0]).toMatchObject({ beakShot: true });
  });

  it("an 'allies' projectile passes enemies and lands on an ally", () => {
    let ally = 0;
    const { k } = launch({ affects: { teams: 'allies' }, onHit: [{ kind: 'heal', amount: 50 }] }, (kk) => {
      kk.hero('albatross', 'dusk', { x: 0, y: 0, z: 5 });
      const a = kk.hero('shrike', 'dawn', { x: 0, y: 0, z: 10 });
      a.health.hp = 100;
      ally = a.id;
    });
    k.step(15);
    expect(k.of('heal.applied')).toMatchObject([{ target: ally, amount: 50 }]);
  });
});
