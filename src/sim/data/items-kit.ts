import type { AreaEffect, Effect, ItemActive, ItemCategory, ItemDef, ItemTier, StatId, StatModifier, StatOp, TriggerDef } from '../core/contracts';

const COST = { 1: 800, 2: 1600, 3: 3200, 4: 6400 } as const;
export const stat = (id: StatId, value: number, op: StatOp = 'add'): StatModifier => ({ stat: id, op, value });
export function item(id: string, name: string, description: string, category: ItemCategory, tier: ItemTier,
  stats: StatModifier[], component: string | null = null, active: ItemActive | null = null, procs: TriggerDef[] = [],
  aura?: AreaEffect): ItemDef {
  return { id, name, description, category, tier, cost: COST[tier], component, passive: { stats }, procs, active,
    ...(aura ? { aura } : {}) };
}

/**
 * Behaviour the shared effect vocabulary cannot say as a trigger, run by sim/items (riders.ts). `on` picks the event:
 * a gun hit on an enemy, a heavy melee hit on a hero, or a hero kill or assist by the holder. A rider's own damage is a
 * proc, so it never fires another rider or trigger.
 */
export interface Rider {
  readonly on: 'gunHit' | 'heavyMelee' | 'killAssist';
  /** gunHit only: restrict the target ('nonHero' covers units, Nests, structures and the Roc). */
  readonly vs?: 'hero' | 'nonHero';
  /** gunHit only: only from this distance or farther (m). */
  readonly minM?: number;
  /** gunHit only: extra Talon damage as a fraction of the hit's damage (after resists, so it adds that much). */
  readonly extra?: number;
  /** gunHit only: one more enemy within `radius` of the target takes `fraction` of the hit (no beak shot). */
  readonly bounce?: { readonly radius: number; readonly fraction: number };
  /** Effects applied to the target (killAssist: to the holder). */
  readonly effects?: readonly Effect[];
  /** killAssist only: heal this fraction of the holder's max HP. */
  readonly healMaxPct?: number;
}

/** A shield the holder gets on purchase and respawn (it can't be taken back on sale; it ends with the next death). */
export interface ItemShield {
  readonly absorbs: 'talon' | 'song' | 'barrier';
  readonly amount: number;
  readonly rechargeS: number;
}

/** A lasting aura's duration: longer than any match, ended by the engine on sale or death. */
export const AURA_S = 86_400;
