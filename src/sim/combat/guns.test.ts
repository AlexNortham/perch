import { describe, expect, it } from 'vitest';
import { Button, HERO_IDS, IDLE_COMMAND } from '../core/contracts';
import type { HeroEntity, HeroId, Vec3 } from '../core/contracts';
import { aimRay } from '../core/aim';
import { createRng } from '../core/rng';
import { createSim } from '../index';
import { HEROES } from '../heroes/registry';
import { falloff, rayCapsule, rayCylinder, raySphere, spreadDir } from './geometry';
import { createKit } from './testkit';
import type { Kit } from './testkit';
import { createSandbox } from '../../../tests/helpers/sandbox';

const DEG = Math.PI / 180;
const angle = (a: Vec3, b: Vec3): number =>
  Math.acos(Math.min(1, (a.x * b.x + a.y * b.y + a.z * b.z) / (Math.hypot(a.x, a.y, a.z) * Math.hypot(b.x, b.y, b.z))));

/** Kingfisher (Dart Pistol, 22 per shot) at the origin facing +z, a dusk target `dist` m ahead; one shot at `aimY`. */
function shoot(target: 'hero' | 'unit', dist: number, aimY: number, setup?: (k: Kit, me: HeroEntity) => void) {
  const k = createKit();
  const me = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
  const foe = target === 'hero' ? k.hero('albatross', 'dusk', { x: 0, y: 0, z: dist }, Math.PI) : k.unit('dusk', { x: 0, y: 0, z: dist });
  setup?.(k, me);
  k.aimAt(me, { x: 0, y: aimY, z: dist });
  k.input(me, Button.Fire);
  k.step();
  return { k, me, foe, hits: k.of('damage.applied') };
}

describe('geometry', () => {
  it('ray tests: sphere, vertical capsule, cylinder', () => {
    const o = { x: 0, y: 1, z: 0 };
    const d = { x: 0, y: 0, z: 1 };
    expect(raySphere(o, d, 0, 1, 10, 0.5)).toBeCloseTo(9.5);
    expect(raySphere(o, d, 0, 2, 10, 0.5)).toBe(-1);
    expect(rayCapsule(o, d, 0, 10, 0.5, 1.5, 0.5)).toBeCloseTo(9.5);
    expect(rayCapsule({ x: 0, y: 1.9, z: 0 }, d, 0, 10, 0.5, 1.5, 0.5)).toBeGreaterThan(9.5);
    expect(rayCylinder(o, d, 0, 10, 0, 10, 2)).toBeCloseTo(8);
    expect(rayCylinder({ x: 0, y: 20, z: 10 }, { x: 0, y: -1, z: 0 }, 0, 10, 0, 10, 2)).toBeCloseTo(10);
  });

  it('falloff: full to start, linear to 25% at end, 25% beyond', () => {
    expect(falloff(18, 18, 40, 0.25)).toBe(1);
    expect(falloff(29, 18, 40, 0.25)).toBeCloseTo(0.625);
    expect(falloff(40, 18, 40, 0.25)).toBe(0.25);
    expect(falloff(90, 18, 40, 0.25)).toBe(0.25);
  });

  it('spread is uniform over the cone with a fixed seed', () => {
    const rng = createRng(7, 'combat');
    const dir = { x: 0, y: 0, z: 1 };
    const out = { x: 0, y: 0, z: 0 };
    const half = 5 * DEG;
    const n = 4000;
    let inner = 0;
    let maxA = 0;
    for (let i = 0; i < n; i++) {
      const a = angle(dir, spreadDir(dir, half, rng, out));
      maxA = Math.max(maxA, a);
      if (a <= half / 2) inner++;
    }
    expect(maxA).toBeLessThanOrEqual(half + 1e-9);
    expect(maxA).toBeGreaterThan(half * 0.95);
    // Uniform by solid angle: P(θ ≤ α/2) ≈ 1/4.
    expect(inner / n).toBeGreaterThan(0.22);
    expect(inner / n).toBeLessThan(0.28);
    // Same seed, same directions.
    const a = spreadDir(dir, half, createRng(9, 'combat'), { x: 0, y: 0, z: 0 });
    expect(spreadDir(dir, half, createRng(9, 'combat'), { x: 0, y: 0, z: 0 })).toEqual(a);
  });
});

describe('hitboxes and beak shots', () => {
  it('a head hit on a hero is a beak shot (×1.65), a body hit is not', () => {
    const head = shoot('hero', 10, 2.05);
    expect(head.hits).toHaveLength(1);
    expect(head.hits[0]).toMatchObject({ target: head.foe.id, beakShot: true, damageType: 'talon', via: 'weapon' });
    expect(head.hits[0]?.amount).toBeCloseTo(22 * 1.65);
    expect(head.k.of('projectile.impact')[0]).toMatchObject({ target: head.foe.id, beakShot: true });

    const bodyShot = shoot('hero', 10, 1.0);
    expect(bodyShot.hits[0]).toMatchObject({ beakShot: false });
    expect(bodyShot.hits[0]?.amount).toBeCloseTo(22);
    expect(bodyShot.foe.health.hp).toBeCloseTo(720 - 22 + 2 / 60); // regeneration ran this tick too
  });

  it('never beak-shots a unit, even at its top', () => {
    const { hits } = shoot('unit', 10, 0.85);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ beakShot: false, targetKind: 'unit' });
    expect(hits[0]?.amount).toBeCloseTo(22);
  });

  it('beak bonus and flat are added in step 3, before gun damage %', () => {
    const { hits } = shoot('hero', 10, 2.05, (k, me) =>
      k.mod(me, 'items:test', [['beakShotBonus', 'add', 0.2], ['beakShotFlat', 'add', 10], ['gunDamage', 'add', 0.5]]),
    );
    expect(hits[0]?.amount).toBeCloseTo((22 * (1.65 + 0.2) + 10) * 1.5);
  });

  it('crouching lowers the head hitbox', () => {
    const k = createKit();
    const me = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    const foe = k.hero('albatross', 'dusk', { x: 0, y: 0, z: 10 }, Math.PI);
    foe.motor.crouching = true;
    k.aimAt(me, { x: 0, y: 2.05, z: 10 });
    k.input(me, Button.Fire);
    k.step();
    expect(k.of('damage.applied')).toHaveLength(0);
    k.aimAt(me, { x: 0, y: 2.05 * 0.65, z: 10 });
    k.step(20);
    expect(k.of('damage.applied')[0]?.beakShot).toBe(true);
  });
});

describe('falloff', () => {
  it('is full at falloff start, linear to the middle, 25% past the end', () => {
    expect(shoot('hero', 10, 1.0).hits[0]?.amount).toBeCloseTo(22);
    const mid = shoot('hero', 29.5, 1.0);
    const fired = mid.k.of('weapon.fired')[0];
    const hit = mid.k.of('projectile.impact')[0];
    expect(fired && hit).toBeTruthy();
    if (!fired || !hit) return;
    const d = Math.hypot(hit.pos.x - fired.muzzle.x, hit.pos.y - fired.muzzle.y, hit.pos.z - fired.muzzle.z);
    expect(d).toBeGreaterThan(18);
    expect(d).toBeLessThan(40);
    expect(mid.hits[0]?.amount).toBeCloseTo(22 * (1 - ((d - 18) / 22) * 0.75));
    expect(shoot('hero', 60, 1.0).hits[0]?.amount).toBeCloseTo(22 * 0.25);
    // Falloff range bonus scales both ends.
    const far = shoot('hero', 29.5, 1.0, (k, me) => k.mod(me, 'items:test', [['falloffRange', 'add', 1]]));
    expect(far.hits[0]?.amount).toBeCloseTo(22);
  });

  it('does nothing beyond max range', () => {
    expect(shoot('hero', 125, 1.0).hits).toHaveLength(0);
  });
});

describe('pellets and spread', () => {
  it('publishes eight true endpoints including misses in a mixed Albatross volley', async () => {
    const sb = await createSandbox({ heroes: [{ hero: 'albatross', at: { x: 0, y: 0, z: -10 } }] });
    const me = sb.heroes[0]!;
    sb.look(me, 0, -2.5 * DEG);
    sb.fire(me);
    sb.step();
    const [fired] = sb.eventsOf('weapon.fired');
    const [traces] = sb.eventsOf('weapon.traces');
    if (!fired || !traces) throw new Error('missing shot');
    expect(fired.hitscan).toBe(true);
    expect(traces.muzzle).toEqual(fired.muzzle);
    expect(traces.ends).toHaveLength(8);
    const impacts = sb.eventsOf('projectile.impact');
    expect(impacts.length).toBeGreaterThan(0);
    expect(impacts.length).toBeLessThan(8);
    for (const hit of impacts) {
      expect(traces.ends.some((point) => Math.hypot(point.x - hit.pos.x, point.y - hit.pos.y, point.z - hit.pos.z) < 1e-5)).toBe(true);
    }
    const miss = traces.ends.find((point) =>
      Math.abs(Math.hypot(point.x - fired.muzzle.x, point.y - fired.muzzle.y, point.z - fired.muzzle.z) - HEROES.albatross.def.weapon.range) < 1e-5);
    expect(miss).toBeDefined();
  });

  it('adds the flat beak damage once when multiple pellets hit the head', () => {
    const run = (flat: number) => {
      const k = createKit({ seed: 1 });
      const me = k.hero('albatross', 'dawn', { x: 0, y: 0, z: 0 });
      k.hero('albatross', 'dusk', { x: 0, y: 0, z: 2.5 }, Math.PI);
      k.mod(me, 'items:beak', [['beakShotFlat', 'add', flat]]);
      k.aimAt(me, { x: 0, y: 2.05, z: 2.5 });
      k.input(me, Button.Fire);
      k.step();
      const hits = k.of('damage.applied');
      expect(hits.filter((e) => e.beakShot).length).toBeGreaterThan(1);
      return hits.reduce((total, e) => total + e.amount, 0);
    };
    expect(run(35) - run(0)).toBeCloseTo(35);
  });

  it('a shotgun fires 8 pellets inside its 5° cone, seeded', () => {
    const wall = { min: { x: -20, y: -5, z: 20 }, max: { x: 20, y: 20, z: 21 } };
    const run = (seed: number) => {
      const k = createKit({ seed, boxes: [wall] });
      const me = k.hero('albatross', 'dawn', { x: 0, y: 0, z: 0 });
      k.aimAt(me, { x: 0, y: 1.5, z: 20 });
      k.input(me, Button.Fire);
      k.step();
      return { fired: k.of('weapon.fired'), impacts: k.of('projectile.impact') };
    };
    const a = run(3);
    expect(a.fired).toHaveLength(1);
    expect(a.impacts).toHaveLength(8);
    const f = a.fired[0];
    if (!f) return;
    for (const i of a.impacts) {
      expect(i.target).toBeNull();
      expect(angle(f.dir, { x: i.pos.x - f.muzzle.x, y: i.pos.y - f.muzzle.y, z: i.pos.z - f.muzzle.z })).toBeLessThanOrEqual(5 * DEG + 1e-6);
    }
    expect(run(3).impacts).toEqual(a.impacts);
    expect(run(4).impacts).not.toEqual(a.impacts);
  });

  it('aiming tightens spread ×0.75 and airborne widens it ×1.3', () => {
    const wall = { min: { x: -20, y: -5, z: 20 }, max: { x: 20, y: 20, z: 21 } };
    const maxAngle = (buttons: number, grounded: boolean): number => {
      const k = createKit({ boxes: [wall] });
      const me = k.hero('albatross', 'dawn', { x: 0, y: 0, z: 0 });
      me.motor.grounded = grounded;
      k.aimAt(me, { x: 0, y: 1.5, z: 20 });
      k.input(me, Button.Fire | buttons);
      k.step(200);
      let m = 0;
      const fired = k.of('weapon.fired');
      const impacts = k.of('projectile.impact');
      fired.forEach((f, s) => {
        for (const i of impacts.slice(s * 8, s * 8 + 8)) {
          m = Math.max(m, angle(f.dir, { x: i.pos.x - f.muzzle.x, y: i.pos.y - f.muzzle.y, z: i.pos.z - f.muzzle.z }));
        }
      });
      return m / DEG;
    };
    expect(maxAngle(Button.Aim, true)).toBeLessThanOrEqual(3.75 + 1e-6);
    expect(maxAngle(Button.Aim, true)).toBeGreaterThan(3.3);
    expect(maxAngle(0, false)).toBeGreaterThan(5.2);
    expect(maxAngle(0, false)).toBeLessThanOrEqual(6.5 + 1e-6);
  });
});

describe('fire rate, magazine and reload', () => {
  const firedTicks = (k: Kit): number[] => k.of('weapon.fired').map(() => 0);

  it('fires at fireRate, auto-reloads at 0 and reloads in reloadS', () => {
    const k = createKit();
    const me = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    const ticks: number[] = [];
    k.ctx.bus.on('weapon.fired', () => ticks.push(k.ctx.clock.tick));
    const reloads: [number, boolean][] = [];
    k.ctx.bus.on('weapon.reload', (e) => reloads.push([k.ctx.clock.tick, e.done]));
    k.input(me, Button.Fire);
    k.step(270);
    // 4 shots/s = every 15 ticks; 12 rounds; 1.6 s = 96 ticks of reload.
    expect(ticks.slice(0, 13)).toEqual([1, 16, 31, 46, 61, 76, 91, 106, 121, 136, 151, 166, 262]);
    expect(reloads.slice(0, 2)).toEqual([[166, false], [262, true]]);
    expect(firedTicks(k)).toHaveLength(13);
  });

  it('keeps fractional fire rates exact (11 shots/s)', () => {
    const k = createKit();
    const me = k.hero('pelican', 'dawn', { x: 0, y: 0, z: 0 });
    k.input(me, Button.Fire);
    k.step(60);
    expect(k.of('weapon.fired')).toHaveLength(11);
    expect(me.weapon.ammo).toBe(50 - 11);
  });

  it('R reloads; firing with rounds left cancels a magazine reload and loses its progress', () => {
    const k = createKit();
    const me = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    k.input(me, Button.Fire);
    k.step(31);
    expect(me.weapon.ammo).toBe(9);
    k.input(me, 0, Button.Reload);
    k.step(10); // tick 41; the next shot is allowed from tick 46 (fire rate)
    expect(me.weapon.reloading).toBe(true);
    k.input(me, Button.Fire);
    k.step(4);
    expect(me.weapon.reloading).toBe(true);
    k.step(1);
    expect(me.weapon.reloading).toBe(false);
    expect(me.weapon.ammo).toBe(8);
    k.input(me, 0, Button.Reload);
    k.step(96); // pressed on tick 47: done on tick 47 + 96
    expect(me.weapon.ammo).toBe(8);
    k.step(1);
    expect(me.weapon.ammo).toBe(12);
    // R with a full magazine does nothing.
    k.clear();
    k.input(me, 0, Button.Reload);
    k.step();
    expect(k.of('weapon.reload')).toHaveLength(0);
  });

  it('shell-loaders load one round per reloadS after a 0.3 s start; a cancel keeps loaded rounds', () => {
    const k = createKit();
    const me = k.hero('albatross', 'dawn', { x: 0, y: 0, z: 0 });
    k.input(me, Button.Fire);
    k.step(1);
    k.input(me, 0);
    k.step(9);
    expect(me.weapon.ammo).toBe(5);
    k.input(me, 0, Button.Reload); // tick 11: first shell at 11 + 0.75 s = tick 56
    k.step(45);
    expect(me.weapon.ammo).toBe(5);
    k.step(1);
    expect(me.weapon.ammo).toBe(6);
    expect(me.weapon.reloading).toBe(false);
    // Empty it to 4, reload, cancel after one shell.
    k.input(me, Button.Fire);
    k.step(50);
    k.input(me, 0, Button.Reload);
    const start = k.ctx.clock.tick + 1;
    const before = me.weapon.ammo;
    k.step(46);
    expect(k.ctx.clock.tick).toBe(start + 45);
    expect(me.weapon.ammo).toBe(before + 1);
    k.input(me, Button.Fire);
    k.step(1);
    expect(me.weapon.reloading).toBe(false);
    expect(me.weapon.ammo).toBe(before);
  });

  it('disarm and stun stop the gun; a stun cancels a reload', () => {
    const k = createKit();
    const me = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    k.ctx.stats.set(me.id, 'test:disarm', { conditions: ['disarmed'] });
    k.input(me, Button.Fire);
    k.step(30);
    expect(k.of('weapon.fired')).toHaveLength(0);
    k.ctx.stats.set(me.id, 'test:disarm', null);
    k.input(me, 0, Button.Reload);
    me.weapon.ammo = 3;
    k.step(1);
    expect(me.weapon.reloading).toBe(true);
    k.ctx.stats.set(me.id, 'test:stun', { conditions: ['stunned'] });
    k.step(1);
    expect(me.weapon.reloading).toBe(false);
  });
});

describe('projectile bullets', () => {
  it('travel at projectileSpeed, hit with the same hitboxes, then despawn', () => {
    const k = createKit();
    const me = k.hero('shrike', 'dawn', { x: 0, y: 0, z: 0 });
    const foe = k.hero('albatross', 'dusk', { x: 0, y: 0, z: 15 }, Math.PI);
    k.aimAt(me, { x: 0, y: 2.05, z: 15 });
    k.input(me, Button.Fire);
    let hitTick = 0;
    k.ctx.bus.on('damage.applied', () => (hitTick ||= k.ctx.clock.tick));
    k.step(1);
    const bullets = k.ctx.store.list('projectile');
    expect(bullets).toHaveLength(1);
    expect(bullets[0]?.projectile).toMatchObject({ owner: me.id, source: 'weapon' });
    expect(Math.hypot(bullets[0]?.vel.x ?? 0, bullets[0]?.vel.y ?? 0, bullets[0]?.vel.z ?? 0)).toBeCloseTo(180);
    k.input(me, 0);
    k.step(10);
    // ~14.3 m to the head at 3 m per tick: the 5th step after the firing tick.
    expect(hitTick).toBe(6);
    const hit = k.of('damage.applied')[0];
    expect(hit).toMatchObject({ target: foe.id, beakShot: true });
    expect(hit?.amount).toBeCloseTo(14 * 1.65);
    expect(k.ctx.store.list('projectile')).toHaveLength(0);
  });

  it('retains shot-limited conditional damage and no falloff on a travelling round', async () => {
    const sb = await createSandbox({ heroes: [
      { hero: 'shrike', at: { x: 0, y: 0, z: -29 } },
      { hero: 'albatross', at: { x: 0, y: 0, z: 26 }, controller: 'dummy' },
    ] });
    const [me, target] = sb.heroes as [number, number];
    const status = { id: 'mark', name: 'Marked', negative: true, durationS: 1, stacking: 'max', maxStacks: 1 } as const;
    sb.apply({ kind: 'applyStatus', status }, target, sb.cause(me));
    sb.apply({ kind: 'weaponMod', durationS: 1, shots: 1, ignoreFalloff: true, gunDamage: 0.5, onlyVsStatus: 'mark' }, me, sb.cause(me));
    sb.aimAt(me, target);
    sb.fire(me);
    sb.step();
    sb.fire(me, false);
    expect(sb.eventsOf('damage.applied')).toHaveLength(0);
    sb.step(30);
    const hit = sb.eventsOf('damage.applied').find((e) => e.target === target);
    expect(hit).toMatchObject({ via: 'weapon', amount: 21 });
  });

  it('expire at max range', () => {
    const k = createKit();
    const me = k.hero('shrike', 'dawn', { x: 0, y: 0, z: 0 });
    k.input(me, Button.Fire);
    k.step(1);
    k.input(me, 0);
    k.step(39);
    expect(k.ctx.store.list('projectile')).toHaveLength(1);
    k.step(2);
    expect(k.ctx.store.list('projectile')).toHaveLength(0);
  });
});

describe('what bullets pass and what stops them', () => {
  it('pods are reported and passed through; allies are passed through', () => {
    const k = createKit();
    const me = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    const pod = k.pod('dusk', { x: 0, y: 1.0, z: 5 });
    const ally = k.hero('shrike', 'dawn', { x: 0, y: 0, z: 7 });
    const foe = k.hero('albatross', 'dusk', { x: 0, y: 0, z: 10 }, Math.PI);
    k.aimAt(me, { x: 0, y: 1.0, z: 10 });
    k.input(me, Button.Fire);
    k.step();
    expect(k.of('projectile.impact').map((e) => e.target)).toEqual([pod.id, foe.id]);
    expect(k.of('damage.applied').map((e) => e.target)).toEqual([foe.id]);
    expect(ally.health.hp).toBe(580);
  });

  it('world geometry stops the shot (honest muzzle path)', () => {
    const wall = { min: { x: -2, y: 0, z: 5 }, max: { x: 2, y: 3, z: 5.5 } };
    const k = createKit({ boxes: [wall] });
    const me = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    k.hero('albatross', 'dusk', { x: 0, y: 0, z: 10 }, Math.PI);
    k.aimAt(me, { x: 0, y: 1.0, z: 10 });
    k.input(me, Button.Fire);
    k.step();
    expect(k.of('damage.applied')).toHaveLength(0);
    expect(k.of('projectile.impact')[0]).toMatchObject({ target: null, normal: { x: 0, y: 0, z: -1 } });
  });
});

describe('wired into createSim', () => {
  it.each(['kingfisher', 'shrike'] as const)('%s hits an exposed phase-two heart through real physics', async (hero) => {
    const sb = await createSandbox({ heroes: [{ hero, at: { x: 0, y: 0, z: -23 } }] });
    const me = sb.heroes[0]!;
    const id = sb.dummy({ kind: 'structure', type: 'patron', team: 'dusk', at: { x: 0, y: 0, z: 0 }, hp: 20_000, height: 11, radius: 8 });
    const patron = sb.ctx.store.getKind(id, 'structure')!;
    patron.structure.phase = 2;
    const heart = { x: 0, y: 6, z: -8 };
    patron.structure.weakPoint = { centre: heart, radius: 1 };
    const fire = () => {
      sb.aimAt(me, heart);
      sb.fire(me);
      sb.step(1);
      sb.fire(me, false);
      sb.step(30);
      return sb.eventsOf('damage.applied').at(-1);
    };
    expect(fire()).toMatchObject({ target: id, weakPoint: true, beakShot: false });
    sb.clearEvents();
    sb.place(me, { x: 0, y: 0, z: 23 });
    expect(fire()).toMatchObject({ target: id, weakPoint: false, beakShot: false });
  });

  it('a hero shoots another in the arena through the real composition root', async () => {
    const sim = await createSim({
      seed: 5,
      map: 'arena',
      roster: [
        { team: 'dawn', hero: 'kingfisher', controller: 'human' },
        { team: 'dusk', hero: 'owl', controller: 'easy' },
      ],
    });
    const [me, foe] = sim.ctx.store.list('hero') as HeroEntity[];
    if (!me || !foe) throw new Error('heroes missing');
    // The first spawns (x = −7.5, z = ∓15) face each other across the arena's ramp (x −10…−6, z −3…3, 2 m high),
    // which real physics rightly stops the shot on; x = 0 is a clear line.
    me.pos.x = 0;
    foe.pos.x = 0;
    const b = HEROES.kingfisher.def.body;
    const target = { x: foe.pos.x, y: foe.pos.y + 1, z: foe.pos.z };
    let yaw = me.yaw;
    let pitch = 0;
    for (let i = 0; i < 8; i++) {
      const r = aimRay(me.pos, yaw, pitch, 1, b, false);
      yaw = Math.atan2(target.x - r.origin.x, target.z - r.origin.z);
      pitch = Math.atan2(target.y - r.origin.y, Math.hypot(target.x - r.origin.x, target.z - r.origin.z));
    }
    sim.step([{ hero: me.id, command: { ...IDLE_COMMAND, yaw, pitch, held: Button.Fire, pressed: Button.Fire } }]);
    const events = sim.drainEvents();
    expect(events.some((e) => e.type === 'weapon.fired')).toBe(true);
    expect(events.find((e) => e.type === 'damage.applied')).toMatchObject({ source: me.id, target: foe.id });
    expect(foe.health.hp).toBeLessThan(foe.stats.final.maxHealth);
    expect(HERO_IDS.includes(foe.hero.heroId as HeroId)).toBe(true);
  });

  it('is deterministic: same seed and commands give the same hash while heroes fire, kill and respawn', async () => {
    const run = async (seed: number) => {
      const sim = await createSim({
        seed,
        map: 'arena',
        roster: [
          { team: 'dawn', hero: 'albatross', controller: 'easy' },
          { team: 'dusk', hero: 'owl', controller: 'easy' },
        ],
      });
      const [me, foe] = sim.ctx.store.list('hero') as HeroEntity[];
      if (!me || !foe) throw new Error('heroes missing');
      me.pos.x = foe.pos.x;
      me.pos.z = foe.pos.z - 6;
      sim.ctx.stats.set(me.id, 'items:test', { stats: [{ stat: 'weaponDamage', op: 'add', value: 40 }] });
      const b = HEROES.albatross.def.body;
      let deaths = 0;
      for (let t = 0; t < 1200; t++) {
        const r = aimRay(me.pos, me.yaw, me.pitch, 1, b, false);
        const yaw = Math.atan2(foe.pos.x - r.origin.x, foe.pos.z - r.origin.z);
        const pitch = Math.atan2(foe.pos.y + 1 - r.origin.y, Math.hypot(foe.pos.x - r.origin.x, foe.pos.z - r.origin.z));
        sim.step([{ hero: me.id, command: { ...IDLE_COMMAND, yaw, pitch, held: Button.Fire } }]);
        deaths += sim.drainEvents().filter((e) => e.type === 'entity.died').length;
      }
      return { hash: sim.hash(), deaths };
    };
    const a = await run(11);
    expect(a.deaths).toBeGreaterThan(0);
    expect((await run(11)).hash).toBe(a.hash);
    expect((await run(12)).hash).not.toBe(a.hash);
  });
});
