/**
 * Wave 3 contract follow-ups for sim/combat (docs/briefs/W3-contract-followups.md, Combat 1–9), plus the pod aim fix.
 */
import { describe, expect, it } from 'vitest';
import { Button } from '../core/contracts';
import type { DamageEffect, EffectCause, Entity, HeroEntity, Team, UnitEntity, Vec3 } from '../core/contracts';
import { ALBATROSS, KINGFISHER, createKit } from './testkit';
import type { Kit } from './testkit';

const cause = (source: Entity, values: Record<string, number> = {}): EffectCause => ({
  source: source.id,
  team: source.team,
  via: 'ability',
  ability: 'test.ability',
  item: null,
  values,
  songPower: 0,
  proc: false,
  origin: { ...source.pos },
});

/** A Gale Shield–style wall: width 6, height 3, depth 0.4, standing on `pos`, turned by `yaw`. */
const wall = (k: Kit, team: Team, pos: Vec3, yaw: number): UnitEntity =>
  k.ctx.store.spawn({
    kind: 'unit',
    team,
    pos: { ...pos },
    vel: { x: 0, y: 0, z: 0 },
    yaw,
    radius: 3,
    unit: { type: 'summon', lane: null, height: 3, size: { x: 6, y: 3, z: 0.4 }, owner: null, summon: 'wall', target: null, attacking: false },
    health: { hp: 400, talonShield: 0, songShield: 0, barrier: 0, dead: false, respawnAt: null, inCombatUntil: 0 },
    stats: k.ctx.stats.create({ maxHealth: 400 }),
    statuses: [],
  });

/** One trigger pull at `point` from a hero at the origin facing +z. */
const fireAt = (k: Kit, me: HeroEntity, point: Vec3, ticks = 1): void => {
  k.aimAt(me, point);
  k.input(me, Button.Fire);
  k.step(ticks);
  k.input(me, 0);
};

describe('bullets (Combat 1, 2)', () => {
  it('projectile.impact carries the cause’s via: weapon for gun bullets, ability for ability projectiles', () => {
    const k = createKit();
    const me = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    k.hero('albatross', 'dusk', { x: 0, y: 0, z: 10 }, Math.PI);
    fireAt(k, me, { x: 0, y: 1, z: 10 });
    expect(k.of('projectile.impact').map((e) => e.via)).toEqual(['weapon']);
    k.clear();
    k.ctx.effects.apply(
      { kind: 'projectile', speed: 100, radius: 0.3, range: 30, gravity: 0, pierce: 'none', affects: { teams: 'enemies' }, onHit: [] },
      { entity: null, point: { x: 0, y: 1, z: 10 }, dir: { x: 0, y: 0, z: 1 } },
      { ...cause(me), origin: { x: 0, y: 1, z: 0 } },
    );
    k.step(10);
    expect(k.of('projectile.impact').map((e) => e.via)).toEqual(['ability']);
  });

  it('WeaponDef.projectileRadius sizes gun bullets (Echo Lute 0.25 m); the default stays 0.06 m', () => {
    const k = createKit();
    const lute = k.hero('lyrebird', 'dawn', { x: 0, y: 0, z: 0 });
    const rifle = k.hero('shrike', 'dawn', { x: 5, y: 0, z: 0 });
    k.input(lute, Button.Fire);
    k.input(rifle, Button.Fire);
    k.step();
    const radii = k.ctx.store.list('projectile').map((p) => [p.projectile.owner, p.radius]);
    expect(radii).toEqual([
      [lute.id, 0.25],
      [rifle.id, 0.06],
    ]);
  });

  it('WeaponDef.perRoundStartS delays the first shell (0.6 s here instead of 0.3 s)', () => {
    const slow = { def: { ...ALBATROSS.def, weapon: { ...ALBATROSS.def.weapon, perRoundStartS: 0.6 } } };
    const k = createKit({ heroes: { albatross: slow } });
    const me = k.hero('albatross', 'dawn', { x: 0, y: 0, z: 0 });
    k.input(me, Button.Fire);
    k.step(1);
    k.input(me, 0);
    k.step(9);
    k.input(me, 0, Button.Reload); // tick 11: first shell at 11 + (0.6 + 0.45) s = tick 74
    k.step(63);
    expect(me.weapon.ammo).toBe(5);
    k.step(1);
    expect(me.weapon.ammo).toBe(6);
  });
});

describe('aim point on seed pods (EP, Economy D-ECON-001)', () => {
  it('a crosshair on a pod 6 m away converges the bullet on it', () => {
    const exact = { def: { ...KINGFISHER.def, weapon: { ...KINGFISHER.def.weapon, spreadDeg: 0 } } };
    const k = createKit({ heroes: { kingfisher: exact } });
    const me = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    const pod = k.pod('neutral', { x: 0, y: 0.6, z: 6 });
    fireAt(k, me, pod.pos);
    expect(k.of('projectile.impact').map((e) => e.target)).toEqual([pod.id]);
    // The shot line passes through the pod centre (it used to pass ~0.75 m beside it, aimed at the far end of the ray).
    const shot = k.of('weapon.fired')[0];
    if (!shot) throw new Error('no shot');
    const v = { x: pod.pos.x - shot.muzzle.x, y: pod.pos.y - shot.muzzle.y, z: pod.pos.z - shot.muzzle.z };
    const along = v.x * shot.dir.x + v.y * shot.dir.y + v.z * shot.dir.z;
    const miss = Math.hypot(v.x - shot.dir.x * along, v.y - shot.dir.y * along, v.z - shot.dir.z * along);
    expect(miss).toBeLessThan(pod.radius);
  });
});

describe('wall hitboxes (Combat 3, UnitInfo.size)', () => {
  it('an enemy wall stops hitscan and projectile bullets; turned edge-on it misses; an allied wall is passed', () => {
    for (const hero of ['kingfisher', 'shrike'] as const) {
      const k = createKit();
      const me = k.hero(hero, 'dawn', { x: 0, y: 0, z: 0 });
      const foe = k.hero('albatross', 'dusk', { x: 0, y: 0, z: 12 }, Math.PI);
      const w = wall(k, 'dusk', { x: 0, y: 0, z: 6 }, 0);
      fireAt(k, me, { x: 0, y: 1, z: 12 }, 10);
      const hits = k.of('damage.applied');
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.every((e) => e.target === w.id)).toBe(true);
      expect(foe.health.hp).toBe(720);
    }
    // Edge-on (yaw π/2: 0.4 m thick along x, at x = 1.5) the same shot passes beside it.
    const k = createKit();
    const me = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    const foe = k.hero('albatross', 'dusk', { x: 0, y: 0, z: 12 }, Math.PI);
    wall(k, 'dusk', { x: 1.5, y: 0, z: 6 }, Math.PI / 2);
    fireAt(k, me, { x: 0, y: 1, z: 12 });
    expect(k.of('damage.applied').map((e) => e.target)).toEqual([foe.id]);
    // An allied wall never stops its own team's shots.
    const a = createKit();
    const me2 = a.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    const foe2 = a.hero('albatross', 'dusk', { x: 0, y: 0, z: 12 }, Math.PI);
    wall(a, 'dawn', { x: 0, y: 0, z: 6 }, 0);
    fireAt(a, me2, { x: 0, y: 1, z: 12 });
    expect(a.of('damage.applied').map((e) => e.target)).toEqual([foe2.id]);
  });
});

describe('damage effect fields (Combat 4, 6)', () => {
  it('missingHpPct, executeBelow and targetHpBelow resolve through ctx.effects.magnitude (value names work)', () => {
    const k = createKit();
    const me = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    const foe = k.hero('albatross', 'dusk', { x: 0, y: 0, z: 5 });
    k.mod(foe, 'test:noRegen', [['healthRegen', 'add', -2]]);
    // D-ARCH-015: the fields are numbers until W3.5 widens them; a value name must already resolve.
    const name = (n: string) => n as unknown as number;
    const fx: DamageEffect = {
      kind: 'damage',
      amount: 100,
      type: 'song',
      missingHpPct: name('mhp'),
      bonus: [{ mult: 1.5, targetHpBelow: name('below') }],
    };
    const c = cause(me, { mhp: 0.12, below: 0.5, exe: 0.3 });
    foe.health.hp = 420; // missing 300 → +36; 420 < 0.5 × 720 is false → no bonus
    k.ctx.effects.apply(fx, { entity: foe.id, point: { ...foe.pos }, dir: { x: 0, y: 0, z: 1 } }, c);
    k.step();
    expect(foe.health.hp).toBeCloseTo(420 - 136);
    foe.health.hp = 340; // missing 380 → +45.6, bonus holds: × 1.5
    k.ctx.effects.apply(fx, { entity: foe.id, point: { ...foe.pos }, dir: { x: 0, y: 0, z: 1 } }, c);
    k.step();
    expect(foe.health.hp).toBeCloseTo(340 - 145.6 * 1.5);
    foe.health.hp = 300; // 300 − 100 = 200 < 0.3 × 720 = 216 → executed
    k.ctx.effects.apply({ kind: 'damage', amount: 100, type: 'song', executeBelow: name('exe') }, { entity: foe.id, point: { ...foe.pos }, dir: { x: 0, y: 0, z: 1 } }, c);
    k.step();
    expect(foe.health.dead).toBe(true);
  });

  it('DamageEffect.beakShotMult overrides the ability beak multiplier (×2 instead of ×1.5)', () => {
    const k = createKit();
    const me = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    const foe = k.hero('albatross', 'dusk', { x: 0, y: 0, z: 5 });
    k.mod(foe, 'test:noRegen', [['healthRegen', 'add', -2]]);
    const head = { x: 0, y: 2.05, z: 5 };
    const hit = (beakShotMult?: number): number => {
      foe.health.hp = 720;
      const fx: DamageEffect = { kind: 'damage', amount: 100, type: 'song', beakShot: true, ...(beakShotMult ? { beakShotMult } : {}) };
      k.ctx.effects.apply(fx, { entity: foe.id, point: head, dir: { x: 0, y: 0, z: 1 } }, cause(me));
      k.step();
      return 720 - foe.health.hp;
    };
    expect(hit()).toBeCloseTo(150);
    expect(hit(2)).toBeCloseTo(200);
  });
});
