# PERCH — Decisions

Append-only. Anyone may add an entry; nobody edits another author's entry. IDs carry the author's role tag so
parallel branches never collide: EP, DIR, ARCH, BUILD, CTRL, CAM, COMBAT, ABIL, HEROA, HEROB, ECON, OBJ, LEVEL,
AI, ART, RENDER, UI, AUDIO, BAL, QA.

Entry shape: `### D-<TAG>-<NNN> · <dd/mm/yyyy> — <title>` followed by **Decision:** and **Why:** lines.
A change to the BRIEF §1 stack needs an ADR entry (Context / Decision / Consequences) before the change lands.

### D-EP-001 · 18/11/2026 — No interview kickoff
**Decision:** start from the brief without an interview round.
**Why:** the brief already is the requirements (milestones with acceptance criteria, a decided stack) and tells the EP
not to stop for questions.

### D-EP-002 · 18/11/2026 — Originality boundary
**Decision:** the gameplay loop follows the reference game as closely as possible (BRIEF §2). Names, characters,
hero kits, the item list, the map layout, art and audio are original PERCH designs, not one-for-one reskins of the
reference's heroes, items or map. The reference game's names appear only in docs as design reference (BRIEF, and GDD
Appendix A), never in `src/` or player-facing text.
**Why:** the brief bans the reference's names and IP. Matching mechanics is in scope; copying content is not.

### D-EP-003 · 18/11/2026 — W1 in the main checkout, worktrees from W2
**Decision:** W1 (Director, Architect, Build) works in the main checkout and doesn't commit; the EP commits after the
wave. From W2, every agent gets its own git worktree and branch.
**Why:** there is nothing to branch from yet, the Architect needs Build's toolchain as it lands, and the three roles
own disjoint files.

### D-EP-004 · 18/11/2026 — Fresh agents per wave
**Decision:** each wave spawns fresh agents for its roles. Continuity lives in GDD, INTERFACES, STATUS and DECISIONS,
not in long-lived agent memory.
**Why:** a role that returns two waves later should work from merged `main`, not from a stale worktree. The docs are
the studio's memory.

### D-EP-005 · 18/11/2026 — Roles pulled forward to meet gates
**Decision:** Rendering & VFX joins M0 (W2) because the M0 gate needs a lit blockout. Objectives (fledgling waves) and
Economy & Items (seed pods) join M1 (W3) because the M1 gate needs fledglings and pods. M1's systems engineers
(Controller, Combat, Abilities) start in W2 alongside the rest of M0.
**Why:** the brief's per-milestone role lists don't cover every M0/M1 acceptance criterion. Starting M1 systems in W2
also uses the 6–8 agent budget.

### D-EP-006 · 18/11/2026 — Tests-first only for rules-heavy sim systems
**Decision:** QA writes suites from the GDD and the contracts one wave before the implementer for the damage pipeline,
economy (pods, deny, bounties, levels, shop) and objectives (Brood Ward, Shrine gating, Patron phases, Egg, Roc).
Everywhere else, tests ship with the code; feel, rendering, UI, audio and AI are checked by screenshots, e2e runs and
headless matches.
**Why:** those systems can be specified as assertions now and many engineers depend on them. The rest is exploratory
and can't be pinned down by assertions up front.

### D-EP-007 · 18/11/2026 — QA review per wave, not per branch
**Decision:** QA/Review gates each wave's integration branch (`integrate/w<N>`). `main` moves only when that branch
passes `npm run check` and QA approves.
**Why:** same protection as reviewing every branch ("merge only after QA approves and check passes") at a fraction of
the cost, and cross-branch problems only show up after integration anyway.

### D-EP-008 · 18/11/2026 — Unit and structure targeting live in sim/world
**Decision:** fledgling, Hawk, Heron, Warden, Patron and Roc behaviour and targeting belong to Objectives
(`src/sim/world/`). `src/sim/ai/` drives bot heroes only.
**Why:** fledglings must fight in M1, two milestones before the Bot AI engineer starts.

### D-EP-009 · 18/11/2026 — Data and constants ownership
**Decision:** until W6 each system owner owns its own file(s) in `src/sim/data/`; from W6 the Balance & Data Designer
owns all of `src/sim/data/`. Presentation constants (colours, camera offsets, VFX timings) live in a named-constants
module inside the owning client folder.
**Why:** a single data owner from day one would bottleneck every engineer. "No magic numbers outside sim/data"
governs gameplay numbers; client presentation numbers still need names.

### D-EP-010 · 18/11/2026 — Where tests live
**Decision:** unit tests sit next to the code (`src/**/*.test.ts`) and belong to that code's owner. `tests/` holds
QA's cross-system suites (determinism, contracts, rules suites, soak, the ability sandbox helper). `e2e/` holds
Playwright.
**Why:** owners test their own code; QA owns the suites that span systems and can block a merge for missing tests.

### D-EP-011 · 18/11/2026 — Hero ids are fixed
**Decision:** hero ids are `shrike`, `albatross`, `kingfisher`, `lyrebird` (Hero Engineer A) and `owl`, `pelican`,
`secretarybird`, `starling` (Hero Engineer B). The Game Director may change display names and kits; changing an id
needs an ADR.
**Why:** ids are folder names and registry keys, fixed by the Architect in W1.

### D-EP-012 · 18/11/2026 — Union merge for the shared logs
**Decision:** `.gitattributes` sets `merge=union` on `docs/STATUS.md` and `docs/DECISIONS.md`.
**Why:** every agent appends to both on its own branch; union merge keeps every appended entry without conflicts.

### D-EP-013 · 18/11/2026 — Each worktree installs its own node_modules
**Decision:** each worktree runs `npm ci --prefer-offline`. No junctions to the main checkout's `node_modules`.
**Why:** a worktree clean-up that follows a junction could delete the main checkout's dependencies, and the npm cache
makes the second install cheap.

### D-EP-014 · 18/11/2026 — Local only
**Decision:** the project stays on this machine: no git remotes, pushes, pull requests, cloud sessions, published
artifacts or uploads. Installing packages from the npm registry is fine.
**Why:** the user's instruction at kickoff ("keep local, don't push anywhere").
