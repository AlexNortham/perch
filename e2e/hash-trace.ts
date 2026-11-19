// The seeded scripts behind the cross-environment determinism test (D-ARCH-021). The same module runs in Node (the
// Playwright runner) and in the page (imported through the Vite dev server), so both engines execute identical code.
import type { EntityId } from '../src/sim/core/contracts';
import { siegeAgent, SIEGE_HERO } from '../src/sim/ai/siege-proof.testkit';
import { allBotRoster, createSim, humanRoster } from '../src/sim/index';

export const TRACE_SEED = 1;
export const TRACES = {
  /** The siege proof and `?scene=replay`: one Owl on the agent's ordinary commands, structures and waves on. */
  siege: { everyTickUntil: 1800, stride: 600, ticks: 18_000 },
  /** The headless bot match the Build Lab plays: 12 bots, everything on. */
  bots: { everyTickUntil: 900, stride: 600, ticks: 9_000 },
} as const;
export type TraceName = keyof typeof TRACES;

/** `[tick, hash]` after every tick up to `everyTickUntil`, then every `stride` ticks, then at the end. */
export async function hashTrace(name: TraceName): Promise<[number, string][]> {
  const { everyTickUntil, stride, ticks } = TRACES[name];
  const seed = TRACE_SEED;
  const sim =
    name === 'siege'
      ? await createSim({
          seed, map: 'main', roster: humanRoster(seed, SIEGE_HERO, { team: 'dawn', bots: 0 }),
          options: { structures: true, waves: true, neutrals: false },
        })
      : await createSim({ seed, roster: allBotRoster(seed, 12) });
  const me = sim.view.localHero as EntityId;
  const drive = name === 'siege' ? siegeAgent(sim, me) : null;
  const out: [number, string][] = [[sim.tick, sim.hash()]];
  while (!sim.isOver && sim.tick < ticks) {
    sim.step(drive ? [{ hero: me, command: drive() }] : undefined);
    sim.drainEvents();
    if (sim.tick <= everyTickUntil || sim.tick % stride === 0) out.push([sim.tick, sim.hash()]);
  }
  return out;
}
