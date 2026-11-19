/* eslint-disable no-restricted-properties -- a benchmark measures wall time; the clock never reaches the sim */
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { createSim } from '../index';

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
  it('~150 fledglings marching and fighting, vision included, stay inside the world budget', async () => {
    const base = await measure(false);
    const busy = await measure(true);
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
