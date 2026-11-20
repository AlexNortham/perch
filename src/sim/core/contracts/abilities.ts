/**
 * Ability data. Owner of the framework: sim/abilities (casting, targeting, cooldowns, charges, channels, AP,
 * upgrades, ultimate unlock). Hero data files fill these shapes; hero modules add hooks only for what data can't say.
 * Framework numbers (AP cost per tier, ultimate unlock level, cast rules) live in src/sim/data/abilities.ts.
 */
import type { AbilityId } from './base';
import type { Effect, TargetFilter } from './effects';

/**
 * How a cast picks its target (GDD §9.0.1). Every cast aims with the hero's camera ray (core/aim.ts, GDD §4.5).
 * - self: the caster, on press.
 * - direction: along the aim, on press: target.point = aim point, target.dir = aim direction.
 * - unit: the enemy or ally (per `affects`) nearest the crosshair inside the data cone and within range; the cast
 *   fails without one.
 * - point: the aim point projected to the ground and clamped to range (placement and confirm are the client's).
 * A channelled ability ends early when its key is pressed again.
 */
export type AbilityTargeting = 'self' | 'direction' | 'unit' | 'point';

/** One upgrade tier. Every field is optional and adds to (or extends) the base ability. */
export interface AbilityUpgrade {
  /** Player-facing text. */
  readonly description: string;
  /** Added to the named `values`. */
  readonly values?: Readonly<Record<string, number>>;
  /** Added to cooldownS (negative shortens). */
  readonly cooldownS?: number;
  /** Added to charges. */
  readonly charges?: number;
  /** Added to range. */
  readonly range?: number;
  /**
   * Seconds added to `channelS` (Sulphur Shriek T2, Burrow T1). Replaces Hero B3's `channelExtraS` value name
   * (D-ARCH-032).
   */
  readonly channelS?: number;
  /** Appended to the cast's effects. */
  readonly effects?: readonly Effect[];
  /** Appended to the cast's selfEffects. */
  readonly selfEffects?: readonly Effect[];
}

export interface AbilityDef {
  readonly id: AbilityId;
  /** Player-facing name and text. */
  readonly name: string;
  readonly description: string;
  readonly targeting: AbilityTargeting;
  /** For 'unit' targeting: which entities can be chosen. */
  readonly affects?: TargetFilter;
  /** For 'unit' targeting of allies: with no ally in the cone, target the caster instead of failing. */
  readonly selfFallback?: boolean;
  /**
   * For 'point' targeting: take the surface under the crosshair (wall, tree or floor) within range instead of the floor
   * below it, and mark the target `surface` (Branch Swing, Tree Cling). Beyond range: the ordinary floor point.
   * Replaces the `surface` value name (D-ARCH-027).
   */
  readonly surface?: boolean;
  /** Metres (0 for self casts). */
  readonly range: number;
  readonly cooldownS: number;
  /** Charges (1 = an ordinary cooldown). With more, one charge returns every cooldownS. */
  readonly charges: number;
  /** Wind-up before the effects land (0 = instant). Stun or silence during it cancels the cast. */
  readonly castS: number;
  /** Channel length after the cast (0 = none). Stun or silence ends it. */
  readonly channelS: number;
  /** The caster can't move while casting or channelling (GDD: "rooted"). */
  readonly rooted?: boolean;
  /** While channelling, `channelEffects` apply every channelIntervalS. */
  readonly channelIntervalS?: number;
  readonly channelEffects?: readonly Effect[];
  /** Named numbers that magnitudes refer to by name; upgrades add to them. */
  readonly values: Readonly<Record<string, number>>;
  /** Applied when the cast lands, to the target chosen by `targeting`. */
  readonly effects: readonly Effect[];
  /**
   * Applied to the caster when the cast lands, after `effects`, whatever the targeting (target.entity = caster,
   * point = its feet, dir = the cast direction): the self-buff of a unit cast (Riverstrike's invisibility).
   */
  readonly selfEffects?: readonly Effect[];
  /** The three upgrade tiers, bought in order with AP. */
  readonly upgrades: readonly [AbilityUpgrade, AbilityUpgrade, AbilityUpgrade];
  /** The hero module's onCast runs after `effects` when the cast lands. */
  readonly hook: boolean;
}
