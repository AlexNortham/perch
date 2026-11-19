import type { ItemActive, ItemCategory, ItemDef, ItemTier, StatId, StatModifier, StatOp, TriggerDef } from '../core/contracts';

const COST = { 1: 800, 2: 1600, 3: 3200, 4: 6400 } as const;
export const stat = (id: StatId, value: number, op: StatOp = 'add'): StatModifier => ({ stat: id, op, value });
export function item(id: string, name: string, description: string, category: ItemCategory, tier: ItemTier,
  stats: StatModifier[], component: string | null = null, active: ItemActive | null = null, procs: TriggerDef[] = []): ItemDef {
  return { id, name, description, category, tier, cost: COST[tier], component, passive: { stats }, procs, active };
}
