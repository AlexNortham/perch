/**
 * Item data for the Magpie's Hoard (GDD §10). Owner of the rules: sim/items (buy, sell, upgrade, slots, passives,
 * triggers, actives). The item table lives in src/sim/data/items.ts.
 */
import type { ItemId } from './base';
import type { AbilityTargeting } from './abilities';
import type { Effect, TriggerDef } from './effects';
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
}
