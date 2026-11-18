/**
 * Statuses (GDD §5.9): stacking, timers, periodic effects (DoTs), expiry, cleanse. Each instance publishes its
 * modifiers through ctx.stats under its own key 'status:<n>'.
 */
import { COMBAT } from '../data/combat';
import { TICK_RATE } from '../data/core';
import type {
  Damageable,
  DamageEffect,
  EffectCause,
  EffectTarget,
  EntityId,
  Hasher,
  HealEffect,
  ModifierSet,
  SimContext,
  StatusDef,
  StatusId,
  StatusInstance,
} from '../core/contracts';
import { copy, ticks } from '../core/math';
import type { Mutable } from './types';

interface Rec {
  readonly e: Damageable;
  readonly inst: Mutable<StatusInstance>;
  readonly key: string;
  /** Tick of the next periodic application (Infinity without one). */
  next: number;
  readonly interval: number;
  /** The cause periodic effects use: the status's, marked via 'status' (structures ignore it, GDD §7). */
  readonly periodicCause: EffectCause | null;
  gone: boolean;
}

export interface StatusDeps {
  periodicDamage(effect: DamageEffect, target: EffectTarget, cause: EffectCause, scale: number): void;
  periodicHeal(effect: HealEffect, target: EffectTarget, cause: EffectCause, scale: number): void;
  /** A positive status from `cause` landed on `e` (assist ledger). */
  supported(cause: EffectCause, e: Damageable): void;
}

export interface Statuses {
  apply(e: Damageable, def: StatusDef, cause: EffectCause, durationS: number, magnitude: number, stacks: number): void;
  cleanse(e: Damageable, remove: 'negative' | 'positive' | readonly StatusId[]): void;
  /** Firing, melee or casting ends statuses with endsOnAttack (invisibility). */
  endOnAttack(e: Damageable): void;
  /** Death: every status ends. */
  clear(e: Damageable): void;
  /** A lethal hit: ends the first status with onLethal and returns it, or null. */
  takeLethal(e: Damageable): StatusInstance | null;
  has(e: Damageable, id: StatusId): boolean;
  /** Statuses phase: periodic effects, then expiry. */
  tick(): void;
  /** Forget a despawned entity's records. */
  drop(id: EntityId): void;
  hash(h: Hasher): void;
}

const { conditions: CC_CONDITIONS, stats: CC_STATS } = COMBAT.unstoppableBlocks;

/** Statuses unstoppable blocks and removes (GDD §5.9). */
function isCrowdControl(def: StatusDef): boolean {
  const m = def.modifiers;
  if (!m) return false;
  return (
    (m.conditions?.some((c) => CC_CONDITIONS.includes(c)) ?? false) ||
    (m.stats?.some((s) => CC_STATS.includes(s.stat)) ?? false)
  );
}

export function createStatuses(ctx: SimContext, deps: StatusDeps): Statuses {
  const recs: Rec[] = [];
  const recOf = new Map<StatusInstance, Rec>();
  let serial = 0;

  const publish = (r: Rec): void => {
    const m = r.inst.def.modifiers;
    if (!m) return;
    const k = r.inst.magnitude * r.inst.stacks;
    const set: ModifierSet =
      k === 1 || !m.stats ? m : { stats: m.stats.map((s) => ({ stat: s.stat, op: s.op, value: s.value * k })), conditions: m.conditions };
    ctx.stats.set(r.e.id, r.key, set);
  };

  const remove = (r: Rec, reason: 'expired' | 'cleansed' | 'death'): void => {
    if (r.gone) return;
    r.gone = true;
    recOf.delete(r.inst);
    const list = r.e.statuses;
    const i = list.indexOf(r.inst);
    if (i >= 0) list.splice(i, 1);
    if (r.inst.def.modifiers) ctx.stats.set(r.e.id, r.key, null);
    ctx.bus.emit({ type: 'status.ended', target: r.e.id, status: r.inst.def.id, reason });
  };

  const removeWhere = (e: Damageable, reason: 'expired' | 'cleansed' | 'death', test: (s: StatusInstance) => boolean): void => {
    for (let i = e.statuses.length - 1; i >= 0; i--) {
      const s = e.statuses[i] as StatusInstance;
      const r = recOf.get(s);
      if (r && test(s)) remove(r, reason);
    }
  };

  const targetOf = (e: Damageable): EffectTarget => ({
    entity: e.id,
    point: copy(e.pos),
    dir: { x: Math.sin(e.yaw), y: 0, z: Math.cos(e.yaw) },
  });

  const announce = (r: Rec): void => {
    const { inst } = r;
    ctx.bus.emit({
      type: 'status.applied',
      target: r.e.id,
      status: inst.def.id,
      source: inst.cause.source,
      stacks: inst.stacks,
      expiresAt: inst.expiresAt,
    });
    if (!inst.def.negative) deps.supported(inst.cause, r.e);
  };

  const periodic = (r: Rec): void => {
    const p = r.inst.def.periodic;
    const cause = r.periodicCause;
    if (!p || !cause || r.e.health.dead) return;
    const scale = r.inst.magnitude * r.inst.stacks;
    const target = targetOf(r.e);
    for (const fx of p.effects) {
      if (fx.kind === 'damage') deps.periodicDamage(fx, target, cause, scale);
      else if (fx.kind === 'heal') deps.periodicHeal(fx, target, cause, scale);
      else ctx.effects.apply(fx, target, cause);
    }
  };

  const statuses: Statuses = {
    apply(e, def, cause, durationS, magnitude, stacks) {
      if (e.health.dead) return;
      const c = e.stats.conditions;
      if (def.negative && (c.has('intangible') || (c.has('unstoppable') && isCrowdControl(def)))) return;
      let seconds = durationS;
      if (def.negative) seconds *= 1 - Math.min(e.stats.final.statusResist, COMBAT.statusResistCap);
      if (cause.ability !== null && cause.source !== null) seconds *= 1 + ctx.stats.get(cause.source, 'abilityDuration');
      const now = ctx.clock.tick;
      const expiresAt = now + Math.max(1, ticks(seconds));

      const same = (s: StatusInstance): boolean =>
        s.def.id === def.id && (def.stacking !== 'perSource' || s.cause.source === cause.source);
      const old = def.stacking === 'independent' ? undefined : e.statuses.find(same);
      const r = old && recOf.get(old);
      if (r) {
        const inst = r.inst;
        if (def.stacking === 'max') inst.expiresAt = Math.max(inst.expiresAt, expiresAt);
        else {
          inst.expiresAt = expiresAt;
          inst.magnitude = magnitude;
          if (def.stacking === 'stack') inst.stacks = Math.min(def.maxStacks, inst.stacks + stacks);
          publish(r);
        }
        announce(r);
        return;
      }

      const inst: Mutable<StatusInstance> = {
        def,
        cause,
        magnitude,
        stacks: def.stacking === 'stack' ? Math.min(def.maxStacks, stacks) : 1,
        appliedAt: now,
        expiresAt,
      };
      const interval = def.periodic ? def.periodic.intervalS * TICK_RATE : 0;
      const rec: Rec = {
        e,
        inst,
        key: `status:${++serial}`,
        next: def.periodic ? now + interval : Infinity,
        interval,
        periodicCause: def.periodic ? { ...cause, via: 'status' } : null,
        gone: false,
      };
      e.statuses.push(inst);
      recs.push(rec);
      recOf.set(inst, rec);
      publish(rec);
      if (def.modifiers?.conditions?.includes('unstoppable')) {
        removeWhere(e, 'cleansed', (s) => s.def.negative && isCrowdControl(s.def));
      }
      announce(rec);
    },
    cleanse(e, which) {
      removeWhere(e, 'cleansed', (s) =>
        which === 'negative' ? s.def.negative : which === 'positive' ? !s.def.negative : which.includes(s.def.id),
      );
    },
    endOnAttack(e) {
      if (e.statuses.length > 0) removeWhere(e, 'expired', (s) => s.def.endsOnAttack === true);
    },
    clear(e) {
      removeWhere(e, 'death', () => true);
    },
    takeLethal(e) {
      const inst = e.statuses.find((s) => s.def.onLethal !== undefined);
      const r = inst && recOf.get(inst);
      if (!inst || !r) return null;
      remove(r, 'expired');
      return inst;
    },
    has: (e, id) => e.statuses.some((s) => s.def.id === id),
    tick() {
      const now = ctx.clock.tick;
      for (let i = 0; i < recs.length; i++) {
        const r = recs[i] as Rec;
        while (!r.gone && r.next <= now && r.next <= r.inst.expiresAt) {
          r.next += r.interval;
          periodic(r);
        }
        if (r.gone || now < r.inst.expiresAt) continue;
        remove(r, 'expired');
        const fx = r.inst.def.onExpire;
        if (fx && !r.e.health.dead) ctx.effects.applyAll(fx, targetOf(r.e), r.inst.cause);
      }
      let n = 0;
      for (const r of recs) if (!r.gone) recs[n++] = r;
      recs.length = n;
    },
    drop(id) {
      for (const r of recs) {
        if (r.e.id !== id || r.gone) continue;
        r.gone = true;
        recOf.delete(r.inst);
      }
    },
    hash(h) {
      h.num(serial);
      for (const r of recs) {
        if (r.gone) continue;
        h.num(r.e.id);
        h.str(r.key);
        h.num(r.next);
      }
    },
  };
  return statuses;
}
