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
