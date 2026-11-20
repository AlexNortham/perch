// A Build Lab match is a pure function of its job, and recording it doesn't change the match.
import { describe, expect, it } from 'vitest';
import { allBotRoster, createSim } from '../../src/sim';
import { TICK_RATE } from '../../src/sim/data/core';
import { runMatch, type MatchJob } from './match';

const job: MatchJob = {
  seed: 42,
  minutes: 1.5,
  difficulty: 'hard',
  policy: { dawn: { kind: 'scores', round: 0, temperature: 1 }, dusk: { kind: 'random' } },
  scores: {},
};

describe('runMatch', () => {
  it('records the same match twice, with the hash of the bare sim', async () => {
    const a = await runMatch(job);
    const b = await runMatch(job);
    expect(b).toEqual(a);
    const sim = await createSim({
      seed: job.seed,
      roster: allBotRoster(job.seed, undefined, 'hard'),
      options: { botShopping: { dawn: { temperature: 1 }, dusk: { random: true } } },
    });
    while (sim.tick < job.minutes * 60 * TICK_RATE) sim.step();
    expect(a.hash).toBe(sim.hash());
    expect(a.heroes).toHaveLength(12);
    expect(a.heroes.some((h) => Object.values(h.abilities).some((x) => x.casts > 0))).toBe(true);
  }, 120_000);
});
