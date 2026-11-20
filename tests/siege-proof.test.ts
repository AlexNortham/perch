/**
 * Siege proof (W4 integration): the real Play match (main map, waves and structures on, no neutrals, no bots: the
 * client's `matchConfig`), one picked Dawn hero driven only through ordinary PlayerCommands by a scripted
 * aim-and-fire agent (src/sim/ai/siege-proof.testkit.ts, shared with the browser replay `?scene=replay`). The agent
 * reads state to choose where to walk and where to look, as a player reads the screen; it never writes state and uses
 * no win helper. It walks out of the base onto Riverbank, keeps behind its own wave, shoots enemy fledglings and each
 * open Dusk structure from outside that structure's reach, and the Patron's phase-two heart. The run writes its seed, hash and timeline to out/siege-proof/seed-<seed>.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import type { EntityId, SimEvent } from '../src/sim/core/contracts';
import { TICK_RATE } from '../src/sim/data/core';
import { siegeAgent, SIEGE_HERO as HERO, SIEGE_ROUTE as ROUTE } from '../src/sim/ai/siege-proof.testkit';
import { createSim, humanRoster } from '../src/sim/index';

const SEED = 1;
const MAX_TICKS = 60 * 60 * TICK_RATE;

// About 72,000 ticks (20 match minutes) in about 7 s alone; the timeout leaves room for a busy parallel run.
it('siege proof: one Owl on ordinary commands takes the Dusk structures and both Patron phases to victory', { timeout: 120_000 }, async () => {
  const sim = await createSim({
    seed: SEED, map: 'main', roster: humanRoster(SEED, HERO, { team: 'dawn', bots: 0 }),
    options: { structures: true, waves: true, neutrals: false, laneStart: false },
  });
  const me = sim.view.localHero as EntityId;
  const route = sim.ctx.store.list('structure').filter((s) => s.team === 'dusk' &&
    (s.structure.lane === 'riverbank' || s.structure.lane === null));
  const drive = siegeAgent(sim, me);
  const events: SimEvent[] = [];
  const fell: { type: string; at: number; credit: EntityId | null }[] = [];
  const hit = new Set<EntityId>();
  let heart = 0;
  let deaths = 0;
  while (!sim.isOver && sim.tick < MAX_TICKS) {
    sim.step([{ hero: me, command: drive() }]);
    for (const e of sim.drainEvents()) {
      if (e.type === 'match.ended' || e.type === 'patron.depleted' || (e.type === 'structure.state' && e.state === 'phase2')) events.push(e);
      if (e.type === 'damage.applied' && e.source === me && e.via === 'weapon' && route.some((s) => s.id === e.target)) {
        hit.add(e.target);
        if (e.weakPoint) heart++;
      }
      if (e.type === 'entity.died' && e.victim === me) deaths++;
      if (e.type === 'entity.died' && route.some((s) => s.id === e.victim)) {
        fell.push({ type: route.find((s) => s.id === e.victim)!.structure.type, at: Math.round(sim.tick / TICK_RATE), credit: e.creditHero });
      }
    }
  }
  const patron = route.find((s) => s.structure.type === 'patron')!;
  const proof = { seed: SEED, hero: HERO, ticks: sim.tick, matchSeconds: sim.tick / TICK_RATE, hash: sim.hash(), winner: sim.winner, deaths, heartHits: heart, fell };
  mkdirSync('out/siege-proof', { recursive: true });
  writeFileSync(`out/siege-proof/seed-${SEED}.json`, `${JSON.stringify(proof, null, 2)}\n`);

  expect(events).toEqual([
    { type: 'patron.depleted', structure: patron.id },
    { type: 'structure.state', structure: patron.id, state: 'phase2' },
    { type: 'match.ended', winner: 'dawn', reason: 'patron' },
  ]);
  expect(fell.map((f) => f.type).sort()).toEqual(['hawk', 'heron', 'patron', 'shrine', 'shrine', 'warden', 'warden']);
  // The wave and the hero share the work; the hero shot at every stage of the route.
  const shot = new Set(route.filter((s) => hit.has(s.id)).map((s) => s.structure.type));
  expect([...shot].sort(), 'the hero shot each kind of route structure').toEqual([...ROUTE].sort());
  expect(heart, 'gun hits on the phase-two heart-feather').toBeGreaterThan(0);
});
