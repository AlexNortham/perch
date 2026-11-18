# PERCH — Studio Status

The Executive Producer (EP) owns this file. Agents append to the **Log** at the bottom and edit nothing above it.

Client brief: [BRIEF.md](BRIEF.md) · Decisions: [DECISIONS.md](DECISIONS.md) · Design: [GDD.md](GDD.md) ·
Architecture: [ARCHITECTURE.md](ARCHITECTURE.md), [INTERFACES.md](INTERFACES.md) · Balance: [BALANCE.md](BALANCE.md)

## Now

- **Milestone:** M0 — Foundations
- **Roster:** 24 heroes (D-EP-015), shipped in six batches of four from W3 to W6
- **Wave:** W1 done (0afec69). W2 in progress in worktrees: Level Designer, Rendering & VFX, QA, Character
  Controller, Combat, Ability Systems
- **main:** 0afec69 — GDD, sim core and contracts, app shell, stubs, toolchain
- **Last `npm run check`:** PASS on main at 0afec69 (5/5 steps, 12 s), run by the EP on 18/11/2026

## How the studio works

1. **Exclusive ownership.** Edit only the paths your role owns (map below). If you need a change elsewhere, put it
   under *Interface requests* in your Log entry and the EP routes it to the owner.
2. **Branches.** W1 works in the main checkout because there is nothing to branch from yet; W1 agents don't commit,
   the EP does. From W2 on, every agent runs in its own git worktree on its own branch, commits there, and never
   touches `main` or another agent's branch.
3. **Dependencies in worktrees.** Run `npm ci --prefer-offline --no-audit --no-fund` once in your worktree. Never add
   a dependency yourself; request it from Build & Tooling.
4. **Merge gate.** The EP merges a wave's branches into `integrate/w<N>` and runs `npm run check`; then QA/Review
   approves or blocks. Only an approved integration branch fast-forwards `main`.
5. **Contracts first.** Cross-system types and events live in `src/sim/core/contracts/` (Architect). Systems talk
   through the event bus and those contracts, never through each other's internals. A contract change is an
   interface request to the Architect and lands between waves, never mid-wave.
6. **Proof, not claims.** Done means you ran it: name the commands and what they printed. Visual work is checked by
   capturing a screenshot with `npm run shots` and looking at the PNG.
7. **Never run `npm start`.** It opens a browser on the user's desktop. Use `npm run shots`, `npm run e2e` or
   `npm run preview`, and stop any server you start.
8. **Originality.** The gameplay loop follows BRIEF §2. Names, characters, hero kits, the item list, the map layout,
   art and audio are PERCH originals. The reference game's names and terms never appear in `src/` or in
   player-facing text (see D-EP-002).
9. **Report.** The last step of every task is a Log entry (template at the bottom). Record non-obvious decisions in
   DECISIONS.md.
10. **Local only.** Never add a git remote, push, publish or upload anything. Branches and merges stay on this
    machine (D-EP-014). Installing packages from the npm registry is fine.
11. **Launchable at every gate.** A milestone closes only when `npm start` opens the menu and that stage's new
    features are reachable from it (before the menus are finished, from a listed `?scene=` URL), and the EP has added
    the stage's section to [PLAYABLE.md](../PLAYABLE.md): how to launch, what you can do, what isn't in yet
    (D-EP-017).

## Ownership map

| Path | Owner (#) |
|---|---|
| `docs/STATUS.md` above the Log | Executive Producer (1) |
| `docs/DECISIONS.md` | everyone, append-only |
| `docs/GDD.md` | Game Director (2) |
| `docs/ARCHITECTURE.md`, `docs/INTERFACES.md` | Technical Architect (3) |
| `src/sim/core/**` (incl. `contracts/`), `src/sim/index.ts`, `src/sim/heroes/registry.ts`, `src/sim/data/core.ts` | Technical Architect (3) |
| `src/client/main.ts`, `src/client/app/**` (boot, app states, loop, interpolation, settings store, `?scene=` router) | Technical Architect (3) |
| `package.json`, lockfile, `tsconfig*.json`, `vite.config.ts`, Vitest/ESLint/Playwright configs, `index.html`, `.gitignore`, `scripts/**`, `tools/**` | Build & Tooling (4) |
| `src/sim/physics/**`, `src/sim/data/movement.ts` | Character Controller (5) |
| `src/client/camera/**`, `src/client/input/**` | Camera & Input (6) |
| `src/sim/combat/**`, `src/sim/data/combat.ts` | Combat (7) |
| `src/sim/abilities/**`, `src/sim/data/abilities.ts` | Ability Systems (8) |
| `src/sim/heroes/<id>/**` and `src/sim/data/heroes/<id>.ts` for shrike, albatross, kingfisher, lyrebird (A1), hornbill, flamingo, penguin, puffin (A2), peacock, vulture, swift, hummingbird (A3) | Hero Engineer A (9) |
| the same paths for owl, pelican, secretarybird, starling (B1), cassowary, toucan, woodpecker, nightjar (B2), frigatebird, cockatoo, swan, kiwi (B3) | Hero Engineer B (10) |
| `src/sim/economy/**`, `src/sim/items/**`, `src/sim/data/{economy,items}.ts` | Economy & Items (11) |
| `src/sim/world/**` except `world/map/`, `src/sim/data/world.ts` | Objectives (12) |
| `src/sim/world/map/**` | Level Designer (13) |
| `src/sim/ai/**`, `src/sim/data/ai.ts` | Bot AI (14) |
| `src/client/render/models/**`, `src/client/render/rigs/**` | Technical Artist (15) |
| `src/client/render/**` (everything else), `src/client/vfx/**` | Rendering & VFX (16) |
| `src/client/ui/**` | UI/HUD (17) |
| `src/client/audio/**` | Audio (18) |
| all of `src/sim/data/**` from W7, `docs/BALANCE.md`, `tools/balance/**` | Balance & Data (19) |
| `tests/**`, `e2e/**` | QA, Performance & Review (20) |
| `src/**/*.test.ts` next to code | the owner of that code |

W1 exceptions: the Architect creates a compiling stub entry module in every area so the composition roots never
need editing again; each stub then belongs to its area's owner. Build creates the first `e2e/smoke.spec.ts`; QA owns
`e2e/` from W2.

## Plan

Waves run 3–7 agents at once. A wave starts when the previous wave's integration branch is on `main`.
Tests: QA writes the rules suites one wave ahead of the implementer for the rules-heavy sim systems; everywhere else
tests ship with the code (D-EP-006). Each wave ends with a QA/Review gate on `integrate/w<N>` (D-EP-007).

### M0 — Foundations

- **W1** (main checkout): Game Director → GDD · Technical Architect → core, contracts, composition roots, stubs,
  ARCHITECTURE and INTERFACES · Build & Tooling → toolchain, headless sim CLI, screenshot harness, `check.sh`
- **W2** (worktrees; M1 systems start here too): Level Designer → map data, lanes, nav graph · Rendering & VFX →
  lit scene, fog, blockout renderer, quality presets · QA → determinism test, ability sandbox helper, damage-pipeline
  contract tests, e2e smoke, tests-first rules suites for W3 · Character Controller · Combat · Ability Systems

Gate M0:
- [ ] GDD, ARCHITECTURE and INTERFACES written
- [ ] `npm start` opens a lit 3D blockout of the map
- [ ] Headless sim runs (`npm run sim -- --seed 1 --minutes 3 --bots 12`)
- [ ] `npm run check` passes
- [ ] Launchable: `npm start` shows the lit map behind the menu; PLAYABLE.md "Stage 1 (M0)" written

### M1 — One bird in a lane

- **W2** (above): Character Controller → walk, sprint, jump, dash, dash-jump, slide, mantle, stamina, updrafts,
  knockback, layers · Combat → guns, projectiles, head/body hitboxes, falloff, ammo and reload, damage types and
  resists, statuses, melee/heavy/parry · Ability Systems → data-driven abilities, charges, channels, AP, upgrade
  tiers, ultimate unlock
- **W3**: Camera & Input · Technical Artist (Hero A birds, fledglings) · Hero Engineer A (shrike, albatross,
  kingfisher, lyrebird) · Rendering & VFX (tracers, impacts, beak-shot flash, ability VFX) · Objectives (fledgling
  waves; marching and fighting) · Economy & Items (seed pods: drop, secure, deny) · QA

Gate M1:
- [ ] Player runs, dashes, slides, mantles and rides updrafts
- [ ] Shoots with working beak shots
- [ ] Uses 4 abilities
- [ ] Fledglings march and fight
- [ ] Pods can be secured and denied
- [ ] Launchable: from the menu you can drop into a lane as a hero and do all of the above; PLAYABLE.md "Stage 2 (M1)"
  written

### M2 — The loop

- **W4**: Economy & Items (seeds, levels, AP, molts, flex slots, shop, item effects, first items) · Objectives
  (Hawk, Heron, Wardens, Shrines, 2-phase Patron, Brood Ward, win condition) · UI/HUD (HUD, minimap and pings, Hoard
  shop, scoreboard, kill feed, damage numbers) · Audio · Hero Engineer B, batch B1 (owl, pelican, secretarybird,
  starling) · Hero Engineer A, batch A2 (hornbill, flamingo, penguin, puffin) · Technical Artist (B1 and A2 birds,
  structures, Patrons) · QA

Gate M2:
- [ ] Seeds, levels, AP and the shop work
- [ ] All structures and the 2-phase Patron work, so a match can be won by hand
- [ ] HUD, minimap and audio done
- [ ] Launchable: a full match against the structures can be started from the menu; PLAYABLE.md "Stage 3 (M2)"
  written

### M3 — Full 6v6

- **W5**: Bot AI · Objectives (Golden Egg, Roc and Phoenix Ember, Thickets, Nests, Feather runes) · Economy & Items
  (48+ items, about 10 actives) · Hero Engineer A, batch A3 (peacock, vulture, swift, hummingbird) · Hero Engineer B,
  batch B2 (cassowary, toucan, woodpecker, nightjar) · Technical Artist (A3 and B2 birds) · QA
- **W6**: Level Designer (verticality pass, bot navigation) · Hero Engineer B, batch B3 (frigatebird, cockatoo, swan,
  kiwi) · Technical Artist (B3 birds) · Bot AI (build lists and tuning for all 24) · Hero polish (fixes from earlier
  reviews) · QA (20 seeded headless matches, soak)

Gate M3:
- [ ] All 24 heroes and 48+ items
- [ ] Golden Egg, Roc/Ember, Thickets and runes work
- [ ] 11 bots finish 20 seeded headless matches with zero crashes
- [ ] Launchable: a 1 + 11 bots match with any of the 24 heroes starts from the menu; PLAYABLE.md "Stage 4 (M3)" written

### M4 — Balance and polish

- **W7**: Balance & Data (100+ headless matches per iteration) · Technical Artist (animation polish) · Rendering &
  VFX (juice, post-fx, instancing and LOD, FPS) · Audio (polish, adaptive music) · UI/HUD (main menu, hero select,
  settings, pause, end-of-match stats) · QA (FPS budget, 30-minute soak, screenshot review) · Game Director (feel
  review)

Gate M4:
- [ ] Matches last 25–40 min; every hero wins 40–60%; every item gets bought; no runaway snowball
- [ ] 60 FPS budget met with 12 heroes, ~150 fledglings and all structures
- [ ] Menus, settings and end screen done
- [ ] Juice: hitstop, shake, hit markers, kill confirms
- [ ] Launchable: the polished game from the menu; PLAYABLE.md "Stage 5 (M4)" written

### M5 — Release candidate

- **W8**: Build & Tooling (clean-clone run, `build:single` file:// check, README) · QA (sign-off) · Game Director
  (final fidelity review)

Gate M5:
- [ ] `npm install && npm start` opens the main menu on a clean clone
- [ ] `dist/perch.html` runs offline from file:// in Chrome, Edge and Firefox
- [ ] README: install paragraph, controls, hero and item guide
- [ ] Zero failing tests; QA/Review signs off
- [ ] PLAYABLE.md "Stage 6 (M5)" written, including how to run `dist/perch.html`

## Open requests (EP-maintained)

| From | To | Request | Scheduled |
|---|---|---|---|
| Architect | Build | Print `hash()` on the single-run `npm run sim` line | next Build task |
| Director | Level Designer | GDD §6.3 coordinates are binding | W2 brief |
| Director | Technical Artist | 40 m line-up screenshot of all 24 heroes | M3 (W6) |
| Architect | Level Designer, UI | Axes: x = east, z = north; a north-up top-down view shows east on the left (D-ARCH-008) | W2 brief; W4 UI brief |

## Log

Append your entry below this line. Template:

```
### W<n> · <Role> · <dd/mm/yyyy>
**Done:** …
**Verified:** commands run and what they printed
**Blocked:** …
**Interface requests:** <owner> — <request>
**Next:** …
```

### W1 · Build & Tooling · 18/11/2026
**Done:** package.json and lockfile (exact pins: three 0.187.0, rapier3d-compat 0.21.0, vite 8.3.8, vitest 5.1.1,
eslint 10.15.0 + typescript-eslint 8.73.0, @playwright/test 1.65.1, vite-plugin-singlefile 2.3.4, tsx 4.23.15,
typescript 6.0.3, @types/node 22.20.5); tsconfig.base/sim/client/node.json with a solution tsconfig.json; eslint.config.js;
vite.config.ts (also holds the Vitest config); playwright.config.ts; index.html; .gitignore; tools/browser.ts,
tools/sim.ts, tools/shots.ts; scripts/check.sh; the first e2e/smoke.spec.ts. Decisions D-BUILD-001…008.
Scripts: start, dev, build, build:single, preview, typecheck, lint, test, sim, shots, e2e, check.
**Verified:** in a fresh copy after `npm ci` (145 packages, 10 s): `npm run typecheck` exit 0; `npm run lint` exit 0,
no warnings; `npm test` 35 passed; `npm run build` and `npm run build:single` built (dist/perch.html 586 kB; Rapier
isn't imported yet, a three + Rapier test page built to 4.9 MB and rendered from file:// too); `npm run shots --
--scene menu --file dist/perch.html` showed the menu over the WebGL arena from file:// in headless Edge;
`npm run sim -- --seed 1 --minutes 3 --bots 12` twice gave byte-identical telemetry (`diff` clean); `npm run shots --
--scene menu` saved out/shots/menu.png in 1.1 s, looked at; `npm run check` printed PASS for all five steps, 13 s in
total. Also: 8 shots and 3 e2e runs at once all pass; a 20-match batch (`--matches 20 --parallel 8`) completed;
crashes are counted and exit 1; a page that never sets `__perch.ready` fails after 60 s with the URL in the message.
**Blocked:** nothing.
**Interface requests:** none.
**Next:** notes for every role:
- In a worktree: `npm ci --prefer-offline --no-audit --no-fund` once, then `npm run shots -- --scene <name> [--cam …]`.
  Each run serves that checkout on its own free port; PNGs go to that checkout's out/shots/.
- `npm run check` needs bash: run it from Git Bash on Windows.
- src/sim compiles with no DOM, no Node and no `console`. noUncheckedIndexedAccess is on everywhere.
- Magic numbers warn in src/ outside src/sim/data/; map coordinates in src/sim/world/map/ will warn too. The EP
  decides whether map data gets the src/sim/data/ exemption.
- Ask Build & Tooling for any new dependency.

### W1 · Game Director · 18/11/2026
**Done:** docs/GDD.md written in full (16 sections + Appendix A, ~2,100 lines). 24 heroes per D-EP-015 (8 archetypes ×
3), each with silhouette/colour notes, body plan with head hitbox, base stats, gun and 4 abilities × 3 upgrade
tiers with numbers; 40 m silhouette check (§9.24.1). Effect-primitive list §9.25 (19 primitives) covers every
ability and active. 48 items (12 per tier, 16 per category, 11 actives). Map brief with a dimensioned ASCII sketch
and coordinate table. Bot difficulties and a build list + AP priority for all 24 heroes. Decisions D-DIR-001…006.
**Verified:** `grep -nE "TBD|TODO|\?\?\?" docs/GDD.md` → no output; `grep -ni deadlock docs/GDD.md` → line 23 (§1,
one sentence) and lines in Appendix A only; node checks: 48 item rows (12 per tier), every build-list id exists,
components precede upgrades, all 48 items used by some build list; all 24 hero sections have 4 ability rows of 10
cells with T1–T3.
**Blocked:** nothing.
**Interface requests:** Technical Architect — contract vocabulary from GDD §5.2 (pipeline order), §5.9 (statuses incl.
Undying, Marked, Carried, Egg carrier), §9.25 (effect primitives incl. tether, attach, movementMode, trigger) and the
§11.1 vision rule as a shared sim service. Level Designer — GDD §6 is the brief; coordinates in §6.3 are binding,
art is free. Character Controller — movement values §3, plus ability movement modes glide / flight / hover / cling /
toboggan / burrow. EP — 40 m silhouette line-up screenshot at M3 (§16) for the Technical Artist; Balance owns all
(assumed) values in D-DIR-003.
**Next:** answer design questions from W2 roles; feel review at the M1 gate with the §16 checklist.

### W1 · Technical Architect · 18/11/2026
**Done:** sim core (`src/sim/core`: fixed 60 Hz phases, sfc32 RNG with named streams, FIFO event bus with a per-step
log, entity store, XZ spatial hash, state hash, the stat model, effect router, aim model, view builder, telemetry,
`canSee`) with unit tests; every contract in `src/sim/core/contracts/`, reconciled with GDD §4, §5.2, §5.9, §6.3,
§9.0.1, §9.25 and §11.1; `createSim`, the `Sim` API and `allBotRoster`/`humanRoster` in `src/sim/index.ts`; the
registry for all 24 heroes; compiling stubs for physics, combat, abilities, items, economy, world, world/map ('arena'
plus a placeholder 'main'), ai (with `pickBotHero`), 24 hero modules with placeholder data, and client input, camera,
render, render/models, vfx, ui and audio; client boot, state machine, fixed-step loop with interpolation, settings
store and `?scene=` router; docs/ARCHITECTURE.md and docs/INTERFACES.md (responsibility matrix, change process);
D-ARCH-001…010.
**Verified:** `npm run check` → PASS typecheck, lint, test (37 tests), sim, e2e. Two `createSim` runs, seed 1, 12 bots,
10,800 ticks → both hash `abb9604b6877d8eb` with identical picks. `npm run shots -- --scene menu`, `--scene match
--hero owl`, `--scene sandbox --hero albatross`, `--scene blockout` → PNGs looked at (menu over a lit ground plane;
third-person view with the hero left of centre). Core overhead with 162 entities and 150 spatial queries per tick:
0.087 ms per tick. Rapier compat `init()` works under tsx.
**Blocked:** nothing.
**Interface requests:** Build & Tooling — print `hash` in the single-run `npm run sim` line, so "two runs print the
same hash" is visible without a script. Game Director — the GDD's x = east with z = north puts east on the left of a
north-up top-down view (D-ARCH-008); say so in GDD §6 or relabel. Level Designer — replace the placeholder 'main' in
`src/sim/world/map/index.ts`, author data under `world/map/data/` (D-BUILD-009), keep `loadMap(id)` and 'arena'.
**Next:** W2 engineers: read docs/INTERFACES.md first. Register your effect kinds with
`ctx.effects.handle(kind, '<system>', handler)`; initialise your components in an `entity.spawned` handler; keep private
state in your factory closure and fold it into `System.hash`; draw randomness only from your own `ctx.rng.stream`.
Combat: shared statuses go in `src/sim/data/combat.ts`; report pod hits through `projectile.impact` and `melee`. QA:
the ability sandbox is `createSim({ map: 'arena', options: { unlockAbilities: true } })` plus commands; tests may use
`sim.ctx`, the client may not. Contract changes are interface requests and land between waves.

### W2 · QA, Performance & Review · 18/11/2026
**Done:** `tests/determinism.test.ts` (seed 1, `humanRoster` 6v6 on 'main': a scripted human that walks, jumps,
dashes, fires, melees, parries, casts all four, upgrades and pings, plus 11 bots; two sims in lockstep for 3 sim
minutes, `hash()` and an event-stream digest compared every 10 s, then telemetry and view; seed 2 runs a minute
without crashing and differs). `tests/helpers/sandbox.ts` (place heroes and dummies, aim through a point or a
head/body, hold/press/fire/cast/upgrade, step/stepUntil, events, health, statuses, effects with a built cause,
test-only stat sources) with its own test, `tests/helpers/lanes.ts` with tests, `tests/README.md` with a worked
example. Pending suites (`describe.runIf(PERCH_PENDING === '1')`, every assertion cites its GDD section):
`tests/contracts/damage.test.ts` 23 tests / 73 expect sites, `tests/rules/pods.test.ts` 11 / 41,
`tests/rules/fledglings.test.ts` 11 / 45. `e2e/scenes.spec.ts`: every scene in the router's `SCENES` loads, reaches
`__perch.ready` with the right scene and logs no console or page errors; each run saves 1920×1080 review shots to
`out/shots/review/`. Decisions D-QA-001…005.
**Verified:** `npm run check` → PASS typecheck, lint, test (44 passed, 45 skipped), sim, e2e (6 passed), 33 s.
`PERCH_PENDING=1 npx vitest run tests` → 45 failed / 7 passed, all 45 failures `AssertionError` from missing
implementation (e.g. "expected 550 to be close to 450", "a wave.spawned event: expected null not to be null", "a pod
pickup after the kill: expected undefined to be defined"). The README example compiled and ran (fails for missing
abilities, as it should). Looked at all five review PNGs: menu (title over the dark arena), blockout (ground plane
only), sandbox, lane and match (placeholder hero box left of centre over the shoulder; lane and match show the other
heroes on the horizon).
**Review of wave 1 (main 0afec69):** no cross-ownership edits, no purity breaches (lint clean; no `Math.random`,
clocks or `console` in src/sim; the client never touches `sim.ctx`). Findings, none blocking:
- *Architect:* src/sim/core/spatial.ts:33-37 allocates five new arrays every rebuild although :14 says they are
  reused (per-tick garbage in the hot path). src/sim/core/store.ts:23 rebuilds the whole live list after every
  spawn or despawn, O(n) per mid-tick spawn once projectiles pool. src/sim/index.ts:211 decides a command is stale by
  object identity, so a bot that reuses its command object loses its presses; undocumented, and Bot AI must know
  (W5); :216, :249 and :251 allocate per hero per tick. src/sim/index.ts:213-214 don't sanitise commands: NaN
  yaw or pitch (`clampPitch(NaN)` is NaN) or axes beyond ±1 enter the sim. src/sim/core/rng.ts:44 folds the seed to
  32 bits while createSim accepts any safe integer, so seeds differing above bit 31 play the same match.
  src/sim/core/telemetry.ts:92-93 counts gunHits on heroes only but beakShots on everything (decoys, Owl's ability),
  skewing beak-shot %. The `EntityDiedEvent.assisters` TSDoc (contracts/events.ts) omits the heal/shield/buff assist
  that GDD §8.3 and INTERFACES §6.4 include. No unit tests for core/view.ts, core/vision.ts or core/math.ts.
- *Build:* eslint.config.js:16 runs no-magic-numbers with `detectObjects` off, so numbers inside object literals are
  never flagged anywhere in src (the ARENA literal passes clean).
- *Level Designer (inherited stub):* src/sim/world/map/index.ts:22-71 keeps authored coordinates in the logic file,
  not world/map/data/ (D-BUILD-009); there are no map tests (at least TEAM_SIZE spawns per team, the mirror rule).
- *Rendering:* the stub renderer draws only the ground (blockout shows no lanes or base pads); W2 replaces it.
**Blocked:** nothing.
**Interface requests:** Architect — (1) `ProjectileImpactEvent` needs the shot's kind (`via`, or ProjectileInfo's
`source`): Economy must ignore ability projectiles passing through pods (GDD §8.2 "abilities don't"); emitter Combat,
consumer Economy. (2) The `DamageBonus.mult` TSDoc should say how it combines in step 4; GDD §5.2 says additive within
the step, and damage.test.ts reads ×1.5 as +50% (D-QA-004). (3) Document `DamageAppliedEvent.pos` (hit point or
target position). (4) Say in command.ts that bots must write a fresh `PlayerCommand` object every tick.
**Next:** at the W2 gate, run the damage suite on `integrate/w2` with `PERCH_PENDING=1` and flip it to always-on (drop
the `runIf`) once it passes; pods and fledglings likewise at W3. Hero Engineers write smoke tests with
`tests/helpers/sandbox.ts` (see tests/README.md). The 20-minute fledgling composition test is slow by design: keep it
pending-only or move it to the soak run when flipping that suite.
### W2 · Rendering & VFX · 18/11/2026
**Done:** the render core in `src/client/render/`: `index.ts` (Renderer: sun with soft PCF shadows fitted to the view,
hemisphere light, exp² fog, equirect sky gradient peach over Dawn / violet over Dusk, Neutral tone mapping, quality
presets switchable live), `blockout.ts` (MapData → one mesh per material group, lane ribbons in lane accent colours,
Updraft cables + stations, Chimney shafts, Vines, shop rings + canopies, structure-anchor placeholders, forest
backdrop), `entities.ts` (model per entity, pooled, interpolated), `palette.ts` (exports `TEAM_COLOURS`,
`DAWN_COLOURS`, `DUSK_COLOURS`, GDD §14 colours), `constants.ts`, `fixture.ts` (test map), two test files.
D-RENDER-001…005. VFX stub untouched.
**Verified:** `npm run check` → PASS typecheck, lint (no warnings), test (45), sim, e2e (no console errors).
`npm run shots -- --scene menu`, `--scene blockout --cam overview|top`, `--quality low|high`, and the fixture through
`?renderFixture` (overview, top, low/medium/high, street level), looked at. Live switch high→low→medium→high: one
canvas, no console errors. Draw calls / triangles (overview, `renderer.info`, shadow pass included): fixture 12 /
22.5k (low), 17 / 34.0k (medium, high); placeholder 8 / 11.1k (low), 11 / 11.2k (medium); menu (arena) 6 / 11.0k.
`npm run build` contains none of the dev hooks.
**Blocked:** nothing.
**Interface requests:** Architect — `sceneConfig` runs 'arena' behind the menu; use 'main' with no roster so the menu
shows the real map (D-EP-017). UI — the menu panel's rgba(12,14,18,0.78) overlay hides most of the backdrop; lighten
it or darken only behind the buttons. Build — let `npm run shots` pass extra query parameters (e.g.
`--extra "renderFixture&renderCam=…"`) so fixture shots use the standard tool.
**Next:** Technical Artist: import team colours from `client/render/palette.ts`. Instanced fledglings: `create()`
returns a bare Object3D proxy, take an instance slot on its 'added' event, write the proxy's position/yaw (set by the
renderer before `pose()`) into the InstancedMesh in `pose()`, free the slot on 'removed'; add the InstancedMesh to
`model.parent` on first `pose()` (lifecycle in `entities.ts`). VFX (W3): get the scene from the render module, not
the contract. Not measured: FPS on an iGPU (headless runs are not representative).
