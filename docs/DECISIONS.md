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

### D-EP-015 · 18/11/2026 — 24 heroes
**Decision:** the roster is 24 playable heroes, superseding the 8 in BRIEF §3. The 8 ids in D-EP-011 stay; the 16
added ids are fixed too: `hornbill`, `flamingo`, `penguin`, `puffin`, `peacock`, `vulture`, `swift`,
`hummingbird` (Hero Engineer A) and `cassowary`, `toucan`, `woodpecker`, `nightjar`, `frigatebird`, `cockatoo`,
`swan`, `kiwi` (Hero Engineer B). Each of the 8 archetypes is covered three times. A match uses 12 distinct heroes
(no hero on both teams). Heroes ship in batches of four (A1 in W3; B1 and A2 in W4; A3 and B2 in W5; B3 in W6), and
M3 is split across W5 and W6, so M4 becomes W7 and M5 becomes W8. Items stay at 48+.
**Why:** the user's instruction ("there should be 24 characters"). Batches of four keep each hero engineer's task the
size the brief planned for.

### D-BUILD-001 · 18/11/2026 — Toolchain versions
**Decision:** exact pins in package.json, locked in package-lock.json: three 0.187.0 (+ @types/three 0.187.0),
@dimforge/rapier3d-compat 0.21.0, vite 8.3.8 (Rolldown), vite-plugin-singlefile 2.3.4, vitest 5.1.1, eslint 10.15.0,
typescript-eslint 8.73.0, @playwright/test 1.65.1, tsx 4.23.15, typescript 6.0.3, @types/node 22.20.5. Node ≥ 22.13.
Nothing else: no @eslint/js, no `globals`, no extra Playwright browsers. Ask Build & Tooling for any new dependency.
**Why:** the latest stable releases that work together. Exact pins because three and Rapier break between minors.

### D-BUILD-002 · 18/11/2026 — TypeScript 6.0.3 rather than 7.0.2; Node 22 types
**Decision:** typescript 6.0.3 (not the 7.0.2 `latest`) and @types/node 22.x (not 26.x).
**Why:** typescript-eslint 8.73, the latest, supports TypeScript < 6.1 only; 7.x is the native Go compiler and its
parser API isn't supported yet. @types/node must match the Node 22 runtime, or tools could call APIs it lacks.
Revisit TypeScript 7 when typescript-eslint supports it.

### D-BUILD-003 · 18/11/2026 — Three TypeScript projects; strictness flags
**Decision:** `tsconfig.base.json` (strict, noImplicitOverride, noFallthroughCasesInSwitch, noUncheckedIndexedAccess,
verbatimModuleSyntax, bundler resolution, noEmit) is extended by `tsconfig.sim.json` (src/sim minus tests; lib ES2023
only, no types), `tsconfig.client.json` (the rest of src; DOM + vite/client) and `tsconfig.node.json` (tools, tests,
e2e, `src/**/*.test.ts`, `*.config.ts`; Node + DOM). `npm run typecheck` is `tsc -b` (incremental, build info in
node_modules/.tmp). noUncheckedIndexedAccess is on; exactOptionalPropertyTypes is off.
**Why:** the compiler enforces the sim boundary: no DOM, Node, `console`, `performance`, timers or `crypto` in
src/sim. Tests sit in the Node project because Vitest's types bring Node globals with them. Unchecked indexing is
the classic entity-store and data-table bug; exact optional types mostly fight third-party types for little gain.

### D-BUILD-004 · 18/11/2026 — Headless WebGL: installed Edge, real GPU, SwiftShader fallback
**Decision:** Playwright drives the installed Microsoft Edge (`channel: 'msedge'`), or bundled Chromium only when
Edge is missing (`npx playwright install chromium` once), with `--enable-unsafe-swiftshader`. `tools/browser.ts`
holds this for both e2e and shots.
**Why:** verified 18/11/2026 on this machine: headless Edge 156 renders WebGL2 on the GPU (ANGLE D3D11, Intel Arc
140T) with no extra flags, and a three.js + Rapier test scene screenshot came out correct. The flag matters only
without a usable GPU (CI, RDP, VMs): Chromium then falls back to SwiftShader instead of refusing WebGL. Forcing
SwiftShader (`--use-angle=swiftshader`) also renders correctly but takes ~2.6 s per shot against ~0.9 s; add it if QA
wants pixel-stable CPU rendering. Chrome and Firefox aren't installed here, so file:// is verified in Edge only.

### D-BUILD-005 · 18/11/2026 — Parallel-safe servers for e2e and shots
**Decision:** e2e: `playwright.config.ts` picks a free port, hands it to its workers through `PERCH_E2E_PORT` and
starts `vite --strictPort` on 127.0.0.1 as its webServer. shots: starts Vite in-process on port 0 with no file
watcher and closes it after the PNG. Vite's watcher ignores .claude/, out/ and dist/. Dependency pre-bundling is
off (three and Rapier are ES modules already).
**Why:** several agents run these at once, so nothing uses a fixed port, and a port clash fails loudly instead of
testing someone else's server. With pre-bundling on, four shots started together on a cold cache hit an EPERM
rename race in node_modules/.vite and one took 6 s; with it off, eight at once all pass in under 4 s with no change
in page load time.

### D-BUILD-006 · 18/11/2026 — Headless sim runner
**Decision:** `tools/sim.ts` runs one match in-process (defaults: seed 1, 60 minutes, 12 bots). `--matches N` forks
one child process per match (the tsx loader is inherited), `--parallel P` at a time (default cores − 1), writes the
per-match telemetry next to a summary JSON and exits 1 if any match crashed. Wall-clock numbers go to stdout and the
summary, never into a telemetry file.
**Why:** a crash or leak stays inside its own process and is counted (M3 needs zero crashes across 20 matches), and
two runs of one seed produce byte-identical telemetry.

### D-BUILD-007 · 18/11/2026 — build:single and start
**Decision:** `build:single` is `vite build --mode single`: vite-plugin-singlefile inlines everything into
`dist/perch.html` (about 5 MB, mostly Rapier's base64 WASM) and leaves the rest of dist/ alone. `start` is
`vite build && vite preview --open`, the optimised build rather than the dev server; `?scene=` defaults to the menu.
**Why:** the brief asks `npm start` to build and serve. Inline module scripts and inlined WASM need no fetches, so
the file runs from file:// (verified in Edge).

### D-BUILD-008 · 18/11/2026 — Lint rules
**Decision:** typescript-eslint `recommended` without type information, plus `no-explicit-any` as an error. Magic
numbers warn in src/ outside src/sim/data/ and tests (ignoring −1, 0, 1, 2, array indexes, default values, enums,
literal types and readonly class fields). src/sim also bans `new Date()` next to Math.random, Date.now,
performance.now, window, document, three and src/client imports.
**Why:** linting the repo takes about 1.5 s. ESLint 10 no longer ships @eslint/js, and strict TypeScript covers most of
its recommended set. `new Date()` reads the wall clock just like Date.now.

### D-BUILD-009 · 18/11/2026 — Authored map data is exempt from the magic-number rule
**Decision:** `src/sim/world/map/data/**` joins `src/sim/data/**` outside the magic-number rule. The Level Designer
keeps authored coordinates, sizes and splines there. Map logic elsewhere in `src/sim/world/map/` (nav-graph building,
mirroring, lookups) stays under the rule.
**Why:** the EP's ruling (18/11/2026): map geometry is data by nature, but code that processes it is not.

### D-DIR-001 · 18/11/2026 — Archetypes for the 24 heroes
**Decision:** gun carry: pelican, hornbill, woodpecker · spirit burst: starling, peacock, cockatoo · tank/initiator:
albatross, penguin, cassowary · support: lyrebird, flamingo, swan · assassin: kingfisher, nightjar, kiwi · area
control: shrike, puffin, vulture · long-range poke: owl, toucan, frigatebird · mobility skirmisher: secretarybird,
swift, hummingbird (GDD §9.0).
**Why:** each bird's real-life signature (pouch, drumming, display, booming, burrowing, soaring) maps cleanly onto
one archetype, and the size bands in GDD §9.24.1 keep all 24 silhouettes distinct at 40 m.

### D-DIR-002 · 18/11/2026 — Map frame and mirror rule
**Decision:** playable area 260 m (x) × 300 m (z); Dawn base south (z −150), Dusk north; gameplay geometry is
authored for the Dawn half and mirrored by z → −z; structure, camp and shop positions are also mirrored in x.
Side lanes 289 m, Riverbank 224 m (GDD §6).
**Why:** a z-mirror makes every lane fair for both flocks while letting the three lanes keep different art; the
sizes give ~22–29 s for a wave to reach the centre, matching 30 s waves.

### D-DIR-003 · 18/11/2026 — Assumed loop rules
**Decision:** where the reference's live behaviour was uncertain the GDD picks the conventional answer and marks it
(assumed): deny pays the denier 25% of the fledgling's value; 1 seed/s passive income; Herons are gated behind
their lane's Hawk; Thicket creatures pay their last hitter; the ultimate unlocks at level 6; the Roc first spawns at
20:00; 100% sell refund within 20 s of buying; stamina regenerates while airborne; one air dash per airtime.
**Why:** each needs a concrete starting value now; Balance tunes them from telemetry and M5 confirms or logs each
one as a deviation.

### D-DIR-004 · 18/11/2026 — Late-game pressure at 35:00
**Decision:** from 35:00 Brood Ward weakens to ×0.6 damage taken and fledglings get +25% damage vs structures.
**Why:** a PERCH addition (not in the reference) to keep bot matches inside the 25–40 min target without capping
match length.

### D-DIR-005 · 18/11/2026 — Damage pipeline and stacking
**Decision:** fixed pipeline order (GDD §5.2); positive resists stack multiplicatively, shred adds after; CDR and
status resist stack multiplicatively (caps 50% / 60%); slows, fire-rate slows and heal reduction use the strongest
instance only.
**Why:** one written order lets QA test the pipeline before Combat builds it, and multiplicative stacking stops
resist and CDR from reaching immunity.

### D-DIR-006 · 18/11/2026 — One vision rule for bots and the minimap
**Decision:** an enemy is visible to a flock within line of sight of an allied hero (40 m), fledgling (20 m) or
structure (30 m), or when revealed; bots use only that plus last-seen positions (GDD §11.1).
**Why:** bots must not see more than the player, and the minimap needs the same rule anyway.

### D-ARCH-001 · 18/11/2026 — Four channels between systems
**Decision:** systems interact only through (1) components on plain entity records, each with exactly one writer;
(2) effects, `ctx.effects.apply`, routed to the single owner of each effect kind; (3) events on a synchronous FIFO bus,
which are facts only, never requests; (4) services on `SimContext` (physics, stats, spatial, rng, clock, team and
objective state). Private state lives in each system's factory closure, never at module level.
**Why:** explicit ownership is what lets 6–7 engineers build in parallel worktrees and merge cleanly; facts-only
events keep the client's per-step log meaningful; closures keep several sims per process (tests, batch CLI) apart.

### D-ARCH-002 · 18/11/2026 — Tick phase order
**Decision:** ai → [core latch] → movement → [spatial rebuild] → abilities → combat → world → damage → statuses →
economy → [flush, telemetry]; within a phase systems run in the order ai, physics, world, abilities, combat, economy,
items. Damage requested before the damage phase lands the same tick; DoT damage lands next tick.
**Why:** bots decide on settled state, movement settles before anything aims, and every damage source of a tick is
resolved in one place in arrival order, so the GDD §5.2 pipeline has one owner and one deterministic order.

### D-ARCH-003 · 18/11/2026 — One effect vocabulary with one owner per kind
**Decision:** the GDD §9.25 primitives are the `Effect` union one-to-one (19 kinds) plus `hook` for hero-specific
behaviour. `EFFECT_OWNERS` fixes each kind's owner (combat: damage, heal, applyStatus, statMod, cleanse, shield,
weaponMod, projectile; physics: displace, dash, teleport, movementMode, attach; abilities: area, summon, tether,
delay, cooldownMod, hook; items: trigger) and the router refuses any other registrant. Numbers in effects are
`Magnitude`s (a literal, a named ability value, or value + k × SP).
**Why:** abilities, items, runes, the Ember and objectives share one machinery, as the brief requires; named values
let upgrade tiers change numbers without code.

### D-ARCH-004 · 18/11/2026 — The stat model lives in core
**Decision:** core owns `ctx.stats`: base values from data, modifier sets per source key, recomputed immediately,
stacking add → pct → mul → max (strongest only) → stack (1 − Π(1 − x)); conditions (stunned, silenced …) come from the
same modifier sets. Consumers apply caps from their own data.
**Why:** physics, combat and abilities all need stats from W2; one small model in core avoids a cross-team dependency
and matches GDD §5.3 and §10 stacking.

### D-ARCH-005 · 18/11/2026 — Hero lifecycle split
**Decision:** core spawns every hero at match start with all components at neutral values (owners adjust on
`entity.spawned`); sim/combat owns death, the respawn timer and respawning at the Home Roost.
**Why:** createSim must produce heroes in W1, while death and respawn belong next to the damage pipeline that causes
them and the Ember rule that shortens them.

### D-ARCH-006 · 18/11/2026 — Commands are the only input
**Decision:** everything the player or a bot does is a `PlayerCommand`, including pings (rate-limited by core) and
conceding (core, from 15:00). `sim.step(commands: HeroCommand[])` takes an array to match the headless CLI; a hero
without a fresh command repeats its last one with no presses.
**Why:** a match is then reproducible from its seed and command log, which is what the determinism test checks.

### D-ARCH-007 · 18/11/2026 — Keep rapier3d-compat; the deterministic build is the fallback
**Decision:** stay on `@dimforge/rapier3d-compat` (BRIEF §1). Its README promises determinism on one machine only.
If QA's Node-versus-browser hash comparison ever diverges inside physics, switch to
`@dimforge/rapier3d-deterministic-compat` (same API) under an ADR.
**Why:** the gate needs same-machine determinism and the compat build is faster; the fallback is a package swap.

### D-ARCH-008 · 18/11/2026 — World frame and the mirrored top-down view
**Decision:** right-handed, +y up; Dawn at −z, Dusk at +z; yaw 0 faces +z, forward = (sin yaw, 0, cos yaw), right =
(−cos yaw, 0, sin yaw). With the GDD's x = east and z = north, a top-down view with north up shows east on the left,
so the minimap and overview cameras map screen-right to −x for a Dawn-at-bottom view.
**Why:** Three.js and Rapier are right-handed; keeping the GDD's coordinates (D-DIR-002) means the 2D views flip x
rather than the world.

### D-ARCH-009 · 18/11/2026 — Vision is a shared service owned by sim/world
**Decision:** sim/world computes `EntityBase.seenBy` (one bit per flock) every tick in the world phase from the
D-DIR-006 rule and the reveal, invisibility and true-sight statuses; bots, unit and structure targeting, the minimap
and outlines read it through `canSee(team, entity)`.
**Why:** one implementation of the rule for every consumer; world already owns two of its three sources (fledglings
and structures) and works in W3–W4, before the minimap (W4) and bots (W5) need it.

### D-ARCH-010 · 18/11/2026 — The body plan stores only what the GDD gives
**Decision:** `BodyPlan` is height, capsule radius, head sphere and muzzle socket. The body capsule height (head
centre − head radius), crouch scale (×0.65), camera pivot (head centre − 0.05 m) and boom (scaled by height) are
derived by shared code (core/aim.ts, data/core.ts).
**Why:** GDD §9.0.1 and §4.1 define them as rules; derived values can't drift between combat, physics, the camera and
the Technical Artist's models.

### D-EP-016 · 18/11/2026 — Briefs live in docs/briefs, agents commit early
**Decision:** wave briefs are files in `docs/briefs/` on main (a shared `W<n>-common.md` plus one per role), and every
agent commits after each working piece. The first wave 2 attempt is discarded.
**Why:** all six wave 2 agents stalled at the same moment before committing anything, and their worktrees were cleaned
up, so the work was lost. Briefs on main make a retry a one-line spawn; frequent commits make an interruption cheap.

### D-EP-017 · 18/11/2026 — Every stage ends launchable, with PLAYABLE.md
**Decision:** a milestone gate closes only when `npm start` opens the menu and the stage's new features are reachable
from it (before the menus are finished, from a listed `?scene=` URL), and the EP has added the stage's section to
`PLAYABLE.md` at the repo root: how to launch, what you can do, what isn't in yet. The EP writes each section after
launching that build and checking it.
**Why:** the user's instruction: progress must be visible after every stage, with a written guide to what works.

### D-LEVEL-001 · 18/11/2026 — The map is authored as half a map and built in code
**Decision:** `src/sim/world/map/data/main.ts` authors the Dawn half and the z = 0 strip; `build.ts` mirrors the half
(z → −z, yaw → π − yaw), builds climbs and Updrafts, derives mantle ledges from box edges (top free, 0.6–2.4 m above
the ground in front) and builds the nav graph. The east jungle reuses the west jungle's block plan mirrored in x and
rebuilt in timber; the three lanes are dressed separately. Anchors on z = 0 face ±x so they are their own mirror.
**Why:** symmetry and the GDD §3 reach limits hold by construction instead of by hand-checking ~600 prims, and the
tests still check the result independently. The x-mirrored jungle keeps both side jungles equally fair in W2; the
W6 verticality pass can make them differ.

### D-LEVEL-002 · 18/11/2026 — The nav graph is generated from the geometry, on first access
**Decision:** nodes come from lane samples, building corners and roofs, wall ends, ramp ends and middles, wide
cylinder tops, climb ends, Updraft stations and every anchor (Dawn half, merged within 2.5 m, then mirrored). Links
are tried between nodes up to 14 m apart (skipping pairs with a node on the way) and classified from the ground
profile between them: walk, drop, mantle (0.6–2.4 m), jump (jump-mantle up to 3.6 m, or a gap up to 3.5 m) or
dashJump (a gap up to 7 m); climbs and Updrafts add chimney, vine and updraft links. Only what is reachable both ways
from a spawn is kept. `MapData.nav` is a getter that builds the graph once, on first access.
**Why:** a hand-authored graph of ~900 nodes would go stale with every geometry edit; a generated one stays
consistent and the tests check it. It costs ~40–75 ms and only bots read it, so `loadMap` stays ~30 ms.

### D-LEVEL-003 · 18/11/2026 — Updraft stations on the line; tower stations set back 6 m
**Decision:** stations are points on the Updraft line, 12 m above the lane path (GDD §6.3): both gates, the middle,
and for each Heron and Hawk a point 6 m along the lane from it toward its own gate.
**Why:** Herons and Hawks stand on the lane path, so a station directly above one would sit inside its model and
out of reach from the ground beside it; 6 m back puts it on the owning flock's side.

### D-LEVEL-004 · 18/11/2026 — Climb geometry convention
**Decision:** a chimney is a 1.5 m-radius shaft centred 1.6 m out from its building's wall, from the ground to 1 m
above the roof, with no prim. A vine's `bottom` and `top` are 0.5 m out from the wall, at the ground and at the roof
edge; `out` points away from the wall. The roof is on the far side of the wall in both cases.
**Why:** the shaft must stay clear for the rider, and the extra metre lets the exit pop (+6 m/s) carry the rider over
the roof edge.
