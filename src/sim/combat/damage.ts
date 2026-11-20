/**
 * The damage pipeline (GDD §5.2, INTERFACES §6), healing (§5.11), shields (§5.10), kill credit and assists, hero
 * death and respawn (§8.9), the combat state (§5.13) and the heal on level-up (§8.6).
 */
import { COMBAT } from '../data/combat';
import { EFFECT_TICK_SECONDS, TICK_RATE } from '../data/core';
import type {
  Damageable,
  DamageBonus,
  DamageEffect,
  DamageType,
  EffectCause,
  EffectTarget,
  Entity,
  EntityId,
  Hasher,
  HealEffect,
  HeroEntity,
  HeroId,
  ShieldEffect,
  SimContext,
  StatusInstance,
  StructureEntity,
  StructureType,
  UnitEntity,
  UnitType,
  Vec3,
} from '../core/contracts';
import { clamp, copy, ticks } from '../core/math';
import type { Hitboxes } from './hitboxes';
import type { Statuses } from './statuses';
import { Melee } from './types';
import type { HeroState } from './types';
import * as dmath from '../core/dmath';

const SECONDS_PER_MINUTE = 60;
/** Summon → owner → … chains are short; this bounds the walk. */
const MAX_OWNER_HOPS = 3;

/** Which beak-shot rule a hit uses (GDD §5.4). */
export const Beak = { None: 0, Gun: 1, Ability: 2 } as const;

export interface GunShot {
  beakFlat: number;
  readonly closeDamage: number;
}

/** One queued hit. Pooled: valid until the damage phase resolves it. */
export interface Req {
  target: EntityId;
  cause: EffectCause;
  type: DamageType;
  /** Step 1 result (gun damage with Molt growth, ability base + k × SP, melee). */
  base: number;
  /** Step 2 multiplier. */
  falloff: number;
  beak: (typeof Beak)[keyof typeof Beak];
  /** The gun's beak multiplier (before the attacker's bonus). */
  beakMult: number;
  gunBonus: number;
  shot: GunShot | null;
  /** A gun hit on the Patron's weak point. */
  weak: boolean;
  /** Conditional bonuses, %HP parts and execute, for `damage` effects. */
  effect: DamageEffect | null;
  /** A heavy melee swing (StructureInfo.breakable 'heavyMelee', its `heavy` amount). */
  heavy: boolean;
  /** A repeat of an earlier hit on this target (D-SYS-014): the final amount, which skips steps 1–7; else −1. */
  repeat: number;
  readonly point: Vec3;
}

/** The hit whose `damage.applied` is being handled, for `triggerPct` (D-SYS-014). */
interface TriggerHit {
  readonly target: EntityId;
  /** After step 5, before the target's resists. */
  readonly preResist: number;
  /** After step 7: what the event reports. */
  readonly amount: number;
}

export interface Damage {
  /** Queue a hit for this tick's damage phase (or the next, once the phase has run); fill optional fields on the result. */
  request(target: EntityId, cause: EffectCause, type: DamageType, base: number, point: Vec3): Req;
  /** The `damage` effect; `scale` multiplies the amount (DoT magnitude and stacks). */
  effect(fx: DamageEffect, target: EffectTarget, cause: EffectCause, scale: number): void;
  /** Damage phase: resolve every queued hit in arrival order. */
  resolve(): void;
  /** Heal through healAmp and heal reduction; returns the hp restored. */
  heal(e: Damageable, amount: number, cause: EffectCause | null): number;
  healEffect(fx: HealEffect, target: EffectTarget, cause: EffectCause, scale: number): void;
  shield(fx: ShieldEffect, target: EffectTarget, cause: EffectCause): void;
  /** `cause` healed, shielded or buffed `e` (assist ledger). */
  supported(cause: EffectCause, e: Damageable): void;
  /**
   * A status was applied with `cause`: if that happened while a hit's `damage.applied` was being handled, `triggerPct`
   * damage in the status's onExpire effects later refers to that hit (a delayed repeat, Echo Chamber, D-SYS-014).
   */
  bind(cause: EffectCause): void;
  inCombat(e: HeroEntity): void;
  levelUp(hero: EntityId, level: number): void;
  /** Statuses phase: heals over time, shield expiry and recharge, regeneration, level-up heals, respawns. */
  tick(): void;
  drop(id: EntityId): void;
  hash(h: Hasher): void;
}

/** GDD §8.9: min(55, 8 + 1.2 × minutes) s rounded to 0.1 s, halved while the hero's flock holds the Ember. */
export function respawnSeconds(matchSeconds: number, ember: boolean): number {
  const { baseS, perMinuteS, maxS, roundS, emberMult } = COMBAT.respawn;
  const s = Math.round(Math.min(maxS, baseS + (perMinuteS * matchSeconds) / SECONDS_PER_MINUTE) / roundS) * roundS;
  return ember ? s * emberMult : s;
}

export function isDamageable(e: Entity | undefined): e is Damageable {
  return e !== undefined && (e.kind === 'hero' || e.kind === 'unit' || e.kind === 'structure');
}

interface ShieldRec {
  readonly e: Damageable;
  readonly absorbs: 'talon' | 'song' | 'barrier';
  amount: number;
  readonly full: number;
  readonly expiresAt: number;
  /** Ticks without damage before it refills; 0 for none. */
  readonly recharge: number;
  lastHit: number;
}

interface HealOverTime {
  readonly e: Damageable;
  readonly cause: EffectCause;
  readonly per: number;
  left: number;
  next: number;
}

export function createDamage(
  ctx: SimContext,
  hb: Hitboxes,
  statuses: Statuses,
  heroes: ReadonlyMap<EntityId, HeroState>,
): Damage {
  const reqs: Req[] = [];
  let count = 0;
  const shields: ShieldRec[] = [];
  const depletedPatrons = new WeakSet<StructureEntity>();
  const hots: HealOverTime[] = [];
  /** Hero victim → enemy hero → last tick it damaged the victim. */
  const damagers = new Map<EntityId, Map<EntityId, number>>();
  /** Hero → allied hero → last tick it healed, shielded or buffed it. */
  const supporters = new Map<EntityId, Map<EntityId, number>>();
  const headScratch = { x: 0, y: 0, z: 0 };
  const interval = EFFECT_TICK_SECONDS * TICK_RATE;
  /** The hit being reported on the bus right now, or null (D-SYS-014). */
  let live: TriggerHit | null = null;
  /** Causes of statuses applied while a hit was reported → that hit (delayed repeats). */
  const bound = new WeakMap<EffectCause, TriggerHit>();
  /** GDD §7.12 Rekindle: hero → the `until` of the buff it already revived under. */
  const revivedUnder = new Map<EntityId, number>();
  /** Heroes waiting to revive → where they fell. */
  const revivals = new Map<EntityId, Vec3>();

  const note = (ledger: Map<EntityId, Map<EntityId, number>>, key: EntityId, who: EntityId): void => {
    let m = ledger.get(key);
    if (!m) ledger.set(key, (m = new Map()));
    m.set(who, ctx.clock.tick);
  };

  /** The hero credited for an entity's hits: itself, or the owner of a summon or projectile. */
  const creditOf = (id: EntityId | null): EntityId | null => {
    let e = id === null ? undefined : ctx.store.get(id);
    for (let i = 0; i <= MAX_OWNER_HOPS && e; i++) {
      if (e.kind === 'hero') return e.id;
      const owner = e.kind === 'unit' ? e.unit.owner : e.kind === 'projectile' ? e.projectile.owner : null;
      e = owner === null ? undefined : ctx.store.get(owner);
    }
    return null;
  };

  const inCombat = (e: HeroEntity): void => {
    e.health.inCombatUntil = Math.max(e.health.inCombatUntil, ctx.clock.tick + ticks(COMBAT.combatStateS));
  };

  const supported = (cause: EffectCause, e: Damageable): void => {
    const by = creditOf(cause.source);
    if (by === null || by === e.id || e.kind !== 'hero' || ctx.store.get(by)?.team !== e.team) return;
    note(supporters, e.id, by);
  };

  const heal = (e: Damageable, amount: number, cause: EffectCause | null): number => {
    if (e.health.dead || !(amount > 0)) return 0;
    const st = e.stats.final;
    const amt = amount * (1 + st.healAmp) * (1 - Math.min(1, st.healReduction));
    const applied = Math.min(amt, st.maxHealth - e.health.hp);
    if (!(applied > 0)) return 0;
    e.health.hp += applied;
    noteTrainingActivity(e);
    ctx.bus.emit({ type: 'heal.applied', source: cause?.source ?? null, target: e.id, amount: applied,
      ability: cause?.ability ?? null, item: cause?.item ?? null });
    if (cause) supported(cause, e);
    return applied;
  };

  const shieldTotals = (e: Damageable): void => {
    let talon = 0;
    let song = 0;
    let barrier = 0;
    for (const s of shields) {
      if (s.e !== e) continue;
      if (s.absorbs === 'talon') talon += s.amount;
      else if (s.absorbs === 'song') song += s.amount;
      else barrier += s.amount;
    }
    e.health.talonShield = talon;
    e.health.songShield = song;
    e.health.barrier = barrier;
  };

  const drainKind = (e: Damageable, kind: ShieldRec['absorbs'], dmg: number): number => {
    let left = dmg;
    for (const s of shields) {
      if (left <= 0) break;
      if (s.e !== e || s.absorbs !== kind) continue;
      const take = Math.min(left, s.amount);
      s.amount -= take;
      left -= take;
    }
    return left;
  };

  /** Step 8: matching typed shields oldest first, then barriers oldest first. Returns the part absorbed. */
  const drainShields = (e: Damageable, type: DamageType, dmg: number): number => {
    let touched = false;
    for (const s of shields) {
      if (s.e !== e) continue;
      touched = true;
      s.lastHit = ctx.clock.tick;
    }
    if (!touched) return 0;
    const left = drainKind(e, 'barrier', drainKind(e, type, dmg));
    for (let i = shields.length - 1; i >= 0; i--) {
      const s = shields[i] as ShieldRec;
      if (s.e === e && s.amount <= 0 && s.recharge === 0) shields.splice(i, 1);
    }
    shieldTotals(e);
    return dmg - left;
  };

  const bonusHolds = (b: DamageBonus, e: Damageable, src: Entity | undefined, cause: EffectCause): boolean => {
    if (b.targetHpBelow !== undefined && !(e.health.hp < ctx.effects.magnitude(b.targetHpBelow, cause) * e.stats.final.maxHealth)) {
      return false;
    }
    if (b.targetKinds && !b.targetKinds.includes(e.kind)) return false;
    if (b.maxDistance !== undefined || b.minDistance !== undefined) {
      const from = src?.pos ?? cause.origin;
      const d = dmath.hypot(e.pos.x - from.x, e.pos.y - from.y, e.pos.z - from.z);
      if (b.maxDistance !== undefined && d > b.maxDistance) return false;
      if (b.minDistance !== undefined && d < b.minDistance) return false;
    }
    return b.targetHasStatus === undefined || statuses.has(e, b.targetHasStatus);
  };

  const assistsFor = (v: HeroEntity, credit: EntityId | null): EntityId[] => {
    const now = ctx.clock.tick;
    const window = ticks(COMBAT.assistWindowS);
    const out: EntityId[] = [];
    const contributors: EntityId[] = [];
    if (credit !== null && ctx.store.get(credit)?.team !== v.team) contributors.push(credit);
    const add = (id: EntityId): void => {
      if (id !== credit && !out.includes(id)) out.push(id);
    };
    for (const [h, t] of damagers.get(v.id) ?? []) {
      if (now - t > window) continue;
      add(h);
      contributors.push(h);
    }
    for (const c of contributors) for (const [s, t] of supporters.get(c) ?? []) if (now - t <= window) add(s);
    return out.sort((a, b) => a - b);
  };

  const victimType = (e: Damageable): HeroId | UnitType | StructureType =>
    e.kind === 'hero' ? e.hero.heroId : e.kind === 'unit' ? e.unit.type : e.structure.type;

  const die = (e: Damageable, cause: EffectCause, credit: EntityId | null, beakShot: boolean): void => {
    const now = ctx.clock.tick;
    const assisters = e.kind === 'hero' ? assistsFor(e, credit) : [];
    e.health.hp = 0;
    let revives = false;
    if (e.kind === 'hero') {
      e.health.dead = true;
      const ember = ctx.teams[e.team].emberUntil > now;
      // GDD §7.12: with a Rekindle charge, once per hero per buff, the hero revives where it fell.
      const rk = ctx.teams[e.team].rekindle;
      revives = !e.hero.training && rk !== undefined && rk.charges > 0 && rk.until > now && revivedUnder.get(e.id) !== rk.until;
      if (revives && rk) {
        revivedUnder.set(e.id, rk.until);
        revivals.set(e.id, copy(e.pos));
      }
      e.health.respawnAt = now + ticks(
        e.hero.training ? COMBAT.trainingResetS : revives ? COMBAT.reviveS : respawnSeconds(ctx.clock.seconds, ember),
      );
      e.weapon.reloading = false;
      e.weapon.firing = false;
      delete e.weapon.meleePose;
      const s = heroes.get(e.id);
      if (s) {
        s.melee = Melee.Idle;
        s.parryOpen = -1;
        s.parryClose = -1;
        s.mods.length = 0;
        s.levelHeal = 0;
      }
      damagers.delete(e.id);
      supporters.delete(e.id);
    } else {
      e.health.dead = true;
      ctx.store.despawn(e.id);
    }
    ctx.bus.emit({
      type: 'entity.died',
      victim: e.id,
      victimKind: e.kind,
      victimTeam: e.team,
      victimType: victimType(e),
      killer: cause.source,
      creditHero: credit,
      assisters,
      via: cause.via,
      beakShot,
      pos: copy(e.pos),
      ...(revives && { revives: true }),
    });
    statuses.clear(e);
    dropHealth(e.id);
  };

  /** GDD §7.8, §7.12: inside a neutral unit's damage region (a sphere, cut off above maxY). */
  const inRegion = (r: NonNullable<UnitEntity['unit']['damageFrom']>, p: Vec3): boolean =>
    (r.maxY === undefined || p.y <= r.maxY) &&
    (p.x - r.centre.x) ** 2 + (p.y - r.centre.y) ** 2 + (p.z - r.centre.z) ** 2 <= r.radius * r.radius;

  /**
   * Steps 1–7 of GDD §5.2 for a hit on `e`. Returns the damage and writes the amount before the target's resists
   * (after step 5) into `pre[0]`.
   */
  const pipeline = (r: Req, e: Damageable, src: Entity | undefined, pre: number[]): number => {
    const st = e.stats.final;
    const ss = src && 'stats' in src ? src.stats.final : null;
    const via = r.cause.via;
    const talon = r.type === 'talon';
    const fx = r.effect;
    const max = st.maxHealth;
    // 1. Base (+ % of missing, current and max hp).
    let dmg = r.base;
    if (fx?.missingHpPct !== undefined) dmg += ctx.effects.magnitude(fx.missingHpPct, r.cause) * Math.max(0, max - e.health.hp);
    if (fx?.currentHpPct !== undefined) dmg += ctx.effects.magnitude(fx.currentHpPct, r.cause) * e.health.hp;
    if (fx?.maxHpPct !== undefined) dmg += ctx.effects.magnitude(fx.maxHpPct, r.cause) * max;
    // 2. Falloff.
    dmg *= r.falloff;
    // 3. Beak shot (head hitbox only, so never on units or structures).
    if (r.beak === Beak.Gun) dmg = dmg * (r.beakMult + (ss?.beakShotBonus ?? 0)) + (r.shot?.beakFlat ?? 0);
    else if (r.beak === Beak.Ability) dmg *= r.beakMult;
    // 4. Outgoing bonuses: additive within the step, applied once.
    let out = 0;
    if (via === 'weapon') out += (ss?.gunDamage ?? 0) + r.gunBonus;
    if (ss && !talon) out += ss.songDamage;
    if (fx?.bonus) for (const b of fx.bonus) if (bonusHolds(b, e, src, r.cause)) out += b.mult - 1;
    dmg *= 1 + out;
    // 5. Incoming amplification, capped, plus the melee-taken bonus for light and heavy melee: additive in the step.
    const melee = via === 'melee' ? st.meleeDamageTaken : 0;
    dmg *= Math.max(0, 1 + Math.min(COMBAT.ampCap, talon ? st.talonAmp : st.songAmp) + melee);
    pre[0] = dmg;
    // 6. Resist: stacked (by the stat model) minus shred, clamped.
    const resist = talon ? st.talonResist - st.talonShred : st.songResist - st.songShred;
    dmg *= 1 - clamp(resist, COMBAT.resistMin, COMBAT.resistMax);
    // 7. Structure rules.
    dmg *= st.damageTaken;
    if (e.kind === 'structure') {
      if (via === 'area' || via === 'status') dmg = 0;
      else if (via === 'melee') dmg *= COMBAT.structureMeleeMult;
      else if (!talon) dmg *= COMBAT.structureSongMult;
      if (via === 'weapon' && r.weak) dmg *= COMBAT.weakPointMult;
    }
    return dmg;
  };
  const preScratch = [0];

  const dropHealth = (id: EntityId): void => {
    let n = 0;
    for (const s of shields) if (s.e.id !== id) shields[n++] = s;
    shields.length = n;
    n = 0;
    for (const h of hots) if (h.e.id !== id) hots[n++] = h;
    hots.length = n;
    const e = ctx.store.get(id);
    if (isDamageable(e)) shieldTotals(e);
  };

  const noteTrainingActivity = (e: Damageable): void => {
    if (e.kind !== 'hero' || !e.hero.training) return;
    const s = heroes.get(e.id);
    if (s) s.trainingResetAt = ctx.clock.tick + ticks(COMBAT.trainingResetS);
  };

  const resolveOne = (r: Req): void => {
    const e = ctx.store.get(r.target);
    if (!isDamageable(e) || e.removed || e.health.dead) return;
    const st = e.stats.final;
    const cond = e.stats.conditions;
    if (cond.has('intangible')) return;
    const src = r.cause.source === null ? undefined : ctx.store.get(r.cause.source);
    const ss = src && 'stats' in src ? src.stats.final : null;
    const via = r.cause.via;
    const talon = r.type === 'talon';
    const fx = r.effect;
    const max = st.maxHealth;
    const firstPhase = e.kind === 'structure' && e.structure.type === 'patron' && e.structure.phase === 1;
    if (firstPhase && depletedPatrons.has(e)) return;
    // Neutral units: a hit counts only while its credited hero stands inside the unit's region (the Roc's Hollow,
    // a dormant camp's 35 m; GDD §§7.8, 7.12).
    if (e.kind === 'unit' && e.unit.damageFrom) {
      const by = creditOf(r.cause.source);
      const hero = by === null ? undefined : ctx.store.getKind(by, 'hero');
      if (hero && !inRegion(e.unit.damageFrom, hero.pos)) return;
    }
    // Breakables (Nests, Bell Feeders, GDD §§7.9, 7.14): only what `by` allows; a melee hit may deal a fixed amount.
    const brk = e.kind === 'structure' ? e.structure.breakable : undefined;
    if (brk && brk.by !== 'any' && (via !== 'melee' || (brk.by === 'heavyMelee' && !r.heavy))) return;
    const fixed = brk && via === 'melee' ? (r.heavy ? brk.heavy : brk.light) : undefined;

    // Steps 1–7, except for a fixed breakable amount and a repeat (both already final).
    let dmg: number;
    let preResist: number;
    if (r.repeat >= 0) dmg = preResist = r.repeat;
    else if (fixed !== undefined) dmg = preResist = fixed;
    else {
      dmg = pipeline(r, e, src, preScratch);
      preResist = preScratch[0] ?? dmg;
    }
    if (cond.has('invulnerable')) dmg = 0;
    if (!(dmg > 0)) return;
    if (r.beak === Beak.Gun && r.shot) r.shot.beakFlat = 0;
    // 8. Shields.
    const absorbed = drainShields(e, r.type, dmg);
    // 9. Health: undying floors at 1, an onLethal status saves the holder.
    let hp = e.health.hp - (dmg - absorbed);
    let lethal = hp <= 0 || (fx?.executeBelow !== undefined && hp < ctx.effects.magnitude(fx.executeBelow, r.cause) * max);
    let saved: StatusInstance | null = null;
    const depleted = firstPhase && lethal;
    if (depleted) {
      depletedPatrons.add(e);
      hp = 1;
      lethal = false;
    } else if (lethal && cond.has('undying')) {
      hp = Math.max(hp, 1);
      lethal = false;
    } else if (lethal && (saved = statuses.takeLethal(e))) {
      hp = 1;
      lethal = false;
    }
    e.health.hp = lethal ? 0 : hp;
    if (dmg > absorbed) noteTrainingActivity(e);

    const credit = creditOf(r.cause.source);
    const creditHero = credit === null ? undefined : ctx.store.getKind(credit, 'hero');
    if (e.kind === 'hero') {
      inCombat(e);
      if (creditHero) {
        inCombat(creditHero);
        if (creditHero.team !== e.team) note(damagers, e.id, creditHero.id);
      }
    }
    // Effects applied while this event is handled (item and ability triggers) can refer to this hit (triggerPct).
    const outer = live;
    live = { target: e.id, preResist, amount: dmg };
    ctx.bus.emit({
      type: 'damage.applied',
      source: r.cause.source,
      sourceTeam: r.cause.team,
      target: e.id,
      targetKind: e.kind,
      amount: dmg,
      absorbed,
      damageType: r.type,
      via,
      ability: r.cause.ability,
      item: r.cause.item,
      beakShot: r.beak !== Beak.None,
      weakPoint: via === 'weapon' && r.weak,
      proc: r.cause.proc,
      lethal,
      pos: copy(r.point),
    });
    live = outer;
    if (depleted) ctx.bus.emit({ type: 'patron.depleted', structure: e.id });
    if (saved?.def.onLethal) {
      const dir = { x: dmath.sin(e.yaw), y: 0, z: dmath.cos(e.yaw) };
      ctx.effects.applyAll(saved.def.onLethal, { entity: e.id, point: copy(e.pos), dir }, saved.cause);
    }
    // Lifesteal: a share of the post-step-7 damage (50% effective against non-heroes).
    if (ss && isDamageable(src)) {
      const ls = talon ? ss.talonLifesteal : ss.songLifesteal;
      if (ls > 0) heal(src, ls * dmg * (e.kind === 'hero' ? 1 : COMBAT.lifestealNonHeroMult), r.cause);
    }
    if (lethal) die(e, r.cause, credit, r.beak !== Beak.None);
  };

  const respawn = (s: HeroState): void => {
    const h = s.hero;
    const now = ctx.clock.tick;
    h.health.dead = false;
    h.health.respawnAt = null;
    h.health.hp = h.hero.training?.hp ?? h.stats.final.maxHealth;
    s.trainingResetAt = null;
    h.weapon.ammo = Math.round(h.stats.final.magazine);
    h.weapon.reloading = false;
    // Rekindle revives where the hero fell (GDD §7.12); everyone else respawns at the Home Roost.
    const fell = revivals.get(h.id);
    revivals.delete(h.id);
    const at = fell ?? s.spawn.pos;
    h.pos.x = at.x;
    h.pos.y = at.y;
    h.pos.z = at.z;
    h.vel.x = 0;
    h.vel.y = 0;
    h.vel.z = 0;
    s.nextFire = now;
    s.lockout = now;
    s.parryReady = Math.min(s.parryReady, now);
    ctx.bus.emit({ type: 'hero.respawned', hero: h.id, pos: copy(h.pos), ...(fell && { revived: true }) });
  };

  const flushLevelHeal = (s: HeroState): void => {
    const h = s.hero;
    const amount = Math.min(s.levelHeal, h.stats.final.maxHealth - h.health.hp);
    if (h.health.dead || !(amount > 0)) return;
    h.health.hp += amount;
    s.levelHeal -= amount;
    ctx.bus.emit({ type: 'heal.applied', source: h.id, target: h.id, amount, ability: null, item: null });
  };

  const request = (target: EntityId, cause: EffectCause, type: DamageType, base: number, point: Vec3): Req => {
    let r = reqs[count];
    if (!r) {
      r = {
        target, cause, type, base, falloff: 1, beak: Beak.None, beakMult: 1, gunBonus: 0, shot: null, weak: false, effect: null,
        heavy: false, repeat: -1, point: copy(point),
      };
      reqs.push(r);
    } else {
      r.target = target;
      r.cause = cause;
      r.type = type;
      r.base = base;
      r.falloff = 1;
      r.beak = Beak.None;
      r.beakMult = 1;
      r.gunBonus = 0;
      r.shot = null;
      r.weak = false;
      r.effect = null;
      r.heavy = false;
      r.repeat = -1;
      r.point.x = point.x;
      r.point.y = point.y;
      r.point.z = point.z;
    }
    count++;
    return r;
  };

  const regen = (list: readonly (HeroEntity | UnitEntity)[]): void => {
    for (const e of list) {
      const st = e.stats.final;
      if (e.health.dead || (e.kind === 'hero' && e.hero.training) || st.healthRegen <= 0 || e.health.hp >= st.maxHealth) continue;
      const gain = (st.healthRegen / TICK_RATE) * (1 - Math.min(1, st.healReduction));
      e.health.hp = Math.min(st.maxHealth, e.health.hp + gain);
    }
  };

  return {
    request,
    effect(fx, target, cause, scale) {
      const e = target.entity === null ? undefined : ctx.store.get(target.entity);
      if (!isDamageable(e)) return;
      let base = ctx.effects.magnitude(fx.amount, cause) * scale;
      let repeat = -1;
      // triggerPct (D-SYS-014): a share of the hit being reported (or the one a status bound). On another entity it is
      // a new hit worth that share of the hit before its target's resists; on the same target it repeats the hit: that
      // share of the damage it dealt, resisted once (no second pass through steps 1–7).
      const hit = fx.triggerPct === undefined ? null : (live ?? bound.get(cause) ?? null);
      if (hit && fx.triggerPct !== undefined) {
        const pct = ctx.effects.magnitude(fx.triggerPct, cause);
        if (hit.target === e.id) repeat = base + pct * hit.amount;
        else base += pct * hit.preResist;
      }
      const r = request(e.id, cause, fx.type, base, target.point);
      r.effect = fx;
      r.repeat = repeat;
      if (fx.beakShot) {
        const hr = hb.head(e, headScratch);
        const p = target.point;
        if (hr >= 0 && dmath.hypot(p.x - headScratch.x, p.y - headScratch.y, p.z - headScratch.z) <= hr) {
          r.beak = Beak.Ability;
          r.beakMult = fx.beakShotMult ?? COMBAT.abilityBeakShotMult;
        }
      }
      if (cause.via === 'ability' && cause.source !== null) {
        const caster = ctx.store.getKind(cause.source, 'hero');
        if (caster) inCombat(caster);
      }
    },
    resolve() {
      // Hits requested while resolving (splash from procs, onLethal effects) land in this same pass.
      for (let i = 0; i < count; i++) resolveOne(reqs[i] as Req);
      count = 0;
    },
    heal,
    healEffect(fx, target, cause, scale) {
      const e = target.entity === null ? undefined : ctx.store.get(target.entity);
      if (!isDamageable(e) || e.health.dead) return;
      const amount = ctx.effects.magnitude(fx.amount, cause) * scale;
      const over = fx.overS === undefined ? 0 : ctx.effects.magnitude(fx.overS, cause);
      if (over <= 0) {
        heal(e, amount, cause);
        return;
      }
      const n = Math.max(1, Math.round(over / EFFECT_TICK_SECONDS));
      hots.push({ e, cause, per: amount / n, left: n, next: ctx.clock.tick + interval });
    },
    shield(fx, target, cause) {
      const e = target.entity === null ? undefined : ctx.store.get(target.entity);
      if (!isDamageable(e) || e.health.dead) return;
      const amount = ctx.effects.magnitude(fx.amount, cause);
      const dur = fx.durationS === undefined ? Infinity : ticks(ctx.effects.magnitude(fx.durationS, cause));
      shields.push({
        e,
        absorbs: fx.absorbs,
        amount,
        full: amount,
        expiresAt: ctx.clock.tick + dur,
        recharge: fx.rechargeS === undefined ? 0 : Math.max(1, ticks(fx.rechargeS)),
        lastHit: ctx.clock.tick,
      });
      shieldTotals(e);
      ctx.bus.emit({ type: 'shield.applied', source: cause.source, target: e.id, amount, absorbs: fx.absorbs,
        ability: cause.ability, item: cause.item });
      supported(cause, e);
    },
    supported,
    bind(cause) {
      if (live) bound.set(cause, live);
    },
    inCombat,
    levelUp(hero, level) {
      const s = heroes.get(hero);
      if (!s) return;
      const gained = level - s.level;
      s.level = level;
      if (gained <= 0 || s.hero.health.dead) return;
      let perLevel = 0;
      for (const g of s.def.growth) if (g.stat === 'maxHealth' && g.op === 'add') perLevel += g.value;
      s.levelHeal += perLevel * gained;
      flushLevelHeal(s);
    },
    tick() {
      const now = ctx.clock.tick;
      // Heals over time.
      let n = 0;
      for (const h of hots) {
        while (h.left > 0 && h.next <= now && !h.e.health.dead) {
          heal(h.e, h.per, h.cause);
          h.left--;
          h.next += interval;
        }
        if (h.left > 0 && !h.e.health.dead && !h.e.removed) hots[n++] = h;
      }
      hots.length = n;
      // Shields: expiry and recharge.
      n = 0;
      let changed = false;
      for (const s of shields) {
        if (now >= s.expiresAt) {
          changed = true;
          s.e.health.talonShield = 0;
          s.e.health.songShield = 0;
          s.e.health.barrier = 0;
          continue;
        }
        if (s.recharge > 0 && s.amount < s.full && now - s.lastHit >= s.recharge) {
          s.amount = s.full;
          changed = true;
        }
        shields[n++] = s;
      }
      shields.length = n;
      if (changed) for (const s of shields) shieldTotals(s.e);
      // Level-up heals whose max-HP growth landed after the event, and respawns.
      for (const s of heroes.values()) {
        if (s.levelHeal > 0) flushLevelHeal(s);
        s.levelHeal = 0;
        const h = s.hero.health;
        h.hp = Math.min(h.hp, s.hero.stats.final.maxHealth);
        if (h.dead && h.respawnAt !== null && now >= h.respawnAt) respawn(s);
        const training = s.hero.hero.training;
        if (!h.dead && training && s.trainingResetAt !== null && now >= s.trainingResetAt) {
          const target = { entity: s.hero.id, point: training.pos, dir: { x: 0, y: 0, z: 1 } };
          ctx.effects.apply({ kind: 'teleport', to: 'point', face: 'keep' }, target, { ...s.meleeCause, origin: target.point });
          h.hp = training.hp;
          s.trainingResetAt = null;
        }
      }
      // Regeneration (heal reduction applies to it; structures don't regenerate, GDD §7).
      regen(ctx.store.list('hero'));
      regen(ctx.store.list('unit'));
    },
    drop(id) {
      dropHealth(id);
      damagers.delete(id);
      supporters.delete(id);
      revivedUnder.delete(id);
      revivals.delete(id);
    },
    hash(h) {
      for (const e of ctx.store.list('structure')) {
        if (e.structure.phase === 1 && depletedPatrons.has(e)) h.num(e.id);
      }
      for (const s of shields) {
        h.num(s.e.id);
        h.num(s.amount);
        h.num(s.expiresAt);
        h.num(s.lastHit);
      }
      for (const o of hots) {
        h.num(o.e.id);
        h.num(o.left);
        h.num(o.next);
      }
      h.value(damagers);
      h.value(supporters);
      h.value(revivedUnder);
      h.value(revivals);
    },
  };
}
