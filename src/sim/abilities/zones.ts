/**
 * The lasting things abilities leave in the world: areas, summons and tethers (effect kinds `area`, `summon`,
 * `tether`, owned by sim/abilities). Each keeps its EffectCause, so credit and Song scaling outlive the caster.
 *
 * Areas (rules beyond the contract's TSDoc):
 * - durationS ≤ 0 is a burst: `effects` once to everything inside, now.
 * - A lasting area applies `effects` every intervalS (first one intervalS after it appears, last one on its final
 *   tick), at most once per tick per target for the same AreaEffect (GDD §5.12). onEnter fires on entering,
 *   onExit on leaving, dying-free, and when the area ends; onCross on crossing a ring's mid line, or any other
 *   shape's edge. onEnter and onCross re-fire for one target at most once per intervalS.
 * - attach 'source' follows the cause's source, 'target' follows target.entity (ends when they die or go);
 *   'point' stays at target.point. `move` slides it along the horizontal target direction and, with `carry`,
 *   launches what it reaches along with it: one `displace` 'along' per entity, of move.maxCarry or the area's travel
 *   left if less. An 'along' arc that long flies at about the area's speed; physics adds pushes to the current
 *   velocity, so a push every tick would stack (a 12 m cap became 27 m).
 * - Effects from areas carry the cause with via 'area' and origin at the area centre (structures ignore them).
 * Durations of areas, summons and tethers from abilities scale with the source's `abilityDuration`.
 */
import { CROSS_MARGIN, GROUND_PROBE_UP, RAD_PER_DEG, SUMMON } from '../data/abilities';
import { EFFECT_TICK_SECONDS, TICK_SECONDS } from '../data/core';
import { LAYERS_SOLID } from '../core/contracts';
import type {
  AreaEffect,
  DisplaceEffect,
  Effect,
  EffectCause,
  EffectTarget,
  Entity,
  EntityId,
  EntityKind,
  Hasher,
  HeroHooks,
  SimContext,
  SummonEffect,
  TargetFilter,
  Team,
  TetherEffect,
  Tick,
  Vec3,
} from '../core/contracts';
import { canSee } from '../core/vision';
import { copy, distSq, ticks, vec3 } from '../core/math';
import { boundRadius, inside, isEmpty, resolveShape, sideOf } from './shapes';
import type { ResolvedShape } from './shapes';
import * as dmath from '../core/dmath';

const DEFAULT_KINDS: readonly EntityKind[] = ['hero', 'unit'];
const HERO_KINDS: readonly EntityKind[] = ['hero'];
const ENEMY_HEROES: TargetFilter = { teams: 'enemies', heroesOnly: true };
const ENEMIES: TargetFilter = { teams: 'enemies' };
/** Keys of the per-tick "hit once per AreaEffect" set: kind id × this + entity id. */
const AREA_KEY_STRIDE = 0x1_0000_0000;
/** Stat source key for conditions sim/abilities puts on its summons. */
const SUMMON_KEY = 'abilities:summon';

/** Does `e` pass the filter for a cause of `team` from `source`? Dead and removed entities never do. */
export function matches(f: TargetFilter, team: Team, source: EntityId | null, e: Entity): boolean {
  if (e.removed || ('health' in e && e.health.dead)) return false;
  if (!(f.heroesOnly ? HERO_KINDS : (f.kinds ?? DEFAULT_KINDS)).includes(e.kind)) return false;
  if (e.id === source) return f.self === true && f.teams !== 'enemies';
  return f.teams === 'all' || (f.teams === 'enemies') === (e.team !== team);
}

/**
 * Ids of entities whose sphere reaches within `radius` of `centre` that could pass `f`, ascending, into `out`.
 * Hero-only filters scan the heroes directly: the spatial hash also holds every area and summon, which crowd a
 * busy fight.
 */
export function near(ctx: SimContext, f: TargetFilter, centre: Vec3, radius: number, out: EntityId[]): EntityId[] {
  if (!(f.heroesOnly || (f.kinds?.length === 1 && f.kinds[0] === 'hero'))) return ctx.spatial.query(centre, radius, out);
  out.length = 0;
  for (const h of ctx.store.list('hero')) {
    const reach = radius + h.radius;
    if (distSq(h.pos, centre) <= reach * reach) out.push(h.id);
  }
  return out;
}

/** Height above the feet of an entity's body centre (aim and line-of-sight checks). */
export function centreHeight(ctx: SimContext, e: Entity): number {
  switch (e.kind) {
    case 'hero':
      return ctx.heroes[e.hero.heroId].def.body.height / 2;
    case 'unit':
      return e.unit.height / 2;
    case 'structure':
      return e.structure.body.height / 2;
    default:
      return 0;
  }
}

/** True when nothing solid lies between the two points. */
export function clearLine(ctx: SimContext, from: Vec3, to: Vec3): boolean {
  const d = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
  const len = dmath.hypot(d.x, d.y, d.z);
  if (len === 0) return true;
  const dir = { x: d.x / len, y: d.y / len, z: d.z / len };
  return ctx.physics.raycast(from, dir, len, LAYERS_SOLID) === null;
}

/** Unit horizontal direction; +z when the input has no horizontal part. */
function flat(dir: Vec3): Vec3 {
  const len = dmath.hypot(dir.x, dir.z);
  return len > 0 ? { x: dir.x / len, y: 0, z: dir.z / len } : { x: 0, y: 0, z: 1 };
}

interface AreaState {
  readonly id: EntityId;
  readonly effect: AreaEffect;
  readonly cause: EffectCause;
  readonly shape: ResolvedShape;
  readonly bound: number;
  readonly dir: Vec3;
  readonly follow: EntityId | null;
  readonly expiresAt: Tick;
  readonly interval: Tick;
  readonly kindKey: number;
  readonly carry: DisplaceEffect | null;
  /** Entities the carry has already launched. */
  readonly carried: Set<EntityId>;
  /** Has enter, exit, cross or carry behaviour, so membership is checked every tick. */
  readonly watch: boolean;
  nextTick: Tick;
  /** Entity → last tick it was inside. */
  readonly lastIn: Map<EntityId, Tick>;
  /** Entity → last tick onEnter or onCross fired for it. */
  readonly lastFired: Map<EntityId, Tick>;
  /** Entity → tick × 2 + side, for onCross. */
  readonly side: Map<EntityId, number>;
  /** This area's own spatial query buffer (applying effects can re-enter other areas). */
  readonly ids: EntityId[];
  done: boolean;
}

interface SummonState {
  readonly id: EntityId;
  readonly effect: SummonEffect;
  readonly cause: EffectCause;
  readonly dir: Vec3;
  readonly expiresAt: Tick;
  nextAttack: Tick;
  done: boolean;
}

interface TetherState {
  readonly source: EntityId;
  readonly target: EntityId;
  readonly effect: TetherEffect;
  readonly cause: EffectCause;
  readonly expiresAt: Tick;
  readonly interval: Tick;
  readonly breakSq: number;
  nextTick: Tick;
  done: boolean;
}

export interface Zones {
  /** Runs once per tick in the abilities phase. */
  tick(): void;
  hash(h: Hasher): void;
}

/** Registers `area`, `summon` and `tether`. `hooksOf` finds the hero module hooks behind a cause's source. */
export function createZones(ctx: SimContext, hooksOf: (source: EntityId | null) => HeroHooks | undefined): Zones {
  const { store, stats, effects, clock } = ctx;
  const areas: AreaState[] = [];
  const summons: SummonState[] = [];
  const tethers: TetherState[] = [];
  const kindKeys = new Map<AreaEffect, number>();
  const hitThisTick = new Set<number>();
  const scratch: EntityId[] = [];

  const durationScale = (cause: EffectCause): number =>
    cause.ability !== null && cause.source !== null ? 1 + stats.get(cause.source, 'abilityDuration') : 1;
  const lasting = (m: AreaEffect['durationS'], cause: EffectCause): Tick =>
    ticks(effects.magnitude(m, cause) * durationScale(cause));
  const at = (e: Entity, dir: Vec3): EffectTarget => ({ entity: e.id, point: copy(e.pos), dir: copy(dir) });
  const apply = (list: readonly Effect[] | undefined, e: Entity, dir: Vec3, cause: EffectCause): void => {
    if (list?.length) effects.applyAll(list, at(e, dir), cause);
  };
  const alive = (id: EntityId): Entity | undefined => {
    const e = store.get(id);
    return e && !e.removed && !('health' in e && e.health.dead) ? e : undefined;
  };

  // ── Areas ──────────────────────────────────────────────────────────────────────────────────────────────────

  effects.handle('area', 'abilities', (effect, target, cause) => {
    const shape = resolveShape(effect.shape, (m) => effects.magnitude(m, cause));
    if (isEmpty(shape)) return;
    const follow = effect.attach === 'source' ? cause.source : effect.attach === 'target' ? target.entity : null;
    const anchor = follow === null ? undefined : alive(follow);
    const centre = copy(anchor?.pos ?? (effect.attach === 'source' ? cause.origin : target.point));
    const dir = flat(target.dir);
    const bound = boundRadius(shape);
    const duration = lasting(effect.durationS, cause);
    if (duration <= 0) {
      // A burst: collect first, since applying can re-enter this handler.
      const burstCause: EffectCause = { ...cause, via: 'area', origin: centre };
      const hit = near(ctx, effect.affects, centre, bound, scratch)
        .map((id) => store.get(id))
        .filter((e): e is Entity => !!e && matches(effect.affects, cause.team, cause.source, e))
        .filter((e) => inside(shape, centre, dir.x, dir.z, e.pos, e.radius));
      for (const e of hit) apply(effect.effects, e, dir, burstCause);
      return;
    }
    let kindKey = kindKeys.get(effect);
    if (kindKey === undefined) kindKeys.set(effect, (kindKey = kindKeys.size));
    const ent = store.spawn({
      kind: 'area',
      team: cause.team,
      pos: centre,
      vel: vec3(),
      yaw: dmath.atan2(dir.x, dir.z),
      radius: bound,
      area: {
        dimensions: shape,
        ...(effect.concealsAlliesOutside ? { concealsAlliesOutside: true } : {}),
        owner: cause.source,
        ability: cause.ability,
        shape: effect.shape.kind,
        expiresAt: clock.tick + duration,
      },
    });
    const interval = Math.max(1, ticks(effect.intervalS ?? EFFECT_TICK_SECONDS));
    areas.push({
      id: ent.id,
      effect,
      cause: { ...cause, via: 'area', origin: copy(centre) },
      shape,
      bound,
      dir,
      follow: anchor ? follow : null,
      expiresAt: clock.tick + duration,
      interval,
      kindKey,
      carry: effect.move?.carry
        ? { kind: 'displace', mode: 'along', distance: effect.move.maxCarry ?? Infinity, ...(effect.move.onWall ? { onWall: effect.move.onWall } : {}) }
        : null,
      carried: new Set(),
      watch: !!(effect.onEnter?.length || effect.onExit?.length || effect.onCross?.length || effect.move?.carry),
      nextTick: clock.tick + interval,
      lastIn: new Map(),
      lastFired: new Map(),
      side: new Map(),
      ids: [],
      done: false,
    });
  });

  const tickArea = (a: AreaState): void => {
    const tick = clock.tick;
    const ent = store.getKind(a.id, 'area');
    if (!ent || ent.removed) {
      a.done = true;
      return;
    }
    const e = a.effect;
    const pos = ent.pos;
    if (a.follow !== null) {
      const f = alive(a.follow);
      if (!f) {
        end(a);
        return;
      }
      pos.x = f.pos.x;
      pos.y = f.pos.y;
      pos.z = f.pos.z;
    } else if (e.move) {
      const step = e.move.speed * TICK_SECONDS;
      pos.x += a.dir.x * step;
      pos.z += a.dir.z * step;
      ent.vel.x = a.dir.x * e.move.speed;
      ent.vel.z = a.dir.z * e.move.speed;
    }
    const cause = a.follow === null && !e.move ? a.cause : { ...a.cause, origin: copy(pos) };
    const due = tick >= a.nextTick;
    if (due) a.nextTick += a.interval;
    // An area with only tick effects needs to know what is inside only when it ticks.
    if (!a.watch && !due) {
      if (tick >= a.expiresAt) end(a);
      return;
    }
    const ready = (id: EntityId): boolean => {
      const last = a.lastFired.get(id);
      if (last !== undefined && tick - last < a.interval) return false;
      a.lastFired.set(id, tick);
      return true;
    };
    for (const id of near(ctx, e.affects, pos, e.onCross ? a.bound + CROSS_MARGIN : a.bound, a.ids)) {
      const t = store.get(id);
      if (!t || !matches(e.affects, a.cause.team, a.cause.source, t)) continue;
      if (e.onCross) {
        const s = sideOf(a.shape, pos, a.dir.x, a.dir.z, t.pos, t.radius);
        if (s !== null) {
          const prev = a.side.get(id);
          if (prev !== undefined && Math.floor(prev / 2) === tick - 1 && prev % 2 !== Number(s) && ready(id)) {
            apply(e.onCross, t, a.dir, cause);
          }
          a.side.set(id, tick * 2 + Number(s));
        }
      }
      if (!inside(a.shape, pos, a.dir.x, a.dir.z, t.pos, t.radius)) continue;
      const was = a.lastIn.has(id);
      a.lastIn.set(id, tick);
      if (!was && e.onEnter && ready(id)) apply(e.onEnter, t, a.dir, cause);
      if (a.carry && e.move && !a.carried.has(id)) {
        a.carried.add(id);
        const distance = Math.min(a.carry.distance as number, e.move.speed * (a.expiresAt - tick) * TICK_SECONDS);
        if (distance > 0) effects.apply({ ...a.carry, distance }, at(t, a.dir), cause);
      }
      if (due && e.effects.length) {
        const key = a.kindKey * AREA_KEY_STRIDE + id;
        if (!hitThisTick.has(key)) {
          hitThisTick.add(key);
          apply(e.effects, t, a.dir, cause);
        }
      }
    }
    for (const [id, last] of a.lastIn) {
      if (last === tick) continue;
      a.lastIn.delete(id);
      exit(a, id, cause);
    }
    if (tick >= a.expiresAt) end(a);
  };

  const exit = (a: AreaState, id: EntityId, cause: EffectCause): void => {
    const t = alive(id);
    if (t && a.effect.onExit) apply(a.effect.onExit, t, a.dir, cause);
    if (t && a.effect.onCross && a.shape.kind !== 'ring') apply(a.effect.onCross, t, a.dir, cause);
  };

  const end = (a: AreaState): void => {
    for (const id of a.lastIn.keys()) exit(a, id, a.cause);
    a.lastIn.clear();
    store.despawn(a.id);
    a.done = true;
  };

  // ── Summons ────────────────────────────────────────────────────────────────────────────────────────────────

  /**
   * A summon ends (death, expiry, replacement): its onEnd effects at its last position, entity null, with its cause
   * moved there (push and pull work from the summon) and dir = its facing.
   */
  const endSummon = (s: SummonState, pos: Vec3, yaw: number): void => {
    s.done = true;
    const list = s.effect.onEnd;
    if (!list?.length) return;
    const point = copy(pos);
    effects.applyAll(list, { entity: null, point, dir: { x: dmath.sin(yaw), y: 0, z: dmath.cos(yaw) } }, { ...s.cause, origin: copy(point) });
  };

  // A summon killed in the damage phase ends there, while its record is still in the store.
  ctx.bus.on('entity.died', (e) => {
    if (e.victimKind !== 'unit') return;
    const s = summons.find((x) => x.id === e.victim && !x.done);
    if (s) endSummon(s, e.pos, store.get(e.victim)?.yaw ?? dmath.atan2(s.dir.x, s.dir.z));
  });

  effects.handle('summon', 'abilities', (effect, target, cause) => {
    const owner = cause.source;
    const count = Math.max(0, Math.floor(effects.magnitude(effect.count ?? 1, cause)));
    // One application never replaces its own summons: the cap is at least `count` (D-SYS-002).
    const extra = effect.extraCount === undefined ? 0 : Math.max(0, Math.floor(effects.magnitude(effect.extraCount, cause)));
    const cap = Math.max(effect.maxCount + extra, count);
    const live = summons.filter((s) => !s.done && s.cause.source === owner && s.effect.behaviour === effect.behaviour);
    for (let i = 0; i < live.length + count - cap; i++) {
      const old = live[i] as SummonState;
      const u = store.get(old.id);
      store.despawn(old.id);
      endSummon(old, u?.pos ?? old.cause.origin, u?.yaw ?? 0);
    }
    const base = dmath.atan2(target.dir.x, target.dir.z);
    const spread = (effect.spreadDeg ?? 0) * RAD_PER_DEG;
    for (let k = 0; k < count; k++) {
      const yaw = count > 1 ? base - spread / 2 + (spread * k) / (count - 1) : base;
      spawnSummon(effect, target.point, { x: dmath.sin(yaw), y: 0, z: dmath.cos(yaw) }, cause);
    }
  });

  const spawnSummon = (effect: SummonEffect, point: Vec3, dir: Vec3, cause: EffectCause): void => {
    const tick = clock.tick;
    const owner = cause.source;
    const hp = effects.magnitude(effect.health, cause);
    const size = effect.size;
    const unit = store.spawn({
      kind: 'unit',
      team: cause.team,
      pos: copy(point),
      vel: vec3(),
      yaw: dmath.atan2(dir.x, dir.z),
      radius: size ? Math.max(size.x, size.z) / 2 : SUMMON.radius,
      unit: {
        type: 'summon',
        lane: null,
        height: size?.y ?? SUMMON.height,
        ...(size ? { size: copy(size) } : {}),
        owner,
        summon: effect.summon,
        target: null,
        attacking: false,
      },
      health: {
        hp: Math.max(1, hp),
        talonShield: 0,
        songShield: 0,
        barrier: 0,
        dead: false,
        respawnAt: null,
        inCombatUntil: 0,
      },
      stats: stats.create({
        maxHealth: Math.max(1, hp),
        moveSpeed: owner === null ? 0 : stats.get(owner, 'moveSpeed'),
      }),
      statuses: [],
    });
    // Health 0 means it can't be damaged; traps are hidden beyond the invisibility reveal range.
    const conditions = [...(hp <= 0 ? (['invulnerable'] as const) : []), ...(effect.behaviour === 'trap' ? (['invisible'] as const) : [])];
    if (conditions.length) stats.set(unit.id, SUMMON_KEY, { conditions });
    const attack = ticks(SUMMON.attackS);
    summons.push({
      id: unit.id,
      effect,
      cause: { ...cause, origin: copy(point) },
      dir,
      expiresAt: tick + lasting(effect.durationS, cause),
      nextAttack: tick + attack,
      done: false,
    });
  };

  /** Nearest visible, unoccluded target: heroes first, then anything else the filter allows. */
  const acquire = (u: Entity, s: SummonState, range: number, f: TargetFilter): Entity | null => {
    const heroesFirst = s.effect.preferHeroes !== false;
    const eye = { x: u.pos.x, y: u.pos.y + centreHeight(ctx, u), z: u.pos.z };
    let best: Entity | null = null;
    let bestD = Infinity;
    for (const id of near(ctx, f, u.pos, range, scratch)) {
      const t = store.get(id);
      if (!t || id === u.id || !matches(f, s.cause.team, s.cause.source, t)) continue;
      if (t.team !== s.cause.team && s.cause.team !== 'neutral' && !canSee(s.cause.team, t)) continue;
      const d = distSq(u.pos, t.pos);
      if (best) {
        const bestIsHero = heroesFirst && best.kind === 'hero';
        if (bestIsHero && t.kind !== 'hero') continue;
        if ((!heroesFirst || bestIsHero === (t.kind === 'hero')) && d >= bestD) continue;
      }
      if (!clearLine(ctx, eye, { x: t.pos.x, y: t.pos.y + centreHeight(ctx, t), z: t.pos.z })) continue;
      best = t;
      bestD = d;
    }
    return best;
  };

  const tickSummon = (s: SummonState): void => {
    const tick = clock.tick;
    const u = store.getKind(s.id, 'unit');
    if (!u || u.removed || u.health.dead) {
      s.done = true;
      return;
    }
    if (tick >= s.expiresAt) {
      store.despawn(s.id);
      endSummon(s, u.pos, u.yaw);
      return;
    }
    const e = s.effect;
    u.unit.attacking = false;
    // Rooted or stunned summons stay put; physics roots a unit while it displaces it (D-ARCH-014).
    if (e.behaviour === 'decoy' && !stats.has(u.id, 'rooted') && !stats.has(u.id, 'stunned')) {
      const speed = stats.get(u.id, 'moveSpeed');
      u.pos.x += s.dir.x * speed * TICK_SECONDS;
      u.pos.z += s.dir.z * speed * TICK_SECONDS;
      u.pos.y = ctx.physics.groundHeight(u.pos.x, u.pos.z, u.pos.y + GROUND_PROBE_UP) ?? u.pos.y;
      u.vel.x = s.dir.x * speed;
      u.vel.z = s.dir.z * speed;
    }
    switch (e.behaviour) {
      case 'wall':
        return;
      case 'trap': {
        const f = e.trigger?.affects ?? ENEMY_HEROES;
        const radius = e.trigger?.radius ?? SUMMON.trapRadius;
        let hit: Entity | undefined;
        for (const id of near(ctx, f, u.pos, radius, scratch)) {
          const t = store.get(id);
          if (t && t.id !== u.id && matches(f, s.cause.team, s.cause.source, t)) {
            hit = t;
            break;
          }
        }
        if (!hit) return;
        store.despawn(s.id);
        s.done = true;
        apply(e.effects, hit, s.dir, { ...s.cause, origin: copy(u.pos) });
        return;
      }
      case 'decoy':
      case 'turret': {
        if (tick < s.nextAttack) return;
        s.nextAttack = tick + ticks(SUMMON.attackS);
        const t = acquire(u, s, e.trigger?.radius ?? SUMMON.attackRange, e.trigger?.affects ?? ENEMIES);
        u.unit.target = t?.id ?? null;
        if (!t) return;
        u.unit.attacking = true;
        const dx = t.pos.x - u.pos.x;
        const dz = t.pos.z - u.pos.z;
        apply(e.effects, t, flat({ x: dx, y: 0, z: dz }), { ...s.cause, origin: copy(u.pos) });
        return;
      }
      default:
        hooksOf(s.cause.source)?.onEffect?.(e.behaviour, { entity: u.id, point: copy(u.pos), dir: copy(s.dir) }, s.cause);
    }
  };

  // ── Tethers ────────────────────────────────────────────────────────────────────────────────────────────────

  effects.handle('tether', 'abilities', (effect, target, cause) => {
    const { source } = cause;
    if (source === null || target.entity === null || target.entity === source) return;
    const interval = Math.max(1, ticks(effect.intervalS ?? EFFECT_TICK_SECONDS));
    tethers.push({
      source,
      target: target.entity,
      effect,
      cause,
      expiresAt: clock.tick + lasting(effect.durationS, cause),
      interval,
      breakSq: effect.breakDistance * effect.breakDistance,
      nextTick: clock.tick + interval,
      done: false,
    });
    ctx.bus.emit({ type: 'tether', source, target: target.entity, ability: cause.ability, stage: 'start' });
  });

  /** Expiry, breaking beyond breakDistance, or either end dying: the client stops drawing the link. */
  const endTether = (t: TetherState): void => {
    t.done = true;
    ctx.bus.emit({ type: 'tether', source: t.source, target: t.target, ability: t.cause.ability, stage: 'end' });
  };

  const tickTether = (t: TetherState): void => {
    const s = alive(t.source);
    const g = alive(t.target);
    if (!s || !g || distSq(s.pos, g.pos) > t.breakSq) {
      endTether(t);
      return;
    }
    if (clock.tick >= t.nextTick) {
      t.nextTick += t.interval;
      const toTarget = flat({ x: g.pos.x - s.pos.x, y: 0, z: g.pos.z - s.pos.z });
      apply(t.effect.onSourceTick, s, toTarget, t.cause);
      apply(t.effect.onTargetTick, g, toTarget, t.cause);
    }
    if (clock.tick >= t.expiresAt) endTether(t);
  };

  /** Runs `step` on every live entry, including ones added meanwhile, then drops finished ones. */
  const each = <T extends { done: boolean }>(list: T[], step: (x: T) => void): void => {
    for (let i = 0; i < list.length; i++) {
      const x = list[i] as T;
      if (!x.done) step(x);
    }
    let w = 0;
    for (const x of list) if (!x.done) list[w++] = x;
    list.length = w;
  };

  return {
    tick() {
      hitThisTick.clear();
      each(areas, tickArea);
      each(summons, tickSummon);
      each(tethers, tickTether);
    },
    hash(h) {
      for (const a of areas) {
        h.num(a.id);
        h.num(a.nextTick);
        for (const [id, t] of a.lastIn) {
          h.num(id);
          h.num(t);
        }
      }
      for (const s of summons) {
        h.num(s.id);
        h.num(s.nextAttack);
        h.num(s.expiresAt);
      }
      for (const t of tethers) {
        h.num(t.source);
        h.num(t.target);
        h.num(t.nextTick);
        h.num(t.expiresAt);
      }
    },
  };
}
