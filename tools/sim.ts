// Headless match runner.
//   npm run sim -- --seed 1 --minutes 35 --bots 12 [--out <file>]
//     One match until --minutes or the match ends. Writes the telemetry JSON (default
//     out/telemetry/seed-<seed>.json) and prints duration, ticks per second, the winner and the final hash().
//   npm run sim -- --seed 1 --matches 100 [--parallel 15] [--minutes 35] [--bots 12] [--out <summary.json>]
//     Seeds seed … seed+matches−1, one child process per match, --parallel at a time (default: cores − 1).
//     Per-match telemetry goes next to the summary (default out/telemetry/summary-<first>-<last>.json).
//     Exits 1 if any match crashed.
// Wall-clock numbers are printed and kept in the summary, never in telemetry, so reruns diff clean.
import { fork } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { allBotRoster, createSim } from '../src/sim';
import { TICK_RATE } from '../src/sim/data/core';

interface MatchResult {
  seed: number;
  winner: string | null;
  ticks: number;
  minutes: number;
  hash: string;
  wallSeconds: number;
  ticksPerSecond: number;
  telemetry: string;
}
interface Crash {
  seed: number;
  error: string;
}

const { values } = parseArgs({
  options: {
    seed: { type: 'string', default: '1' },
    minutes: { type: 'string', default: '60' },
    bots: { type: 'string', default: '12' },
    matches: { type: 'string', default: '1' },
    parallel: { type: 'string', default: String(Math.max(1, availableParallelism() - 1)) },
    out: { type: 'string' },
  },
});
function num(name: 'seed' | 'minutes' | 'bots' | 'matches' | 'parallel'): number {
  const n = Number(values[name]);
  const ok = name === 'minutes' ? n > 0 : Number.isInteger(n) && n >= (name === 'seed' ? 0 : 1);
  if (!ok) {
    console.error(`sim: bad --${name} "${values[name]}"`);
    process.exit(2);
  }
  return n;
}
const seed = num('seed');
const minutes = num('minutes');
const bots = num('bots');
const matches = num('matches');
const parallel = num('parallel');

async function runMatch(matchSeed: number, file: string): Promise<MatchResult> {
  const sim = await createSim({ seed: matchSeed, roster: allBotRoster(matchSeed, bots) });
  const limit = Math.round(minutes * 60 * TICK_RATE);
  const started = performance.now();
  let ticks = 0;
  while (!sim.isOver && ticks < limit) {
    sim.step();
    ticks++;
  }
  const wallSeconds = (performance.now() - started) / 1000;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(sim.telemetry(), null, 2)}\n`);
  return {
    seed: matchSeed,
    winner: sim.winner,
    ticks,
    minutes: ticks / TICK_RATE / 60,
    hash: sim.hash(),
    wallSeconds,
    ticksPerSecond: Math.round(ticks / wallSeconds),
    telemetry: file,
  };
}

const line = (r: MatchResult): string =>
  `seed ${r.seed}: ${r.minutes.toFixed(2)} min (${r.ticks} ticks) in ${r.wallSeconds.toFixed(1)}s, ` +
  `${r.ticksPerSecond} ticks/s, winner ${r.winner ?? 'none'}, hash ${r.hash} → ${r.telemetry}`;

// One child process per match: a crash or a leak stays in its own process.
function runChild(s: number, file: string): Promise<MatchResult | Crash> {
  const args = ['--seed', String(s), '--minutes', String(minutes), '--bots', String(bots), '--out', file];
  return new Promise((done) => {
    let reply: MatchResult | Crash | undefined;
    fork(process.argv[1] ?? '', args)
      .on('message', (m) => (reply = m as MatchResult | Crash))
      .on('exit', (code) => done(reply ?? { seed: s, error: `exited with code ${code} and no result` }));
  });
}

if (matches === 1) {
  // Also the worker of a batch: the parent forks this file and reads the result over IPC.
  try {
    const result = await runMatch(seed, resolve(values.out ?? `out/telemetry/seed-${seed}.json`));
    console.log(`sim: ${line(result)}`);
    process.send?.(result);
  } catch (err) {
    console.error(`sim: seed ${seed} crashed:`, err);
    process.send?.({ seed, error: err instanceof Error ? (err.stack ?? err.message) : String(err) });
    process.exitCode = 1;
  }
} else {
  const last = seed + matches - 1;
  const summaryFile = resolve(values.out ?? `out/telemetry/summary-${seed}-${last}.json`);
  const results: MatchResult[] = [];
  const crashes: Crash[] = [];
  const started = performance.now();
  let next = seed;
  const worker = async (): Promise<void> => {
    while (next <= last) {
      const s = next++;
      const reply = await runChild(s, join(dirname(summaryFile), `seed-${s}.json`));
      if ('error' in reply) crashes.push(reply);
      else results.push(reply);
    }
  };
  await Promise.all(Array.from({ length: Math.min(parallel, matches) }, worker));
  results.sort((a, b) => a.seed - b.seed);
  crashes.sort((a, b) => a.seed - b.seed);
  const wins: Record<string, number> = {};
  for (const r of results) wins[r.winner ?? 'none'] = (wins[r.winner ?? 'none'] ?? 0) + 1;
  const lengths = results.map((r) => r.minutes);
  const wallSeconds = (performance.now() - started) / 1000;
  const summary = {
    seeds: [seed, last],
    minutes,
    bots,
    completed: results.length,
    crashed: crashes.length,
    wins,
    matchMinutes: {
      mean: lengths.reduce((a, b) => a + b, 0) / (lengths.length || 1),
      min: Math.min(...lengths),
      max: Math.max(...lengths),
    },
    wallSeconds,
    crashes,
    results,
  };
  mkdirSync(dirname(summaryFile), { recursive: true });
  writeFileSync(summaryFile, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(
    `sim: ${matches} matches in ${wallSeconds.toFixed(1)}s: ${results.length} completed, ${crashes.length} crashed, ` +
      `wins ${JSON.stringify(wins)} → ${summaryFile}`,
  );
  if (crashes.length) process.exitCode = 1;
}
