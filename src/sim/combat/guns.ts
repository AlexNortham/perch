/**
 * Guns (GDD §4.5, §5.5, §5.6): fire rate, aim point, spread, pellets, hitscan and projectile bullets, falloff, ammo,
 * reload and reload-cancel; weapon mods; the `projectile` effect for ability projectiles. Projectiles are store
 * entities (the renderer draws them); their flight state lives in pooled records.
 */
import { COMBAT } from '../data/combat';
import { CAMERA, TICK_RATE } from '../data/core';
import { Button, LAYERS_SOLID } from '../core/contracts';
import type {
  EffectCause,
  EffectTarget,
  Entity,
  EntityId,
  Hasher,
  HeroEntity,
  ProjectileEffect,
  ProjectileInfo,
  SimContext,
  Vec3,
  WeaponModEffect,
} from '../core/contracts';
import { aimRay, lookDir, muzzlePoint } from '../core/aim';
import { copy, ticks } from '../core/math';
import { Beak, isDamageable } from './damage';
import type { Damage } from './damage';
import { falloff, spreadDir } from './geometry';
import type { CastFilter, Hit, Hitboxes } from './hitboxes';
import type { Statuses } from './statuses';
import { Melee } from './types';
import type { HeroState, ModRec } from './types';

const HALF_TURN_DEG = 180;
const DEG = Math.PI / HALF_TURN_DEG;
const EPS = 1e-6;
/** A returning projectile lives this many one-way flight times (out, back, and slack for a moving caster). */
const RETURN_LIFE_MULT = 3;

interface Proj {
  id: EntityId;
  /** Gun bullets: the shooter. Ability projectiles: null. */
  gun: HeroState | null;
  fx: ProjectileEffect | null;
  cause: EffectCause;
  readonly dir: Vec3;
  speed: number;
  travelled: number;
  range: number;
  radius: number;
  returning: boolean;
  expiresAt: number;
  /** Gun bullets: damage at fire time, falloff range, targets left to pierce. */
  damage: number;
  falloffStart: number;
  falloffEnd: number;
  pierce: number;
  /** Targets hit, the pass (out = 0, back = 1) of their last hit, and how often. */
  readonly hitIds: EntityId[];
  readonly hitPass: number[];
  readonly hitCount: number[];
  readonly filter: CastFilter;
}

export interface Guns {
  /** Combat phase, per living hero: weapon mods, reload, fire. */
  tick(s: HeroState): void;
  /** Combat phase, before heroes fire: move every projectile and resolve its hits. */
  projectiles(): void;
  /** Firing, melee, parry, casting and stuns cancel a reload (GDD §5.6). */
  cancelReload(s: HeroState): void;
  weaponMod(fx: WeaponModEffect, target: EffectTarget, cause: EffectCause): void;
  projectile(fx: ProjectileEffect, target: EffectTarget, cause: EffectCause): void;
  drop(id: EntityId): void;
  hash(h: Hasher): void;
}

const filter = (): CastFilter => ({
  team: null,
  allies: false,
  ignore: -1,
  heroes: true,
  units: true,
  structures: true,
  pods: false,
  ember: false,
});

function projectileSource(cause: EffectCause): ProjectileInfo['source'] {
  switch (cause.via) {
    case 'weapon':
    case 'item':
    case 'unit':
    case 'structure':
      return cause.via;
    default:
      return 'ability';
  }
}

export function createGuns(
  ctx: SimContext,
  hb: Hitboxes,
  damage: Damage,
  statuses: Statuses,
  heroes: ReadonlyMap<EntityId, HeroState>,
): Guns {
  const rng = ctx.rng.stream('combat');
  const live: Proj[] = [];
  const spare: Proj[] = [];
  // The aim ray stops on seed pods too, so the bullet converges on the pod under the crosshair (GDD §4.5, §8.2).
  const aimFilter: CastFilter = { ...filter(), pods: true };
  const shotFilter: CastFilter = { ...filter(), pods: true };
  const near: EntityId[] = [];
  const chain: EntityId[] = [];
  // Scratch vectors (never escape: events and effects get copies).
  const aim = { x: 0, y: 0, z: 0 };
  const from = { x: 0, y: 0, z: 0 };
  const dir = { x: 0, y: 0, z: 0 };
  const pellet = { x: 0, y: 0, z: 0 };
  const at = { x: 0, y: 0, z: 0 };

  const magazine = (h: HeroEntity): number => Math.round(h.stats.final.magazine);
  const along = (o: Vec3, d: Vec3, t: number, out: Vec3): Vec3 => {
    out.x = o.x + d.x * t;
    out.y = o.y + d.y * t;
    out.z = o.z + d.z * t;
    return out;
  };
  const neg = (d: Vec3): Vec3 => ({ x: -d.x, y: -d.y, z: -d.z });

  const impact = (cause: EffectCause, pos: Vec3, normal: Vec3, target: EntityId | null, beakShot: boolean): void => {
    ctx.bus.emit({ type: 'projectile.impact', owner: cause.source, pos: copy(pos), normal, target, beakShot, via: cause.via });
  };

  const reloadSeconds = (s: HeroState, perRoundStart: boolean): number => {
    const w = s.def.weapon;
    const base = perRoundStart ? (w.perRoundStartS ?? COMBAT.perRoundStartS) + w.reloadS : w.reloadS;
    return base / (1 + s.hero.stats.final.reloadSpeed);
  };

  const startReload = (s: HeroState): void => {
    s.hero.weapon.reloading = true;
    s.reloadAt = ctx.clock.tick + reloadSeconds(s, s.def.weapon.reload === 'perRound') * TICK_RATE;
    ctx.bus.emit({ type: 'weapon.reload', hero: s.hero.id, done: false });
  };

  const finishReload = (s: HeroState): void => {
    s.hero.weapon.reloading = false;
    ctx.bus.emit({ type: 'weapon.reload', hero: s.hero.id, done: true });
  };

  const progressReload = (s: HeroState): void => {
    const w = s.hero.weapon;
    const now = ctx.clock.tick;
    const mag = magazine(s.hero);
    if (s.def.weapon.reload === 'magazine') {
      if (now < s.reloadAt) return;
      w.ammo = mag;
    } else {
      while (now >= s.reloadAt && w.ammo < mag) {
        w.ammo++;
        s.reloadAt += reloadSeconds(s, false) * TICK_RATE;
      }
      if (w.ammo < mag) return;
    }
    finishReload(s);
  };

  const cancelReload = (s: HeroState): void => {
    s.hero.weapon.reloading = false;
  };

  const applies = (m: ModRec, e: Entity): boolean =>
    m.mod.onlyVsStatus === undefined || (isDamageable(e) && statuses.has(e, m.mod.onlyVsStatus));

  /** Enemy heroes and units near a point (horizontal reach), for splash and bounces. */
  const enemiesNear = (s: HeroState, p: Vec3, radius: number, out: EntityId[]): EntityId[] => {
    ctx.spatial.query(p, radius + COMBAT.hitboxQueryPad, near);
    out.length = 0;
    for (const id of near) {
      const e = ctx.store.get(id);
      if (!e || (e.kind !== 'hero' && e.kind !== 'unit') || e.team === s.hero.team || e.removed) continue;
      if (e.health.dead || e.stats.conditions.has('intangible')) continue;
      if (Math.hypot(e.pos.x - p.x, e.pos.z - p.z) <= radius + e.radius) out.push(id);
    }
    return out;
  };

  const extraHit = (s: HeroState, target: Entity, amount: number): void => {
    damage.request(target.id, s.gunCause, 'talon', amount, target.pos);
  };

  /** One bullet hit on an entity: impact, damage request, weapon mods. `dist` is muzzle-to-hit. */
  const bulletHit = (s: HeroState, hit: Hit, o: Vec3, d: Vec3, dist: number, dmg: number, fs: number, fe: number): void => {
    const e = ctx.store.get(hit.id);
    if (!e) return;
    const point = along(o, d, hit.t, at);
    impact(s.gunCause, point, neg(d), hit.id, hit.head);
    if (e.kind === 'pickup') return;
    let noFalloff = false;
    for (const m of s.mods) if (m.mod.ignoreFalloff && applies(m, e)) noFalloff = true;
    const f = noFalloff ? 1 : falloff(dist, fs, fe, COMBAT.falloffFloor);
    const r = damage.request(e.id, s.gunCause, 'talon', dmg, point);
    r.falloff = f;
    r.weak = hit.weak;
    if (hit.head) {
      r.beak = Beak.Gun;
      r.beakMult = s.def.weapon.beakShotMult ?? COMBAT.beakShotMult;
    }
    for (const m of s.mods) {
      if (!applies(m, e)) continue;
      const mod = m.mod;
      const target = mod.onBulletHit || mod.everyNth ? { entity: e.id, point: copy(point), dir: copy(d) } : null;
      if (mod.onBulletHit && target) ctx.effects.applyAll(mod.onBulletHit, target, s.gunCause);
      if (mod.everyNth && target && ++m.hits % mod.everyNth.n === 0) ctx.effects.applyAll(mod.everyNth.effects, target, s.gunCause);
      if (mod.splash) {
        for (const id of enemiesNear(s, point, mod.splash.radius, chain)) {
          const other = ctx.store.get(id);
          if (other && id !== e.id) extraHit(s, other, dmg * f * mod.splash.fraction);
        }
      }
      if (mod.bounces) {
        // Each bounce jumps to the nearest enemy not yet hit by this bullet (no beak shot, no falloff).
        let last: Entity = e;
        const visited = [e.id];
        for (let b = 0; b < mod.bounces; b++) {
          let best: Entity | null = null;
          let bestD = Infinity;
          for (const id of enemiesNear(s, last.pos, COMBAT.bounce.radius, chain)) {
            const c = ctx.store.get(id);
            if (!c || visited.includes(id)) continue;
            const dd = Math.hypot(c.pos.x - last.pos.x, c.pos.z - last.pos.z);
            if (dd < bestD) {
              bestD = dd;
              best = c;
            }
          }
          if (!best) break;
          visited.push(best.id);
          extraHit(s, best, dmg * f * COMBAT.bounce.fraction);
          last = best;
        }
      }
    }
  };

  /** Hits along one bullet segment, in order: pods are reported and passed through. Returns the stop distance or −1. */
  const bulletSegment = (
    s: HeroState,
    o: Vec3,
    d: Vec3,
    hits: readonly Hit[],
    travelled: number,
    dmg: number,
    fs: number,
    fe: number,
    p: Proj | null,
    pierce: { left: number },
  ): number => {
    for (const hit of hits) {
      if (p) {
        if (p.hitIds.includes(hit.id)) continue;
        p.hitIds.push(hit.id);
      }
      const isPod = ctx.store.get(hit.id)?.kind === 'pickup';
      bulletHit(s, hit, o, d, travelled + hit.t, dmg, fs, fe);
      if (isPod) continue;
      if (pierce.left <= 0) return hit.t;
      pierce.left--;
    }
    return -1;
  };

  const pierceOf = (s: HeroState): number => {
    let n = 0;
    for (const m of s.mods) if (m.mod.pierce !== undefined && m.mod.onlyVsStatus === undefined) n = Math.max(n, m.mod.pierce);
    return n;
  };

  const aimPoint = (s: HeroState, crouch: boolean): Vec3 => {
    const h = s.hero;
    const ray = aimRay(h.pos, h.yaw, h.pitch, h.shoulder, s.def.body, crouch);
    const len = (s.def.weapon.aimRange ?? CAMERA.aimRange) - ray.start;
    along(ray.origin, ray.dir, ray.start, from);
    const wh = ctx.physics.raycast(from, ray.dir, len, LAYERS_SOLID);
    aimFilter.team = h.team;
    aimFilter.ignore = h.id;
    const hits = hb.cast(from, ray.dir, wh ? wh.distance : len, 0, aimFilter);
    return along(from, ray.dir, hits[0]?.t ?? (wh ? wh.distance : len), aim);
  };

  const spawn = (p: Omit<Proj, 'hitIds' | 'hitPass' | 'hitCount' | 'filter' | 'dir'>, d: Vec3, f: CastFilter): void => {
    const rec = spare.pop() ?? {
      ...p,
      dir: { x: 0, y: 0, z: 0 },
      hitIds: [],
      hitPass: [],
      hitCount: [],
      filter: filter(),
    };
    Object.assign(rec, p);
    rec.dir.x = d.x;
    rec.dir.y = d.y;
    rec.dir.z = d.z;
    rec.hitIds.length = 0;
    rec.hitPass.length = 0;
    rec.hitCount.length = 0;
    Object.assign(rec.filter, f);
    live.push(rec);
  };

  const fire = (s: HeroState): void => {
    const h = s.hero;
    const w = s.def.weapon;
    const st = h.stats.final;
    const now = ctx.clock.tick;
    if (!s.mods.some((m) => m.mod.ammoFree === true)) h.weapon.ammo--;
    if (h.weapon.reloading) cancelReload(s);
    damage.inCombat(h);
    statuses.endOnAttack(h);
    const crouch = h.motor.crouching || h.motor.sliding;
    const target = aimPoint(s, crouch);
    const muzzle = muzzlePoint(h.pos, h.yaw, s.def.body, crouch);
    dir.x = target.x - muzzle.x;
    dir.y = target.y - muzzle.y;
    dir.z = target.z - muzzle.z;
    const len = Math.hypot(dir.x, dir.y, dir.z);
    if (len > EPS) {
      dir.x /= len;
      dir.y /= len;
      dir.z /= len;
    } else Object.assign(dir, lookDir(h.yaw, h.pitch));
    ctx.bus.emit({ type: 'weapon.fired', shooter: h.id, muzzle: copy(muzzle), dir: copy(dir) });
    const cause = s.gunCause;
    cause.origin = muzzle;
    cause.songPower = st.songPower;
    const half =
      w.spreadDeg *
      DEG *
      (h.motor.grounded ? 1 : COMBAT.spreadAirborneMult) *
      ((h.command.held & Button.Aim) !== 0 ? COMBAT.spreadAimMult : 1);
    const dmg = st.weaponDamage;
    const fs = w.falloff.start * (1 + st.falloffRange);
    const fe = w.falloff.end * (1 + st.falloffRange);
    const pierce = pierceOf(s);
    const radius = w.projectileRadius ?? COMBAT.gunProjectileRadius;
    shotFilter.team = h.team;
    shotFilter.ignore = h.id;
    for (let i = 0; i < w.pellets; i++) {
      spreadDir(dir, half, rng, pellet);
      if (w.hitscan) {
        const wh = ctx.physics.raycast(muzzle, pellet, w.range, LAYERS_SOLID);
        const hits = hb.cast(muzzle, pellet, wh ? wh.distance : w.range, 0, shotFilter);
        const stop = bulletSegment(s, muzzle, pellet, hits, 0, dmg, fs, fe, null, { left: pierce });
        if (stop < 0 && wh) impact(cause, wh.point, copy(wh.normal), null, false);
        continue;
      }
      const speed = w.projectileSpeed * (1 + st.bulletSpeed);
      const e = ctx.store.spawn({
        kind: 'projectile',
        team: h.team,
        pos: copy(muzzle),
        vel: { x: pellet.x * speed, y: pellet.y * speed, z: pellet.z * speed },
        yaw: Math.atan2(pellet.x, pellet.z),
        radius,
        projectile: { owner: h.id, source: 'weapon', ability: null, expiresAt: now + Math.ceil((w.range / speed) * TICK_RATE) + 1 },
      });
      spawn(
        {
          id: e.id,
          gun: s,
          fx: null,
          cause,
          speed,
          travelled: 0,
          range: w.range,
          radius,
          returning: false,
          expiresAt: e.projectile.expiresAt,
          damage: dmg,
          falloffStart: fs,
          falloffEnd: fe,
          pierce,
        },
        pellet,
        shotFilter,
      );
    }
  };

  /** An ability projectile touching an entity. Returns true if it stops there. */
  const abilityHit = (p: Proj, fx: ProjectileEffect, hit: Hit, o: Vec3): boolean => {
    const e = ctx.store.get(hit.id);
    if (!e) return false;
    const pass = p.returning ? 1 : 0;
    const i = p.hitIds.indexOf(hit.id);
    if (i >= 0) {
      if (p.hitPass[i] === pass || (p.hitCount[i] ?? 0) >= (fx.maxHitsPerTarget ?? 1)) return false;
      p.hitPass[i] = pass;
      p.hitCount[i] = (p.hitCount[i] ?? 0) + 1;
    } else {
      p.hitIds.push(hit.id);
      p.hitPass.push(pass);
      p.hitCount.push(1);
    }
    // A head hit lands on the head centre so `damage` effects flagged beakShot see it (GDD §5.4).
    const point = hit.head && hb.head(e, at) >= 0 ? at : along(o, p.dir, hit.t, at);
    const beak = hit.head && fx.onHit.some((x) => x.kind === 'damage' && x.beakShot === true);
    impact(p.cause, point, neg(p.dir), hit.id, beak);
    ctx.effects.applyAll(fx.onHit, { entity: hit.id, point: copy(point), dir: copy(p.dir) }, p.cause);
    return fx.pierce === 'none' || (fx.pierce === 'units' && e.kind !== 'unit');
  };

  const end = (p: Proj, point: Vec3): void => {
    if (p.fx?.onExpire) ctx.effects.applyAll(p.fx.onExpire, { entity: null, point: copy(point), dir: copy(p.dir) }, p.cause);
    ctx.store.despawn(p.id);
    p.id = -1;
  };

  const move = (p: Proj): void => {
    const e = ctx.store.getKind(p.id, 'projectile');
    if (!e || e.removed) {
      p.id = -1;
      return;
    }
    const now = ctx.clock.tick;
    if (now >= p.expiresAt) return end(p, e.pos);
    const fx = p.fx;
    let len: number;
    let last = false;
    if (p.returning) {
      const c = p.cause.source === null ? undefined : ctx.store.get(p.cause.source);
      if (!c || c.removed) return end(p, e.pos);
      const tx = c.pos.x - e.pos.x;
      const ty = c.pos.y + c.radius - e.pos.y;
      const tz = c.pos.z - e.pos.z;
      const dist = Math.hypot(tx, ty, tz);
      len = p.speed / TICK_RATE;
      if (dist <= len + EPS) {
        len = dist;
        last = true;
      }
      if (dist > EPS) {
        p.dir.x = tx / dist;
        p.dir.y = ty / dist;
        p.dir.z = tz / dist;
      }
    } else {
      if (fx && fx.gravity !== 0) e.vel.y -= fx.gravity / TICK_RATE;
      const v = Math.hypot(e.vel.x, e.vel.y, e.vel.z);
      len = v / TICK_RATE;
      if (v > EPS) {
        p.dir.x = e.vel.x / v;
        p.dir.y = e.vel.y / v;
        p.dir.z = e.vel.z / v;
      }
      if (p.travelled + len >= p.range) {
        len = Math.max(0, p.range - p.travelled);
        last = true;
      }
    }
    const o = e.pos;
    const wh = len > 0 ? ctx.physics.raycast(o, p.dir, len, LAYERS_SOLID) : null;
    const seg = wh ? wh.distance : len;
    const hits = hb.cast(o, p.dir, seg, p.radius, p.filter);
    let stop = -1;
    if (p.gun) {
      const pierce = { left: p.pierce };
      stop = bulletSegment(p.gun, o, p.dir, hits, p.travelled, p.damage, p.falloffStart, p.falloffEnd, p, pierce);
      p.pierce = pierce.left;
    } else if (fx) {
      for (const hit of hits) {
        if (abilityHit(p, fx, hit, o)) {
          stop = hit.t;
          break;
        }
      }
    }
    const advance = stop >= 0 ? stop : seg;
    along(o, p.dir, advance, o);
    p.travelled += advance;
    if (p.returning) {
      e.vel.x = p.dir.x * p.speed;
      e.vel.y = p.dir.y * p.speed;
      e.vel.z = p.dir.z * p.speed;
      e.yaw = Math.atan2(p.dir.x, p.dir.z);
    }
    if (stop >= 0) return end(p, o);
    if (wh) {
      impact(p.cause, wh.point, copy(wh.normal), null, false);
      return end(p, o);
    }
    if (!last) return;
    if (fx?.returns && !p.returning) {
      p.returning = true;
      return;
    }
    end(p, o);
  };

  return {
    cancelReload,
    tick(s) {
      const h = s.hero;
      const w = h.weapon;
      const now = ctx.clock.tick;
      const c = h.stats.conditions;
      if (s.mods.length > 0) {
        let k = 0;
        for (const m of s.mods) if (now < m.expiresAt) s.mods[k++] = m;
        s.mods.length = k;
      }
      const wasFiring = w.firing;
      w.firing = false;
      if (c.has('stunned')) {
        cancelReload(s);
        return;
      }
      if (w.reloading) progressReload(s);
      const ammoFree = s.mods.some((m) => m.mod.ammoFree === true);
      if ((h.command.pressed & Button.Reload) !== 0 && !w.reloading && w.ammo < magazine(h)) startReload(s);
      const can =
        (h.command.held & Button.Fire) !== 0 &&
        !c.has('disarmed') &&
        !c.has('eggCarrier') &&
        now >= s.lockout &&
        s.melee === Melee.Idle &&
        s.parryClose < 0;
      if (can && (w.ammo > 0 || ammoFree)) {
        const st = h.stats.final;
        const rate = s.def.weapon.fireRate * (1 + st.fireRate) * (1 - Math.min(1, st.fireRateSlow));
        if (rate > 0) {
          // A new burst starts now (no catch-up); within continuous fire the fractional cadence is kept exactly.
          if (!wasFiring && s.nextFire < now) s.nextFire = now;
          w.firing = true;
          while (s.nextFire <= now && (w.ammo > 0 || ammoFree)) {
            fire(s);
            s.nextFire += TICK_RATE / rate;
          }
        }
      }
      if (w.ammo <= 0 && !w.reloading && !ammoFree) startReload(s);
    },
    projectiles() {
      const n = live.length;
      for (let i = 0; i < n; i++) {
        const p = live[i] as Proj;
        if (p.id >= 0) move(p);
      }
      let k = 0;
      for (const p of live) {
        if (p.id >= 0) live[k++] = p;
        else spare.push(p);
      }
      live.length = k;
    },
    weaponMod(fx, target, cause) {
      const s = target.entity === null ? undefined : heroes.get(target.entity);
      if (!s || s.hero.health.dead) return;
      const h = s.hero;
      if (fx.reload) {
        h.weapon.ammo = magazine(h);
        if (h.weapon.reloading) finishReload(s);
      }
      const dur = ctx.effects.magnitude(fx.durationS, cause);
      if (dur > 0) s.mods.push({ mod: fx, expiresAt: ctx.clock.tick + ticks(dur), hits: 0 });
      damage.supported(cause, h);
    },
    projectile(fx, target, cause) {
      const speed = ctx.effects.magnitude(fx.speed, cause);
      const range = ctx.effects.magnitude(fx.range, cause);
      const d = target.dir;
      const dl = Math.hypot(d.x, d.y, d.z);
      if (!(speed > 0) || !(range > 0) || dl < EPS) return;
      const ux = d.x / dl;
      const uy = d.y / dl;
      const uz = d.z / dl;
      const life = (range / speed) * (fx.returns ? RETURN_LIFE_MULT : 1);
      const e = ctx.store.spawn({
        kind: 'projectile',
        team: cause.team,
        pos: copy(cause.origin),
        vel: { x: ux * speed, y: uy * speed, z: uz * speed },
        yaw: Math.atan2(ux, uz),
        radius: fx.radius,
        projectile: {
          owner: cause.source,
          source: projectileSource(cause),
          ability: cause.ability,
          expiresAt: ctx.clock.tick + Math.ceil(life * TICK_RATE) + 1,
        },
      });
      const kinds = fx.affects.heroesOnly ? ['hero'] : (fx.affects.kinds ?? ['hero', 'unit']);
      const f: CastFilter = {
        team: fx.affects.teams === 'all' ? null : cause.team,
        allies: fx.affects.teams === 'allies',
        ignore: cause.source ?? -1,
        heroes: kinds.includes('hero'),
        units: kinds.includes('unit'),
        structures: kinds.includes('structure'),
        pods: false,
        ember: false,
      };
      spawn(
        {
          id: e.id,
          gun: null,
          fx,
          cause,
          speed,
          travelled: 0,
          range,
          radius: fx.radius,
          returning: false,
          expiresAt: e.projectile.expiresAt,
          damage: 0,
          falloffStart: 0,
          falloffEnd: 0,
          pierce: 0,
        },
        { x: ux, y: uy, z: uz },
        f,
      );
    },
    drop(id) {
      for (const p of live) if (p.id === id) p.id = -1;
    },
    hash(h) {
      for (const p of live) {
        h.num(p.id);
        h.num(p.travelled);
        h.num(p.pierce);
        h.num(p.returning ? 1 : 0);
        h.value(p.hitIds);
      }
    },
  };
}
