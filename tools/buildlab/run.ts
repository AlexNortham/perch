// The Build Lab (D-EP-036/037/049, D-BAL-001..005): seeded headless 12-bot matches in rounds, learning item scores and
// recommended builds per hero.
//   npx tsx tools/buildlab/run.ts --round R --matches N [--parallel P] [--minutes 60] [--difficulty hard]
//     Plays round R's training matches (seeds R·1,000,000 + 1 … + N) with round R−1's scores and exploration, one
//     child process per match, P at a time (default half the logical cores). Resumable: matches already written under
//     out/buildlab/round-R/matches/ are skipped. Then learns from every training match of rounds 1…R and writes
//     out/buildlab/round-R/learned.json, src/sim/data/learned/builds.ts and docs/balance/report.md.
//   --duel prev|random   Held-out matches instead (seeds + 500,000): round R's scores vs round R−1's, or vs random.
//   --learn-only         Skip playing; relearn and rewrite the outputs.
import { fork } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { BotDifficulty, HeroId, ItemScores, PlayerTeam, RecommendedBuild } from '../../src/sim/core/contracts';
import { HERO_IDS } from '../../src/sim/core/contracts';
import { createRng } from '../../src/sim/core/rng';
import { BUILDS } from '../../src/sim/data/builds';
import { TICK_RATE } from '../../src/sim/data/core';
import { ITEMS } from '../../src/sim/data/items';
import { recommend } from './learn';
import type { FlockPolicy, MatchJob, MatchRecord } from './match';
import { PRIOR_SCORES, learnedSource, learnRound, reportMarkdown, type LearnedRound, type RunLine, type Timing } from './report';

/**
 * D-BAL-002/005: the temperature falls each round to Hunter's; a quarter of flocks buy at random, which keeps rarely
 * bought items explored and doubles as the random baseline.
 */
export const EXPLORE = {
  temperature: (round: number): number => Math.max(0.5, 0.8 ** (round - 1)),
  randomShare: (): number => 0.25,
  /** Duels play at Hunter's temperature, as most bots will. */
  duelTemperature: 0.5,
  seedsPerRound: 1_000_000,
  duelOffset: 500_000,
} as const;

const { values } = parseArgs({
  options: {
    round: { type: 'string' },
    matches: { type: 'string', default: '0' },
    parallel: { type: 'string', default: String(Math.max(1, Math.floor(availableParallelism() / 2))) },
    minutes: { type: 'string', default: '60' },
    difficulty: { type: 'string', default: 'hard' },
    duel: { type: 'string' },
    'learn-only': { type: 'boolean', default: false },
    out: { type: 'string', default: 'out/buildlab' },
  },
});
const int = (v: string | undefined, name: string, min: number): number => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min) {
    console.error(`buildlab: bad --${name} "${v}"`);
    process.exit(2);
  }
  return n;
};
const round = int(values.round, 'round', 1);
const matches = int(values.matches, 'matches', 0);
const parallel = int(values.parallel, 'parallel', 1);
const minutes = Number(values.minutes);
const difficulty = values.difficulty as BotDifficulty;
const duel = values.duel;
if (!(minutes > 0) || !['easy', 'normal', 'hard'].includes(difficulty) || (duel !== undefined && !['prev', 'random'].includes(duel))) {
  console.error('buildlab: bad --minutes, --difficulty or --duel');
  process.exit(2);
}

const root = resolve(values.out);
const roundDir = (r: number): string => join(root, `round-${r}`);
const matchDir = (r: number, kind: string): string => join(roundDir(r), kind === 'train' ? 'matches' : `duel-${kind}`);
const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T;
const writeAtomic = (file: string, text: string): void => {
  writeFileSync(`${file}.tmp`, text);
  renameSync(`${file}.tmp`, file);
};
const readLines = <T>(file: string): T[] =>
  existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as T) : [];
const records = (dir: string): MatchRecord[] =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => readJson<MatchRecord>(join(dir, f))) : [];

/** Round r's learned scores; round 0 is the designer prior, passed explicitly so records don't depend on builds.ts. */
function scoresOf(r: number): Partial<Record<HeroId, ItemScores>> {
  if (r === 0) return PRIOR_SCORES;
  const file = join(roundDir(r), 'learned.json');
  if (!existsSync(file)) throw new Error(`buildlab: ${file} is missing; learn round ${r} first`);
  return readJson<LearnedRound>(file).scores;
}

function jobOf(seed: number, kind: string): MatchJob {
  const scores = (r: number): FlockPolicy => ({ kind: 'scores', round: r, temperature: kind === 'train' ? EXPLORE.temperature(round) : EXPLORE.duelTemperature });
  let policy: Record<PlayerTeam, FlockPolicy>;
  if (kind === 'train') {
    const rng = createRng(seed, 'buildlab');
    const pick = (): FlockPolicy => (rng.next() < EXPLORE.randomShare() ? { kind: 'random' } : scores(round - 1));
    policy = { dawn: pick(), dusk: pick() };
  } else {
    // The newest scores alternate sides by seed.
    const newest = scores(round);
    const rival: FlockPolicy = kind === 'prev' ? scores(round - 1) : { kind: 'random' };
    policy = seed % 2 ? { dawn: newest, dusk: rival } : { dawn: rival, dusk: newest };
  }
  const of = (p: FlockPolicy): Partial<Record<HeroId, ItemScores>> | undefined => (p.kind === 'scores' ? scoresOf(p.round) : undefined);
  const dawn = of(policy.dawn);
  const dusk = of(policy.dusk);
  return { seed, minutes, difficulty, policy, scores: { ...(dawn && { dawn }), ...(dusk && { dusk }) } };
}

type Reply = { record: MatchRecord; wallSeconds: number } | { error: string };
const workerFile = fileURLToPath(new URL('./worker.ts', import.meta.url));
function runChild(job: MatchJob): Promise<Reply> {
  return new Promise((done) => {
    let reply: Reply | undefined;
    const child = fork(workerFile);
    child.on('message', (m) => (reply = m as Reply));
    child.on('exit', (code) => done(reply ?? { error: `exited with code ${code} and no result` }));
    child.send(job);
  });
}

async function play(kind: string): Promise<void> {
  const dir = matchDir(round, kind);
  mkdirSync(dir, { recursive: true });
  const first = round * EXPLORE.seedsPerRound + (kind === 'train' ? 0 : EXPLORE.duelOffset) + 1;
  const todo = Array.from({ length: matches }, (_, i) => first + i).filter((s) => !existsSync(join(dir, `${s}.json`)));
  console.log(`buildlab: round ${round} ${kind}: ${matches - todo.length} of ${matches} done, ${todo.length} to play, ${parallel} at a time`);
  const started = performance.now();
  let crashes = 0;
  let finished = 0;
  const worker = async (): Promise<void> => {
    for (let seed = todo.shift(); seed !== undefined; seed = todo.shift()) {
      const reply = await runChild(jobOf(seed, kind));
      finished++;
      if ('error' in reply) {
        crashes++;
        console.error(`buildlab: seed ${seed} crashed: ${reply.error.split('\n')[0]}`);
        continue;
      }
      const m = reply.record;
      writeAtomic(join(dir, `${seed}.json`), `${JSON.stringify(m)}\n`);
      const ticks = Math.round(m.seconds * TICK_RATE);
      appendFileSync(join(roundDir(round), 'timings.jsonl'), `${JSON.stringify({ seed, wallSeconds: reply.wallSeconds, ticks } satisfies Timing)}\n`);
      console.log(`buildlab: [${finished}] seed ${seed}: ${(m.seconds / 60).toFixed(1)} min, winner ${m.winner ?? 'none'}, ` +
        `${reply.wallSeconds.toFixed(0)} s (${Math.round(ticks / reply.wallSeconds)} ticks/s)`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(parallel, todo.length) }, worker));
  const elapsedSeconds = (performance.now() - started) / 1000;
  if (finished) appendFileSync(join(root, 'runs.jsonl'), `${JSON.stringify({ round, kind, matches: finished - crashes, parallel, elapsedSeconds } satisfies RunLine)}\n`);
  console.log(`buildlab: round ${round} ${kind}: ${finished - crashes} played, ${crashes} crashed in ${(elapsedSeconds / 60).toFixed(1)} min`);
  if (crashes) process.exitCode = 1;
}

function learn(): void {
  const catalogue = new Map(ITEMS.map((i) => [i.id, i]));
  const train = Array.from({ length: round }, (_, i) => records(matchDir(i + 1, 'train'))).flat();
  if (!train.length) throw new Error('buildlab: no training matches to learn from');
  const prevFile = join(roundDir(round - 1), 'learned.json');
  // Round 1 compares with the greedy cores of the designer prior.
  const prevBuilds: Partial<Record<HeroId, RecommendedBuild>> = existsSync(prevFile)
    ? readJson<LearnedRound>(prevFile).builds
    : Object.fromEntries(HERO_IDS.flatMap((h) => {
      const s = PRIOR_SCORES[h];
      return s ? [[h, recommend(s, catalogue, BUILDS.builds[h]?.situational ?? [])]] : [];
    }));
  const started = performance.now();
  const { heroes: learned, contribution } = learnRound(train, catalogue, prevBuilds);
  const seeds = train.map((m) => m.seed);
  const byRound = [...new Set(seeds.map((s) => Math.floor(s / EXPLORE.seedsPerRound)))].sort((a, b) => a - b);
  const out: LearnedRound = {
    round,
    matches: train.length,
    seeds: byRound.map((r) => {
      const xs = seeds.filter((s) => Math.floor(s / EXPLORE.seedsPerRound) === r);
      return [Math.min(...xs), Math.max(...xs)] as const;
    }),
    scores: Object.fromEntries([...learned].map(([h, l]) => [h, l.model?.scores ?? PRIOR_SCORES[h]])),
    builds: Object.fromEntries([...learned].map(([h, l]) => [h, l.build])),
  };
  mkdirSync(roundDir(round), { recursive: true });
  writeAtomic(join(roundDir(round), 'learned.json'), `${JSON.stringify(out)}\n`);
  const caps = [...new Set(train.map((m) => m.minutes))].sort((a, b) => a - b);
  const diffs = [...new Set(train.map((m) => m.difficulty))].join('/');
  const here = fileURLToPath(new URL('.', import.meta.url));
  const dataFile = resolve(here, '../../src/sim/data/learned/builds.ts');
  const reportFile = resolve(here, '../../docs/balance/report.md');
  mkdirSync(resolve(dataFile, '..'), { recursive: true });
  mkdirSync(resolve(reportFile, '..'), { recursive: true });
  writeFileSync(dataFile, learnedSource(out, caps, diffs));
  const duels = ['prev', 'random'].map((kind) => ({ kind, matches: records(matchDir(round, kind)) })).filter((d) => d.matches.length);
  const timings = Array.from({ length: round }, (_, i) => readLines<Timing>(join(roundDir(i + 1), 'timings.jsonl'))).flat();
  const runs = readLines<RunLine>(join(root, 'runs.jsonl'));
  writeFileSync(reportFile, reportMarkdown({ round, matches: train, duels, learned, contribution, timings, runs, catalogue }));
  console.log(`buildlab: learned round ${round} from ${train.length} matches in ${((performance.now() - started) / 1000).toFixed(1)} s → ` +
    `${join(roundDir(round), 'learned.json')}, ${dataFile}, ${reportFile}`);
}

if (!values['learn-only'] && matches > 0) await play(duel ?? 'train');
learn();
