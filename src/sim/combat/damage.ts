/**
 * The damage pipeline (GDD §5.2, INTERFACES §6), healing (§5.11), shields (§5.10), kill credit and assists, hero
 * death and respawn (§8.9), the combat state (§5.13) and the heal on level-up (§8.6).
 */
import { COMBAT } from '../data/combat';
import { TICK_RATE } from '../data/core';
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

const SECONDS_PER_MINUTE = 60;
/** Summon → owner → … chains are short; this bounds the walk. */
const MAX_OWNER_HOPS = 3;

/** Which beak-shot rule a hit uses (GDD §5.4). */
export const Beak = { None: 0, Gun: 1, Ability: 2 } as const;

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
  /** A gun hit on the Patron's weak point. */
  weak: boolean;
  /** Conditional bonuses, missing-HP part and execute, for `damage` effects. */
  effect: DamageEffect | null;
  readonly point: Vec3;
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
  const hots: HealOverTime[] = [];
  /** Hero victim → enemy hero → last tick it damaged the victim. */
  const damagers = new Map<EntityId, Map<EntityId, number>>();
  /** Hero → allied hero → last tick it healed, shielded or buffed it. */
  const supporters = new Map<EntityId, Map<EntityId, number>>();
  const headScratch = { x: 0, y: 0, z: 0 };
  const interval = COMBAT.tickIntervalS * TICK_RATE;

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
    ctx.bus.emit({ type: 'heal.applied', source: cause?.source ?? null, target: e.id, amount: applied });
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
    if (b.targetHpBelow !== undefined && !(e.health.hp < b.targetHpBelow * e.stats.final.maxHealth)) return false;
    if (b.targetKinds && !b.targetKinds.includes(e.kind)) return false;
    if (b.maxDistance !== undefined || b.minDistance !== undefined) {
      const from = src?.pos ?? cause.origin;
      const d = Math.hypot(e.pos.x - from.x, e.pos.y - from.y, e.pos.z - from.z);
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

  const die = (e: Damageable, cause: EffectCause, credit: EntityId | null): void => {
    const now = ctx.clock.tick;
    const assisters = e.kind === 'hero' ? assistsFor(e, credit) : [];
    e.health.hp = 0;
    if (e.kind === 'hero') {
      e.health.dead = true;
      const ember = ctx.teams[e.team].emberUntil > now;
      e.health.respawnAt = now + ticks(respawnSeconds(ctx.clock.seconds, ember));
      e.weapon.reloading = false;
      e.weapon.firing = false;
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
      pos: copy(e.pos),
    });
    statuses.clear(e);
    dropHealth(e.id);
  };

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

    // 1. Base (+ % of missing hp).
    let dmg = r.base;
    if (fx?.missingHpPct) dmg += fx.missingHpPct * Math.max(0, max - e.health.hp);
    // 2. Falloff.
    dmg *= r.falloff;
    // 3. Beak shot (head hitbox only, so never on units or structures).
    if (r.beak === Beak.Gun) dmg = dmg * (r.beakMult + (ss?.beakShotBonus ?? 0)) + (ss?.beakShotFlat ?? 0);
    else if (r.beak === Beak.Ability) dmg *= COMBAT.abilityBeakShotMult;
    // 4. Outgoing bonuses: additive within the step, applied once.
    let out = 0;
    if (ss && via === 'weapon') out += ss.gunDamage;
    if (ss && !talon) out += ss.songDamage;
    if (fx?.bonus) for (const b of fx.bonus) if (bonusHolds(b, e, src, r.cause)) out += b.mult - 1;
    dmg *= 1 + out;
    // 5. Incoming amplification, capped.
    dmg *= 1 + Math.min(COMBAT.ampCap, talon ? st.talonAmp : st.songAmp);
    // 6. Resist: stacked (by the stat model) minus shred, clamped.
    const resist = talon ? st.talonResist - st.talonShred : st.songResist - st.songShred;
    dmg *= 1 - clamp(resist, COMBAT.resistMin, COMBAT.resistMax);
    // 7. Structure rules.
    dmg *= st.damageTaken;
    if (cond.has('invulnerable')) dmg = 0;
    if (e.kind === 'structure') {
      if (via === 'area' || via === 'status') dmg = 0;
      else if (via === 'melee') dmg *= COMBAT.structureMeleeMult;
      else if (!talon) dmg *= COMBAT.structureSongMult;
      if (r.weak) dmg *= COMBAT.weakPointMult;
    }
    if (!(dmg > 0)) return;
    // 8. Shields.
    const absorbed = drainShields(e, r.type, dmg);
    // 9. Health: undying floors at 1, an onLethal status saves the holder.
    let hp = e.health.hp - (dmg - absorbed);
    let lethal = hp <= 0 || (fx?.executeBelow !== undefined && hp < fx.executeBelow * max);
    let saved: StatusInstance | null = null;
    if (lethal && cond.has('undying')) {
      hp = Math.max(hp, 1);
      lethal = false;
    } else if (lethal && (saved = statuses.takeLethal(e))) {
      hp = 1;
      lethal = false;
    }
    e.health.hp = lethal ? 0 : hp;

    const credit = creditOf(r.cause.source);
    const creditHero = credit === null ? undefined : ctx.store.getKind(credit, 'hero');
    if (e.kind === 'hero') {
      inCombat(e);
      if (creditHero) {
        inCombat(creditHero);
        if (creditHero.team !== e.team) note(damagers, e.id, creditHero.id);
      }
    }
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
      weakPoint: r.weak,
      proc: r.cause.proc,
      lethal,
      pos: copy(r.point),
    });
    if (saved?.def.onLethal) {
      const dir = { x: Math.sin(e.yaw), y: 0, z: Math.cos(e.yaw) };
      ctx.effects.applyAll(saved.def.onLethal, { entity: e.id, point: copy(e.pos), dir }, saved.cause);
    }
    // Lifesteal: a share of the post-step-7 damage (50% effective against non-heroes).
    if (ss && isDamageable(src)) {
      const ls = talon ? ss.talonLifesteal : ss.songLifesteal;
      if (ls > 0) heal(src, ls * dmg * (e.kind === 'hero' ? 1 : COMBAT.lifestealNonHeroMult), r.cause);
    }
    if (lethal) die(e, r.cause, credit);
  };

  const respawn = (s: HeroState): void => {
    const h = s.hero;
    const now = ctx.clock.tick;
    h.health.dead = false;
    h.health.respawnAt = null;
    h.health.hp = h.stats.final.maxHealth;
    h.weapon.ammo = Math.round(h.stats.final.magazine);
    h.weapon.reloading = false;
    h.pos.x = s.spawn.pos.x;
    h.pos.y = s.spawn.pos.y;
    h.pos.z = s.spawn.pos.z;
    h.vel.x = 0;
    h.vel.y = 0;
    h.vel.z = 0;
    s.nextFire = now;
    s.lockout = now;
    s.parryReady = Math.min(s.parryReady, now);
    ctx.bus.emit({ type: 'hero.respawned', hero: h.id, pos: copy(h.pos) });
  };

  const flushLevelHeal = (s: HeroState): void => {
    const h = s.hero;
    const amount = Math.min(s.levelHeal, h.stats.final.maxHealth - h.health.hp);
    if (h.health.dead || !(amount > 0)) return;
    h.health.hp += amount;
    s.levelHeal -= amount;
    ctx.bus.emit({ type: 'heal.applied', source: h.id, target: h.id, amount });
  };

  const request = (target: EntityId, cause: EffectCause, type: DamageType, base: number, point: Vec3): Req => {
    let r = reqs[count];
    if (!r) {
      r = { target, cause, type, base, falloff: 1, beak: Beak.None, beakMult: 1, weak: false, effect: null, point: copy(point) };
      reqs.push(r);
    } else {
      r.target = target;
      r.cause = cause;
      r.type = type;
      r.base = base;
      r.falloff = 1;
      r.beak = Beak.None;
      r.beakMult = 1;
      r.weak = false;
      r.effect = null;
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
      if (e.health.dead || st.healthRegen <= 0 || e.health.hp >= st.maxHealth) continue;
      const gain = (st.healthRegen / TICK_RATE) * (1 - Math.min(1, st.healReduction));
      e.health.hp = Math.min(st.maxHealth, e.health.hp + gain);
    }
  };

  return {
    request,
    effect(fx, target, cause, scale) {
      const e = target.entity === null ? undefined : ctx.store.get(target.entity);
      if (!isDamageable(e)) return;
      const r = request(e.id, cause, fx.type, ctx.effects.magnitude(fx.amount, cause) * scale, target.point);
      r.effect = fx;
      if (fx.beakShot) {
        const hr = hb.head(e, headScratch);
        const p = target.point;
        if (hr >= 0 && Math.hypot(p.x - headScratch.x, p.y - headScratch.y, p.z - headScratch.z) <= hr) r.beak = Beak.Ability;
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
      const n = Math.max(1, Math.round(over / COMBAT.tickIntervalS));
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
      supported(cause, e);
    },
    supported,
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
      // Regeneration (heal reduction applies to it; structures don't regenerate, GDD §7).
      regen(ctx.store.list('hero'));
      regen(ctx.store.list('unit'));
      // Level-up heals whose max-HP growth landed after the event, then respawns.
      for (const s of heroes.values()) {
        if (s.levelHeal > 0) flushLevelHeal(s);
        s.levelHeal = 0;
        const h = s.hero.health;
        if (h.dead && h.respawnAt !== null && now >= h.respawnAt) respawn(s);
      }
    },
    drop(id) {
      dropHealth(id);
      damagers.delete(id);
      supporters.delete(id);
    },
    hash(h) {
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
    },
  };
}
