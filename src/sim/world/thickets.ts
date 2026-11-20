/**
 * Thickets, the neutral camps (GDD §7.8).
 *
 * Each `MapData.thickets` anchor is a camp of its family's creatures, spawned all at once at the family's first-spawn
 * time with HP (+2%/min) and damage (+0.5%/min) fixed for the spawn. A camp sleeps (`asleep`, no per-tick work; damage
 * from a hero more than 35 m away is dropped by combat through `damageFrom`) until a hero comes within 30 m. The first
 * damage to any creature wakes the whole camp and it fights: each creature attacks, with line of sight, the hero who
 * dealt the camp the most damage in the last 3 s. Creatures chase up to 3 m past the 18 m leash (indoor camps never
 * leave their room); past that, or after 6 s without taking damage, the camp walks home, heals to full and sleeps
 * 5 s after its last hero leaves 30 m. A camp returns all at once, its family's time after its last creature dies
 * (a Granary's Rats only once its Bell Feeder is also down). Economy pays the Seeds.
 *
 * Fledglings and creatures ignore each other (fledgling targeting skips neutrals; creatures attack heroes only).
 */
import type {
  CharacterMove, DamageEffect, EffectCause, EntityId, Hasher, HeroEntity, SimContext, ThicketAnchor, ThicketFamily, Tick,
  UnitEntity, Vec3,
} from '../core/contracts';
import { LAYERS_SOLID } from '../core/contracts';
import { ticks } from '../core/math';
import { SLOW } from '../data/combat';
import { TICK_SECONDS } from '../data/core';
import { AIR } from '../data/movement';
import { CREATURE_SPECIALS as SPECIAL, CREATURES, RAT_BITE, THICKET_FAMILIES, THICKETS as T } from '../data/world';
import type { CreatureDef, CreatureType } from '../data/world';
import type { Granary } from './nests';
import { clampToBox, flatDistSq, frameOf, minutes, targetOf, worldCause } from './neutral';
import type { BoxFrame } from './neutral';
import { aimHeight } from './vision';
import * as dmath from '../core/dmath';

/** Below this length a vector has no direction. */
const EPS = 1e-6;
/** A chasing creature stops this fraction of its reach from its target. */
const CLOSE_IN = 0.9;

type CampState = 'empty' | 'asleep' | 'idle' | 'fight' | 'home';

interface Creature {
  readonly e: UnitEntity;
  readonly def: CreatureDef;
  readonly home: Vec3;
  readonly cause: EffectCause;
  nextAttack: Tick;
  nextSpecial: Tick;
  /** A dash-bite or Slam winding up: when it lands. */
  windup: { readonly at: Tick; readonly kind: 'dashBite' | 'slam'; readonly target: EntityId } | null;
  target: HeroEntity | null;
  /** Line of sight to the target at the last retarget. */
  sees: boolean;
}

interface Camp {
  readonly index: number;
  readonly anchor: ThicketAnchor;
  readonly family: ThicketFamily;
  /** Indoor camps: their room (or building footprint), which creatures never leave. */
  readonly room: BoxFrame | null;
  readonly creatures: Creature[];
  state: CampState;
  /** Damage and HP scale fixed at the spawn. */
  dmgScale: number;
  /** Hero hits on the camp in the aggro window, oldest first. */
  readonly hits: { readonly hero: EntityId; readonly tick: Tick; readonly amount: number }[];
  lastHurt: Tick;
  idleSince: Tick;
  nextCheck: Tick;
  nextPick: Tick;
}

interface Puddle {
  readonly pos: Vec3;
  readonly until: Tick;
  readonly cause: EffectCause;
  readonly dps: number;
}

export const familyOf = (a: ThicketAnchor): ThicketFamily => a.family ?? (a.tier === 1 ? 'beetles' : a.tier === 2 ? 'weasels' : 'badgers');

export interface Thickets {
  /** Movement phase: walk awake creatures. */
  steer(): void;
  /** World phase: spawns, waking, targets, attacks. */
  update(): void;
  hash(h: Hasher): void;
}

export function createThickets(ctx: SimContext, granary: Granary): Thickets {
  const campAt = (ctx.objectives.campAt ??= ctx.map.thickets.map(() => null));
  const camps: Camp[] = ctx.map.thickets.map((anchor, index) => {
    const family = familyOf(anchor);
    campAt[index] = ticks(THICKET_FAMILIES[family].firstS);
    return { index, anchor, family, room: roomOf(ctx, anchor), creatures: [], state: 'empty', dmgScale: 1, hits: [], lastHurt: 0,
      idleSince: 0, nextCheck: 0, nextPick: 0 };
  });
  const campOf = new Map<EntityId, Camp>();
  const puddles: Puddle[] = [];
  const delta = { x: 0, y: 0, z: 0 };
  const moved: CharacterMove = { pos: { x: 0, y: 0, z: 0 }, grounded: false, wall: null };
  const from = { x: 0, y: 0, z: 0 };
  const dir = { x: 0, y: 0, z: 0 };
  const check = ticks(T.checkS);

  const heroNear = (c: Camp, r: number): boolean => {
    for (const h of ctx.store.list('hero')) {
      if (!h.health.dead && (h.pos.x - c.anchor.pos.x) ** 2 + (h.pos.y - c.anchor.pos.y) ** 2 + (h.pos.z - c.anchor.pos.z) ** 2 <= r * r) return true;
    }
    return false;
  };

  const spawn = (c: Camp): void => {
    const now = ctx.clock.tick;
    const fam = THICKET_FAMILIES[c.family];
    const m = minutes(ctx);
    const hpScale = 1 + T.hpPerMinute * m;
    c.dmgScale = 1 + T.damagePerMinute * m;
    const types: CreatureType[] = fam.units.flatMap((u) => Array<CreatureType>(u.n).fill(u.type));
    types.forEach((type, k) => {
      const def = CREATURES[type];
      const a = c.anchor.yaw + (2 * Math.PI * k) / types.length;
      const home = { x: c.anchor.pos.x + dmath.sin(a) * T.spreadM, y: c.anchor.pos.y, z: c.anchor.pos.z + dmath.cos(a) * T.spreadM };
      if (c.room) clampToBox(c.room, home, T.wallMarginM + def.radius);
      home.y = ctx.physics.groundHeight(home.x, home.z, c.anchor.pos.y + 1) ?? c.anchor.pos.y;
      const hp = def.hp * hpScale;
      const e = ctx.store.spawn({
        kind: 'unit', team: 'neutral', pos: { ...home }, vel: { x: 0, y: 0, z: 0 }, yaw: a + Math.PI, radius: def.radius,
        unit: { type, lane: null, height: def.height, owner: null, summon: null, target: null, attacking: false, camp: c.index,
          asleep: true, damageFrom: { centre: { ...c.anchor.pos }, radius: T.snipeM } },
        health: { hp, talonShield: 0, songShield: 0, barrier: 0, dead: false, respawnAt: null, inCombatUntil: 0 },
        stats: ctx.stats.create({ maxHealth: hp, moveSpeed: def.speed, talonResist: fam.resists.talon, songResist: fam.resists.song }),
        statuses: [],
      });
      c.creatures.push({ e, def, home, cause: worldCause(e.id, 'neutral', home, 'unit'), nextAttack: now, nextSpecial: now, windup: null,
        target: null, sees: false });
      campOf.set(e.id, c);
    });
    c.state = 'asleep';
    c.hits.length = 0;
    campAt[c.index] = null;
    ctx.bus.emit({ type: 'objective', action: 'campSpawned', hero: null, team: 'neutral', pickup: null, pickupType: null,
      pos: { ...c.anchor.pos }, camp: c.index });
  };

  const setAsleep = (c: Camp, asleep: boolean): void => {
    c.state = asleep ? 'asleep' : 'idle';
    c.idleSince = ctx.clock.tick;
    for (const k of c.creatures) {
      k.e.unit.asleep = asleep;
      k.e.unit.damageFrom = asleep ? { centre: { ...c.anchor.pos }, radius: T.snipeM } : null;
      ctx.bus.emit({ type: 'unit.state', unit: k.e.id, state: asleep ? 'asleep' : 'awake' });
    }
  };

  const fight = (c: Camp): void => {
    if (c.state === 'asleep') setAsleep(c, false);
    if (c.state !== 'fight') {
      const now = ctx.clock.tick;
      c.state = 'fight';
      c.nextPick = now;
      for (const k of c.creatures) {
        const sp = k.def.special;
        k.nextSpecial = now + (sp ? Math.round(ticks(SPECIAL[sp].everyS) / 2) : 0);
      }
    }
  };

  const goHome = (c: Camp): void => {
    c.state = 'home';
    c.hits.length = 0;
    for (const k of c.creatures) {
      k.target = null;
      k.windup = null;
      k.e.unit.target = null;
      k.e.unit.attacking = false;
    }
  };

  const lineOfSight = (k: Creature, h: HeroEntity): boolean => {
    from.x = k.e.pos.x;
    from.y = k.e.pos.y + k.def.height;
    from.z = k.e.pos.z;
    const tx = h.pos.x - from.x;
    const ty = h.pos.y + aimHeight(ctx, h) - from.y;
    const tz = h.pos.z - from.z;
    const d = dmath.hypot(tx, ty, tz);
    if (d < EPS) return true;
    dir.x = tx / d;
    dir.y = ty / d;
    dir.z = tz / d;
    return ctx.physics.raycast(from, dir, d, LAYERS_SOLID, h.id) === null;
  };

  /** Every creature takes the top damager of the last 3 s it can see; with no recent damage it keeps its target. */
  const retarget = (c: Camp): void => {
    const now = ctx.clock.tick;
    const window = ticks(T.aggroWindowS);
    let n = 0;
    while (n < c.hits.length && now - c.hits[n]!.tick > window) n++;
    c.hits.splice(0, n);
    const totals = new Map<EntityId, number>();
    for (const hit of c.hits) totals.set(hit.hero, (totals.get(hit.hero) ?? 0) + hit.amount);
    const ranked = [...totals].sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .map(([id]) => ctx.store.getKind(id, 'hero'))
      .filter((h): h is HeroEntity => h !== undefined && !h.health.dead);
    for (const k of c.creatures) {
      const seen = ranked.find((h) => lineOfSight(k, h));
      const kept = k.target && !k.target.health.dead ? k.target : null;
      const t = seen ?? ranked[0] ?? kept;
      k.target = t;
      k.sees = t !== null && (t === seen || (ranked.length === 0 && lineOfSight(k, t)));
      k.e.unit.target = t?.id ?? null;
    }
  };

  const cue = (k: Creature, attack: 'bite' | 'dashBite' | 'lash' | 'spit' | 'slam', point: Vec3, at: Tick): void => {
    ctx.bus.emit({ type: 'unit.attack', unit: k.e.id, attack, origin: { x: k.e.pos.x, y: k.e.pos.y + k.def.height / 2, z: k.e.pos.z },
      point: { ...point }, impactAt: at });
  };

  const hurt = (k: Creature, h: HeroEntity, amount: number, type: 'talon' | 'song'): void => {
    const fx: DamageEffect = { kind: 'damage', amount, type };
    ctx.effects.apply(fx, targetOf(h), k.cause);
  };

  /** Within reach: centre to the target's surface. */
  const inReach = (k: Creature, h: HeroEntity, reach: number): boolean => {
    const r = reach + h.radius;
    return flatDistSq(k.e.pos, h.pos) <= r * r && Math.abs(h.pos.y - k.e.pos.y) <= reach + 2;
  };

  const land = (c: Camp, k: Creature): void => {
    const w = k.windup!;
    k.windup = null;
    if (w.kind === 'slam') {
      for (const h of ctx.store.list('hero')) {
        if (h.health.dead || flatDistSq(h.pos, k.e.pos) > SPECIAL.slam.radius ** 2 || Math.abs(h.pos.y - k.e.pos.y) > SPECIAL.slam.radius) continue;
        hurt(k, h, SPECIAL.slam.damage * c.dmgScale, 'song');
        ctx.effects.apply({ kind: 'displace', mode: 'push', distance: SPECIAL.slam.push }, targetOf(h), { ...k.cause, origin: { ...k.e.pos } });
      }
      return;
    }
    const h = ctx.store.getKind(w.target, 'hero');
    if (h && !h.health.dead && inReach(k, h, k.def.reach + 1)) hurt(k, h, SPECIAL.dashBite.damage * c.dmgScale, 'talon');
  };

  const special = (c: Camp, k: Creature, h: HeroEntity, now: Tick): void => {
    const sp = k.def.special;
    if (!sp || now < k.nextSpecial) return;
    if (sp === 'dashBite') {
      if (!inReach(k, h, SPECIAL.dashBite.lungeM + k.def.reach)) return;
      const d = Math.max(0, Math.sqrt(flatDistSq(k.e.pos, h.pos)) - h.radius - k.def.reach);
      const at = now + Math.max(1, ticks(d / SPECIAL.dashBite.speed));
      k.windup = { at, kind: 'dashBite', target: h.id };
      cue(k, 'dashBite', h.pos, at);
    } else if (sp === 'slam') {
      if (!inReach(k, h, SPECIAL.slam.radius)) return;
      const at = now + ticks(SPECIAL.slam.telegraphS);
      k.windup = { at, kind: 'slam', target: h.id };
      cue(k, 'slam', k.e.pos, at);
    } else {
      if (!inReach(k, h, SPECIAL.spit.range)) return;
      cue(k, 'spit', h.pos, now);
      puddles.push({ pos: { ...h.pos }, until: now + ticks(SPECIAL.spit.durationS), cause: k.cause, dps: SPECIAL.spit.dps * c.dmgScale });
    }
    k.nextSpecial = now + ticks(SPECIAL[sp].everyS);
  };

  const attack = (c: Camp, k: Creature, now: Tick): void => {
    const h = k.target;
    k.e.unit.attacking = false;
    if (k.windup) {
      if (now >= k.windup.at) land(c, k);
      return;
    }
    if (!h || h.health.dead || !k.sees || k.e.stats.conditions.has('stunned')) return;
    k.e.yaw = dmath.atan2(h.pos.x - k.e.pos.x, h.pos.z - k.e.pos.z);
    special(c, k, h, now);
    if (k.windup || !inReach(k, h, k.def.reach)) return;
    k.e.unit.attacking = true;
    if (now < k.nextAttack) return;
    k.nextAttack = now + ticks(k.def.intervalS);
    cue(k, k.def.attack, h.pos, now);
    hurt(k, h, k.def.damage * c.dmgScale, k.def.damageType);
    const hr = k.def.healReduction;
    if (hr) ctx.effects.apply({ kind: 'applyStatus', status: RAT_BITE, durationS: hr.durationS, magnitude: hr.value }, targetOf(h), k.cause);
  };

  const puddleTick = (now: Tick): void => {
    const every = ticks(SPECIAL.spit.tickS);
    let n = 0;
    for (const p of puddles) {
      if (now >= p.until) continue;
      puddles[n++] = p;
      if ((p.until - now) % every !== 0) continue;
      for (const h of ctx.store.list('hero')) {
        if (h.health.dead || flatDistSq(h.pos, p.pos) > SPECIAL.spit.radius ** 2 || Math.abs(h.pos.y - p.pos.y) > SPECIAL.spit.radius) continue;
        ctx.effects.apply({ kind: 'damage', amount: p.dps * SPECIAL.spit.tickS, type: 'song' }, targetOf(h), p.cause);
        ctx.effects.apply({ kind: 'applyStatus', status: SLOW, durationS: SPECIAL.spit.tickS + TICK_SECONDS, magnitude: SPECIAL.spit.slow },
          targetOf(h), p.cause);
      }
    }
    puddles.length = n;
  };

  const step = (k: Creature, c: Camp, tx: number, tz: number, speed: number): void => {
    const e = k.e;
    let mx = tx - e.pos.x;
    let mz = tz - e.pos.z;
    const l = dmath.hypot(mx, mz);
    const max = speed * TICK_SECONDS;
    if (l > max) {
      mx *= max / l;
      mz *= max / l;
    }
    e.vel.y -= AIR.gravity * TICK_SECONDS;
    delta.x = mx;
    delta.y = e.vel.y * TICK_SECONDS;
    delta.z = mz;
    const r = ctx.physics.moveCharacter(e.id, delta, moved);
    if (r.grounded) e.vel.y = 0;
    e.pos.x = r.pos.x;
    e.pos.y = r.pos.y;
    e.pos.z = r.pos.z;
    if (c.room) clampToBox(c.room, e.pos, T.wallMarginM + k.def.radius);
    e.vel.x = mx / TICK_SECONDS;
    e.vel.z = mz / TICK_SECONDS;
    if (l > EPS) e.yaw = dmath.atan2(mx, mz);
  };

  const stand = (k: Creature): void => {
    k.e.vel.x = 0;
    k.e.vel.z = 0;
  };

  ctx.bus.on('damage.applied', (ev) => {
    if (ev.targetKind !== 'unit') return;
    const c = campOf.get(ev.target);
    if (!c || c.state === 'empty') return;
    let by = ev.source === null ? undefined : ctx.store.get(ev.source);
    if (by?.kind === 'unit' && by.unit.owner !== null) by = ctx.store.get(by.unit.owner);
    if (by?.kind !== 'hero') return;
    // Asleep: only a hero within 35 m wakes it (combat drops damage from further away through `damageFrom`).
    if (c.state === 'asleep' && (by.pos.x - c.anchor.pos.x) ** 2 + (by.pos.y - c.anchor.pos.y) ** 2 + (by.pos.z - c.anchor.pos.z) ** 2 > T.snipeM ** 2) return;
    c.hits.push({ hero: by.id, tick: ctx.clock.tick, amount: ev.amount });
    c.lastHurt = ctx.clock.tick;
    if (c.state !== 'home') fight(c);
  });

  ctx.bus.on('entity.died', (ev) => {
    if (ev.victimKind !== 'unit') return;
    const c = campOf.get(ev.victim);
    if (!c) return;
    campOf.delete(ev.victim);
    const i = c.creatures.findIndex((k) => k.e.id === ev.victim);
    if (i >= 0) c.creatures.splice(i, 1);
    if (c.creatures.length > 0) return;
    cleared(c, ev.creditHero, ev.pos);
  });

  const cleared = (c: Camp, hero: EntityId | null, pos: Vec3): void => {
    const team = hero === null ? undefined : ctx.store.get(hero)?.team;
    c.state = 'empty';
    c.hits.length = 0;
    if (granary.has(c.index)) granary.ratsDown(c.index);
    else campAt[c.index] = ctx.clock.tick + ticks(THICKET_FAMILIES[c.family].respawnS);
    ctx.bus.emit({ type: 'objective', action: 'campCleared', hero, team: team ?? 'neutral', pickup: null, pickupType: null,
      pos: { ...pos }, camp: c.index });
  };

  return {
    steer() {
      for (const c of camps) {
        if (c.state !== 'fight' && c.state !== 'home') continue;
        for (const k of c.creatures) {
          const e = k.e;
          if (e.removed || e.stats.conditions.has('stunned') || e.stats.conditions.has('rooted')) continue;
          const speed = e.stats.final.moveSpeed * (1 - Math.min(1, e.stats.final.slow));
          if (c.state === 'home') {
            if (flatDistSq(e.pos, k.home) > T.homeM ** 2) step(k, c, k.home.x, k.home.z, speed);
            else stand(k);
            continue;
          }
          const w = k.windup;
          const h = k.target;
          if (w?.kind === 'dashBite') {
            const t = ctx.store.getKind(w.target, 'hero');
            if (t && !inReach(k, t, k.def.reach)) step(k, c, t.pos.x, t.pos.z, SPECIAL.dashBite.speed);
            else stand(k);
          } else if (!w && h && !h.health.dead && !(k.sees && inReach(k, h, k.def.reach * CLOSE_IN))) {
            step(k, c, h.pos.x, h.pos.z, speed);
          } else stand(k);
        }
      }
    },

    update() {
      const now = ctx.clock.tick;
      for (const c of camps) {
        if (c.state === 'empty') {
          const t = campAt[c.index];
          if (t != null && now >= t) spawn(c);
          continue;
        }
        let k = 0;
        for (const x of c.creatures) if (!x.e.removed) c.creatures[k++] = x;
        c.creatures.length = k;
        if (k === 0) {
          cleared(c, null, c.anchor.pos);
          continue;
        }
        if (c.state === 'asleep') {
          if (heroNear(c, T.wakeM)) setAsleep(c, false);
          continue;
        }
        if (c.state === 'idle') {
          if ((now + c.index) % check !== 0) continue;
          if (heroNear(c, T.wakeM)) c.idleSince = now;
          else if (now - c.idleSince >= ticks(T.sleepS)) setAsleep(c, true);
          continue;
        }
        if (c.state === 'home') {
          if (c.creatures.every((x) => flatDistSq(x.e.pos, x.home) <= T.homeM ** 2)) {
            for (const x of c.creatures) ctx.effects.apply({ kind: 'heal', amount: x.e.stats.final.maxHealth }, targetOf(x.e), x.cause);
            c.state = 'idle';
            c.idleSince = now;
          }
          continue;
        }
        // Past the leash and 3 m more, or 6 s without damage while dragged past the leash or with no hero in sight to
        // fight, the camp walks home (D-OBJ-012). A hero fighting it inside the leash keeps it fighting.
        const chase = T.leashM + T.chaseM;
        const far = c.creatures.some((x) => flatDistSq(x.e.pos, c.anchor.pos) > T.leashM ** 2);
        const engaged = c.creatures.some((x) => x.sees && x.target !== null && !x.target.health.dead);
        if (c.creatures.some((x) => flatDistSq(x.e.pos, c.anchor.pos) > chase * chase) ||
            (now - c.lastHurt >= ticks(T.calmS) && (far || !engaged))) {
          goHome(c);
          continue;
        }
        if (now >= c.nextPick) {
          c.nextPick = now + ticks(T.retargetS);
          retarget(c);
        }
        for (const x of c.creatures) attack(c, x, now);
      }
      if (puddles.length > 0) puddleTick(now);
    },

    hash(h) {
      for (const c of camps) {
        h.value([c.state, c.dmgScale, c.lastHurt, c.idleSince, c.nextPick, c.hits]);
        for (const k of c.creatures) h.value([k.e.id, k.nextAttack, k.nextSpecial, k.windup, k.target?.id ?? -1, k.sees]);
      }
      h.value(puddles.map((p) => [p.pos, p.until, p.dps, p.cause.source]));
    },
  };
}

/** An indoor camp's room (its building and storey), else its building's footprint; null outdoors. */
function roomOf(ctx: SimContext, a: ThicketAnchor): BoxFrame | null {
  if (a.building === undefined) return null;
  const room = ctx.map.rooms?.find((r) => r.building === a.building && r.storey === (a.storey ?? 0));
  const volume = room?.volume ?? ctx.map.buildings?.[a.building]?.footprint;
  return volume ? frameOf(volume) : null;
}
