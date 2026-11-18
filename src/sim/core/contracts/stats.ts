/**
 * The one stat model. Base values come from data at spawn; every other source (Molts, items, statuses, objectives)
 * contributes a ModifierSet under its own key through `ctx.stats.set`, and core recomputes the entity's final
 * values at once, so a read is always current.
 *
 * Per stat, in this order (GDD §5.3 for resists):
 *   v = (base + Σ add) × (1 + Σ pct) × Π mul
 *   v = max(v, every 'max' value)                 strongest-only stats (slow, heal reduction)
 *   v = 1 − (1 − v) × Π (1 − stack)               multiplicative stacking (resists, status resist)
 * Sources apply in the order their keys were first set (deterministic). The consumer applies caps and clamps from
 * its own data (e.g. sim/combat clamps resist − shred to [−50%, +85%]).
 */
import type { EntityId } from './base';

/**
 * Every stat and its default. "Bonus" stats are fractions where 0 means no change and 0.25 means +25%; the
 * consumer multiplies by (1 + value). The damage pipeline step (GDD §5.2) that reads a stat is noted as "step n".
 */
export const STAT_DEFAULTS = {
  /** Hit points. */
  maxHealth: 0,
  /** HP per second, always on. */
  healthRegen: 0,
  /** Ground speed (m/s). */
  moveSpeed: 0,
  /** Extra ground speed out of combat (m/s). */
  sprintSpeed: 0,
  /** Stamina pips (dash charges). */
  stamina: 0,
  /** Seconds to regain one stamina pip. */
  staminaRecharge: 0,
  /** Talon damage per bullet or pellet (step 1); Molt growth adds to it with op 'pct'. */
  weaponDamage: 0,
  /** Outgoing gun damage bonus (step 4). */
  gunDamage: 0,
  /** Fire rate bonus. */
  fireRate: 0,
  /** Fire-rate slow, 0..1, strongest only (op 'max'). */
  fireRateSlow: 0,
  /** Rounds per magazine. */
  magazine: 0,
  /** Reload speed bonus (0.2 reloads 20% faster). */
  reloadSpeed: 0,
  /** Bullet speed bonus. */
  bulletSpeed: 0,
  /** Falloff range bonus; scales both falloff ranges. */
  falloffRange: 0,
  /** Added to the beak-shot multiplier (step 3). */
  beakShotBonus: 0,
  /** Flat damage added to a beak shot after the multiplier (step 3). */
  beakShotFlat: 0,
  /** Light melee damage (base plus growth); heavy melee scales it by combat data. */
  meleeDamage: 0,
  /** Song power: Magnitude.song coefficients multiply it. */
  songPower: 0,
  /** Outgoing Song damage bonus (step 4). */
  songDamage: 0,
  /** Cooldown reduction, 0..1. */
  cooldownReduction: 0,
  /** Ability range bonus. */
  abilityRange: 0,
  /** Duration bonus for abilities and the statuses they apply. */
  abilityDuration: 0,
  /** Extra charges for abilities that have charges. */
  abilityCharges: 0,
  /** Talon resist, 0..1, stacks with op 'stack' (step 6). */
  talonResist: 0,
  /** Song resist, 0..1, stacks with op 'stack' (step 6). */
  songResist: 0,
  /** Talon resist shred, subtracted after stacking (step 6). */
  talonShred: 0,
  /** Song resist shred, subtracted after stacking (step 6). */
  songShred: 0,
  /** Incoming Talon damage amplification, additive (step 5; capped by combat data). */
  talonAmp: 0,
  /** Incoming Song damage amplification, additive (step 5; capped by combat data). */
  songAmp: 0,
  /** Structure-rule multiplier on all damage taken (step 7; Brood Ward uses op 'mul'). */
  damageTaken: 1,
  /** Fraction of Talon damage dealt (after step 7) healed back (step 9). */
  talonLifesteal: 0,
  /** Fraction of Song damage dealt (after step 7) healed back (step 9). */
  songLifesteal: 0,
  /** Healing received bonus. */
  healAmp: 0,
  /** Healing received reduction, 0..1, strongest only (op 'max'). */
  healReduction: 0,
  /** Movement slow, 0..1, strongest only (op 'max'). */
  slow: 0,
  /** Shortens incoming negative statuses, 0..1, stacks with op 'stack' (capped by combat data). */
  statusResist: 0,
} as const;

export type StatId = keyof typeof STAT_DEFAULTS;

/** On/off states derived from modifiers (normally from statuses, GDD §5.9). */
export const CONDITIONS = [
  /** No movement, gun, melee, parry, abilities or items. */
  'stunned',
  /** No abilities and no item actives. */
  'silenced',
  /** No gun fire. */
  'disarmed',
  /** No walking, jumping, dashing or movement abilities. */
  'rooted',
  /** No dash, jump, Updraft, Chimney, Vine or movement abilities; can walk. */
  'grounded',
  /** Shown to enemies on the minimap and outlined through walls. */
  'revealed',
  /** Unseen by enemies beyond the reveal range unless revealed or in their true sight. */
  'invisible',
  /** Sees invisible enemies within its radius. */
  'trueSight',
  /** Immune to stun, silence, disarm, root, grounded, slow and displacement. */
  'unstoppable',
  /** No damage, no statuses, can't be targeted; shots pass through. */
  'intangible',
  /** Takes no damage but can be targeted and shot (Patron gates, GDD §7). */
  'invulnerable',
  /** Health can't fall below 1. */
  'undying',
  /** Carrying the Golden Egg: can't fire, cast, use items, parry or ride Updrafts, Chimneys or Vines. */
  'eggCarrier',
] as const;
export type Condition = (typeof CONDITIONS)[number];

export type StatOp = 'add' | 'pct' | 'mul' | 'max' | 'stack';

export interface StatModifier {
  readonly stat: StatId;
  readonly op: StatOp;
  readonly value: number;
}

/** What one source contributes. */
export interface ModifierSet {
  readonly stats?: readonly StatModifier[];
  readonly conditions?: readonly Condition[];
}

/**
 * Stat component. Writer: core only, through `ctx.stats`. Read `final` and `conditions`; never write them.
 */
export interface StatBlock {
  /** Base values from data (missing stats use STAT_DEFAULTS). */
  readonly base: Partial<Record<StatId, number>>;
  /** Modifier sets by source key, in first-set order. Key convention '<system>:<what>', e.g. 'items:12'. */
  readonly sources: Map<string, ModifierSet>;
  /** Final values. */
  readonly final: Record<StatId, number>;
  /** Active conditions. */
  readonly conditions: Set<Condition>;
}

/** `ctx.stats`. Implemented by core. */
export interface StatService {
  /** A fresh stat block for a spawning entity. */
  create(base: Partial<Record<StatId, number>>): StatBlock;
  /** Replace the modifiers a source contributes to an entity (null removes them) and recompute at once. */
  set(entity: EntityId, key: string, mods: ModifierSet | null): void;
  /** Replace an entity's base values (e.g. a decoy copying its owner) and recompute. */
  setBase(entity: EntityId, base: Partial<Record<StatId, number>>): void;
  /** The entity's final stat; STAT_DEFAULTS for entities without stats. */
  get(entity: EntityId, stat: StatId): number;
  /** True if the entity has the condition. */
  has(entity: EntityId, condition: Condition): boolean;
}
