# Wave 2 gate review — QA, Performance & Code Review (#20), tag QA

You give the independent verdict on wave 2 before it reaches `main` (D-EP-007). You can block. This is a **review**: you
don't change `src/`, `tests/` or `e2e/`; you write findings.

## Where you work
- The main checkout, `C:\Users\AlexNortham\Documents\game`, on branch `integrate/w2` (main + the six wave 2 branches +
  the integration fixes). Don't switch branches, merge, reset or touch `main` or `.claude/worktrees/`.
- Windows 11, Node 22, Git Bash via the Bash tool; dependencies installed. Today is 18/11/2026.
- Local only: never add a git remote, push, publish or upload. Never run `npm start`.
- Read: docs/STATUS.md (rules, ownership map, plan, and the wave 2 Log entries, including `W2 · Integration`),
  docs/INTERFACES.md, docs/ARCHITECTURE.md, docs/DECISIONS.md (especially D-EP-006, -007, -010, -018), and
  docs/briefs/W2-*.md (what each engineer was asked for).

## Review `git diff main...integrate/w2`
1. **Ownership.** Each wave 2 branch stayed in its owned paths (the EP checked file lists); integration commits
   (`W2 integration (…)`) are the D-EP-018 exception. Flag anything else.
2. **Interfaces.** Systems talk through the event bus, `ctx` services and the contracts, never through another system's
   internals or private state. Flag every cross-system import outside `src/sim/core/**` and the documented pure helpers.
3. **Sim purity and determinism.** No DOM, Node APIs, console, Math.random or wall clock in `src/sim`; RNG only through
   named streams; deterministic iteration; no float accumulation that differs run to run.
4. **Magic numbers.** Gameplay numbers outside `src/sim/data/`; presentation numbers without names in `src/client/`.
5. **Tests.** Each system has tests for the items its brief listed. Name the gaps.
6. **Performance.** Time `npm run sim -- --seed 1 --minutes 3 --bots 12` (ticks/s and ms per tick against the 1 ms
   budget). Note the render draw calls Rendering reported.
7. **Known issues to classify** (severity and owner): heroes never come to rest (≈1e-4 m height drift per tick under
   Rapier); Combat counts a beak shot when the head lies on the bullet's path behind a body hit (a bullet should resolve
   at the first hitbox it meets); the arena ramp sits between the first spawns.
8. **Gate M0 evidence.** `npm run check` (quote the summary); the damage suite runs always-on and passes; pods and
   fledglings suites are still gated; `npm run e2e` review screenshots in `out/shots/review/` — look at each with the
   Read tool; `npm run shots -- --scene menu` shows the lit map behind the menu.

## Verdict
**APPROVE** (with follow-ups for wave 3) or **BLOCK**. Block only for a defect that breaks the M0 gate, or a correctness
or contract problem that wave 3 would build on and that would be expensive to fix later. Everything else is a follow-up
with an owner.

## Finish
Append your Log entry (`### W2 · QA gate · 18/11/2026`) to docs/STATUS.md with the verdict and findings grouped by
owner (file:line), commit only that file on `integrate/w2` (`W2 QA gate: <verdict>`). Reply to the EP in at most 250
words: verdict, the blocking items if any, the top follow-ups by owner, and the measured ms per tick.
