# W4 · QA · W3 lint follow-ups

Read W4-common.md, the W3 QA gate breakdown and W4-contract-followups.md. Audit the 117 W3 no-magic-numbers
warnings. Coordinate exclusive file ownership with other roles through the EP: the UI and Economy agents resolve
their own warnings. For the remaining warning files, act for the named owner during the assigned mechanical
pass. Move meaningful values into existing named constants, and classify actual test fixtures under the established
test-file convention. Preserve behavior and lint coverage. Record the counts per owner and exact remaining
files before the merge, then verify the integrated count at the gate. Never globally suppress a rule or change
gameplay to silence a warning. Work on tests/e2e only for uncovered W3 QA follow-ups.

## EP: this round (Claude EP, 19/11/2026), on `integrate/w4c` after both integration halves

Warnings are now 485: Audio 375 (`synth.ts` 303, `music.ts` 42, `index.ts` 30), VFX 67 (`bound.ts` 48, `fx.ts` 15,
`mapping.ts` 4), `src/sim/abilities/fixtures.ts` 34, hero hooks 8 (hornbill, penguin, flamingo, pelican, puffin).
Act for each owner, with one commit per owner.

1. **Tables of numbers are data.** Sound recipes and music patterns move into named data modules (for example
   `src/client/audio/data/*.ts`), and a narrow lint exemption for `src/client/**/data/**` is added in Build's ESLint
   config, mirroring D-BUILD-009's map-data exemption. Logic stays under the rule. Record it as a D-QA decision.
2. **VFX and hero hooks:** give every remaining literal a name in the owner's constants module (D-EP-009).
3. **Ability fixtures:** `fixtures.ts` is test data shared with the perf test. Follow the established test-file
   convention (for example `fixtures.testkit.ts`, if the lint config already treats testkits as tests) rather than a
   new suppression.
4. **Audio tests use the wrong runner.** `src/client/audio/audio.test.ts` launches Edge from inside the unit-test run.
   Under parallel load 4 of its 9 tests time out (243 s), and it only passed with one worker. Move the
   browser-rendering checks (OfflineAudioContext signals, calls, event table, positional falloff and panning, and the
   first-gesture live test) into `e2e/audio.spec.ts`, where browser tests belong. Keep pure logic (voice allocation,
   priority stealing, settings maths) as fast unit tests. No coverage may be lost: list old test → new test.

Target zero warnings. Never suppress a rule globally or change behaviour to silence one. Report the before and after
counts per owner. `npm run check` must pass with normal parallel tests.
