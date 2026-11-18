import { STAT_DEFAULTS } from './contracts';
import type { Condition, EntityId, EntityStore, ModifierSet, StatBlock, StatId, StatService } from './contracts';

const STAT_IDS = Object.keys(STAT_DEFAULTS) as StatId[];

function filled(value: number): Record<StatId, number> {
  return Object.fromEntries(STAT_IDS.map((s) => [s, value])) as Record<StatId, number>;
}

/** Recompute a block's final values and conditions from base and sources (order: see contracts/stats.ts). */
export function recompute(block: StatBlock): void {
  const add = filled(0);
  const pct = filled(0);
  const mul = filled(1);
  const top = filled(-Infinity);
  const keep = filled(1);
  block.conditions.clear();
  for (const set of block.sources.values()) {
    for (const m of set.stats ?? []) {
      switch (m.op) {
        case 'add':
          add[m.stat] += m.value;
          break;
        case 'pct':
          pct[m.stat] += m.value;
          break;
        case 'mul':
          mul[m.stat] *= m.value;
          break;
        case 'max':
          top[m.stat] = Math.max(top[m.stat], m.value);
          break;
        case 'stack':
          keep[m.stat] *= 1 - m.value;
          break;
      }
    }
    for (const c of set.conditions ?? []) block.conditions.add(c);
  }
  for (const s of STAT_IDS) {
    const v = Math.max(((block.base[s] ?? STAT_DEFAULTS[s]) + add[s]) * (1 + pct[s]) * mul[s], top[s]);
    block.final[s] = keep[s] === 1 ? v : 1 - (1 - v) * keep[s];
  }
}

/** `ctx.stats`. Entities without a stat block (projectiles, pickups, areas) read as STAT_DEFAULTS. */
export function createStatService(store: EntityStore): StatService {
  const blockOf = (id: EntityId): StatBlock | undefined => {
    const e = store.get(id);
    return e && 'stats' in e ? e.stats : undefined;
  };

  return {
    create(base) {
      const block: StatBlock = {
        base: { ...base },
        sources: new Map<string, ModifierSet>(),
        final: { ...STAT_DEFAULTS },
        conditions: new Set<Condition>(),
      };
      recompute(block);
      return block;
    },
    set(id, key, mods) {
      const block = blockOf(id);
      if (!block) return;
      if (mods) block.sources.set(key, mods);
      else if (!block.sources.delete(key)) return;
      recompute(block);
    },
    setBase(id, base) {
      const block = blockOf(id);
      if (!block) return;
      for (const s of STAT_IDS) delete block.base[s];
      Object.assign(block.base, base);
      recompute(block);
    },
    get(id, stat) {
      return blockOf(id)?.final[stat] ?? STAT_DEFAULTS[stat];
    },
    has(id, condition) {
      return blockOf(id)?.conditions.has(condition) ?? false;
    },
  };
}
