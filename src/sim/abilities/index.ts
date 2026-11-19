/**
 * sim/abilities: casting, targeting, cooldowns, charges, channels, AP and upgrade tiers, unlocks, and the effect
 * kinds area, summon, tether (zones.ts), delay, cooldownMod and hook. Runs in the abilities phase.
 *
 * Cast targets (what `effects` land on), per AbilityDef.targeting:
 * - self:      entity = caster, point = caster's feet, dir = look direction.
 * - direction: entity = caster, point = aim point, dir = muzzle → aim point.
 * - point:     entity = caster, point = the floor under the crosshair within range (never through a ceiling), or with
 *              values.surface ≥ 1 the surface under it (D-SYS-012), dir = flat look.
 * - unit:      entity = the chosen hero or unit (visible to the caster's flock, not behind ivy beyond 3 m; an ally cast
 *              with selfFallback takes the caster when no ally is in the cone), point = its feet, dir = muzzle → its
 *              body centre.
 * So self-buffs work in self, direction and point casts, and anything meant for others goes through a projectile,
 * area, dash onHit, tether or summon. `selfEffects` land on the caster whatever the targeting (entity = caster, point
 * = its feet, dir = the cast's dir), after `effects` and before the onCast hook. The cause's
 * origin is the muzzle point. `cooldownMod` always changes the cause's source's cooldowns.
 *
 * A cast: press → checks (unlocked, a charge, not stunned, silenced, egg-carrying or casting, no movement mode that
 * forbids abilities; rooted or grounded block casts that move the caster, but rooted not one that cleanses the root
 * itself) → `ability` start → castS wind-up (stun or
 * silence interrupts it and nothing is spent) → land: effects, selfEffects, then the hook's onCast, then a charge is
 * spent and its cooldown starts (so cooldownMod in the cast's own effects reaches only the other slots) → `ability`
 * land → optional channel with channelEffects every channelIntervalS, ended by its duration ('end'), a second press
 * ('end'), or stun, silence, death or a displacement ('interrupted').
 */
import {
  AP_COSTS,
  CHARGE_LOCKOUT_S,
  COOLDOWN_REDUCTION_CAP,
  CURTAIN_SEE_THROUGH_M,
  POINT_PULL_BACK,
  RAD_PER_DEG,
  SURFACE_VALUE,
  UNIT_TARGET_CONE_DEG,
  UNLOCK_LEVELS,
} from '../data/abilities';
import { CAMERA } from '../data/core';
import { PHYSICS_LAYERS } from '../data/movement';
import { ABILITY_BUTTONS, LAYERS_SOLID } from '../core/contracts';
import type {
  Effect,
  EffectCause,
  EffectTarget,
  Entity,
  EntityId,
  HeroDef,
  HeroEntity,
  HeroHooks,
  HeroId,
  RayHit,
  SystemFactory,
  TargetFilter,
  Tick,
  Vec3,
} from '../core/contracts';
import { heroAimRay, muzzlePoint } from '../core/aim';
import type { AimRay } from '../core/aim';
import { canSee } from '../core/vision';
import { addScaled, clamp, copy, dot, normalize, sub, ticks } from '../core/math';
import { resolveAbility } from './kit';
import type { ResolvedAbility } from './kit';
import { centreHeight, clearLine, createZones, matches, near } from './zones';
import * as dmath from '../core/dmath';

export { onCaster, resolveAbility, validateKit } from './kit';
export type { ResolvedAbility } from './kit';

const SLOTS = 4;
const TIERS = 3;
/** Stat source key for the `rooted` condition of a rooted cast. */
const ROOT_KEY = 'abilities:rooted';
const ROOTED = { conditions: ['rooted'] } as const;
const ENEMIES: TargetFilter = { teams: 'enemies' };
const COS_UNIT_CONE = dmath.cos(UNIT_TARGET_CONE_DEG * RAD_PER_DEG);

interface Cast {
  readonly slot: number;
  stage: 'windup' | 'channel';
  /** Wind-up: the land tick. Channel: the end tick. */
  at: Tick;
  nextPulse: Tick;
  pulse: Tick;
  readonly target: EffectTarget;
  readonly cause: EffectCause;
  readonly rooted: boolean;
}

interface HeroState {
  readonly hero: HeroEntity;
  readonly def: HeroDef;
  readonly hooks: HeroHooks | undefined;
  /** Each slot at its bought tier. */
  readonly abilities: ResolvedAbility[];
  /** Charged abilities: no second use before this tick. */
  readonly lockUntil: Tick[];
  cast: Cast | null;
}

interface Delay {
  readonly at: Tick;
  readonly effects: readonly Effect[];
  readonly target: EffectTarget;
  readonly cause: EffectCause;
}

export const createAbilitySystem: SystemFactory = (ctx) => {
  const { store, bus, stats, effects, clock, physics } = ctx;
  const unlockAll = ctx.config.options.unlockAbilities;
  const hooks = new Map<HeroId, HeroHooks>();
  for (const r of ctx.config.roster) {
    const make = ctx.heroes[r.hero].hooks;
    if (make && !hooks.has(r.hero)) hooks.set(r.hero, make(ctx));
  }
  const heroes: HeroState[] = [];
  const byId = new Map<EntityId, HeroState>();
  const delays: Delay[] = [];
  const scratch: EntityId[] = [];

  /** Hooks of the hero behind a cause's source (a summon's owner counts). */
  const hooksOf = (source: EntityId | null): HeroHooks | undefined => {
    const e = source === null ? undefined : store.get(source);
    const owner = e?.kind === 'unit' && e.unit.owner !== null ? store.get(e.unit.owner) : e;
    return owner?.kind === 'hero' ? hooks.get(owner.hero.heroId) : undefined;
  };
  const zones = createZones(ctx, hooksOf);

  // ── Charges and cooldowns ──────────────────────────────────────────────────────────────────────────────────

  const maxCharges = (hs: HeroState, i: number): number => {
    const base = (hs.abilities[i] as ResolvedAbility).charges;
    return base > 1 ? base + Math.max(0, Math.floor(stats.get(hs.hero.id, 'abilityCharges'))) : base;
  };

  const cooldownTicks = (hs: HeroState, i: number): Tick => {
    const cdr = clamp(stats.get(hs.hero.id, 'cooldownReduction'), 0, COOLDOWN_REDUCTION_CAP);
    return ticks((hs.abilities[i] as ResolvedAbility).cooldownS * (1 - cdr));
  };

  /** Starts the next charge's cooldown if one is missing, and returns charges whose time has come. */
  const recharge = (hs: HeroState, i: number): void => {
    const slot = hs.hero.abilities.slots[i];
    if (!slot) return;
    const max = maxCharges(hs, i);
    if (slot.charges < max && slot.readyAt === 0) {
      slot.cooldownTicks = cooldownTicks(hs, i);
      slot.readyAt = clock.tick + slot.cooldownTicks;
    }
    if (slot.charges < max && clock.tick >= slot.readyAt) {
      slot.charges++;
      slot.readyAt = 0;
      slot.cooldownTicks = 0;
      if (slot.charges < max) recharge(hs, i);
    }
    if (slot.charges >= max) {
      slot.charges = max;
      slot.readyAt = 0;
      slot.cooldownTicks = 0;
    }
  };

  const reset = (hs: HeroState, i: number): void => {
    const slot = hs.hero.abilities.slots[i];
    if (!slot) return;
    slot.charges = maxCharges(hs, i);
    slot.readyAt = 0;
    slot.cooldownTicks = 0;
    hs.lockUntil[i] = 0;
  };

  const refund = (hs: HeroState, i: number, by: Tick): void => {
    const slot = hs.hero.abilities.slots[i];
    if (!slot || slot.readyAt === 0) return;
    slot.readyAt = Math.max(clock.tick, slot.readyAt - by);
    recharge(hs, i);
  };

  // ── Heroes, progression ────────────────────────────────────────────────────────────────────────────────────

  bus.on('entity.spawned', (e) => {
    const hero = e.kind === 'hero' ? store.getKind(e.id, 'hero') : undefined;
    if (!hero) return;
    const def = ctx.heroes[hero.hero.heroId].def;
    const hs: HeroState = {
      hero,
      def,
      hooks: hooks.get(hero.hero.heroId),
      abilities: def.abilities.map((a, i) => resolveAbility(a, hero.abilities.slots[i]?.tier ?? 0)),
      lockUntil: [0, 0, 0, 0],
      cast: null,
    };
    heroes.push(hs);
    byId.set(hero.id, hs);
    hero.abilities.slots.forEach((s, i) => {
      s.unlocked = unlockAll || (UNLOCK_LEVELS[i] ?? Infinity) <= hero.progress.level;
      s.charges = maxCharges(hs, i);
    });
  });

  bus.on('hero.level', (e) => {
    const hs = byId.get(e.hero);
    if (!hs) return;
    hs.hero.abilities.ap += e.ap;
    hs.hero.abilities.slots.forEach((s, i) => {
      if (s.unlocked || ((UNLOCK_LEVELS[i] ?? Infinity) > e.level && e.unlockSlot !== i)) return;
      s.unlocked = true;
      bus.emit({ type: 'ability.upgraded', hero: e.hero, slot: i, tier: 0 });
    });
  });

  // GDD §3.9: displacement cancels channels.
  bus.on('movement', (e) => {
    const hs = e.action === 'displaced' ? byId.get(e.hero) : undefined;
    if (hs?.cast?.stage === 'channel') stop(hs, 'interrupted');
  });

  const upgrade = (hs: HeroState, i: number): void => {
    const slot = hs.hero.abilities.slots[i];
    const def = hs.def.abilities[i];
    if (!slot || !def || !slot.unlocked || slot.tier >= TIERS) return;
    const cost = AP_COSTS[slot.tier] ?? Infinity;
    if (hs.hero.abilities.ap < cost) return;
    hs.hero.abilities.ap -= cost;
    const before = maxCharges(hs, i);
    slot.tier++;
    hs.abilities[i] = resolveAbility(def, slot.tier);
    slot.charges += Math.max(0, maxCharges(hs, i) - before);
    recharge(hs, i);
    bus.emit({ type: 'ability.upgraded', hero: hs.hero.id, slot: i, tier: slot.tier });
  };

  // ── Targeting ──────────────────────────────────────────────────────────────────────────────────────────────

  const rangeOf = (hs: HeroState, r: ResolvedAbility): number => r.range * (1 + stats.get(hs.hero.id, 'abilityRange'));

  /** First solid hit along the crosshair ray, or null (aim model step 3, world only). */
  const aimHit = (ray: AimRay): RayHit | null =>
    physics.raycast(addScaled(ray.origin, ray.dir, ray.start), ray.dir, CAMERA.aimRange - ray.start, LAYERS_SOLID);
  /** The aim point: the first solid hit along the crosshair ray, or the ray's end. */
  const aimPoint = (ray: AimRay, hit = aimHit(ray)): Vec3 =>
    hit?.point ?? addScaled(ray.origin, ray.dir, CAMERA.aimRange);

  /**
   * 'point' targeting (GDD §6.11): the floor under the crosshair. The aim point, or the point along the crosshair ray
   * whose horizontal distance from the caster is the range, is pulled back toward the camera off any surface and
   * dropped to the floor below it: it is in the open air the caster sees, so the drop never goes through a ceiling.
   */
  const floorPoint = (h: HeroEntity, ray: AimRay, p: Vec3, max: number): Vec3 => {
    // On a surface within range: just off it, toward the camera.
    let q = addScaled(p, ray.dir, -POINT_PULL_BACK);
    if (dmath.hypot(p.x - h.pos.x, p.z - h.pos.z) > max) {
      // Out of range: the point on the ray at that horizontal distance (the far root of |start + dir·u − hero| = max).
      const start = addScaled(ray.origin, ray.dir, ray.start);
      const a = ray.dir.x * ray.dir.x + ray.dir.z * ray.dir.z;
      const ox = start.x - h.pos.x;
      const oz = start.z - h.pos.z;
      const halfB = ox * ray.dir.x + oz * ray.dir.z;
      const c = ox * ox + oz * oz - max * max;
      const disc = halfB * halfB - a * c;
      if (a > 0 && disc >= 0) q = addScaled(start, ray.dir, (-halfB + Math.sqrt(disc)) / a);
    }
    return { x: q.x, y: physics.groundHeight(q.x, q.z, q.y) ?? q.y, z: q.z };
  };

  /** Caster or target within CURTAIN_SEE_THROUGH_M of an ivy curtain sees through it; otherwise it blocks (GDD §6.8). */
  const curtainClear = (from: Vec3, to: Vec3): boolean => {
    const d = sub(to, from);
    const len = dmath.hypot(d.x, d.y, d.z);
    if (len <= 2 * CURTAIN_SEE_THROUGH_M) return true;
    const hit = physics.raycast(from, { x: d.x / len, y: d.y / len, z: d.z / len }, len, PHYSICS_LAYERS.sight);
    return hit === null || hit.distance <= CURTAIN_SEE_THROUGH_M || len - hit.distance <= CURTAIN_SEE_THROUGH_M;
  };

  const centre = (e: Entity): Vec3 => ({ x: e.pos.x, y: e.pos.y + centreHeight(ctx, e), z: e.pos.z });

  /** 'unit' targeting: the candidate nearest the crosshair within the cone, range and line of sight. */
  const pickUnit = (hs: HeroState, r: ResolvedAbility, ray: AimRay, origin: Vec3): Entity | null => {
    const h = hs.hero;
    const f = r.def.affects ?? ENEMIES;
    let best: Entity | null = null;
    let bestCos = COS_UNIT_CONE;
    for (const id of near(ctx, f, h.pos, rangeOf(hs, r), scratch)) {
      const e = store.get(id);
      if (!e || id === h.id || !matches(f, h.team, h.id, e) || stats.has(id, 'intangible')) continue;
      if (e.team !== h.team && !canSee(h.team, e)) continue;
      const c = centre(e);
      const v = sub(c, ray.origin);
      const len = dmath.hypot(v.x, v.y, v.z);
      const cos = len > 0 ? dot(v, ray.dir) / len : -1;
      if (cos < bestCos || (best !== null && cos === bestCos)) continue;
      if (!clearLine(ctx, origin, c) || !curtainClear(origin, c)) continue;
      best = e;
      bestCos = cos;
    }
    // An ally cast with no ally in the cone falls back to the caster when the data says so.
    return best ?? ((f.self === true || r.def.selfFallback === true) && f.teams !== 'enemies' ? h : null);
  };

  const pickTarget = (hs: HeroState, r: ResolvedAbility, origin: Vec3): EffectTarget | null => {
    const h = hs.hero;
    const ray = heroAimRay(h, hs.def.body);
    switch (r.def.targeting) {
      case 'self':
        return { entity: h.id, point: copy(h.pos), dir: ray.dir };
      case 'direction': {
        const p = aimPoint(ray);
        return { entity: h.id, point: p, dir: normalize(sub(p, origin)) };
      }
      case 'point': {
        const hit = aimHit(ray);
        const p = aimPoint(ray, hit);
        const max = rangeOf(hs, r);
        const dir = normalize({ x: ray.dir.x, y: 0, z: ray.dir.z });
        // A surface cast (Tree Cling, Branch Swing) takes the wall, tree or floor under the crosshair within range.
        const onSurface = hit !== null && (r.values[SURFACE_VALUE] ?? 0) >= 1 && dmath.hypot(p.x - h.pos.x, p.y - h.pos.y, p.z - h.pos.z) <= max;
        return { entity: h.id, point: onSurface ? copy(p) : floorPoint(h, ray, p, max), dir };
      }
      case 'unit': {
        const e = pickUnit(hs, r, ray, origin);
        if (!e) return null;
        return { entity: e.id, point: copy(e.pos), dir: e === h ? ray.dir : normalize(sub(centre(e), origin)) };
      }
    }
  };

  // ── Casting ────────────────────────────────────────────────────────────────────────────────────────────────

  const emit = (hs: HeroState, slot: number, stage: 'start' | 'land' | 'end' | 'interrupted', point: Vec3): void => {
    const ability = hs.def.abilities[slot]?.id ?? '';
    bus.emit({ type: 'ability', caster: hs.hero.id, slot, ability, stage, point: copy(point) });
  };

  const stop = (hs: HeroState, stage: 'end' | 'interrupted'): void => {
    const c = hs.cast;
    if (!c) return;
    if (c.rooted) stats.set(hs.hero.id, ROOT_KEY, null);
    hs.cast = null;
    hs.hero.abilities.casting = null;
    hs.hero.abilities.channelling = false;
    emit(hs, c.slot, stage, c.target.point);
  };

  const land = (hs: HeroState, c: Cast): void => {
    const h = hs.hero;
    const r = hs.abilities[c.slot] as ResolvedAbility;
    const channel = ticks(r.def.channelS);
    if (c.rooted && channel === 0) stats.set(h.id, ROOT_KEY, null);
    effects.applyAll(r.effects, c.target, c.cause);
    if (r.selfEffects.length > 0) effects.applyAll(r.selfEffects, { entity: h.id, point: copy(h.pos), dir: copy(c.target.dir) }, c.cause);
    if (r.def.hook) hs.hooks?.onCast?.({ hero: h, slot: c.slot, ability: r.def, tier: r.tier, target: c.target, cause: c.cause });
    const slot = h.abilities.slots[c.slot];
    if (slot) {
      slot.charges = Math.max(0, slot.charges - 1);
      if (maxCharges(hs, c.slot) > 1) hs.lockUntil[c.slot] = clock.tick + ticks(CHARGE_LOCKOUT_S);
      recharge(hs, c.slot);
    }
    emit(hs, c.slot, 'land', c.target.point);
    if (channel === 0) {
      hs.cast = null;
      h.abilities.casting = null;
      return;
    }
    c.stage = 'channel';
    c.at = clock.tick + channel;
    c.pulse = ticks(r.def.channelIntervalS ?? 0);
    c.nextPulse = c.pulse > 0 ? clock.tick + c.pulse : Infinity;
    h.abilities.channelling = true;
  };

  const blocked = (id: EntityId): boolean =>
    stats.has(id, 'stunned') || stats.has(id, 'silenced') || stats.has(id, 'eggCarrier');

  const tryCast = (hs: HeroState, i: number): void => {
    const h = hs.hero;
    const slot = h.abilities.slots[i];
    const r = hs.abilities[i];
    if (!slot || !r || !slot.unlocked || slot.charges < 1 || clock.tick < (hs.lockUntil[i] ?? 0)) return;
    // A movement mode that forbids abilities (Burrow) blocks new casts, not the re-press that ends a channel (D-ARCH-016).
    if (h.motor.modeAllowsAbilities === false) return;
    if (blocked(h.id) || (r.movement && ((stats.has(h.id, 'rooted') && !r.unroots) || stats.has(h.id, 'grounded')))) return;
    const origin = muzzlePoint(h.pos, h.yaw, hs.def.body, h.motor.crouching);
    const target = pickTarget(hs, r, origin);
    if (!target) return;
    const cause: EffectCause = {
      source: h.id,
      team: h.team,
      via: 'ability',
      ability: r.def.id,
      item: null,
      values: r.values,
      songPower: stats.get(h.id, 'songPower'),
      proc: false,
      origin,
    };
    const c: Cast = {
      slot: i,
      stage: 'windup',
      at: clock.tick + ticks(r.def.castS),
      nextPulse: Infinity,
      pulse: 0,
      target,
      cause,
      rooted: r.def.rooted === true,
    };
    hs.cast = c;
    h.abilities.casting = i;
    if (c.rooted) stats.set(h.id, ROOT_KEY, ROOTED);
    emit(hs, i, 'start', target.point);
    if (clock.tick >= c.at) land(hs, c);
  };

  /** Advances a cast in progress. Returns the press bits it used up (a second press that ends a channel). */
  const advance = (hs: HeroState, c: Cast, pressed: number): number => {
    const button = ABILITY_BUTTONS[c.slot] ?? 0;
    if (blocked(hs.hero.id)) {
      stop(hs, 'interrupted');
      return 0;
    }
    if (c.stage === 'windup') {
      if (clock.tick >= c.at) land(hs, c);
      return 0;
    }
    if ((pressed & button) !== 0) {
      stop(hs, 'end');
      return button;
    }
    const r = hs.abilities[c.slot] as ResolvedAbility;
    while (c.nextPulse <= clock.tick && c.nextPulse <= c.at) {
      c.nextPulse += c.pulse;
      effects.applyAll(r.def.channelEffects ?? [], c.target, c.cause);
    }
    if (clock.tick >= c.at) stop(hs, 'end');
    return 0;
  };

  const tickHero = (hs: HeroState): void => {
    const h = hs.hero;
    const cmd = h.command;
    if (cmd.upgrade !== null) upgrade(hs, cmd.upgrade);
    for (let i = 0; i < SLOTS; i++) recharge(hs, i);
    if (h.health.dead) {
      stop(hs, 'interrupted');
      return;
    }
    let pressed = cmd.pressed;
    if (hs.cast) pressed &= ~advance(hs, hs.cast, pressed);
    for (let i = 0; i < SLOTS && !hs.cast; i++) if ((pressed & (ABILITY_BUTTONS[i] ?? 0)) !== 0) tryCast(hs, i);
    hs.hooks?.onTick?.(h);
  };

  // ── Owned effect kinds: delay, cooldownMod, hook ───────────────────────────────────────────────────────────

  effects.handle('delay', 'abilities', (e, target, cause) => {
    const n = ticks(effects.magnitude(e.seconds, cause));
    const t = { entity: target.entity, point: copy(target.point), dir: copy(target.dir) };
    if (n <= 0) effects.applyAll(e.effects, t, cause);
    else delays.push({ at: clock.tick + n, effects: e.effects, target: t, cause });
  });

  // Always the cause's source: refunds sit in dash onHit lists and kill triggers, where the target is the enemy.
  effects.handle('cooldownMod', 'abilities', (e, _target, cause) => {
    const hero = cause.source === null ? undefined : store.getKind(cause.source, 'hero');
    const hs = hero && byId.get(hero.id);
    if (!hero || !hs) return;
    const by = e.mode === 'refund' ? ticks(effects.magnitude(e.seconds ?? 0, cause)) : 0;
    if (e.scope === 'items') {
      for (const it of hero.inventory.items) it.readyAt = e.mode === 'reset' ? 0 : Math.max(0, it.readyAt - by);
      return;
    }
    for (let i = 0; i < SLOTS; i++) {
      if (e.scope === 'slot' && i !== e.slot) continue;
      if (e.mode === 'reset') reset(hs, i);
      else refund(hs, i, by);
    }
  });

  effects.handle('hook', 'abilities', (e, target, cause) => hooksOf(cause.source)?.onEffect?.(e.name, target, cause));

  const runDelays = (): void => {
    const n = delays.length;
    let w = 0;
    for (let i = 0; i < n; i++) {
      const d = delays[i] as Delay;
      if (d.at <= clock.tick) effects.applyAll(d.effects, d.target, d.cause);
      else delays[w++] = d;
    }
    delays.copyWithin(w, n);
    delays.length = w + delays.length - n;
  };

  return {
    name: 'abilities',
    phases: {
      abilities() {
        runDelays();
        for (const hs of heroes) if (!hs.hero.removed) tickHero(hs);
        zones.tick();
      },
    },
    hash(h) {
      for (const hs of heroes) {
        h.num(hs.hero.id);
        for (const t of hs.lockUntil) h.num(t);
        const c = hs.cast;
        h.value(c ? [c.slot, c.stage, c.at, c.nextPulse] : null);
      }
      for (const d of delays) {
        h.num(d.at);
        h.num(d.target.entity ?? -1);
      }
      zones.hash(h);
    },
  };
};
