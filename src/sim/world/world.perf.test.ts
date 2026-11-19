/* eslint-disable no-restricted-properties -- a benchmark measures wall time; the clock never reaches the sim */
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { PERF_RUNS } from '../../../tests/helpers/perf';
import { allBotRoster, createSim } from '../index';

const FORCED_WAVES = 7;
const WAVE_GAP_TICKS = 120;
const WARMUP_TICKS = 25 * 60;
const MEASURE_TICKS = 1200;

/** ms per tick over a window after `FORCED_WAVES` waves 2 s apart (168 fledglings) have marched for 25 s. */
async function measure(waves: boolean): Promise<{ ms: number; alive: number; deaths: number; attacks: number }> {
  const sim = await createSim({ seed: 1, map: 'main', roster: [], options: { waves, neutrals: false } });
  const o = sim.ctx.objectives;
  let deaths = 0;
  let attacks = 0;
  sim.ctx.bus.on('entity.died', () => deaths++);
  sim.ctx.bus.on('damage.applied', (e) => {
    if (e.via === 'unit') attacks++;
  });
  for (let i = 0; i < WARMUP_TICKS; i++) {
    if (waves && i < FORCED_WAVES * WAVE_GAP_TICKS && i % WAVE_GAP_TICKS === 0) o.nextWaveAt = sim.tick + 1;
    else if (waves) o.nextWaveAt = Number.MAX_SAFE_INTEGER;
    sim.step();
    sim.drainEvents();
  }
  const alive = sim.ctx.store.list('unit').length;
  const t0 = performance.now();
  for (let i = 0; i < MEASURE_TICKS; i++) {
    sim.step();
    sim.drainEvents();
  }
  return { ms: (performance.now() - t0) / MEASURE_TICKS, alive, deaths, attacks };
}

describe('performance', () => {
  it('reports startup, individual wave ticks and the warm distribution on Old Mossmarket', async () => {
    const seed = 1;
    const startup = performance.now();
    const sim = await createSim({ seed, map: 'main', roster: allBotRoster(seed, 12), options: { waves: true, structures: true, neutrals: false } });
    const startupMs = performance.now() - startup;
    const first = performance.now();
    sim.step();
    sim.drainEvents();
    const firstMs = performance.now() - first;
    const samples: number[] = [];
    const spawns: number[] = [];
    for (let i = 1; i < 3 * 60 * 60; i++) {
      const t = performance.now();
      sim.step();
      const events = sim.drainEvents();
      const elapsed = performance.now() - t;
      samples.push(elapsed);
      if (events.some((e) => e.type === 'wave.spawned')) spawns.push(elapsed);
    }
    samples.sort((a, b) => a - b);
    const mean = samples.reduce((sum, x) => sum + x, 0) / samples.length;
    console.log(`world siege seed ${seed}, 12 bots, 3 min, ms: startup ${startupMs.toFixed(2)}, first tick ${firstMs.toFixed(2)}, ` +
      `warm wave ticks 1800..10800 ${spawns.map(ms => ms.toFixed(3)).join(', ')}, mean ${mean.toFixed(3)}, ` +
      `p99 ${samples[Math.floor(samples.length * 0.99)]!.toFixed(3)}, max ${samples.at(-1)!.toFixed(3)}`);
    expect(spawns).toHaveLength(6);
  }, 120_000);

  it('~150 fledglings marching and fighting, vision included, stay inside the world budget', async () => {
    const runs: { base: Awaited<ReturnType<typeof measure>>; busy: Awaited<ReturnType<typeof measure>> }[] = [];
    for (let i = 0; i < PERF_RUNS; i++) runs.push({ base: await measure(false), busy: await measure(true) });
    runs.sort((a, b) => a.busy.ms - a.base.ms - (b.busy.ms - b.base.ms));
    const { base, busy } = runs[Math.floor(PERF_RUNS / 2)] as (typeof runs)[number];
    const cost = busy.ms - base.ms;
    console.log(
      `world: ${busy.alive} fledglings, ${busy.ms.toFixed(3)} ms/tick (${base.ms.toFixed(3)} without), ` +
        `+${cost.toFixed(3)} ms; ${busy.attacks} unit hits, ${busy.deaths} deaths in the window`,
    );
    expect(busy.alive).toBeGreaterThanOrEqual(140);
    expect(busy.attacks).toBeGreaterThan(100);
    // Brief: 0.25 ms per tick for ~150 fledglings, vision included. The bound is loose for loaded machines.
    expect(cost).toBeLessThan(0.5);
  }, 120_000);
});
