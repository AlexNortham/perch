/** Bots can play the four Hero B3 birds: a bot match with all four, and each of them casts. */
import { describe, expect, it } from 'vitest';
import type { HeroId } from '../core/contracts';
import { TICK_RATE } from '../data/core';
import { createSim } from '../index';

const FOUR: readonly HeroId[] = ['frigatebird', 'cockatoo', 'swan', 'kiwi'];

describe('bots play Frigatebird, Cockatoo, Swan and Kiwi', () => {
  it('casts abilities with each of the four in a 6v6 bot match, with no failure', async () => {
    const dawn: readonly HeroId[] = [...FOUR, 'owl', 'pelican'];
    const dusk: readonly HeroId[] = ['shrike', 'penguin', 'hornbill', 'vulture', 'toucan', 'starling'];
    const sim = await createSim({
      seed: 7,
      map: 'main',
      roster: [
        ...dawn.map((hero) => ({ team: 'dawn' as const, hero, controller: 'normal' as const })),
        ...dusk.map((hero) => ({ team: 'dusk' as const, hero, controller: 'normal' as const })),
      ],
    });
    const heroes = sim.ctx.store.list('hero');
    const casts = new Map<string, number>();
    for (let t = 0; t < TICK_RATE * 120; t++) {
      sim.step();
      for (const e of sim.drainEvents()) {
        if (e.type !== 'ability' || e.stage !== 'land') continue;
        const hero = heroes.find((h) => h.id === e.caster);
        if (hero) casts.set(hero.hero.heroId, (casts.get(hero.hero.heroId) ?? 0) + 1);
      }
    }
    for (const id of FOUR) expect(casts.get(id) ?? 0, id).toBeGreaterThan(0);
  }, 120_000);
});
