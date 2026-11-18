# Wave 2 — QA, Performance & Code Review Engineer (#20), tag QA

Read [W2-common.md](W2-common.md) first; its rules apply. You can block merges.

**Read as well:** DECISIONS D-EP-006, -007 and -010, and GDD §5, §7 and §8.

## Your job
You own `tests/**` and `e2e/**`. Never edit `src/**`; QA blocks merges that do, so you of all people don't. Plain
Vitest, no new dependencies.

1. **Determinism test** (`tests/determinism.test.ts`). Two `createSim` runs with the same seed and the same command
   script (bots plus a scripted human hero that moves, jumps, fires and casts) give identical `hash()` and identical
   telemetry after N ticks. Use at least 3 sim minutes with 12 bots. A different seed must not crash. Keep it fast
   enough for `npm run check`.
2. **Ability sandbox helper** (`tests/helpers/sandbox.ts`) for the Hero Engineers' ability smoke tests next wave:
   `createSandbox({ heroes, map: 'arena', options })` returning the sim plus helpers to place heroes and dummies; issue
   commands (move, aim at a point or entity, fire, cast slot N at a target, upgrade); step N ticks or until a predicate
   holds; read view, events, health and statuses. Document it briefly in `tests/README.md` with one worked example.
3. **Contract and rules suites, written test-first** (D-EP-006). Assert behaviour from the GDD numbers and the
   INTERFACES contracts, through `createSim` and the sandbox:
   - `tests/contracts/damage.test.ts`: the GDD §5.2 / INTERFACES §6 pipeline order, Talon vs Song resists, beak shot
     ×multiplier on heroes only, falloff, shields before health, kill credit and assists.
   - `tests/rules/pods.test.ts`: seed pod spawn, ripe window, secure, deny, wither and the instant share (GDD §8).
   - `tests/rules/fledglings.test.ts`: wave timing, composition, marching on lane paths, target choice (GDD §7).

   Damage is implemented this wave (Combat); pods and fledglings come next wave. On your branch all three fail against
   the stubs, so gate each with `describe.runIf(process.env.PERCH_PENDING === '1')`. That keeps `npm run check` green,
   and an implementer runs `PERCH_PENDING=1 npx vitest run <file>`. At each wave's gate the EP and QA flip a suite to
   always-on once its system is in. Every assertion cites its GDD section.
4. **e2e.** Extend `e2e/` so every scene (`menu`, `blockout`, `sandbox`, `lane`, `match`) loads with no console errors
   and reaches `__perch.ready`. Add a review run that saves a screenshot of every scene to `out/shots/review/` (pictures
   for review; no pixel comparison).
5. **Review of wave 1** (main). Look for interface violations, cross-ownership edits, sim purity breaches, magic numbers
   outside `src/sim/data`, missing tests and determinism hazards (iteration order, unseeded randomness, float
   accumulation). Report findings grouped by owner, with file:line, in your Log entry. Don't fix other owners' code.

## Done means
`npm run check` passes on your branch with the pending suites gated off. Each pending suite runs under
`PERCH_PENDING=1` and fails only for missing implementation, not for errors in the suite itself; show the failure
summary. The determinism test passes. You looked at the review screenshots with the Read tool.

Extra for your report: the pending suites and how many assertions each holds, and your top wave-1 review findings.
