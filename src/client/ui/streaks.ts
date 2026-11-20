/** Kill callouts (D-EP-041): "First Blood" and kill streaks, counted from the event stream. Pure apart from its own tallies. */
import type { EntityId, SimEvent } from '../../sim/core/contracts';

export const FIRST_BLOOD = 'First Blood';
/** The callout for a streak of this many kills; longer streaks keep the last name. */
export const STREAK_CALLOUT: Readonly<Record<number, string>> = {
  2: 'Twin Strike',
  3: 'Hat Trick',
  4: 'Talon Storm',
  5: 'Apex Predator',
};
const LONGEST_NAMED_STREAK = 5;

export interface Callout {
  readonly hero: EntityId;
  readonly text: string;
}

export interface Streaks {
  /** Consecutive hero kills without dying (0 for a bird with none). */
  of(hero: EntityId): number;
  /** Tally the batch; returns the callouts it earned, in order. */
  onEvents(events: readonly SimEvent[]): Callout[];
  reset(): void;
}

export function createStreaks(): Streaks {
  const runs = new Map<EntityId, number>();
  let firstBlood = false;
  return {
    of: (hero) => runs.get(hero) ?? 0,
    reset() {
      runs.clear();
      firstBlood = false;
    },
    onEvents(events) {
      const out: Callout[] = [];
      for (const e of events) {
        // A Rekindle revive is not a death for the board: no kill, no streak lost.
        if (e.type !== 'entity.died' || e.victimKind !== 'hero' || e.revives) continue;
        runs.set(e.victim, 0);
        if (e.creditHero === null || e.creditHero === e.victim) continue;
        if (!firstBlood) {
          firstBlood = true;
          out.push({ hero: e.creditHero, text: FIRST_BLOOD });
        }
        const n = (runs.get(e.creditHero) ?? 0) + 1;
        runs.set(e.creditHero, n);
        const text = STREAK_CALLOUT[Math.min(n, LONGEST_NAMED_STREAK)];
        if (n >= 2 && text) out.push({ hero: e.creditHero, text });
      }
      return out;
    },
  };
}
