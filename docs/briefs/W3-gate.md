# Wave 3 gate review — QA, Performance & Code Review (#20), tag QA

You give the independent verdict on wave 3 (Stage 2, "One bird in a lane") before it reaches `main` (D-EP-007). You can
block. This is a **review**: you don't change `src/`, `tests/` or `e2e/`; you write findings. (D-EP-021 put QA's
wave 4 test-first suites into this gate; the user has paused the project after wave 3, so those suites move to the start
of wave 4. Don't write them.)

## Where you work
- The main checkout, `C:\Users\AlexNortham\Documents\game`, branch `integrate/w3` (main + the eight wave 3 branches +
  the integration fixes). Don't switch branches, merge, reset or touch `main`, `preview/w3` or `.claude/worktrees/`.
- Windows 11, Node 22, Git Bash via the Bash tool; dependencies installed. Today is 19/11/2026.
- Local only: never add a git remote, push, publish or upload. Never run `npm start`. Quote shell redirects carefully
  (a stray `>` once created a junk file in the repo root).
- Read: docs/STATUS.md (rules, plan, the Stage 2 gate, the wave 3 Log entries including `W3 · Integration` and its
  addendum), docs/INTERFACES.md, docs/DECISIONS.md (especially D-EP-006, -007, -017, -018, -020, -021, -022), and
  docs/briefs/W3-*.md (what each engineer was asked for).

## Review `git diff main...integrate/w3`
1. **Ownership.** Each wave 3 branch stayed in its owned paths (the EP checked file lists); `W3 integration (…)`
   commits are the D-EP-018 exception. Flag anything else.
2. **Interfaces.** Systems talk through the event bus, `ctx` services and the contracts; client modules through
   `src/client/app/contracts.ts`. Flag cross-system imports of internals.
3. **Sim purity and determinism.** No DOM, Node APIs, console, Math.random or wall clock in `src/sim`; RNG only through
   named streams; deterministic iteration. Run `npm run sim -- --seed 1 --minutes 35 --bots 12` twice: same hash?
4. **Magic numbers.** Gameplay numbers outside `src/sim/data/`; presentation numbers without names in `src/client/`
   (VFX reported ~240 lint warnings). Count lint warnings per folder and flag the worst.
5. **Tests.** Every hero has an ability smoke test for each ability (brief requirement); each system has tests for its
   brief items. Name the gaps.
6. **Performance.** Sim ms per tick (35-minute run); `npm run perf` numbers against their budgets; draw calls in a busy
   lane (heroes, ~150 fledglings, VFX) if you can measure them.
7. **Stage 2 gate evidence**, from the build itself:
   - `npm run check` passes (quote it), including the always-on pods, fledglings and damage suites and the new e2e
     specs (`e2e/play.spec.ts`, `e2e/options.spec.ts`);
   - screenshots you look at with the Read tool: the menu, hero select (four pickable heroes, twenty "coming soon"),
     each of Shrike, Albatross, Kingfisher and Lyrebird in `?scene=lane&hero=<id>`, fledglings fighting in a lane
     (use `--param renderCam=…` or a later `--t` so they are visible), the Options screen, and the hitbox overlay on a
     hero (`--param hitboxes=1`);
   - for each gate item (run, dash, slide, mantle, Updrafts; beak shots; four abilities; fledglings march and fight;
     pods secured and denied; Options with rebinding that persists after restart), name the test or screenshot that
     proves it, or say it is unproven.

## Verdict
**APPROVE** (with follow-ups for wave 4) or **BLOCK**. Block only for a defect that breaks the Stage 2 gate, or a
correctness or contract problem that wave 4 would build on and that would be expensive to fix later.

## Finish
Append your Log entry (`### W3 · QA gate · 19/11/2026`) to docs/STATUS.md with the verdict, the gate-item evidence
table and findings grouped by owner (file:line); commit only that file on `integrate/w3` (`W3 QA gate: <verdict>`).
Reply to the EP in at most 250 words: verdict, blocking items if any, the gate-item evidence in one line each, top
follow-ups by owner, ms per tick.
