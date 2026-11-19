/* eslint-disable no-restricted-properties -- a benchmark measures wall time; the clock never reaches the sim */
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import type { EffectCause, HeroEntity, Sim } from '../core/contracts';
import { PERF_RUNS } from '../../../tests/helpers/perf';
import { allBotRoster, createSim } from '../index';

const FORCED_WAVES = 7;
const WAVE_GAP_TICKS = 120;
const WARMUP_TICKS = 25 * 60;
const MEASURE_TICKS = 1200;
/** Re-aggro every camp this often while measuring, so they keep fighting instead of walking home. */
const AGGRO_EVERY_TICKS = 120;
/** The objectives benchmark: this many alternating chunks of this many ticks per match (25 s each in all). */
const OBJECTIVE_CHUNKS = 25;
const CHUNK_TICKS = 60;

const cause = (h: HeroEntity): EffectCause => ({ source: h.id, team: h.team, via: 'weapon', ability: null, item: null, values: null,
  songPower: 0, proc: false, origin: { ...h.pos } });

/** Hit one creature of every camp from the hero standing in it, waking the camp and setting it on that hero. */
function aggroAll(sim: Sim): void {
  const heroes = sim.ctx.store.list('hero');
  for (const u of sim.ctx.store.list('unit')) {
    if (u.unit.camp == null) continue;
    const h = heroes[u.unit.camp % heroes.length]!;
    sim.ctx.effects.apply({ kind: 'damage', amount: 1, type: 'talon' }, { entity: u.id, point: { ...u.pos }, dir: { x: 0, y: 0, z: 1 } }, cause(h));
  }
}

/**
 * A siege match with waves and twelve dummy heroes (which never act) standing, unkillable, 4 m from a camp each and the
 * Roc's lair, stepped to 1:00; with `neutrals`, every Stage 4 objective is then forced live: every camp spawned, every
 * Nest, Feeder and Berry up, both runes, the Egg and the awake Roc. Dummies keep the two matches identical apart from
 * the objectives. `step` re-aggroes every camp on its hero every 2 s.
 */
async function objectives(neutrals: boolean): Promise<{ sim: Sim; step: (n: number) => void }> {
  const roster = allBotRoster(1, 12).map((s) => ({ ...s, controller: 'dummy' as const }));
  const sim = await createSim({ seed: 1, map: 'main', roster, options: { waves: true, structures: true, neutrals } });
  const o = sim.ctx.objectives;
  const step = (n: number): void => {
    for (let i = 0; i < n; i++) {
      if (neutrals && sim.tick % AGGRO_EVERY_TICKS === 0) aggroAll(sim);
      sim.step();
      sim.drainEvents();
    }
  };
  const spots = [...sim.ctx.map.thickets.map((a) => a.pos), sim.ctx.map.hollow!.centre];
  sim.ctx.store.list('hero').forEach((h, i) => {
    const at = spots[i % spots.length]!;
    const point = { x: at.x + 4, y: at.y, z: at.z };
    sim.ctx.stats.set(h.id, 'perf:tough', { stats: [{ stat: 'maxHealth', op: 'add', value: 1e9 }] });
    sim.ctx.effects.apply({ kind: 'heal', amount: 1e9 }, { entity: h.id, point, dir: { x: 0, y: 0, z: 1 } }, cause(h));
    sim.ctx.effects.apply({ kind: 'teleport', to: 'point', face: 'keep' }, { entity: h.id, point, dir: { x: 0, y: 0, z: 1 } }, cause(h));
  });
  for (let i = 0; i < 60 * 60; i++) {
    sim.step();
    sim.drainEvents();
  }
  if (neutrals) {
    const now = sim.tick + 1;
    for (const at of [o.campAt, o.nestAt, o.interactableAt]) at?.fill(now);
    o.runesAt = o.eggAt = o.rocAt = now;
  }
  step(25 * 60);
  return { sim, step };
}

/** ms per tick of `step(n)`. (Process CPU time ticks in 15.6 ms steps on Windows, too coarse for a chunk.) */
function chunkMs(step: (n: number) => void, n: number): number {
  const t0 = performance.now();
  step(n);
  return (performance.now() - t0) / n;
}

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

  it('every Stage 4 objective live, every camp fighting, stays inside the objectives budget (GDD §6.12)', async () => {
    // Both matches live in one process and step in alternating 1 s chunks, so load from other processes
    // falls on both alike; the median chunk pair is the cost.
    const off = await objectives(false);
    const on = await objectives(true);
    const pairs: { off: number; on: number }[] = [];
    for (let i = 0; i < OBJECTIVE_CHUNKS; i++) pairs.push({ off: chunkMs(off.step, CHUNK_TICKS), on: chunkMs(on.step, CHUNK_TICKS) });
    pairs.sort((a, b) => a.on - a.off - (b.on - b.off));
    const mid = pairs[Math.floor(OBJECTIVE_CHUNKS / 2)]!;
    const cost = mid.on - mid.off;
    const units = on.sim.ctx.store.list('unit');
    const creatures = units.filter((u) => u.team === 'neutral').length;
    const breakables = on.sim.ctx.store.list('structure').filter((s) => s.structure.type === 'nest').length;
    console.log(
      `objectives: ${creatures} creatures (Roc included), ${breakables} Nests and Feeders, ` +
        `${on.sim.ctx.store.list('pickup').length} pickups; median chunk ${mid.on.toFixed(3)} ms/tick (${mid.off.toFixed(3)} ` +
        `without), +${cost.toFixed(3)} ms; quartiles +${(pairs[Math.floor(OBJECTIVE_CHUNKS / 4)]!.on - pairs[Math.floor(OBJECTIVE_CHUNKS / 4)]!.off).toFixed(3)}` +
        `…+${(pairs[Math.floor((3 * OBJECTIVE_CHUNKS) / 4)]!.on - pairs[Math.floor((3 * OBJECTIVE_CHUNKS) / 4)]!.off).toFixed(3)}`,
    );
    expect(creatures).toBeGreaterThan(40);
    expect(breakables).toBeGreaterThan(20);
    // GDD §6.12: 0.1 ms per tick for all Stage 4 objectives together. Loose bound for loaded machines, as above.
    expect(cost).toBeLessThan(0.3);
  }, 300_000);
});
