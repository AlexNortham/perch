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

### D-QA-001 · 18/11/2026 — The determinism test plays the real 6v6
**Decision:** the determinism test runs `humanRoster(seed, 'shrike')` on 'main' (one scripted human plus 11 bots, the
`match` scene's setup), reading the brief's "12 bots" as the full 12-hero match; two sims step in lockstep and compare
`hash()` and an FNV digest of every step's events every 10 s, then telemetry and view at 3:00.
**Why:** a match holds at most 12 heroes, so a scripted human means 11 bots; lockstep checkpoints name the 10 s window
where a divergence started instead of only failing at the end.

### D-QA-002 · 18/11/2026 — How the pending suites reach each system
**Decision:** damage requests are `damage` effects through `ctx.effects` (INTERFACES §6.1, the path abilities, items
and world use); beak shots and falloff come from real firing with `aimAt`; pod hits are fake `projectile.impact` and
`melee` events (what Combat reports) plus one real-bullet test; fledglings come from real waves on 'main'. Expected
numbers are the GDD's; data-dependent ones (gun damage, falloff ranges, beak override) are read from hero data.
**Why:** each suite then tests its owner's rule through the contracts alone, and keeps working when the Hero
Engineers replace the placeholder kits.

### D-QA-003 · 18/11/2026 — Sandbox conventions
**Decision:** the sandbox sends a command for every hero on every step (bots never act), turns health regeneration off
unless `regen: true`, places heroes by writing `pos` and applying a physics `teleport` effect, and adds test-only stat
or condition sources under `sandbox:<key>`.
**Why:** a smoke test must see only what it caused: no bot input, no regeneration drift in hp deltas, and placement
that works with the stub physics now and Rapier later.

### D-QA-004 · 18/11/2026 — Conditional damage bonuses are additive in step 4
**Decision:** damage.test.ts treats `DamageBonus.mult` 1.5 as +50% added to the attacker's outgoing % before step 4
applies once (100 Song with +25% Song damage and a ×1.5 bonus deals 175, not 187.5).
**Why:** GDD §5.2 step 4 says "additive within the step, then applied once"; the contract calls it a multiplier
without saying how it combines. Interface request to the Architect to state it.

### D-QA-005 · 18/11/2026 — Every e2e run is a review run
**Decision:** `e2e/scenes.spec.ts` loads every scene in the router's `SCENES` (imported, so a new scene is covered
automatically), requires `__perch.ready` and no console or page errors, and saves a 1920×1080 screenshot of each scene
to `out/shots/review/` on every run; no pixel comparison.
**Why:** the shots cost under a second each inside a run `npm run check` already makes, so reviewers always have
current pictures.
### D-RENDER-001 · 18/11/2026 — Blockout: one merged mesh per material group, vertex colours, face normals
**Decision:** every `MapData` prim becomes a non-indexed, vertex-coloured piece (colour per material tag, ±6% jitter,
darker foot on tall prims) and merges into one mesh per group: matte (most tags), water, Dawn and Dusk (emissive team
glow). Map features (Updraft cables and stations, Vines, shops) share one more mesh; lanes and Chimney shafts are two
translucent meshes; structure-anchor placeholders one mesh, hidden once any structure entity exists. A map renders in
8–12 draw calls before shadows.
**Why:** a handful of draw calls for any map, flat shading without derivative shaders, and colour variety without
textures (GDD §14.1).

### D-RENDER-002 · 18/11/2026 — Lighting values: GDD numbers × π, neutral tone mapping, softer shadows
**Decision:** Three's lights are physical, so the GDD §14.5 intensities are multiplied by π and tone-mapped with
`NeutralToneMapping`. The hemisphere light is 1.0 instead of 0.6 and a shadow removes 80% of the sun
(`shadow.intensity`), because at the GDD values faces turned from the low sun went near-black. Three 0.187 removed
`PCFSoftShadowMap`; soft PCF is `PCFShadowMap` with `shadow.radius`.
**Why:** readable shade at street level and from above; the GDD numbers stay as the named inputs.

### D-RENDER-003 · 18/11/2026 — Fog thins with camera height; near and far planes follow it
**Decision:** fog density = preset density × min(1, 30 m / camera height). The far plane sits where the fog is opaque
(clamped 300–3000 m) and the near plane is max(0.1 m, 0.005 × height). The shadow box follows the camera's target
(half-size = 1.1 × camera-to-target distance, 45–240 m), snapped to whole texels.
**Why:** at the GDD density the overview camera (262 m from the centre) saw the map 87% fogged. The player camera
still gets the GDD fog; the overview and top cameras see the whole map through light haze.

### D-RENDER-004 · 18/11/2026 — A quality change rebuilds the WebGL context
**Decision:** `setQuality` creates a new `WebGLRenderer` and canvas with the preset's antialiasing, pixel ratio and
shadow-map size, swaps it into the container and disposes the old one. `Renderer.canvas` is a getter.
**Why:** antialiasing is fixed when a WebGL context is created, so this is the one way to switch every preset field
live; one code path is simpler than special-casing the fields that could change in place.

### D-RENDER-005 · 18/11/2026 — Decorative forest and floor beyond the bounds; dev-only renderer hooks
**Decision:** the blockout adds a floor to the horizon and three rings of instanced giant trees 28 m outside the bounds
(scaled down for shallow maps such as 'arena'; they receive shadows but cast none). Dev builds only:
`?renderFixture` swaps 'main' for the renderer's fixture map, `?renderCam=x,y,z,tx,ty,tz` fixes the camera, and
`window.__perchRender` reports draw calls and triangles and switches quality. Production builds strip all three.
**Why:** the menu and overview cameras need a world around the map, not a square in a void; the hooks let the renderer
be checked against a richer map than the placeholder without touching the router.
### D-COMBAT-001 · 18/11/2026 — Melee timing and heavy damage
**Decision:** a light melee starts on release (released before 0.35 s) and hits 0.25 s later; holding 0.35 s commits a
heavy melee (a 3.5 m `dash` lunge is requested from physics then) that hits 0.6 s after the press. Heavy damage =
light × 2 + 15, light = the `meleeDamage` stat (50 when hero data sets no base). A swing is a 1.2 m sphere cast 2.8 m
along the look direction from the camera pivot; the nearest hitbox is struck (the Ember only by a heavy).
**Why:** GDD §5.7 gives 50 + 3/level and 115 + 6/level; ×2 + 15 matches both exactly while the contract keeps one
melee stat. Timing from the release is the only reading where a tap can't land before it is known to be a tap.

### D-COMBAT-002 · 18/11/2026 — Combat places a respawning hero
**Decision:** at respawn combat writes the hero's `pos` (its spawn anchor, i.e. where core first placed it) and zeroes
`vel`, then emits `hero.respawned` with that position for physics to re-seat its controller.
**Why:** INTERFACES §9 gives "respawn at the Home Roost" to combat while `pos` belongs to physics; writing the
teleport once and announcing it keeps both consistent, and works before physics exists.

### D-COMBAT-003 · 18/11/2026 — Beak shots outside guns
**Decision:** a `damage` effect flagged `beakShot` is a beak shot when `target.point` lies inside the target's head
sphere, and multiplies by `COMBAT.abilityBeakShotMult` (×1.5, Moonlit Mark); combat's projectiles deliver head hits
at the head centre. The attacker's `beakShotBonus` and `beakShotFlat` apply to gun beak shots only. Lyrebird decoys
(summon units of kind decoy) use their owner's BodyPlan, head included.
**Why:** GDD §5.4 and §9.5; DamageEffect has no multiplier field (interface request filed).

### D-COMBAT-004 · 18/11/2026 — What unstoppable and intangible block
**Decision:** unstoppable blocks, and removes on gain, only statuses that carry stunned, silenced, disarmed, rooted,
grounded or a slow (`COMBAT.unstoppableBlocks`); DoTs, amps, shred and heal reduction still land. Intangible blocks
every negative status and all damage, and shots pass through it.
**Why:** GDD §5.9 lists exactly those; the StatusDef TSDoc's "negative statuses are blocked by unstoppable" is broader.

### D-COMBAT-005 · 18/11/2026 — Periodic effects and the DoT convention
**Decision:** a status's periodic `damage` and `heal` effects are scaled by the instance's magnitude × stacks and run
with the status's cause marked `via: 'status'` (structures ignore them). The shared BLEED and BURN deal
`tickIntervalS` per tick at magnitude 1, so they are applied with magnitude = damage per second. Periodic effects
queued in the statuses phase land in the next tick's damage phase.
**Why:** GDD §5.12 "duration-weighted damage per tick" with one def per DoT type; the magnitude carries the number.

### D-COMBAT-006 · 18/11/2026 — Projectiles: store entities, pooled flight state
**Decision:** gun bullets with travel time and ability projectiles are `projectile` entities (so the renderer sees
them); their flight state (direction, distance, pierce left, targets hit) lives in pooled records reused between
shots. A projectile's `onExpire` runs whenever it ends: on the entity that stopped it, on the world, or at range.
**Why:** the store contract allocates an entity per spawn, so pooling covers everything else; firing `onExpire` on any
end lets "bursts on impact or at max range" (Hush) be one effect list.

### D-COMBAT-007 · 18/11/2026 — Pipeline details the GDD leaves open
**Decision:** a hit that comes to 0 after step 7 (invulnerable, areas or DoTs on structures) emits no
`damage.applied`. Structures take ×0.5 from all Song that is not area or status damage (item procs included). The
level-up heal is the hero data's maxHealth growth × levels gained; if Molts land after `hero.level`, the rest is
applied in the next statuses phase. Assists: enemies of a hero victim who damaged it, plus their allied heroes who
healed, shielded or buffed one of them or the killer, within 12 s; non-hero victims get none (economy uses 40 m).
Shell-loaders wait `COMBAT.perRoundStartS` (0.3 s) before the first round.
**Why:** each is the narrowest reading of GDD §5.2, §5.13, §7, §8.6 and §9.2 that the contracts can carry.

### D-COMBAT-008 · 18/11/2026 — Hitbox broad phase
**Decision:** casts up to 24 m query `ctx.spatial` padded by 6 m (it holds feet positions); longer casts (aim rays,
hitscan) scan the hero, unit and pickup lists with a distance-to-segment reject; structures are always scanned.
**Why:** a 300 m aim ray would touch ~1,500 grid cells. With the scan, 12 heroes firing plus 150 units cost
0.07–0.10 ms per tick instead of 0.26 ms. Units taller than the 6 m pad can be missed near the ends of short casts.
### D-ABIL-001 · 18/11/2026 — What a cast's effects land on
**Decision:** self, direction and point casts target `entity = caster` (point = feet, aim point, or the ground point
clamped to range; dir = look, muzzle → aim point, or flat look); unit casts target the chosen entity. Effects for
others go through a projectile, area, dash onHit/onArrive, tether or summon. A unit cast reaches its caster with
`onCaster(effects)` (sim/abilities): a 0.01 m burst on the source that only the source matches. Physics should
move `cause.source` for dash and teleport, heading for `target.entity` when it isn't the mover, else `target.point`.
**Why:** self-buffs inside aimed casts are common (Plunge, Scatter, Rampage, Tempest Dive); with entity = null they
had no target. Unit casts with self effects (Riverstrike, Night Swallow) are rare, so a helper covers them until the
contract has a first-class channel.

### D-ABIL-002 · 18/11/2026 — When a cast spends its charge
**Decision:** a cast spends its charge and starts its cooldown when it lands, after its effects and onCast hook. A
wind-up broken by stun, silence or death spends nothing; a channel broken later has already spent. Cooldown
reduction is read when each cooldown starts and capped at 50%.
**Why:** GDD §9.0.1 ("the cooldown is still spent if the cast had completed"). Spending after the effects means a
`cooldownMod` in a cast's own effects (Crest Flare) reaches only the other slots. Riverstrike's "a stun refunds 50%"
becomes a full refund.

### D-ABIL-003 · 18/11/2026 — cooldownMod changes the source's cooldowns
**Decision:** `cooldownMod` always acts on the cause's source hero, whatever the effect's target.
**Why:** every GDD use refunds the caster's own cooldowns, often from inside a dash onHit or a kill trigger whose
target is the enemy (Plunge T3, Thousand Beats, Riverstrike, Spear Bill T3).

### D-ABIL-004 · 18/11/2026 — Area timing and membership rules
**Decision:** a lasting area applies its tick effects first one interval after it appears and last on its final tick
(duration ÷ interval applications). onEnter and onCross re-fire for one target at most once per interval (Butcher's
Ring: interval 1.5 s gives "once per hero per 1.5 s"). onCross fires on crossing a ring's mid radius, or any other
shape's edge. Cylinder, ring and box are vertically centred on the area; cones reach 3 m up and down. A shape whose
size resolves to ≤ 0 does nothing. Areas with only tick effects check membership only on ticks they fire.
**Why:** one written rule per edge case so kits and QA agree; the membership skip halved spatial queries in a dense
fight.

### D-ABIL-005 · 18/11/2026 — Summon behaviours
**Decision:** health 0 means 1 hp plus `invulnerable`; traps are also `invisible` (so the 8 m invisibility rule hides
them). Turrets and decoys attack every 0.5 s, the nearest visible enemy in line of sight, heroes first, with
`trigger` (when given) as their range and filter. Decoys run along the flat cast direction at their owner's move
speed. Any other behaviour id calls the owner's `onEffect(behaviour, {entity: summon}, cause)` every tick.
**Why:** traps, Echo Double, Burrow Colony and Gale Shield need these and SummonEffect has no other fields for them.

### D-ABIL-006 · 18/11/2026 — Upgrade tiers only add: three data patterns
**Decision:** kits express tiers that change nested numbers with (1) value gating: a nested magnitude names a value
that is 0 at base and the tier raises it (Plunge T3's slow and refund, Thorn Larder T3's burst radius); (2) a
parallel area: a tier that adds to a lasting zone appends a second zone with the same size (Briar Patch T3);
(3) a cleanse by id to lift a base penalty (Grand Chorus T3).
**Why:** AbilityUpgrade can add values, cooldown, charges, range and top-level effects only; these patterns cover
most remaining GDD tiers without hooks.
### D-CTRL-001 · 18/11/2026 — Two Rapier worlds, stepped only when needed
**Decision:** map prims and structures live in a static world that is stepped only when a collider is added or
removed; hero query capsules (Layer.Hero) live in a second, tiny world synced and stepped only when a query asks for
Layer.Hero after heroes moved. Each hero's character-controller proxy sits in the static world with no layer bits.
There is no per-tick `world.step()` (ARCHITECTURE §4.6 says one per tick); nothing is dynamic, so nothing integrates.
**Why:** measured on this machine: Rapier queries only see moved or new colliders after a step, and a step costs about
0.15 µs per collider even when nothing moved (0.15 ms at 1,000 prims, 0.5 ms at 3,000), which alone would blow the
0.3 ms physics share. The static world's contents change only on deterministic spawn and despawn events.

### D-CTRL-002 · 18/11/2026 — Units move on cached ground heights, without colliders
**Decision:** `moveCharacter` on a unit (no controller) moves it by `delta` and seats it on the highest surface at or
below its feet + step-up, from a lazily built cache of every surface top in 0.25 m columns (cleared when the statics
change). Units ignore walls and have no colliders, so Layer.Unit queries find nothing. `groundHeight` stays an exact
raycast (about 2 µs).
**Why:** 150 raycasts per tick cost about 0.3 ms; the cache costs about 0.08 ms per tick for 150 units walking new
ground and less on lanes walked before. Fledglings follow lane polylines, so walls don't matter to them.

### D-CTRL-003 · 18/11/2026 — Velocity against walls, and where the feet are
**Decision:** on the ground a hero keeps its intended velocity against walls (ground acceleration re-targets it every
tick); in the air velocity becomes what the collision allowed; a displaced hero that hits a wall stops (GDD §3.9).
The controller proxy floats one skin (0.02 m) above `pos`, so `pos.y` is the real ground contact.
**Why:** clipping velocity on the ground left too little push for Rapier's auto-step to finish a kerb, and the
hero slid back off it. Spawns and teleports seat heroes exactly on the ground; inside the skin the controller
occasionally stalled for a tick.

### D-CTRL-004 · 18/11/2026 — Who a physics effect moves
**Decision:** displace and attach act on the target entity (attach holds it in front of the cause's source). A dash
with dir 'target' and a teleport to a point or behind a target move the cause's source. Every other dash, teleport
'base' and movementMode move the target entity, or the source when the target has none. Effects on units are ignored
(their `pos` belongs to their spawner).
**Why:** DashEffect says "the target (normally the caster)", but a dash or teleport aimed at an enemy has the enemy as
its target. This reading covers every §9.25 use (Plunge, Wing Slam, Long Stride, Riverstrike, Gulp, the modes).

### D-CTRL-005 · 18/11/2026 — Displacement and ability-dash shapes
**Decision:** push, pull and along launch an arc at 20° whose flat-ground range is the effect's distance (pulls are
capped at the distance to the origin); the push is added to the current velocity; 20% air control until landing.
Knock-up is straight up to `distance` with no control until landing or 1.5 s. Ability dashes run over whole ticks
through the controller (so they stop at walls), with a 4h·t(1−t) arc; they leave at min(dash speed, run + 1), except
dashes to a target, or dashes cut short by a wall or stopOnHit, which stop dead. "Touched" enemies are those whose
spatial sphere overlaps the hero's (spatial positions are one tick old in the movement phase).
**Why:** GDD §3.9 gives distances, not impulses; a fixed launch angle turns each distance into one impulse with a
natural hop. A leap to a point should land on it.

### D-CTRL-006 · 18/11/2026 — Mantle reach is measured from the ground
**Decision:** a mantle triggers when the controller reports a wall the hero pushes into (input, or flight direction
when airborne), a walkable top is 0.6–2.4 m above the lower of the feet and the ground last stood on, and the
standing capsule fits there. The hero rises during the first 60% of the 0.35 s and moves onto the ledge during the
last 60%, then keeps 50% of its speed.
**Why:** "0.6–2.4 m above the feet" measured from airborne feet would let a jump (apex 1.6 m) mantle a 2.6 m ledge,
and GDD §16 says it never must. Contact-triggered checks cost a raycast only when the hero touches a wall.

### D-CTRL-007 · 18/11/2026 — Traversal details the GDD leaves open (assumed)
**Decision:** Updraft riders' feet are on the line; a station mounts within 2 m horizontally from 14 m below to 2 m
above it; a jump-in mounts within 1.5 m of the line; no air mount for 0.5 s after leaving a line; the end of a line
drops the rider with no velocity. A Chimney base is its 1.5 m radius from 0.5 m below to 2 m above the bottom point;
the exit leaves steering onto the roof to the player. A Vine is grabbed within 0.4 m of the capsule's front and 1 m
either side; Space leaves it at 5 m/s out plus the normal jump speed up; at the top the hero steps onto a surface
behind the vine if one fits, else holds at the top. Falling below killY reseats the hero at its spawn (no death).
**Why:** each needed a concrete value now; all are in `src/sim/data/movement.ts` for Balance.
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

### D-EP-018 · 18/11/2026 — One integration engineer per wave for merge defects
**Decision:** defects that appear only after a wave's branches are merged are fixed on `integrate/w<N>` by one
temporary integration engineer acting for the owners, limited to a listed set of defects, with root-cause fixes in the
owning system and no contract changes. QA's gate review then checks the result.
**Why:** reopening four owners for four small cross-system fixes costs more than one focused agent, and the gate
review still independently checks every change.

### D-EP-019 · 19/11/2026 — Model per agent
**Decision:** each agent's model is chosen by how hard its job is. Opus: contracts, core sim systems (physics, combat,
abilities), bot AI, objectives rules, the economy and item framework, hard integration debugging. Sonnet: hero kits on
the existing framework, procedural models, VFX, UI, audio, map passes, QA test writing and gate reviews, balance runs.
Haiku: docs sync, small tooling and bookkeeping. A role steps up a tier if its output fails review.
**Why:** the user asked to stretch the usage allowance after six Opus agents hit the 5-hour limit together.

### D-EP-020 · 19/11/2026 — Beak shot through head and body stands
**Decision:** a bullet whose path crosses both the head and the body counts as a beak shot, as GDD §5.4 states ("Head is
tested before body"). Combat's behaviour is correct; the wave 2 integration note calling it a defect is withdrawn.
**Why:** it is the Game Director's deliberate rule, and the Director has final say on fidelity.

### D-EP-021 · 19/11/2026 — Wave 3 composition
**Decision:** wave 3 adds two roles the plan didn't have there: UI/HUD (menu, hero select, a minimal HUD and pause,
because Stage 2 must be playable from the menu) and a Systems follow-up engineer acting for Combat, Ability Systems and
Character Controller (the accepted wave 2 contract follow-ups, the framework gaps Hero A's kits need, and the idle-drift
defect). QA's test-first suites for wave 4 (structures, levels, AP, shop) move into the wave 3 gate review.
**Why:** Stage 2's launchable gate needs UI; Hero A's kits need framework features that the original owners aren't
scheduled to build; eight agents is the wave limit, so QA's in-wave slot moves to the gate.
### D-EP-022 · 19/11/2026 — Timing assertions run serially in their own check step
**Decision:** every test that asserts on elapsed time or ms per tick lives in a `*.perf.test.ts` file (combat, world,
physics, abilities, main map build). `npm test` excludes that pattern; `npm run perf` (vitest.perf.config.ts) runs
only those files, one at a time, and each test takes the median of 5 runs (tests/helpers/perf.ts). `scripts/check.sh`
runs `perf` right after `test`. The budgets are unchanged.
**Why:** a wall-clock budget measured while 47 test files run in parallel tests the machine's load, not the code: the
fledgling test read 0.17 ms alone and 0.54 to 0.84 ms in the parallel run against a 0.5 ms budget, and failed the gate
at random. Serial runs and a median measure the code; loosening the budget would have hidden real regressions.
### D-ARCH-011 · 18/11/2026 — Commands are copied into a per-hero latch and sanitised
**Decision:** each hero's spawn-time command object is core's latch. After the ai phase core copies the fresh command
into it (a `step()` command first, else whatever a bot assigned to `h.command`, judged fresh when it isn't the latch
itself) and sanitises it: non-finite axes become 0 and axes clamp to ±1; non-finite yaw or pitch keep the previous
value, yaw wraps to ±π, pitch clamps; an upgrade slot outside 0–3 and a ping at a non-finite point are dropped.
Without a fresh command the latch keeps its values and clears the one-shot fields. `h.command` always points at the
latch; nobody else mutates it.
**Why:** the W1 staleness test compared `h.command` with the object from before the ai phase, so a bot reusing its
own command object lost every press (QA's review); NaN look angles reached the aim maths; the latch, the ping filter
and the command map allocated per hero per tick. Normal input is copied unchanged, so the seed-1 hash stayed
4acbedb035dce146.

### D-ARCH-012 · 18/11/2026 — Seeds use all 53 bits
**Decision:** an RNG stream seeds its mixer from the low 32 bits of the match seed (xor the stream name's hash) and
xors the high bits, `floor(seed / 2^32)`, into one of sfc32's four state words.
**Why:** `createSim` accepts any safe integer but the W1 mixer folded it to 32 bits, so seeds 2^32 apart played the
same match. Seeds below 2^32 keep the sequences they always had.

### D-ARCH-013 · 18/11/2026 — The practice match, and `implemented` on hero modules
**Decision:** Play → hero select → `AppActions.startMatch(setup)` → `app/router.ts matchConfig(setup)`: 'main',
fledgling waves on all three lanes, the human on `setup.team` (Dawn for practice) with the chosen hero, plus
`MatchSetup.bots` bot heroes (default 0). `?scene=lane&hero=<id>` starts the same match. Hero select lists all 24
heroes and offers only those whose `HeroModule.implemented` is true; each hero's engineer sets it when the kit is
complete. The router and `startMatch` accept any hero, so screenshots of placeholder heroes still work.
**Why:** Stage 2 (D-EP-017) must drop the player into a lane as a bird before Bot AI exists (wave 5); bot heroes that
stand still would only clutter the practice. A flag on the module keeps the registry the Architect's while the hero
engineers decide when their kits are done.

### D-ARCH-014 · 18/11/2026 — Physics moves displaced units
**Decision:** displace, dash and attach effects move units as well as heroes. While one acts on a unit, sim/physics
writes the unit's `pos` and `vel` (an exception to "the spawner writes a unit's transform", like combat's respawn
write) and sets `rooted` on it under the stat source `'physics:displaced'`, cleared when the displacement ends. sim/world
(fledglings, neutrals) and sim/abilities (summons) don't move a unit that is rooted or stunned.
**Why:** GDD knockbacks, pulls and carries (Wing Slam, Tempest Dive, Rogue Wave) hit fledglings too, and physics
already has the displacement shapes and the unit ground cache (D-CTRL-002). Steering owners must honour root and stun
on units anyway, so the same condition hands the unit over without a new field.

### D-ARCH-015 · 18/11/2026 — Number fields become Magnitudes in two steps
**Decision:** `DamageBonus.targetHpBelow`, `DamageEffect.missingHpPct` and `DamageEffect.executeBelow` stay
`number` in this round. In wave 3 sim/combat reads them through `ctx.effects.magnitude(value, cause)` (which accepts a
number); the W3.5 round widens them to `Magnitude`. Until then a tier that raises one (Kingfisher's Spear Bill T2 and
Riverstrike T2) uses a hook.
**Why:** widening now would break Combat's arithmetic on them, and contracts can't change mid-wave; doing it in two
steps needs no duplicate fields and no code change at the widening.

### D-ARCH-016 · 18/11/2026 — Movement-mode restrictions are Motor fields, not conditions
**Decision:** physics publishes a movement mode's `allowGun` and `allowAbilities` as `Motor.modeAllowsGun` and
`Motor.modeAllowsAbilities` (optional; absent means allowed); combat blocks the gun and abilities block casting from
them.
**Why:** mapping them to `disarmed` and `silenced` would show as those states on the HUD and in the view flags, and
silence ends channels, so a mode started by a channelled ability (Burrow) would end its own channel.

### D-UI-001 · 19/11/2026 — HUD updates are change-gated cells, events drive transient effects
**Decision:** the HUD builds its DOM once and writes each text, class or style only when its value differs from the last
one written; hit markers and pod banners use `Element.animate` started from `damage.applied` and `pod.resolved`
events for the local hero. View-to-display mapping lives in pure `display.ts`.
**Why:** no per-frame allocation or layout thrash (D-EP-009 perf rules), and the mapping is unit-testable without a DOM.
### D-ECON-001 · 19/11/2026 — Pods resolve in the economy phase from queued hits; pod radius 1 m
**Decision:** `projectile.impact` (gun, or `via` absent) and `melee` events on a pod are queued and resolved in the
economy phase by pod age: ignored while rising (< 36 ticks), resolved while ripe, gone at 120 ticks. The pod is
spawned in the `entity.died` handler (value V/2 unrounded; payments floor). Hit radius is 1 m (back to 0.25 m, the
drawn orb, in the wave 3 integration once the aim ray stopped on pods, D-SYS-005).
**Why:** one ordering for hits emitted by combat the same tick and by tests between ticks; the GDD gives no pod size and
a muzzle-offset bullet misses a smaller orb at lane range.

### D-ECON-002 · 19/11/2026 — Passive income lands in wave 3
**Decision:** 1 Seed per second per hero from 0:30 (GDD §8.4, marked assumed), paid as `seeds.gained` reason 'passive'.
**Why:** tiny, and net-worth curves are otherwise flat until bounties exist in wave 4.
### D-CAM-001 · 19/11/2026 — Pull-in moves the camera along the aim ray; ramps are wedges
**Decision:** collision pull-in shifts the camera along the aim ray's own direction by the amount the pivot-to-camera
sphere cast is blocked, rather than along the pivot-to-camera line; ramps are tested as wedges, not boxes.
**Why:** the crosshair then always points along the sim's aim ray. Ramp boxes would contain the hero standing on the slope.

### D-CAM-002 · 19/11/2026 — Resume re-locks the pointer both ways
**Decision:** `setEnabled(true)` requests the pointer lock (works when resume came from a click) and a click on the
stage re-locks if the browser refused. Esc is reported once whether it arrives as a keydown, a lock loss or both.
**Why:** Esc releases the lock, and a request without a user gesture is refused.
### D-RENDER-006 · 19/11/2026 — VFX are five instanced meshes drawn in `render()`, not per-effect meshes
**Decision:** src/client/vfx draws every effect with five additive InstancedMeshes (box, sphere, cylinder, cone, ring;
fixed capacities in `vfx/constants.ts`, a full mesh drops instances), so a busy fight costs 5 extra draw calls. Short
effects (tracers, sparks, puffs, rings) live in a fixed ring of 1024 records; effects that follow entities (projectiles,
pods, areas, summon placeholders, status markers, tethers, hit flashes) are redrawn from the view each frame. Fading is
darkening (additive blending), so no per-instance alpha exists. The VFX module reaches the renderer's scene through
`render/host.ts` (a WeakMap keyed by the `Renderer` object, plus a `beforeRender` hook that `render()` calls) so the
`Renderer` contract is unchanged; effects are placed inside `render()` with the frame's own interpolation, `Vfx.update`
is a no-op.
**Why:** one mesh per effect would cost a draw call each (30+ bullets alone); the contract has no scene access; drawing
from `update()` (after `render()`) would lag bullets by a frame (~3 m at 200 m/s).

### D-RENDER-007 · 19/11/2026 — The entity layer skips what VFX draws
**Decision:** `vfx/drawn.ts` `drawnByVfx(e)` is true for projectiles, areas, seed pods and trap/turret/wall summons;
render/entities.ts gives those no model-kit model. Decoys, Eggs, runes and Embers still go to the ModelKit.
**Why:** the kit's placeholder box would otherwise stand under every bullet and area. If the Technical Artist models
pods or summons later, remove that kind from `drawnByVfx` (one line) and the kit takes over.

### D-RENDER-008 · 19/11/2026 — Hitscan tracers come from the shot's impacts; gun type from the hero registry
**Decision:** `weapon.fired` draws a muzzle flash; if the shooter's `HEROES[id].def.weapon.hitscan` is true, one tracer
per `projectile.impact` it owns in the same batch (pods skipped), else one full-length (60 m) tracer. Projectile guns
get no tracer: their bullet entity is drawn from the view. Fledgling and structure attacks come from `damage.applied`
with via 'unit' or 'structure' (a swipe up close, a tracer from slingers, turrets, structures or beyond 5 m).
**Why:** the events carry no weapon kind or end point. Camera and UI already read the registry for hero data.
### D-SYS-001 · 19/11/2026 — Grounded heroes take no gravity step, and rest exactly
**Decision:** a hero standing on the ground (grounded, not rising) moves with no vertical delta: Rapier's snap-down
keeps it on the ground and on slopes. While it also has no horizontal motion, a controller move smaller than
`CONTROLLER.restBand` (1e-3 m, the sum of |x|, |y|, |z|) is dropped, so an idle hero's `pos` and `vel` stay bit-identical
tick after tick.
**Why:** the W2 gravity step (3.5 mm a tick) pushed the proxy into the controller's 2 cm skin, where Rapier nudged the
feet ~1e-4 m every tick (the idle drift) and, from a fresh seat, stalled one tick of a dash now and then (a lost 0.46 m,
found while fixing the drift). Without the step, neither happens; a free fall moves 3.5× the band, so it never holds a
hero in the air.

### D-SYS-002 · 19/11/2026 — Summon count, cap and end effects
**Decision:** one `summon` application makes `count` summons fanned evenly across `spreadDeg` around the target
direction; the per-source cap is max(`maxCount`, `count`), so a cast never replaces its own summons. `onEnd` runs when
a summon dies (on `entity.died`, in the damage phase), expires or is replaced past the cap — not when a trap fires —
with target = its last position (entity null), dir = its current facing (`yaw`, so a wall a hook turns bursts the way
it faces) and its cause with `origin` moved to that position (pushes in a burst go away from the summon).
**Why:** Echo Double T2 (two decoys, maxCount 1) and Gale Shield T3 (a burst forward from a wall that follows the aim)
need exactly this; a trap's trigger effects already are its end.

### D-SYS-003 · 19/11/2026 — Aim dashes follow the pitch; a target dash at the caster goes to the point
**Decision:** a `dash` with dir 'aim' and no `arcHeight` follows the aim pitch, at most `DASH.aimMaxPitchUp` (30°)
upward, any angle down, `distance` measured along that line. Setting `arcHeight` (0 = flat) keeps an 'aim' dash
horizontal. A dir 'target' dash whose `target.entity` is the mover itself (point casts, D-ABIL-001) goes to
`target.point`.
**Why:** Plunge (GDD §9.3) dashes along the camera aim with a 30° clamp, Wing Slam (§9.2) is horizontal, and
DashEffect has no clamp field; the TSDoc already reads `arcHeight` 0 as "a flat dash". Tempest Dive is a point cast,
so its target entity is the caster and the dash went nowhere.

### D-SYS-004 · 19/11/2026 — Displacements end where they land; wall slams; displaced units
**Decision:** a push, pull or along displacement stops the hero (or unit) where its arc lands — no ground skid — so it
travels its `distance` on flat ground (± 0.2 m measured). A wall slam is a displaced entity meeting a wall with at least
`DISPLACE.wallSlamSpeed` (4 m/s) of horizontal speed toward it, once per displacement: `onWall` with the displacement's
cause on the entity, target dir into the wall, plus a `movement` 'wallSlam' for heroes (also for displacements without
`onWall`). Units move under displace, dash and attach in sim/physics (units.ts): rooted under 'physics:displaced' while
they move, a ballistic flight over the cached ground with one horizontal ray a tick for walls, landing interpolated
within the tick; knock-ups and dashes too; unstoppable units ignore all three.
**Why:** GDD §3.9 gives flat-ground distances; the W2 controller kept the landing speed and decelerated, so a 6 m push
slid to 8.4 m. Units have no controller (D-CTRL-002), so the ray is the cheapest honest wall test.

### D-SYS-005 · 19/11/2026 — The aim ray stops on seed pods; walls are boxes for every cast
**Decision:** combat's aim-point resolution includes pods, so a bullet converges on the pod under the crosshair (it
still passes through pods, GDD §5.6). A unit with `unit.size` is hit as a box of that size standing on `pos`, turned by
`yaw`, grown by the cast radius on every side (square corners); it stops enemy shots from either side.
**Why:** without pods in the aim ray, a shot at a pod 6 m away aimed at the world behind it and passed ~0.75 m from the
pod (Economy's D-ECON-001 workaround). A Minkowski box is one slab test; the rounded corners it skips are a few cm.
### D-HEROA-001 · 19/11/2026 — GDD numbers read as follows for Shrike, Albatross, Kingfisher, Lyrebird
**Decision:** (1) Resist and "+x%" buffs are additive (`op: 'add'`), so Albatross's Salt Hide T1 is exactly +10 points;
Albatross's T3 ally share is a flat 20% (half of 30% + the T1 10%, tiers being bought in order). (2) Salt Hide heals 10% of
max HP through a hook (a Magnitude can't take a fraction of max HP). (3) Thorn Larder's burst is centred on the triggering
hero with radius 1.5 m, 4 m from T3. (4) Echo Double's decoy shot is a fixed 4.8 Talon (30% of the level 1 gun damage); it
doesn't grow with Molts or items. (5) Wing Slam's "within 1.5 m of the path" is dash contact (the controller's touch test).
(6) Gale Shield's 15% slow lasts until the wall ends, then is lifted. (7) Riverstrike T2's extra 6% missing HP is a second
hit read after the main hit lands, so it is a few HP more than 18% of the missing HP at the strike; a stun during the wind-up
refunds the whole cooldown (framework, D-ABIL-002). (8) Butcher's Ring's heal reduction and T3 damage zone cover every enemy
in the 9 m radius, not only heroes. (9) A kill-based refund (Spear Bill T3, Riverstrike) counts damage over time from the
same ability (Spear Bill's bleed keeps its ability id).
**Why:** each is the narrowest reading of the GDD text the contracts can carry; all are in data or one named constant, so
Balance can change them.

### D-HEROA-002 · 19/11/2026 — Framework fallbacks behind named constants
**Decision:** where a W3 data shape isn't run yet (wall slam `onWall`, `SummonEffect.onEnd`, `selfEffects`), the data uses the
new field and the hero module carries a fallback hook guarded by a constant (`WALL_SLAM_IN_FRAMEWORK`,
`SUMMON_END_IN_FRAMEWORK`, `SELF_EFFECTS_IN_FRAMEWORK`) that is false today. After the Systems follow-up merges, set it true
(or delete the hook): nothing applies twice.
**Why:** the smoke tests must pass on this branch, and a hook plus the new field would otherwise double the effect after the merge.
### D-ART-001 · 19/11/2026 — One merged mesh per rig part, vertex colours, instanced chicks
**Decision:** each hero is 8 meshes (body, head, two wings, two legs, tail, gun) built once per hero and team from its
BodyPlan, sharing one flat-shaded vertex-colour material; team trim is baked into the vertex colours. Fledglings are
one InstancedMesh per type and team (capacity 256), animated by whole-body matrix only. No numbers from the GDD are
copied into the models: sizes come from `HEROES[id].def.body`.
**Why:** about 8 draw calls per hero and 4 for any number of chicks, no per-frame allocation, and the models follow
the data when hero engineers change a body plan.

### D-UI-002 · 19/11/2026 — Options apply and save on change; swap logic lives in the UI
**Decision:** every Options change calls `AppActions.saveSettings` immediately (no Apply button); rebinding to a key in
use swaps the two actions, implemented in `src/client/ui/bindings.ts`. Capture listens on window in the capture phase and
stops propagation so Esc and the pause key do not reach the app while capturing.
**Why:** immediate feedback with nothing to forget to apply; input has no `rebind()` to reuse.
### D-OBJ-001 · 19/11/2026 — Fledglings march at 5 m/s along the lane, not in a straight line
**Decision:** a fledgling in its lane advances its arc length along the lane polyline at the march speed every tick and
moves sideways (2.5 m/s, assumed) toward its file or round a structure footprint; the step may run up to 1.2× the march
speed while it sidesteps or turns a corner. Off the lane (after a chase) it heads for a point 3 m ahead on the path at
the march speed. Moves go through `ctx.physics.moveCharacter` (the unit ground cache, walls ignored, D-CTRL-002).
**Why:** GDD §7.1's arrival times (~22 s Riverbank, ~29 s side lanes) are along-lane distance ÷ 5 m/s, and waves must
still meet at z = 0 when one side steps round its own Warden at the gate and the other doesn't.

### D-OBJ-002 · 19/11/2026 — Footprints from the anchors; the W3 hold line
**Decision:** fledglings step round every structure anchor within a lane's width (footprint radii in
`src/sim/data/world.ts` `STRUCTURE_RADIUS`, which W4 uses as `StructureInfo.body.radius`; clearance = radius + 0.45 m
unit + 0.3 m). Until structures exist, a fledgling holds 1 m short of the first enemy Warden's footprint on its lane,
queued 1.5 m behind earlier holders in its file; a holder's death frees the queue only from the back.
**Why:** the brief's "stop at the last structure anchor": the Wardens are the lane's last structures, and the first one
reached keeps holders out of the enemy wave's spawn column (the side-lane Wardens straddle the gate).

### D-OBJ-003 · 19/11/2026 — Vision cost and the visibility-status details
**Decision:** heroes' `seenBy` is recomputed every tick, every other entity's every 6 ticks (by id, 0.1 s lag). Eyes are
gathered once per tick into flat arrays; fledgling (20 m) and structure (30 m) eyes are distance checks; a hero eye
(40 m) raycasts LAYERS_SOLID (ignoring the target's own collider) only when no cheaper eye already sees the entity.
Invisible: seen within 8 m of any eye or inside an enemy true-sight holder's radius (30 m from data until the status
carries one); revealed beats invisible (one bit per flock, so "minimap only" can't be expressed yet).
**Why:** hero bits feed fledgling and bot targeting at once (QA's rules suite teleports heroes next to fledglings);
units only need the ARCHITECTURE §11 0.25 s bound, and fledglings' 14 m aggro sits well inside their 20 m sight.

### D-OBJ-004 · 19/11/2026 — Fledgling attack details the GDD leaves open
**Decision:** ranges for rules 1, 2 and 4 are centre to centre; rule 3 and attack reach are to the target's surface.
A target that dies, goes out of sight, turns intangible or leaves 18 m is dropped at once and a new one picked the same
tick; a fledgling past the 18 m path leash picks nothing until it is back in its lane. Rule 2 counts damage to an
allied hero by an enemy hero or by its summon. Slingers fire a combat `projectile` (30 m/s, can hit whichever enemy is in
the way); Scrappers apply `damage` directly; both carry ×1.5 vs structures as a `DamageBonus` on structures. Scrappers
approach a slot on an arc round the target (on their own gate's side, picked by id) and stop as soon as it is in reach.
**Why:** one projectile path for every slinger shot gives VFX something to draw and pods see `via` correctly; the
bonus keeps the structure multiplier in the pipeline where the 35:00 lever (W4) can add to it. Slots stop Scrappers of
one file stacking on a single spot; chasing the slot after reaching the target made pairs circle and lanes pile up
(482 fledglings at 35:00), so a guard test now holds a 10-minute match to three waves alive.

### D-EP-023 · 19/11/2026 — Options menu with key rebinding in Stage 2
**Decision:** Stage 2's gate includes an Options screen (from the main menu and the pause menu) with rebinding for every
action, sensitivity, FOV, graphics quality and volumes, saved through the settings store so they survive a restart.
It moved forward from wave 7 and was built by the UI engineer in wave 3; `e2e/options.spec.ts` proves persistence and
live rebinding.
**Why:** the user's instruction during wave 3.

### D-EP-024 · 19/11/2026 — Pause after wave 3; W4 test-first suites deferred
**Decision:** at the user's request the studio stops after Stage 2. QA's test-first suites for wave 4 (which D-EP-021
had moved into the wave 3 gate) are written at the start of wave 4 instead, before the wave 4 implementers start.
**Why:** the user asked to stop when wave 3 finished; writing wave 4's suites is wave 4 work.

### D-EP-025 · 19/11/2026 — Private GitHub remote and a personal commit identity
**Decision:** supersedes D-EP-014. The project is pushed to the private GitHub repo `AlexNortham/perch`; the EP pushes
`main` after each stage gate, and agents never push. Commits use the repo-local identity
`Alex Northam <alexanderjnortham@gmail.com>`. All 133 earlier commits were rewritten from the machine's global work
address to that identity and `main` was force-pushed (file contents unchanged). Commit hashes quoted in STATUS.md and
DECISIONS.md before this entry refer to the history before the rewrite; the same commits now have new hashes.
**Why:** the user's instructions: keep the project on their personal GitHub as it goes, and keep it separate from
their work identity.

### D-EP-026 · 19/11/2026 — Sixteen items for the M2 shop
**Decision:** ship the twelve GDD tier-one items, Flurry Feathers, Stout Breast, Rising Song and Thunderbird Heart.
The three categories each have a component upgrade. Quick Preen upgrades to a usable active, and Down Padding
can be upgraded twice. Present the four GDD tiers in the shop and offer only implemented items for purchase.
**Why:** sixteen distinct items let players fill all twelve base slots and all four earned flex slots. This slice
also exercises the transaction rules and the stat, trigger, active and cooldown systems on their real player paths.

### D-EP-027 · 19/11/2026 — Preview stability, controls and movement enter the M2 gate
**Decision:** on player feedback, add a sustained browser traversal check, mouse-button melee/parry rebinding,
readable charged melee and reference-based movement to M2. Update the old GDD assumptions about single jumps,
dash-jump cost, sprint, slides and wall movement to match the agreed controls. Keep PERCH's map and original kits.
**Why:** the player experienced intermittent tab closure and could not access expected actions in the released
M1 preview. The linked guide supplies observable movement combinations and stamina costs to check in play.

### D-EP-028 · 19/11/2026 — A repeatable Practice Hub and mouse-driven ability upgrades
**Decision:** add a separate Practice Hub choice on the main menu. Pick a finished bird, damage an enemy target
and heal a wounded ally using normal attacks and abilities. Each new hub session unlocks the four base skills and
provides 32 practice AP. The bound upgrade action opens a cursor-friendly panel in both the hub and a match.
Each skill shows its effect and next tier on hover or focus, and a click spends the displayed AP when affordable.
**Why:** the player asked for an area to practise both roles and a way to read and upgrade abilities with the mouse.
A fresh training budget lets the player compare tiers immediately while the lane match retains earned progression.
### D-DIR-007 · 19/11/2026 — Traversal chains, browser controls and combat cues
**Decision:** adopt the linked reference's movement sequence and costs in GDD §3. PERCH sets its own
dash-jump window (0.10–0.30 s), wall impulse and fatigue curve, down-dash timing and velocity, and slide
and mantle speeds. Keep Shift and WASD, set crouch to C and move item slot 3 to N. Migrate old defaults as
a pair, preserve custom choices and resolve collisions with a browser-safe free key. Bind ordinary and side
mouse buttons with explicit swaps. Show light release, heavy commitment, lunge, hit and recovery, and both
parry outcomes.
**Why:** the new default supports the full traversal chain in a normal Firefox tab. Timing and impact cues let
players learn the controls by watching and listening. Run GDD §3.10, check the stamina and timing thresholds
and exercise mouse press, hold and release for the M2 gate. [Movement reference](https://deadlock.wiki/Movement)

### D-DIR-008 · 19/11/2026 — Hawk and Heron clearance under the Updraft
**Decision:** keep the §6.3 ground anchors and existing gateward 6 m station setbacks (D-LEVEL-003).
Cap tower geometry and poses at 10 m above the lane, leaving 2 m below rider feet. The Hawk statue sits
on an 8 m column. The Heron keeps its stilt legs, frame, stepping pose and bill beam. Keep ground-anchored
combat reach at 22 m for Hawk fire, 30 m for the Heron beam and 7 m for its stomp.
**Why:** the lane retains its tower silhouettes and fight geometry. Verify clearance at normal and boost
speed over both kinds of tower and check the existing range thresholds.

### D-DIR-009 · 19/11/2026 — Practice Hub and ability inspection
**Decision:** Practice Hub begins at the menu, lets the player select an available hero, and offers repeatable
damage and ally healing on labelled targets. Its four base abilities and 32 AP use the usual tier rules.
Tap the inspect action to free the pointer for hover descriptions, focus and click-to-upgrade. Keep the
keyboard upgrade chord and return to aiming on Close or Esc.
**Why:** the player can try any unlocked kit and all tiers, including ally heals, using the same controls
and outcomes as the match. Check the two target paths, the AP panel and a fresh Play session in the M2 gate.
### D-ARCH-017 · 19/11/2026 — The siege, practice and test fixtures use different match configurations
**Decision:** use one matchConfig for Play and the lane router. Enable the three lanes and both bases, one Dawn human, no hostile heroes or neutrals and real progression. At phase-one lethal damage Combat keeps the Patron alive and announces patron.depleted. World starts the gated transition on the same entity. Final phase-two death ends the match. Practice Hub instead creates two real hero targets, gives the human four abilities and 32 practice AP, and discards the sim on exit. The existing test sandbox remains independently configurable.
**Why:** the UI, headless rules and browser evidence can drive the same ordinary commands. The stable Patron id keeps colliders, target selection, HP and bounty lifetime coherent.

### D-ARCH-018 · 19/11/2026 — The app owns overlay input, shared presentation routes and sight
**Decision:** UI intents join the ordinary command queue. Interactive overlays release capture and the sim keeps running. Hero and item definitions reach their consumers through the registry and screen catalogue. Snapshots carry resolved visual geometry, view masks and action poses. The client can supply the last displayed, bounded sight line for human aim. Combat owns the physical muzzle ray and actual pellet endpoints.
**Why:** a player can inspect an ability, trade, ping or shoot while the rules and camera have one reproducible interpretation. Shared app modules remove the renderer/VFX and UI/input import cycles.

### D-ARCH-019 · 19/11/2026 — Safe browser bindings and visible movement/melee states
**Decision:** migrate settings v1 to v2, reserve user-customised codes, then assign available safe defaults for crouch and item 3. New profiles use C and N respectively. Expose fractional stamina, the actual eligible dash-jump window, distinct air/wall jumps, down dash and mantle glide, and charge/light/heavy/parry poses. A rebound upgrade modifier opens inspect on a solo tap; a chord spends once.
**Why:** the former default permitted native browser close-tab shortcuts during sliding. The new view states let HUD, Art, Audio and QA distinguish intent, windup, impact, available stamina and the real timing window. Heavy charge and browser history failures require separate real-input tests.
### D-QA-006 · 19/11/2026 — Test M1 input with a production preview and real history entries

**Decision:** diagnose keyboard liveness with isolated Firefox and Edge content input, and check side-button
navigation using trusted Chromium CDP events with real browser history in both directions. Keep expected-red
fix checks gated until integrated. Use an advancing sim tick and the Sliding flag to verify the post-fix run.

**Why:** content liveness, browser-native history, browser-chrome shortcuts and WebGL loss have separate
observations. A synthetic side-button event can verify the action path. A history check needs trusted input.

### D-QA-007 · 19/11/2026 — Measure the gun centre separately from the displayed pellet fan

**Decision:** test the simulation's fired direction in the open and against real Rapier geometry, then check the
actual VFX mapping for an open ray on a partially obstructed shotgun blast. Cover both shoulders and use
Kingfisher as the single-shot control.

**Why:** the M1 mapper displays only hit rays once a pellet strikes something. A shallow downward Albatross shot
can have a correct centre while all visible rays point towards the ground.

### D-QA-008 · 19/11/2026 — M2 fit checks use ordinary commands and production rule outcomes
**Decision:** Gate baseline-missing siege, economy, shop and Practice reset rules with `PERCH_PENDING=1` until
integration. Use authored anchors, real structure spawns and Combat resolution, ordinary shop buy/sell and AP
commands, and normal shots or support casts. Keep current Practice entry progression and 18 m secure/deny proofs
always enabled.
**Why:** Event and transaction assertions detect regressions in credit, lifetime earnings, upgrades and objective
state. Sandbox placement and amplified damage isolate rule boundaries and keep the siege runs short. A full
player-controlled match at normal damage remains a separate integration gate.

### D-QA-BROWSER-001 · 19/11/2026 — Measure browser movement in simulation ticks
**Decision:** start through Play and an enabled hero card. Verify the selected kit and Dawn's spawn, then compare
metres per simulated second over at least nine ticks before and after Shift. Require a 1.75× gain. Reach the actual
Riverbank station from the Home Roost ramp, mount with E, measure cruise and boost, shoot and dismount with Space.
**Why:** steady walking cannot meet the speed ratio. Sampling ticks keeps slower browser frames from distorting it.
The app's read-only hero hook supplies the measurements.

### D-QA-BROWSER-002 · 19/11/2026 — Bound draw calls in a populated lane and full match
**Decision:** use seed 1, fast-forward 6,000 ticks and a fixed 1920×1080 Hedgerow camera (-95,10,-20 looking at
-95,0,6). Sample twelve frames with map, fledglings and active lane VFX. Baseline peaks were 25 low and 41 medium in
lane and 217 medium in the full match. Ceilings are 32, 48 and 248 with a floor of 25,000 triangles.
**Why:** seven calls in each lane fixture and 31 in the 12-hero fixture allow variation while catching material
regressions. The triangle floor requires a populated frame. Serial performance checks cover timing.

### D-QA-BROWSER-003 · 19/11/2026 — Observe Practice Hub and upgrades through player-visible state
**Decision:** use Playwright keyboard and mouse input and read labelled dummy health, descriptions, HUD points and
tiers, actual shots, and pointer lock. Keep Practice Hub, the upgrade panel, ordinary siege and the twelve-hero
picker behind `PERCH_PENDING=1` until their producers land. In siege, confirm a locked ultimate and passive earnings
while inspecting.
**Why:** player-visible state can prove input and session wiring alongside QA's rule-level assertions.

### D-EP-029 · 19/11/2026 — Claude resumes wave 4 from ChatGPT's branches
**Decision:** ChatGPT (Codex) ran the W3.5 contract round, the Director, production and test-first rounds (all on main
at 1d9e431) and started Movement, Economy and Objectives before stopping. Its uncommitted work was committed as WIP
snapshots on `w4/movement`, `w4/objectives` and `w4/economy`. Claude's EP continues wave 4 with ChatGPT's briefs
(`docs/briefs/W4-*.md`): Movement, Economy and Objectives resume from those branches; UI, Consumers, Technical
Artist, Hero A (A2) and Hero B (B1) start fresh from main; Audio starts when a slot frees; the Lint pass runs after the
merge because it touches every owner's files. Models follow D-EP-019. ChatGPT's worktrees under `~\.codex\` are left
untouched.
**Why:** the user asked Claude to pick development back up from ChatGPT; resuming its branches keeps its work.

### D-EP-030 · 19/11/2026 — Ctrl to crouch/slide through fullscreen keyboard lock
**Decision:** in browsers with the Keyboard Lock API (Chrome, Edge), entering play also enters fullscreen and locks the
keyboard, so Ctrl+W and similar browser shortcuts reach the game. Ctrl is the default crouch/slide key there again; C
stays the default where keyboard lock is unavailable (Firefox). Esc pauses; holding Esc exits fullscreen (browser rule).
Options notes which reserved combinations only work in fullscreen in Chrome/Edge. This partly supersedes D-ARCH-019's
move of crouch to C. The settings migration change in `src/client/app/settings.ts` lands in the W4 integration round.
**Why:** the user wants to hold W and press Ctrl to slide without the tab closing. A normal tab can never block Ctrl+W;
a fullscreen page in Chromium can.
### D-ECON-003 · 19/11/2026 — Pay earned Seeds and Molts together
**Decision:** round each hero's share at payment and credit both wallet and lifetime earnings. For every crossed
threshold, apply that hero's growth table and emit one level event. Combat heals the HP gain and Abilities grants
the event's AP and ultimate unlock. Use the two flocks' pre-payment worth to calculate a hero bounty.
**Why:** buying and selling must preserve earned levels. A single bounty can cross several thresholds.

### D-ECON-004 · 19/11/2026 — Track refunds by shop visit and preserve active cooldowns on sale
**Decision:** the inventory records the current allied shop anchor. Each purchase records an inclusive last tick for
its full refund. Clearing that tick on a change of anchor or death ends the visit. A sale preserves the active's
current cooldown, including explicit refunds from ability effects, for repurchase in the same match.
**Why:** the UI can display the same refund the simulation validates. Buying back Flurry Feathers should respect its
30 s cooldown even when its price is fully refunded.
### D-OBJ-005 · 19/11/2026 — Siege attacks, collision and base movement
**Decision:** spawn all 30 anchor cylinders in structure matches. Hawk and Heron tops are 10 m, 2 m below the
12 m rider. Attack ranges use feet-to-base distance. Homing bolts commit to a target at launch and resolve at
the announced arrival tick. Heron stomp and Patron Rain recheck the marked area at impact. Wardens defend the
gates. Invulnerability gates govern incoming damage. Place the phase-two heart on the
forward surface of the 8 m Patron body, 6 m above its base. Past its lane's enemy gate a wave pursues open
base targets even outside normal lane aggro range.
**Why:** permits a normal wave to walk from the gate to both Shrines and the Patron, preserves ordinary attack
credit and gives presentation a single timed attack event for warnings and impacts.

### D-OBJ-006 · 19/11/2026 — Individual stat blocks ahead of synchronized wave spawns
**Decision:** prepare one private stat block per tick within a 36-tick lead before its scheduled wave,
according to the wave's exact tick and composition. All entities and their spawn events still enter the match
together. Rescheduling falls back to fresh blocks. Each wave shares its immutable attack definitions.
**Why:** the CPU profile showed repeated construction of empty-modifier stat blocks during a single wave
tick. Spreading the calls preserves the stat service as the writer and keeps spawned units independently mutable.

### D-OBJ-007 · 19/11/2026 — Separate observer sight and map revelation
**Decision:** invisible and revealed entities keep their map icon beyond normal detection range. World sight
checks each eye's proximity, active true sight and resolved Fog Bank membership. An ordinary observer inside
the same bank can see its occupants. The fallback for a legacy true-sight effect with no radius is 30 m.
**Why:** abilities, targeting and actor drawing read world sight. Map views can disclose a revealed opponent
without making it available as a unit target.

### D-OBJ-008 · 19/11/2026 — The 35:00 structure lever adds in step 4
**Decision:** from 35:00 a fledgling attack carries two target-kind bonuses on structures, ×1.5 and +25%, which
damage step 4 adds (×1.75 in all) instead of multiplying them (×1.875). Brood Ward weakens to ×0.6 at the same time.
**Why:** GDD §5.2 step 4 makes conditional target-kind bonuses additive within the step, and D-OBJ-004 kept the ×1.5
as a pipeline bonus so the lever could add to it.
### D-RENDER-009 · 19/11/2026 — W4 consumers: traces, ghosts, fade and cues come from the contract
**Decision:** hitscan tracers draw from `weapon.traces` (every pellet end, misses included, from the real muzzle); the
impact scan stays only as a fallback when a shot has no traces event. Enemies render only when `canSee` for the local
flock; allied invisible heroes draw at 0.35 opacity; the local hero's materials fade over the last metre before the
camera (per-mesh clones, restored at full opacity). Areas draw from `AreaInfo.dimensions`. `meleePose` and the
parry/whiff/structure events have their own cues; `Vfx.reset` clears transients, pods, tethers and flashes. Render
host, palette and drawn now live in `app/`; the old render/vfx modules re-export them.
**Why:** one source of truth per fact, as INTERFACES §12 and the W4 follow-ups require.

### D-ABIL-010 · 19/11/2026 — W4 consumers: abilities use heroAimRay and publish area geometry
**Decision:** unit/point/direction targeting uses `core/aim.heroAimRay`; lasting areas store resolved
`dimensions` and `concealsAlliesOutside`; summons honour `extraCount` and `preferHeroes` (default true); moving
areas stop carrying a target after `move.maxCarry` metres and pass `move.onWall` to the carry displacement.
**Why:** W4-contract-followups, Abilities and Rendering sections.

### D-AUDIO-001 · 19/11/2026 — Audio is proved by measured samples in a real browser
**Decision:** `src/client/audio/audio.test.ts` bundles the module and renders it in Edge through an OfflineAudioContext
(plus one live AudioContext for the gesture check), asserting on measured RMS and signatures. `createAudio` takes an
optional `{ ctx, lookahead }` seam; the app still calls `createAudio(settings)`.
**Why:** Node has no WebAudio, and a fake graph only proves events arrived. Measured samples distinguish sound that is
generated and routed from mere event delivery.

### D-AUDIO-002 · 19/11/2026 — Context is created on the first gesture; positional voices are one-shots
**Decision:** no AudioContext exists until `resume()`; events before it are ignored. Positional sounds fix their panner
position at emission, voices over 60 m are not created, and the slide/updraft loops are one-shots for now.
**Why:** it satisfies browser autoplay rules without queueing stale sounds, keeps the 48-voice budget simple, and
avoids per-frame panner updates until the loop sounds need them.
### D-HEROA-003 · 19/11/2026 — A2 kits use contract fields now and hooks only for what data cannot say
**Decision:** Hornbill, Flamingo, Penguin and Puffin put every number in data (named values for tier changes, a base
number a tier switches on starts at 0) and use the W3.5 fields (weaponMod gunDamage, reloadFraction, pierce, onlyVsStatus;
extraCount, preferHeroes, move maxCarry and onWall, concealsAlliesOutside) even where the owning system has not landed.
Hooks cover hero-only slows, fraction-of-max-HP heals, placing an effect at the caster's feet (a direction cast's point
is the aim point), per-touch hits (Emperor's March) and Toboggan's Space hop. No fallback duplicates a framework
feature, so nothing double-fires when the owners land (D-HEROA-002).
**Why:** duplicating framework behaviour in hooks caused the W3 double bursts; asserting only what runs today and gating
the rest behind PERCH_PENDING keeps the suite honest.
### D-HEROB-001 · 19/11/2026 — Tiers switch effects on with empty areas, not zero durations
**Decision:** `applyStatus` with a duration of 0 still lasts one tick, so a tier that adds a stun, slow, heal reduction,
damage amp or burst uses a parallel area whose radius is 0 until the tier (Snake Stamp `stunR`, Mob `healR`, Scatter and
Black Sun `burstR`, Night Eyes `ampRadius`, Moonlit Mark `rangeAll`). Tiers are bought in order, so a later tier may add
a value that equals an earlier tier's total (Black Sun T3 `burstR` 13 = 10 + T1's 3).
**Why:** `AbilityUpgrade` only adds, and a one-tick status would show on every cast.

### D-HEROB-002 · 19/11/2026 — Refreshing amps are one instance; Footwork stacks share a timer
**Decision:** statuses a zone refreshes every tick (Black Sun's Song amp, Night Eyes' damage amp) use stacking 'max' so
refreshes don't add up. Footwork is one `stack` status (3, 5 s) whose timer restarts on each stack rather than per stack.
**Why:** the shared `DAMAGE_AMP` is independent and overlapping refreshes doubled it; per-stack timers need a new status kind.

### D-HEROB-003 · 19/11/2026 — Hooks that move or end things use the ordinary effects
**Decision:** Viper Dance keeps the Secretarybird on its target by applying `teleport behindTarget` every tick; Silent Wing
ends by applying a one-tick `movementMode`; Gulp attaches through `attach`. The only direct write is Pelican moving a
swallowed fledgling to its feet before the lethal damage, so the economy pod spawns there.
**Why:** keeps Physics the mover and gives credit and last hits through the real pipeline.
### D-ART-002 - 19/11/2026 - Structures are one swapped-geometry mesh; shared instanced Brood Ward dome
Each structure is a single mesh whose geometry is swapped between prebuilt variants (eye glow, Heron leg pose) instead of
separate glow and leg meshes, and towers do not cast shadows. A structure stays at one draw call, so the lane scenes stay
under QA's ceilings (24 and 41 against 32 and 48). The dome is one InstancedMesh for all wards.
### D-UI-003 · 19/11/2026 — Panels render once and update cells; one description element per fact
**Decision:** the upgrade dialog and Hoard build their DOM once per hero or catalogue and only write changed text. Each
ability description and tier effect exists in exactly one element, shown by `:hover`/`:focus-within` CSS, so keyboard and
pointer both reveal it and QA locators resolve one node. Panels never mutate the view; they call `actions.submit`.
**Why:** change-gated writes keep frames cheap (D-UI-001); one node per text avoids strict-locator clashes.

### D-UI-004 · 19/11/2026 — Options capture drains the rest of a mouse press
**Decision:** after a mouse capture the window swallows mouseup, auxclick, pointerup, click and contextmenu until mouseup
(1 s cap). pointerdown is never swallowed, because cancelling it suppresses mousedown. Reserved browser chords (Ctrl/Meta
with W, T, N, Q, R, Tab) get a note matched to `navigator.keyboard.lock`, and are never blocked (D-EP-030).
**Why:** side buttons navigate history on release and the trailing click re-armed capture.
### D-CTRL-008 · 19/11/2026 — Traversal details the reference and the director leave open
**Decision:** the dash-jump window counts from the tick a ground dash starts (ticks 6–18 at 60 Hz) and
`Motor.dashJumpReady` is true only inside it while grounded or in coyote time with a pip to pay. A wall counts when
its normal is within 0.25 of horizontal; the push replaces the into-wall component with 6 m/s outward and keeps the
along-wall part. Down-dash needs two fresh crouch presses in one airtime (Input queues up to two per sample). Mantles
need Jump held (walking into a ledge never mantles) and exit in a slide when crouch is held and slide speed is met
(`mantleGlide`). Sprint returns 5 s after aim is released or combat ends. Jump ends a toboggan with a 1.2 m hop that
keeps its speed. A rider who jumps or drops off a line can air-mount that line again only after being out of its
1.5 m reach or landing.
**Why:** each needed one deterministic reading. The last fixes a jump-off that fell back through the line's reach
just after the 0.5 s remount delay and remounted. The Hedgerow run (GDD §3.10) is a test on the real map.

### D-CAM-003 · 19/11/2026 — Fullscreen keyboard lock for Ctrl crouch (D-EP-030)
**Decision:** where `navigator.keyboard.lock` exists, the play gesture that requests pointer lock also puts the
document element in fullscreen (so the HUD overlay comes too) and locks every key. Pause, panels and menus release the
lock and keep fullscreen, so Resume needs no new fullscreen and browser keys work in menus. Leaving the match calls
`Input.exitFullscreen()`. `defaultBindings()` gives Left Ctrl crouch only where the lock exists. A free C still
crouches while crouch sits on a Ctrl key, covering a refused fullscreen. Firefox keeps today's windowed C.
**Why:** a normal tab can't stop Ctrl+W. Chromium delivers locked keys to a fullscreen page, and one Esc still pauses.

### D-COMBAT-009 · 19/11/2026 — A trigger pull carries its own shot record
**Decision:** each trigger pull snapshots damage, falloff, active weapon mods, Close Talons and the flat beak bonus.
Travelling rounds keep that record. Close Talons uses muzzle-to-hit distance ≤ 15 m, and the flat beak bonus applies
to the first beak-shot pellet of the pull only. Guns and melee test cover against `Layer.World`, so analytic structure
bodies and hearts stay selectable. `weapon.traces` lists every hitscan pellet end, hits and misses. Phase-one Patron
damage floors at 1 HP once and emits `patron.depleted`. A practice dummy resets 4 s after its last change.
**Why:** later item changes or a reload can't alter rounds in flight, and Rendering draws the real pellet fan.

### D-EP-031 · 19/11/2026 — A generated game wiki, kept current at every gate
**Decision:** add a Docs & Wiki role (#21) that owns `tools/wiki/**`, the committed site in `wiki/**` and
`tests/wiki/**`. The wiki is generated from the game's own data (heroes, abilities, items, numbers, map) plus the GDD
for planned content and PLAYABLE.md for patch notes. Every stage gate now includes "wiki regenerated and reviewed",
and a coverage test fails if a feature in the data has no wiki entry.
**Why:** the user asked for a full HTML game wiki that is updated whenever features are added. Generating it from the
data is the only way it can't drift.
### D-ABIL-011 · 19/11/2026 — A moving area's carry is one launch per entity (W4 integration, for Abilities)
**Decision:** a moving area with `move.carry` launches each entity once, on the first tick it is inside: a `displace`
'along' of `move.maxCarry` metres, or the area's travel left if that is shorter (no maxCarry means the travel left).
This replaces D-ABIL-010's per-tick push of speed × tick. A 12 m 'along' arc at g = 25 flies at 20.3 m/s, so Rogue
Wave's target rides just inside the 20 m/s wave front and lands 12 m on.
**Why:** physics adds each push to the hero's velocity, so 36 pushes of 0.33 m stacked to about 27 m and threw the hero
out ahead of the wave, which then re-entered it and repeated onEnter's 160 Song. Units, whose pushes replace their
velocity, barely moved. One launch meets GDD §9.12's "carried with it (up to 12 m)" for both.

### D-ABIL-012 · 19/11/2026 — Rooted does not block a cast that cleanses the root (W4 integration, for Abilities)
**Decision:** a movement cast is still refused while rooted or grounded, except that rooted does not refuse one whose
own effects or selfEffects cleanse the root status (`ROOT.id`, or `'negative'`). Kit resolution derives `unroots` from
the data, so no AbilityDef flag is needed. Grounded still blocks.
**Why:** GDD §9.8 Scatter "removes slows and roots on cast". ROOT is the only status that carries `rooted`, and the
cleanse lands before the dash in the same cast. Contracts are frozen, so the rule comes from the effects.

### D-CTRL-009 · 19/11/2026 — A glide ends itself on landing or Jump (W4 integration, for Physics)
**Decision:** the glide movement mode ends, running its onEnd, when a pressed Jump arrives (no hop: the hero falls
from there) or on the tick the hero lands after being airborne. A glide that starts grounded runs until it lands or
expires. Owl's hook and its one-tick replacement mode are gone.
**Why:** GDD §9.5 Silent Wing "ends on landing or pressing Space", and Thermal's glide is "as Silent Wing's glide", so
the rule belongs to the mode, not one hero (Hero B's W4 interface request 2).

### D-WIKI-001 · 19/11/2026 — Own generator, own Markdown renderer, no new dependency
**Decision:** `tools/wiki/` is a plain TypeScript generator run by `npm run wiki` (tsx). Hand-written prose lives in
`tools/wiki/pages/*.md` with `{{block}}` lines that the generator fills from game data, and `[[page|text]]` links
checked at build. A 60-line Markdown renderer covers headings, lists, tables and inline styles. No package was added.
**Why:** the pages are mostly tables and cards generated from data; a full Markdown library would add a dependency for
a handful of prose paragraphs.

### D-WIKI-002 · 19/11/2026 — Built facts from data, planned facts from the GDD, stages from STATUS.md
**Decision:** built heroes, abilities, items, statuses, structures, economy, movement and combat numbers are read from
`src/sim/data/*`, the hero registry (`implemented`), `loadMap('main')` and `mapSvg`. Heroes and items not built yet are
read from GDD section 9 and 10 tables and marked **Coming in Stage N**; N comes from the milestone headings and batch
lists in STATUS.md (Stage = M + 1). Patch notes come from PLAYABLE.md; the current stage gets a section built from data
until its own notes are written at the gate. Lines naming the reference game are dropped when the GDD is quoted, and
a test fails if such a name reaches a page (D-EP-002).
**Why:** nothing is copied by hand, so a balance change or a newly implemented hero changes the wiki.

### D-WIKI-003 · 19/11/2026 — Hash-named screenshots, captured by Playwright from the game itself
**Decision:** every screenshot has a file name `img/<kind>-<name>-<hash>.jpg` where the hash covers the capture job,
the data it shows (hero body plan, ability definition, structure numbers) and the source of the code that draws it
(models, VFX, UI, map). `npm run wiki` captures only files that do not exist yet and deletes unreferenced ones;
`npm run wiki -- --images` forces a full re-capture. Captures use the dev server and the installed Edge: model
pictures use `modelLineup`, `modelYaw`, `modelState`, `modelStructure`, `modelWave` and `renderCam`; ability pictures
cast the ability for real in the practice scene with the bound key; UI pictures press the real shop, upgrade,
scoreboard and big-map keys. A failed capture copies the hero's portrait to the ability's file name and is reported.
Item icons and "coming soon" silhouettes are generated SVG; the map is `mapSvg` output.
**Why:** regenerating must not churn git, and a changed model, ability or UI must produce a new picture.

### D-WIKI-004 · 19/11/2026 — The coverage test warns about stale screenshots instead of failing
**Decision:** `tests/wiki/coverage.test.ts` fails for a missing hero, implemented ability, catalogue item, status,
structure type or unit type, for broken links or anchors, missing alt text, external URLs and reference-game names. A
screenshot whose hash moved because another role changed a model or an ability only produces a warning.
**Why:** a merge by another role must not turn the gate red for something only `npm run wiki` (a browser run) can fix.
The EP regenerates the wiki at each gate.

### D-EP-032 · 19/11/2026 — main is the stable release line; the studio carries on stage after stage
**Decision:** `main`, local and on GitHub, receives only completed, gated stages; each push is a stable release for
the user to test. Work in progress stays on integration and agent branches and is never pushed. From the Stage 3
sign-off onwards, integration merges happen in a separate worktree, so the main checkout stays on `main` and
`npm start` there always runs the latest stable stage. After each gate the EP starts the next stage without waiting.
**Why:** the user's instruction: carry on with the following stages, but only push to main when a stage is complete,
so they can test stable releases.

### D-EP-033 · 19/11/2026 — A detailed map with enterable buildings, jungle and boxes in Stage 4
**Decision:** Stage 4 adds a map-detail push.
- Before wave 5, the Game Director designs building interiors and what players do inside them (breakable Nests,
  Thicket camps, interior shops, rooftop and balcony routes, and the other in-building interactables the reference
  game has), plus the jungle. The Director uses deadlock.wiki (https://deadlock.wiki/) as the reference for how those
  features work.
- In wave 5 the Level Designer rebuilds Old Mossmarket in far more detail: enterable buildings with doors, stairs,
  upper floors, windows and roof access, more street and jungle detail, and nav through interiors.
- Objectives fills the interiors and the jungle with activities. The Technical Artist and Rendering keep it within
  the FPS and draw-call budgets.
- The Stage 4 gate gains "Detailed map: enterable buildings with interiors and things to do in them, a jungle with
  Thicket camps, and breakable Nests (boxes) throughout".
- The reference is for mechanics only (D-EP-002): layouts, names, art and all wording stay PERCH originals, and
  nothing is copied from the wiki into the game or into PERCH's own wiki.
**Why:** the user's instruction: make the map more detailed, make buildings enterable with things to do in them,
include the jungle and boxes, and use the reference game's wiki for building features.

### D-EP-034 · 19/11/2026 — 64 items by the end of Stage 4
**Decision:** the item target rises from 48 to 64. Stage 4 ships all 48 GDD items (16 are in the Stage 3 shop) plus 16
new items, designed by the Game Director in the W4.5 pass. Mechanics may draw on the reference game's item design;
names, effects and wording stay original (D-EP-002). The new items fill gaps across Talon, Plumage and Song and all
four tiers, bringing the actives to about 14. Wave 5 splits the item work across two Economy & Items engineers by
category. The Stage 4 gate reads "All 24 heroes and 64 items".
**Why:** the user's instruction: 16 items isn't enough; 48 in total if not 64.

### D-EP-035 · 19/11/2026 — Animation quality bar: guns are held, nothing floats
**Decision:** every playable bird holds its weapon through explicit grip sockets on the rig, in every animation state.
Feet are planted when grounded, and no part is ever detached from the rig. Automated attachment tests
(`tests/anim/**`) enforce it. Every stage gate now includes a pose-sheet review (every playable bird in every
animation state) by QA and the EP. The Stage 3 fix is done by the Technical Artist on Opus, a tier up from the Sonnet
work that missed it (D-EP-019 escalation).
**Why:** the user saw guns floating beside the birds instead of being held, and asked that nothing like it happens
again.

### D-EP-036 · 19/11/2026 — Learned item scores, recommended builds and varied bot shopping
**Decision:**
- **Bot shopping.** Bots don't follow fixed build lists. Each hero has a learned item score: a base value, plus
  synergy with the items already owned (including upgrade chains), plus a game-phase factor. Bots sample purchases
  from those scores. Difficulty sets the temperature: hard bots stay near the best options, easy bots explore more.
  The sampling uses a seeded RNG stream, so replays stay deterministic. The Bot AI engineer implements the policy in
  wave 5.
- **Build Lab.** The Balance & Data role is pulled forward from M4 into wave 6 to run it. It plays at least 1,000
  headless bot matches at full sim speed across the 16 cores, in rounds of about 200. The first round explores with
  varied, sensible builds. Each later round fits the scores to outcomes (wins, damage, kills, objectives, Seed
  efficiency, weighted by purchase time), then samples from the updated scores with decreasing exploration.
- **Outputs.** The scores become sim data. Each hero's recommended build (early, mid and late core plus situational
  picks) appears in the Magpie's Hoard and on its wiki page. The method and results go in `docs/BALANCE.md`.
- **Gate.** The Stage 4 gate checks 1,000+ matches, a build for every hero, and build diversity with synergy above a
  random baseline. The scores are re-learned in Stage 5 after balance changes.
**Why:** the user wants every character to have a recommended build learned from at least 1,000 fast mock games, while
bots still buy different but synergistic items every game.

### D-EP-037 · 19/11/2026 — Build Lab runs until convergence; 1,000 matches is the minimum
**Decision:** refines D-EP-036. The Build Lab runs at least 1,000 matches and then keeps adding rounds until all three
of these hold:
- each hero's recommended early, mid and late cores barely change between two consecutive rounds;
- the confidence intervals on each hero's top item scores are narrow enough that their ranking can't plausibly flip;
- in held-out matches, bots using the newest scores beat both last round's scores and random buying by a
  statistically significant margin.
`docs/BALANCE.md` records the match count, the convergence numbers and why it stopped.
**Why:** the user said 1,000 is a minimum and to run more if needed.
