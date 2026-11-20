import { describe, expect, it } from 'vitest';
import { LANE_IDS } from './contracts';
import type { Archetype, HeroId, LaneId, RosterSlot } from './contracts';
import { LANE_FRONTLINE } from '../data/core';
import { HEROES } from '../heroes/registry';
import { humanRoster } from '../index';
import { assignLanes } from './lanes';

const archetypeOf = (id: HeroId): Archetype => HEROES[id].def.archetype;
const lanesOf = (seed: number, roster: readonly RosterSlot[]): (LaneId | null)[] => assignLanes(seed, roster, LANE_IDS, archetypeOf);

describe('lane assignment (D-ARCH-034)', () => {
  it('is deterministic from the seed and varies between seeds', () => {
    const roster = humanRoster(5, 'kingfisher', { bots: 11 });
    expect(lanesOf(5, roster)).toEqual(lanesOf(5, roster));
    const humanLanes = new Set(Array.from({ length: 12 }, (_, s) => lanesOf(s, humanRoster(s, 'kingfisher', { bots: 11 }))[0]));
    expect(humanLanes.size, 'the human is not always on one lane').toBe(3);
  });

  it('puts two birds of each flock in each lane, spreads archetypes and pairs frontline with backline where it can', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const roster = humanRoster(seed, HEROES.owl.implemented ? 'owl' : 'shrike', { bots: 11 });
      const lanes = lanesOf(seed, roster);
      for (const team of ['dawn', 'dusk'] as const) {
        const mine = roster.flatMap((r, i) => (r.team === team ? [{ r, lane: lanes[i] }] : []));
        const front = mine.filter(({ r }) => LANE_FRONTLINE.includes(archetypeOf(r.hero))).length;
        let mixedLanes = 0;
        for (const lane of LANE_IDS) {
          const pair = mine.filter((m) => m.lane === lane).map(({ r }) => archetypeOf(r.hero));
          expect(pair, `seed ${seed} ${team} ${lane}`).toHaveLength(2);
          const kinds = new Set(mine.map(({ r }) => archetypeOf(r.hero)));
          // Two of one archetype share a lane only when the flock has fewer archetypes than lanes need.
          if (kinds.size >= mine.length) expect(pair[0], `seed ${seed} ${team} ${lane}: one archetype twice`).not.toBe(pair[1]);
          if (LANE_FRONTLINE.includes(pair[0]!) !== LANE_FRONTLINE.includes(pair[1]!)) mixedLanes++;
        }
        // As many frontline-with-backline lanes as the flock's frontline/backline split allows.
        expect(mixedLanes, `seed ${seed} ${team}`).toBe(Math.min(front, mine.length - front, LANE_IDS.length));
      }
    }
  });

  it('never puts two supports in one lane, whoever is human', () => {
    const supports = Object.values(HEROES).filter((m) => m.def.archetype === 'support').map((m) => m.def.id);
    const others = Object.values(HEROES).filter((m) => m.def.archetype !== 'support').map((m) => m.def.id);
    expect(supports.length).toBeGreaterThanOrEqual(2);
    for (let seed = 1; seed <= 20; seed++) {
      const heroes = [supports[0]!, supports[1]!, ...others.slice(seed % 5, (seed % 5) + 4)];
      const roster: RosterSlot[] = heroes.map((hero, i) => ({ team: 'dusk', hero, controller: i === seed % 6 ? 'human' : 'normal' }));
      const lanes = lanesOf(seed, roster);
      expect(lanes[0], `seed ${seed}`).not.toBe(lanes[1]);
    }
  });

  it('splits small flocks evenly; no lanes, no assignment', () => {
    const roster: RosterSlot[] = [
      { team: 'dawn', hero: 'shrike', controller: 'normal' },
      { team: 'dawn', hero: 'albatross', controller: 'human' },
      { team: 'dawn', hero: 'lyrebird', controller: 'hard' },
      { team: 'dawn', hero: 'kingfisher', controller: 'easy' },
    ];
    const lanes = lanesOf(9, roster);
    expect(LANE_IDS.map((l) => lanes.filter((x) => x === l).length).sort()).toEqual([1, 1, 2]);
    expect(assignLanes(9, roster, [], archetypeOf)).toEqual([null, null, null, null]);
  });
});
