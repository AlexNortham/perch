# Simulation track · Balance & Data · the Build Lab · tag BAL

Read W5-common.md first. This is the separate simulation track (D-EP-044): it starts in Stage 4 and merges when it
converges. It must never hold a stage up.

**You own:**
- `tools/buildlab/**` (new);
- the generated learned data under `src/sim/data/learned/**` (new);
- `docs/balance/**` (new).

`src/sim/data/builds.ts` belongs to Bot AI until W6. At the end, make one small commit that switches it to your learned
data.

## What the user asked for (D-EP-036, D-EP-037, D-EP-043, D-EP-045)

- **A recommended build for every hero,** from at least 1,000 mock games run at a much higher tick speed than real time.
  Run more if the results haven't converged; 10× or 100× is fine if needed.
- **Item scores that bots sample from.** Score each item by how good it is on that hero and with the items already
  owned. Bots buy varied but synergistic builds, and never the same build every game.
- **Balance evidence for later stages:**
  - per hero: win rate, kills, damage share, Seeds per minute;
  - per ability: casts, damage or healing, kill participation, and the share of value it contributes.

  Abilities that are too strong or near-useless get flagged for rework, with health and damage numbers in scope. You
  only **report** this in Stage 4; the Stage 5 balance round acts on it.

## What's already in place

- Contracts: `BuildData`, `ItemScores` and `RecommendedBuild` (INTERFACES §14.1).
- `src/sim/data/item-scores.ts`: `STARTER_SCORES`, `SCORE_PRIOR`, `ARCHETYPE_CORES`.
- `src/sim/data/builds.ts`: the round-0 designer prior.
- Bots sample purchases from the scores, with difficulty as temperature (D-AI decisions).
- `tools/sim.ts` (`npm run sim -- --matches N --parallel P --bots 12`) runs seeded headless 12-bot matches. It reaches
  about 7,900 ticks/s single-threaded on the full map.

## Phase A (now): the lab

1. **A runner** for thousands of seeded headless matches in parallel worker processes. It is deterministic per seed and
   records per match:
   - hero picks;
   - full purchase sequences with timings;
   - the winner and length;
   - per-hero and per-ability stats.

   It must be resumable after a stop, and write compact results under `out/buildlab/` (git-ignored).
2. **Learning.** Fit item value per hero, conditioned on the items already owned. A regularised model of win rate with
   item features and pairwise synergy terms is the expected route; record your choice as a D-BAL decision.
   - Run in rounds: bots buy from round *n*'s scores, which yields round *n+1*.
   - Mix in exploration, so items that are good but rarely bought are still tried.
3. **Convergence tests:**
   - item-score ranks are stable between independent halves of the data;
   - recommended builds are stable between rounds;
   - confidence intervals are narrow enough that rank changes are real.

   Decide the number of matches from these tests, never fewer than 1,000.
4. **Output:**
   - `src/sim/data/learned/*.ts`: generated, typed, deterministic, with a header naming the round, matches and seed range;
   - `docs/balance/report.md`: per-hero and per-ability tables, flagged outliers, and what the data can't tell yet.
5. **A pilot of about 100 matches** to prove the pipeline end to end.

**Phase A ends** when the pilot runs, learns and writes output. Stop there and report. Don't start the 1,000+ match run
yet: Bot AI is changing how matches end (today matches go undecided at 60:00), and the integration round is changing item
data and the starting purse. The EP will tell you when to run Phase B on the merged result.

## Machine load

Other agents run tests on this machine.
- Cap the lab at half the logical cores by default, with a `--parallel` flag.
- Run the pilot at most 4-wide.

## Prove it

- Pilot results and timings.
- Tests for the learning maths: synthetic data with a known best item must recover it.
- `npm run check`.
- STATUS entry and D-BAL decisions.
- Reply in at most 200 words.
