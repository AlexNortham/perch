/**
 * Keepsakes (GDD §7.13): permanent boons. Each is one type drawn by weight from the hero's own seeded stream, the type
 * received last at half weight; its strength is the match-time bucket's. Totals per stat are capped and published as
 * ONE stat source, 'world:keepsakes', with one summed modifier per stat (D-ARCH-024), so each type stacks once in the
 * resist and CDR stacks. They survive death.
 */
import type { EntityId, Hasher, HeroEntity, ModifierSet, SimContext, StatId } from '../core/contracts';
import { KEEPSAKES } from '../data/world';

const SOURCE = 'world:keepsakes';
const TYPES = KEEPSAKES.types;

export interface Keepsakes {
  /** Give `n` keepsakes to a hero (one keepsakeGained event naming the last type). */
  grant(h: HeroEntity, n: number): void;
  hash(h: Hasher): void;
}

/** One modifier per stat; a 'mul' row is a regeneration bonus, so it divides the seconds per pip. */
export function keepsakeMods(totals: Partial<Record<StatId, number>>): ModifierSet {
  const stats = [];
  for (const [stat, op] of TYPES) {
    const v = totals[stat];
    if (v !== undefined) stats.push({ stat, op, value: op === 'mul' ? 1 / (1 + v) : v });
  }
  return { stats };
}

export function createKeepsakes(ctx: SimContext): Keepsakes {
  /** Per hero: index of the last type received. */
  const last = new Map<EntityId, number>();

  const draw = (h: HeroEntity): number => {
    const prev = last.get(h.id) ?? -1;
    const weight = (i: number): number => TYPES[i]![2] * (i === prev ? KEEPSAKES.repeatWeight : 1);
    let sum = 0;
    for (let i = 0; i < TYPES.length; i++) sum += weight(i);
    let r = ctx.rng.stream(`world/keepsakes/${h.id}`).next() * sum;
    for (let i = 0; i < TYPES.length; i++) {
      r -= weight(i);
      if (r < 0) return i;
    }
    return TYPES.length - 1;
  };

  return {
    grant(h, n) {
      if (n <= 0) return;
      const s = ctx.clock.seconds;
      const bucket = KEEPSAKES.bucketsS.reduce((b, from, i) => (s >= from ? i : b), 0);
      const k = (h.keepsakes ??= { count: 0, totals: {} });
      let stat: StatId = TYPES[0][0];
      for (let j = 0; j < n; j++) {
        const i = draw(h);
        const row = TYPES[i]!;
        stat = row[0];
        k.totals[stat] = Math.min(KEEPSAKES.caps[stat] ?? Infinity, (k.totals[stat] ?? 0) + row[3][bucket]!);
        k.count++;
        last.set(h.id, i);
      }
      ctx.stats.set(h.id, SOURCE, keepsakeMods(k.totals));
      ctx.bus.emit({ type: 'objective', action: 'keepsakeGained', hero: h.id, team: h.team, pickup: null, pickupType: null,
        pos: { ...h.pos }, variant: stat, value: n });
    },
    hash(hh) {
      hh.value(last);
    },
  };
}
