# Wave 5b · Bot AI Engineer (#14) · tag AI

Read W5-common.md first. You own `src/sim/ai/**` and `src/sim/data/ai.ts`.

**Read before you start:**
- GDD §11 (bots, difficulties, archetype cores, how bots use interiors and every new object)
- INTERFACES (the bot command path, vision through `canSee`, item scores and builds)
- your section of W5-contract-followups.md
- `docs/reference/feel-reference.md` G22 ("hero bots that fight": today they stand at spawn)
- D-EP-036 and D-EP-044

**What you're building.** Bots that play whole matches like people, through the same `PlayerCommand` path as the human
and using only what a player in their seat could see (§11.1 fairness):
1. **Three difficulties.** Reaction time and human-like aim error, with tracking, flicks and recoil, per GDD.
2. **Laning.** Last hits, denies (shooting their own side's pods), poking, retreating at the GDD thresholds, and shop
   trips.
3. **Buying.** Sample purchases from item scores (D-EP-036): start from `STARTER_SCORES` in
   `src/sim/data/item-scores.ts` and switch to learned scores when the Build Lab delivers them. Difficulty sets the
   temperature. Builds must vary from match to match and still synergise; QA's `bot-shopping` suite measures this.
   Spend AP on upgrades and the ultimate unlock.
4. **The game around them.**
   - Rotations: Thickets, Nests, runes, the interactables, the Golden Egg (melee pickup, carry, deliver) and the Roc
     and its Embers.
   - Navigating interiors, stairs and roofs on the nav graph.
   - Updrafts by held Jump.
   - Grouping for sieges, Brood Ward awareness, defending, and answering pings.
5. **Play from the menu** (1 human + 11 bots) must make lanes fight within the first minute.

**Performance.** Make decisions at a sensible cadence (for example every few ticks) while aiming every tick. Keep the
AI share of the 1 ms tick budget explicit, and measure it with 12 bots.

**Prove it:**
- QA's bot suites pass under `PERCH_PENDING=1`.
- **20 seeded headless matches** of 12 bots (`npm run sim -- --matches 20 --parallel 8 --bots 12`) finish with zero
  crashes. Report match length, winner, kills and objective timings per match.
- A screenshot of a Play match at about 2 minutes showing bots fighting in a lane, which you have looked at.
- `npm run check` passes all six steps.
