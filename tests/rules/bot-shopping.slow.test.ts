// Bot shopping (GDD §11.4, D-EP-036, INTERFACES §14.1). Written test-first (D-EP-006, W4.5 QA); on since W6 as the SLOW tier
// (D-QA-0xx): 20 seeded four-minute matches take about 12 minutes, so `npm test` skips *.slow.test.ts. Run it with
//   npm run slow
//
// How "near-identical" is measured (and why):
//   similarity(A, B) = |A ∩ B| / |A ∪ B| (Jaccard) over the two bots' FINAL item sets in the same hero, compared
//   as sets so the order of purchase and the moment of a sale don't matter, and normalised by size so a hero that
//   owns more items isn't penalised. Identical sets score 1.0 and two 8-item builds that differ by one item score
//   7/9 = 0.78, by two items 6/10 = 0.60. The failing threshold is similarity >= 0.85: that is "the same build",
//   because even a 12-item build with a single item swapped scores 11/13 = 0.846 and passes. The threshold is
//   deliberately tight; the policy is stochastic by design (softmax over scores), so a Hunter bot that repeats
//   another's whole build is a sign that sampling collapsed to the argmax.
//
// Synergy score of a build (the "does the learned policy do better than chance" measure):
//   S(build) = mean over its items i of ( base[i] + Σ over the other owned items o of synergy[o][i] )
//   using the hero's own table from BUILDS (phase offsets left out, since the build is final). The random baseline
//   is the same measure on builds from `botShopping: { random: true }` (uniform over affordable, buyable items).
import { beforeAll, describe, expect, it } from 'vitest';
import type { HeroId, ItemId, ItemScores, PlayerTeam, RosterSlot, SimOptions } from '../../src/sim/core/contracts';
import { createSim } from '../../src/sim/index';
import { TICK_RATE } from '../../src/sim/data/core';

const TIMEOUT_MS = 900_000;
const MATCHES = 20;
const MATCH_MINUTES = 4;
/** Enough Seeds that every bot fills its slots within the first minutes, so a short match shows the whole build. */
const RICH = 30_000;
const NEAR_IDENTICAL = 0.85;
const DAWN_A: readonly HeroId[] = ['shrike', 'albatross', 'kingfisher', 'lyrebird', 'owl', 'pelican'];
const DUSK_B: readonly HeroId[] = ['secretarybird', 'starling', 'hornbill', 'flamingo', 'penguin', 'puffin'];

interface Build {
  readonly hero: HeroId;
  readonly items: readonly ItemId[];
  /** Purchase order, as bought. */
  readonly bought: readonly ItemId[];
  /** true: sampled from the scores; false: the uniform-random baseline. */
  readonly scored: boolean;
}

const roster = (dawn: readonly HeroId[], dusk: readonly HeroId[]): RosterSlot[] => [
  ...dawn.map((hero) => ({ team: 'dawn' as PlayerTeam, hero, controller: 'normal' as const })),
  ...dusk.map((hero) => ({ team: 'dusk' as PlayerTeam, hero, controller: 'normal' as const })),
];

async function play(seed: number, dawn: readonly HeroId[], dusk: readonly HeroId[], options: SimOptions, minutes = MATCH_MINUTES) {
  const sim = await createSim({ seed, roster: roster(dawn, dusk), options: { startSeeds: RICH, ...options } });
  for (let i = 0; i < minutes * 60 * TICK_RATE; i++) sim.step([]);
  const telemetry = sim.telemetry();
  return { sim, telemetry };
}

function buildsOf(result: Awaited<ReturnType<typeof play>>, team: PlayerTeam, scored: boolean): Build[] {
  return result.sim.ctx.store.list('hero').filter((h) => h.team === team).map((h) => ({
    hero: h.hero.heroId,
    items: h.inventory.items.map((i) => i.item),
    bought: result.telemetry.heroes[h.hero.slot]!.itemsBought.map((b) => b.item),
    scored,
  }));
}

async function scoresOf(): Promise<Readonly<Partial<Record<HeroId, ItemScores>>>> {
  const path = new URL('../../src/sim/data/builds.ts', import.meta.url).href;
  const mod = (await import(/* @vite-ignore */ path)) as { BUILDS: { scores: Readonly<Partial<Record<HeroId, ItemScores>>> } };
  return mod.BUILDS.scores;
}

const jaccard = (a: readonly string[], b: readonly string[]): number => {
  const sa = new Set(a);
  const sb = new Set(b);
  const both = [...sa].filter((x) => sb.has(x)).length;
  return both / (sa.size + sb.size - both);
};

function synergyScore(scores: ItemScores, items: readonly ItemId[]): number {
  let total = 0;
  for (const item of items) {
    let s = scores.base[item] ?? 0;
    for (const owned of items) if (owned !== item) s += scores.synergy[owned]?.[item] ?? 0;
    total += s;
  }
  return total / Math.max(1, items.length);
}

const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: readonly number[]): number => Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)));

describe('W5 bot shopping (§11.4, D-EP-036)', { timeout: TIMEOUT_MS }, () => {
  const scoredBuilds: Build[] = [];
  const randomBuilds: Build[] = [];

  beforeAll(async () => {
    // 20 seeded matches. Dawn always shops from the learned scores, Dusk always at random; the halves swap which
    // heroes stand on which flock, so every hero contributes the same number of scored and random builds.
    for (let seed = 1; seed <= MATCHES; seed++) {
      const swap = seed % 2 === 0;
      const result = await play(seed, swap ? DUSK_B : DAWN_A, swap ? DAWN_A : DUSK_B, { botShopping: { dusk: { random: true } } });
      scoredBuilds.push(...buildsOf(result, 'dawn', true));
      randomBuilds.push(...buildsOf(result, 'dusk', false));
    }
  }, TIMEOUT_MS);

  it('D-EP-036 bots buy: over four minutes with 30,000 Seeds every bot owns at least four items, and never more than the slot limit', () => {
    for (const b of [...scoredBuilds, ...randomBuilds]) {
      expect(b.items.length, `${b.hero} (scored ${b.scored})`).toBeGreaterThanOrEqual(4);
      expect(b.items.length).toBeLessThanOrEqual(16);
    }
  });

  it('D-EP-036 §14.1 purchases are deterministic per seed: the same seed buys the same items in the same order', async () => {
    const a = await play(7, DAWN_A, DUSK_B, {}, 2);
    const b = await play(7, DAWN_A, DUSK_B, {}, 2);
    expect(buildsOf(a, 'dawn', true).map((x) => x.bought)).toEqual(buildsOf(b, 'dawn', true).map((x) => x.bought));
    expect(a.telemetry.heroes.map((h) => h.itemsBought)).toEqual(b.telemetry.heroes.map((h) => h.itemsBought));
    const c = await play(8, DAWN_A, DUSK_B, {}, 2);
    expect(c.telemetry.heroes.map((h) => h.itemsBought), 'a different seed buys differently').not.toEqual(a.telemetry.heroes.map((h) => h.itemsBought));
  });

  it('§14.1 purchases are sampled from item scores: a dominant score is bought first, and a 1-point lead wins about e/(1+e) = 73% of the time', async () => {
    const hero = DAWN_A[0]!;
    const dominant: ItemScores = { base: { 'quill-clip': 50 }, synergy: {}, phase: {} };
    const r = await play(3, [hero], DUSK_B.slice(0, 1), { botShopping: { dawn: { scores: { [hero]: dominant }, temperature: 1 } } }, 2);
    expect(r.telemetry.heroes[0]!.itemsBought[0]!.item, 'the dominant score is the first purchase').toBe('quill-clip');

    // Two candidates (all others far below): the better one by one logit is picked 73% of the time at T = 1.
    const two: ItemScores = { base: { 'quill-clip': 1, 'quick-preen': 0 }, synergy: {}, phase: {} };
    const floor = Object.fromEntries(DAWN_A.map((h) => [h, two])) as Record<HeroId, ItemScores>;
    let first = 0;
    let n = 0;
    for (let seed = 1; seed <= MATCHES; seed++) {
      const m = await play(seed, DAWN_A, DUSK_B.slice(0, 1), { botShopping: { dawn: { scores: floor, temperature: 1 } } }, 1);
      for (const h of m.telemetry.heroes.slice(0, DAWN_A.length)) {
        const pick = h.itemsBought[0]?.item;
        if (pick === undefined) continue;
        n++;
        if (pick === 'quill-clip') first++;
      }
    }
    expect(n, 'every bot made a first purchase').toBeGreaterThan(MATCHES * DAWN_A.length * 0.9);
    expect(first / n).toBeGreaterThan(0.62);
    expect(first / n).toBeLessThan(0.84);
  });

  it('D-EP-036 over 20 seeded matches no two builds of the same hero are near-identical (Jaccard on final item sets < 0.85)', () => {
    const byHero = new Map<HeroId, Build[]>();
    for (const b of scoredBuilds) byHero.set(b.hero, [...(byHero.get(b.hero) ?? []), b]);
    expect(byHero.size, 'twelve heroes').toBe(12);
    const worst: string[] = [];
    for (const [hero, builds] of byHero) {
      expect(builds.length, `${hero} has a build from each of ${MATCHES / 2} matches`).toBe(MATCHES / 2);
      for (let i = 0; i < builds.length; i++) {
        for (let j = i + 1; j < builds.length; j++) {
          const s = jaccard(builds[i]!.items, builds[j]!.items);
          if (s >= NEAR_IDENTICAL) worst.push(`${hero}: builds ${i} and ${j} score ${s.toFixed(2)}`);
        }
      }
    }
    expect(worst, 'near-identical pairs').toEqual([]);
  });

  it('D-EP-036 the mean synergy score of scored bots is above the random-purchase baseline, by at least two standard errors', async () => {
    const scores = await scoresOf();
    const score = (bs: readonly Build[]) => bs.map((b) => synergyScore(scores[b.hero]!, b.items));
    const learned = score(scoredBuilds);
    const random = score(randomBuilds);
    expect(learned.length).toBe(random.length);
    const gap = mean(learned) - mean(random);
    const se = Math.sqrt(sd(learned) ** 2 / learned.length + sd(random) ** 2 / random.length);
    expect(gap, `learned ${mean(learned).toFixed(2)} vs random ${mean(random).toFixed(2)}`).toBeGreaterThan(2 * se);
  });

  it('§14.1 the Build Lab hook: round 0 BUILDS has scores and a build for every hero, with phases at 600 s and 1,320 s', async () => {
    const path = new URL('../../src/sim/data/builds.ts', import.meta.url).href;
    const { BUILDS } = (await import(/* @vite-ignore */ path)) as { BUILDS: { round: number; phases: { midFromS: number; lateFromS: number }; scores: object; builds: Record<string, { early: unknown[]; mid: unknown[]; late: unknown[] }> } };
    expect(BUILDS.round).toBeGreaterThanOrEqual(0);
    expect(BUILDS.phases).toEqual({ midFromS: 600, lateFromS: 1320 });
    for (const hero of [...DAWN_A, ...DUSK_B]) {
      expect((BUILDS.scores as Record<string, unknown>)[hero], `${hero} scores`).toBeDefined();
      const b = BUILDS.builds[hero]!;
      expect(b.early.length + b.mid.length + b.late.length, `${hero} build`).toBeGreaterThan(0);
    }
  });
});
