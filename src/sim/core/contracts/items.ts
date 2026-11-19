/**
 * Item data for the Magpie's Hoard (GDD §10). Owner of the rules: sim/items (buy, sell, upgrade, slots, passives,
 * triggers, actives). Items registers its data table in ctx.itemCatalogue when its system is created.
 */
import type { HeroId, ItemId } from './base';
import type { AbilityTargeting } from './abilities';
import type { AreaEffect, Effect, TargetFilter, TriggerDef } from './effects';
import type { ModifierSet } from './stats';

/** The three shop columns: Talon (gun), Plumage (vitality), Song (ability power). */
export type ItemCategory = 'talon' | 'plumage' | 'song';
export type ItemTier = 1 | 2 | 3 | 4;

export interface ItemActive {
  readonly cooldownS: number;
  readonly targeting: AbilityTargeting;
  readonly range: number;
  readonly effects: readonly Effect[];
  /** Usable while silenced (never while stunned). */
  readonly whileSilenced?: boolean;
  /** For 'unit' targeting: which entities can be chosen (as AbilityDef.affects; Stoop Dive enemy heroes). */
  readonly affects?: TargetFilter;
  /** For 'unit' targeting of allies: the holder when no ally is in the cone (Rescue Call). */
  readonly selfFallback?: boolean;
}

export interface ItemDef {
  readonly id: ItemId;
  /** Player-facing name and text. */
  readonly name: string;
  readonly description: string;
  readonly category: ItemCategory;
  readonly tier: ItemTier;
  /** Price in Seeds. */
  readonly cost: number;
  /** The lower-tier item this one upgrades; buying it consumes the owned component. */
  readonly component: ItemId | null;
  /** Modifiers while owned. */
  readonly passive: ModifierSet;
  /** Triggers while owned (procs). */
  readonly procs: readonly TriggerDef[];
  readonly active: ItemActive | null;
  /**
   * A lasting area attached to the holder while it owns the item and is alive (Nestmother's Mantle, Rookery Dirge).
   * sim/items applies it through `ctx.effects` on purchase and respawn and ends it on sale or death.
   */
  readonly aura?: AreaEffect;
}

// ---- Learned shopping (D-EP-036, D-EP-037). The Build Lab (Balance & Data) learns these from headless matches and
// ---- writes them as sim data; sim/ai samples purchases from the scores; the shop UI and the wiki show the builds.

/** Match phases for the phase factor and the build cores. Boundaries live in BuildData.phases. */
export type GamePhase = 'early' | 'mid' | 'late';
export const GAME_PHASES: readonly GamePhase[] = ['early', 'mid', 'late'];

/**
 * One hero's learned item scores. A candidate item's score for a hero who owns `owned` in phase `p` is
 *   base[item] + Σ over o in owned of synergy[o][item] + phase[item][p]
 * (missing entries count 0). Owning an item's component counts as owning it for synergy, so upgrade chains score
 * through the same table. Scores are logits: sim/ai picks with softmax(score / temperature) over affordable,
 * buyable candidates (components first, the 4-active cap), drawing from the stream 'ai/<heroId>/shop'. GDD §11.4
 * temperatures: Chick 1.0, Hunter 0.5, Raptor 0.2.
 */
export interface ItemScores {
  readonly base: Readonly<Record<ItemId, number>>;
  /** Sparse: synergy[owned][candidate]. */
  readonly synergy: Readonly<Record<ItemId, Readonly<Record<ItemId, number>>>>;
  /** Sparse: [early, mid, late] offsets per item. */
  readonly phase: Readonly<Record<ItemId, readonly [number, number, number]>>;
}

/** A hero's recommended build (GDD §11, D-EP-036): what the Magpie's Hoard highlights and the wiki lists. */
export interface RecommendedBuild {
  /** Core items per phase, in buying order. */
  readonly early: readonly ItemId[];
  readonly mid: readonly ItemId[];
  readonly late: readonly ItemId[];
  /**
   * Situational picks with a short player-facing reason ("vs healers") and, for bots, the id of the condition sim/ai
   * evaluates (data/ai lists them, e.g. 'enemyHealers'). GDD §11.8: 3–4 items per core, 3–5 situational picks.
   */
  readonly situational: readonly { readonly item: ItemId; readonly when: string; readonly condition?: string }[];
}

/** The Build Lab's output, one file of sim data (src/sim/data/builds.ts). */
export interface BuildData {
  /**
   * Increases with every Build Lab round written. Round 0 is the designer prior (GDD §11.4: base from the §11.5
   * list order, +0.3 component synergy, phase offsets from the §11.8 archetype cores; builds = the archetype rows).
   */
  readonly round: number;
  /** Headless matches behind these numbers (BALANCE.md has the method and convergence figures). */
  readonly matches: number;
  /** Match second at which 'mid' and 'late' begin (GDD §11.4: 600 and 1320). */
  readonly phases: { readonly midFromS: number; readonly lateFromS: number };
  readonly scores: Readonly<Partial<Record<HeroId, ItemScores>>>;
  readonly builds: Readonly<Partial<Record<HeroId, RecommendedBuild>>>;
}
