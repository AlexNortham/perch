# W4 · Integration · INTEG

Read W4-common.md and D-EP-018. Work on the EP's integrate/w4 worktree after the verified role merges. The EP
will add the specific merged defects, reproductions and owning paths here before dispatch. Each fix belongs in
the system that owns the behavior, with one commit per item. Contracts remain frozen.

- Verify the full path from a real picked hero through firing, objective gates/bounties, AP, shopping, both
  Patron phases and victory. Exercise key rebinding and volume live across overlays.
- Turn QA's W4 suites always on once the systems land. Preserve the assertions, explain any demonstrably
  incorrect fixture, fix merged wiring at the owning system and run the six-step check in Git Bash.
- Capture the actual stage build and a reproducible normal-control siege proof. Report progress, measured perf
  and deterministic replay; put any remaining findings against an owner for the gate.

## EP: the defects for this round (Claude EP, 19/11/2026)

The candidate is `integrate/w4c`: main + ChatGPT's `integrate/w4` checkpoint + all nine W4 role branches (Economy,
Objectives, Consumers, Audio, Hero A, Hero B, Technical Artist, UI, Movement). `npm run check` passes 6/6 on it
(696 unit, 7 perf, 15 e2e). With `PERCH_PENDING=1`, 598 pass and 5 fail. The round is split in two so the engineers
never edit the same files. Each works in its own worktree branched from `integrate/w4c`, and the EP merges both.

### INTEG-SIM: simulation side (src/sim/**, tests/**)
1. Turn every PERCH_PENDING suite whose system has now landed to always-on (QA's W4 rules suites and the heroes'
   pending tests). List any that stay gated, with the reason.
2. `tests/rules/siege.test.ts`: the three "rides over both flocks' Hawks and Herons" cases fail because the enemy
   towers shoot the rider dead before the far Heron. With extra HP all 12 towers clear by exactly 2.00 m. Fix the
   fixture so it isolates clearance (for example, the towers hold fire or the rider can't die) and keep the 2 m
   clearance assertion. Explain the change in the commit.
3. Puffin's Rogue Wave (`src/sim/heroes/puffin/puffin.test.ts`, 2 failures): the wave carries a target about 27 m
   instead of the 12 m `maxCarry` cap, and the onEnter damage lands twice instead of once. Fix it at the owner
   (Ability Systems' moving-area code, or Puffin's data).
4. Penguin hops twice: Physics now ends Toboggan on Jump with a 1.2 m hop, so remove Hero A's Penguin hop hook.
5. Hero B's gaps: Frenzy T3 shred should use the Items `trigger` handler if Economy's branch provides one, otherwise
   keep `onBulletHit` and say so. Scatter must be castable while rooted if GDD §9 says so. Owl's glide must end
   itself as GDD §9 describes.
6. The sim concession test timed out at 5 s once while the machine was busy. Make it robust: faster setup, or a
   justified timeout.
7. **Siege proof with normal controls:** a deterministic headless run that drives a real picked hero only through
   ordinary `PlayerCommand`s (no win helpers, no state mutation) and takes down the Dusk structures and both Patron
   phases to the victory result. A scripted aim-and-fire agent is fine. Record the seed and the hash.
8. Re-measure `npm run perf` and a 35-minute replay (two seed-1 runs with the same hash) on a quiet machine, and
   state what else was running.

### INTEG-WEB: browser side (src/client/**, e2e/**)
1. **Settings (Architect's `src/client/app/settings.ts`):** new profiles take the input module's `defaultBindings()`.
   Add a one-time v2→v3 migration: where keyboard lock is available (Chrome, Edge), an untouched auto-assigned C
   crouch becomes ControlLeft (D-EP-030). Leaving a match calls `input.exitFullscreen()`.
2. **UI Options capture:** pressing Mouse 4 during key capture (and during play) must not navigate the browser
   back. Prevent the default on those buttons.
3. **Real key routing:** in a match and in the Practice Hub, B opens the Magpie's Hoard, Tab the scoreboard, M the
   big map, and a tap of the upgrade binding (Alt) opens the Ability Upgrades panel, all with real key presses in
   Playwright. Fix the rebound-melee pointer-lock e2e, which fails after the Options step.
4. **Tracers versus the crosshair:** check that VFX draws Combat's `weapon.traces` and that Albatross's pellets and a
   single-shot gun line up with the centre reticle on a distant open sightline, beside cover, and with the muzzle
   genuinely blocked. Save screenshots.
5. **Practice Hub flow from the real menu:** as a support bird, shoot the enemy dummy and heal the ally dummy,
   repeated. Open the upgrade panel and check the pointer is free. Hover all four skills, click one affordable
   upgrade (one AP spent, new tier), click a locked one (nothing happens), close, and aiming returns. Save
   screenshots.
6. Play a match from the menu with one of the 12 birds. Earn Seeds, level up, buy an item in a shop zone and sell it
   back, open the scoreboard and map, and see damage numbers. Save screenshots.

## EP: gate-fix round after the W4 QA BLOCK (19/11/2026)

The QA gate (`W4 · QA gate` in STATUS) blocked `integrate/w4c` on two items. Fix both, plus three small findings, in
one worktree branched from `integrate/w4c`. Act for each owner, with one commit per item and no contract changes.
1. **Flaky `npm run check` (QA and Build).** The audio browser tests (`e2e/audio.spec.ts`) time out at 30 s under
   the full parallel e2e run in `check.sh` (3 failures in 4 runs, a different test each time); alone they pass every
   time. Give them their own Playwright project that runs after the others with one worker (project dependencies),
   or another structural fix. Don't just raise the timeout. Proof: **five consecutive** `npm run check` passes,
   each quoted.
2. **The result screen is unproven in the browser (UI/HUD, app, QA).**
   - Add a **Concede** button to the pause menu, wired to the existing `actions.concede`. It is available from 15:00
     per GDD; before then it is disabled, with the reason shown. A Playwright e2e clicks it with real input and
     asserts the Defeat screen and its stats.
   - Add a **browser victory replay**: a route (for example `?scene=replay&proof=siege&seed=1`) that drives the
     local hero with the siege-proof scripted controller through the **normal command path** (no win helpers, no
     state mutation), fast-forwards, and lets the real Victory screen appear. A Playwright e2e asserts Victory and its
     stats.
   - Add the read-only sim state to `window.__perch` that QA asked for, so these tests can assert on it.
3. **Hawk retarget (Objectives and QA):** a committed rules test that a Sentinel Hawk switches to a hero who damages
   an allied hero nearby (QA measured 0.07 s in a scratch run).
4. **Upgrade panel (UI):** hovering shows two overlapping description cards; only one may show.
5. Regenerate the wiki (`npm run wiki`) if any UI screenshot it uses changed.
Finish: STATUS entry `### W4 · Gate fixes · 19/11/2026`; reply in at most 200 words.
