/**
 * Statuses: timed conditions on an entity (GDD §5.9). Owner: sim/combat. It applies, stacks, times, ticks, expires
 * and cleanses them, and publishes each instance's modifiers through ctx.stats under the key 'status:<n>'.
 *
 * Statuses are data written inline in the effect that applies them (ApplyStatusEffect.status). The GDD's shared
 * ones (stun, silence, disarm, root, grounded, slow, reveal, invisibility, …) are exported from
 * src/sim/data/combat.ts so every system applies the same definition. GDD `statMod` (StatModEffect) becomes a
 * positive status whose `modifiers` carry the stats.
 */
import type { StatusId, Tick } from './base';
import type { Effect, EffectCause } from './effects';
import type { ModifierSet } from './stats';

/**
 * What happens when a status is applied to an entity that already has one with the same id (GDD §5.9):
 * - max: one instance; remaining time becomes max(remaining, new). On/off statuses (stun, silence, reveal …).
 * - perSource: one instance per source; reapplying from the same source refreshes it. Damage over time.
 * - independent: every application is its own instance. Graded statuses (slow, damage amp, shred …); their stats
 *   use op 'max' for strongest-only or 'add' for additive.
 * - stack: one instance; stacks rise by the applied count up to maxStacks, the timer restarts, and modifier values
 *   are multiplied by stacks.
 */
export type StatusStacking = 'max' | 'perSource' | 'independent' | 'stack';

export interface StatusDef {
  readonly id: StatusId;
  /** Player-facing name (UI). */
  readonly name: string;
  /**
   * Negative statuses are shortened by statusResist and removed by cleanse 'negative'. 'unstoppable' blocks (and
   * removes on gain) only the crowd control among them: statuses carrying stunned, silenced, disarmed, rooted,
   * grounded or a slow (GDD §5.9, D-COMBAT-004); 'intangible' blocks every negative status.
   */
  readonly negative: boolean;
  readonly stacking: StatusStacking;
  /** For 'stack'; 1 otherwise. */
  readonly maxStacks: number;
  /** Default duration (seconds); the applying effect may override it. */
  readonly durationS: number;
  /**
   * Modifiers while active. Numeric values are multiplied by the instance's magnitude and stacks, so graded statuses
   * are written for magnitude 1 (a slow is `{ stat: 'slow', op: 'max', value: 1 }`, applied with magnitude 0.3).
   */
  readonly modifiers?: ModifierSet;
  /** Effects applied to the holder every intervalS, credited to the status's cause (damage or heal over time). */
  readonly periodic?: { readonly intervalS: number; readonly effects: readonly Effect[] };
  /** Firing, melee or casting ends it (invisibility's breaksOnAttack, default true there). */
  readonly endsOnAttack?: boolean;
  /** Effects applied to the holder when it expires (not when cleansed or on death). */
  readonly onExpire?: readonly Effect[];
  /**
   * If set, a hit that would kill the holder leaves it at 1 hp instead, ends this status and applies these effects
   * to the holder ("on would-die" triggers, GDD §9.25).
   */
  readonly onLethal?: readonly Effect[];
}

/** A status on an entity. Public so UI, AI and hooks can read it; only sim/combat writes. */
export interface StatusInstance {
  readonly def: StatusDef;
  /** The cause that applied it: credit (cause.source) and scaling for periodic effects. */
  readonly cause: EffectCause;
  /** Scales the def's modifier values (graded statuses); 1 for on/off statuses. */
  magnitude: number;
  stacks: number;
  readonly appliedAt: Tick;
  expiresAt: Tick;
}
