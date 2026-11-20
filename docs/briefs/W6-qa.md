# Wave 6 · QA (#19) · stability round for Stage 4 Release 1 · tag QA

Read W5-common.md first, then D-EP-050 and D-EP-051. You own `tests/**`, `e2e/**`, `playwright.config.ts`,
`scripts/check.sh` and `tests/README.md`.

The user's priority is **stability**. Stage 4 Release 1 ships when every functional gate item works and the full check
passes three times in a row, serially, with no unexplained flaky test (STATUS, Gate M3). Your job is to make that
achievable and provable.

1. **Gated suites.** Switch on or rewrite every suite still behind `PERCH_PENDING=1`:
   - `bot-shopping`: it passes 6/6 but takes 696 s, so move it to a slower tier, or make it faster with the same power.
   - the bots-ride and dead-bird tests.
   - three interactables tests that are wrong for the real map: fix the tests, not the map, unless the map is wrong
     against the GDD.

   List anything that must stay gated, with the reason.
2. **The audio live-context e2e.** It has failed every time since about 10:00 on 21/11, even run alone and on code where
   it passed before. Find out whether it's the machine (audio device, Edge state, autoplay policy) or the code. Fix the
   test's robustness, or the code, at the root.
3. **Flake hunt.** These failed under load in the last day:
   - `preview-regressions` "binds side buttons" (page load);
   - `match.spec`;
   - the `ai.perf` and objectives perf margins;
   - a wiki-coverage timeout;
   - a reload timeout.

   For each one, either make it deterministic, or show it's a real regression and route it to its owner. Never raise a
   timeout to hide a regression. The Architect is adding a staged `__perch.ready` (`menu`, then `world`) in parallel; use
   it once it's merged.
4. **A release mode for the check.** `npm run check -- --release`, or similar, runs every step serially with fixed
   workers, so the gate's three runs are reliable on a busy machine. Record it as a D-QA decision.
5. **Functional gate coverage.** Make sure an automated test proves each functional Gate M3 item:
   - hold-to-upgrade with the cursor (D-EP-038);
   - no Interact key (D-EP-039);
   - Practice Swap bird (D-EP-040);
   - the top scoreboard (D-EP-041);
   - objectives;
   - every implemented hero starts a 1 + 11 match from the menu. Derive the hero list from the registry, so the four
     B3 birds are covered when Hero B3 lands.
6. **Later, when the EP says Bot AI's match-ending fix is merged:**
   - 20 seeded headless matches, each ending with a winner and no crashes;
   - a 30-minute in-browser soak (memory and frame-time trend).

   Prepare the scripts now.

Others work in parallel: Bot AI, Hero B3 and the Architect. Don't edit their source; route source bugs to them through
your report.

**Done means:**
- the three serial full-check runs quoted;
- STATUS entry and D-QA decisions;
- a reply in at most 200 words.
