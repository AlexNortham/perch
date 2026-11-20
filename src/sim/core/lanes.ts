/**
 * Lane assignment at match start (GDD §6.2, D-EP-053, D-ARCH-034). Pure: the same seed and roster give the same lanes.
 *
 * Per flock: an even split over the map's lanes (two each for six birds). The human, if any, goes first on a seeded
 * lane; the bots take what is left in the split that costs least, where a pair in one lane costs
 * LANE_PAIR_COST.sameArchetype for two of one archetype (two supports) and LANE_PAIR_COST.sameLine for two frontline
 * or two backline birds. Every split is tried (at most 3^5 for six birds); ties go to the seeded order, so equal
 * flocks don't always lane alike.
 */
import type { Archetype, HeroId, LaneId, PlayerTeam, RosterSlot } from './contracts';
import { LANE_FRONTLINE, LANE_PAIR_COST } from '../data/core';
import { createRng } from './rng';

export function assignLanes(
  seed: number,
  roster: readonly RosterSlot[],
  lanes: readonly LaneId[],
  archetypeOf: (hero: HeroId) => Archetype,
): (LaneId | null)[] {
  const out: (LaneId | null)[] = roster.map(() => null);
  if (lanes.length === 0) return out;
  for (const team of ['dawn', 'dusk'] as const satisfies readonly PlayerTeam[]) {
    const rng = createRng(seed, `lanes/${team}`);
    const members = roster.flatMap((r, i) => (r.team === team ? [i] : []));
    const humans = members.filter((i) => roster[i]?.controller === 'human');
    const order = [...humans, ...rng.shuffle(members.filter((i) => roster[i]?.controller !== 'human'))];
    const laneOrder = rng.shuffle([...lanes]);
    const most = Math.ceil(order.length / laneOrder.length);
    const least = Math.floor(order.length / laneOrder.length);
    const archetypes = order.map((i) => archetypeOf((roster[i] as RosterSlot).hero));
    const front = archetypes.map((a) => LANE_FRONTLINE.includes(a));
    const pick: number[] = [];
    let best: number[] | null = null;
    let bestCost = Number.POSITIVE_INFINITY;
    const counts = laneOrder.map(() => 0);
    const pairCost = (a: number, b: number): number =>
      (archetypes[a] === archetypes[b] ? LANE_PAIR_COST.sameArchetype : 0) + (front[a] === front[b] ? LANE_PAIR_COST.sameLine : 0);
    // Depth-first over the seeded order; the first split found at the lowest cost wins.
    const place = (k: number, cost: number): void => {
      if (cost >= bestCost) return;
      if (k === order.length) {
        if (counts.every((c) => c >= least)) {
          best = [...pick];
          bestCost = cost;
        }
        return;
      }
      // The first bird (the human when there is one) takes the first seeded lane.
      const choices = k === 0 ? 1 : laneOrder.length;
      for (let l = 0; l < choices; l++) {
        if ((counts[l] as number) >= most) continue;
        let add = 0;
        for (let j = 0; j < k; j++) if (pick[j] === l) add += pairCost(j, k);
        pick[k] = l;
        counts[l]!++;
        place(k + 1, cost + add);
        counts[l]!--;
      }
    };
    place(0, 0);
    const chosen = best as number[] | null;
    order.forEach((i, k) => (out[i] = laneOrder[chosen?.[k] ?? 0] ?? null));
  }
  return out;
}
