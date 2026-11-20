/* eslint-disable no-restricted-properties -- a benchmark measures wall time; the clock never reaches the sim */
// The AI share of the tick budget (ARCHITECTURE §11: 1 ms per tick for the whole sim) with 12 bots, in a live match
// (lanes fighting, so targets, routes and raycasts are all in play). A second AI system runs on a copy of the
// context with its own RNG streams and bus, so timing it doesn't change the match; the real AI then overwrites its
// commands in the next step.
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../core/contracts';
import { createBus } from '../core/events';
import { createRngStreams } from '../core/rng';
import { PERF_RUNS, medianRun } from '../../../tests/helpers/perf';
import { allBotRoster, createSim } from '../index';
import { createAiSystem } from './index';

const WARMUP_TICKS = 75 * 60;
const MEASURE_TICKS = 1800;
/** The AI's share of the 1 ms tick: decisions every 0.2–0.5 s, aim every tick. */
const AI_BUDGET_MS = 0.25;

async function measure(): Promise<{ ai: number; step: number }> {
  const sim = await createSim({ seed: 1, roster: allBotRoster(1, 12) });
  for (let i = 0; i < WARMUP_TICKS; i++) {
    sim.step();
    sim.drainEvents();
  }
  const shadow = createAiSystem({ ...sim.ctx, rng: createRngStreams(sim.ctx.config.seed), bus: createBus<SimEvent>() });
  const run = shadow.phases.ai!;
  let ai = 0;
  let step = 0;
  for (let i = 0; i < MEASURE_TICKS; i++) {
    const t0 = performance.now();
    run();
    const t1 = performance.now();
    sim.step();
    const t2 = performance.now();
    sim.drainEvents();
    ai += t1 - t0;
    step += t2 - t1;
  }
  return { ai: ai / MEASURE_TICKS, step: step / MEASURE_TICKS };
}

describe('bot AI cost', () => {
  it(`12 bots cost under ${AI_BUDGET_MS} ms per tick`, async () => {
    const runs: { ai: number; step: number }[] = [];
    for (let i = 0; i < PERF_RUNS; i++) runs.push(await measure());
    const m = medianRun(runs.length, () => runs.shift()!, (r) => r.ai);
    console.log(`ai ${m.ai.toFixed(3)} ms/tick of a ${m.step.toFixed(3)} ms step (${((m.ai / m.step) * 100).toFixed(0)}%)`);
    expect(m.ai).toBeLessThan(AI_BUDGET_MS);
  });
});
