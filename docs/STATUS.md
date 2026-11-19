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
### W2 · Combat · 18/11/2026
**Done:** `src/sim/combat/` replaces the stub: guns (fire rate with exact fractional cadence, aim point from
`core/aim.ts` plus world raycast and own hitboxes, muzzle-to-aim-point shots, seeded cone spread from
`rng.stream('combat')`, pellets, hitscan and pooled projectile bullets, falloff, max range, ammo, magazine and
per-round reload, reload-cancel, auto-reload); hitboxes (head sphere and body capsule from BodyPlan with crouch,
decoys use their owner's, unit capsules, structure cylinders, Patron weak point, pods and the Ember); the full GDD
§5.2 pipeline in the damage phase (base with missing-HP part, falloff, beak shot with bonus and flat, outgoing %,
capped amp, stacked resist minus shred clamped, structure rules and Brood Ward, typed shields then barriers, undying,
onLethal, execute), lifesteal, `damage.applied`/`heal.applied`, kill credit through summons and projectiles, 12 s
assists, `entity.died`, hero death, respawn timer with the Ember and `hero.respawned` at the Home Roost, the 4 s
combat state, the level-up heal; light/heavy melee and parry with `melee`/`parry` events; all §5.9 statuses with
their stacking, DoTs, cleanse, regeneration, onExpire, endsOnAttack (fire, melee, casting), status resist and ability
duration; the eight combat effect kinds; pods hit by bullets and melee. Shared statuses and tuning in
`src/sim/data/combat.ts`. Decisions D-COMBAT-001…008.
**Verified:** `npm run check` → PASS typecheck, lint, test (112 tests, 74 in src/sim/combat), sim, e2e (40 s). Tests
use a hand-built SimContext with fixture heroes carrying GDD §9 guns (Kingfisher hitscan pistol, Albatross 8-pellet
shell-loader, Shrike 180 m/s projectile rifle, Owl, Pelican, Lyrebird) and a fake AABB PhysicsService, plus two
`createSim` tests (a hit through the real composition root; equal `hash()` for equal seeds over 1,200 ticks of
firing, kills and respawns). Performance: 12 heroes firing continuously with 150 units in the spatial hash,
0.07–0.10 ms per tick for combat's three phases (including the spatial rebuild and flush); 0.02 ms idle.
**Blocked:** nothing.
**Interface requests:** Architect — (1) `WeaponDef`: `projectileRadius` (Lyrebird 0.25 m; all projectile guns use
0.06 m now), spin-up (Woodpecker 6→14 shots/s over 1.5 s), and the per-round start delay (Albatross 0.3 s; now one
combat constant). (2) `DamageEffect.beakShotMult` (Moonlit Mark ×1.5; now `COMBAT.abilityBeakShotMult`).
(3) `WeaponModEffect`: a shot count ("next 6 shots", Heavy Rounds). (4) TSDoc: UnitInfo says units can't be
beak-shot, but GDD §5.4 lets decoys be (implemented via the owner's BodyPlan); StatusDef says unstoppable blocks every
negative status, GDD lists only crowd control (D-COMBAT-004); INTERFACES §3 should note combat writes `pos` once at
respawn (D-COMBAT-002). Character Controller — handle `hero.respawned` by moving the controller to `pos`; melee
requests a `dash` (heavy lunge) and a `displace` push (heavy knockback).
**Next:** the Hero Engineers' weapon data replaces the fixtures; QA's `tests/contracts/damage.test.ts` meets the
pipeline at the merge.
### W2 · Ability Systems · 18/11/2026
**Done:** `src/sim/abilities/` replaces the stub: casting from the latched command (self, direction, unit with a 6°
cone and line of sight, point clamped to range on the ground), checks (stun, silence, egg, root/grounded for moving
casts), wind-up, `rooted`, channels with pulses, early end by re-press, interrupts, charges with the 0.4 s lockout,
cooldown reduction (cap 50%), `ability` start/land/end/interrupted events; AP from `hero.level`, tiers at 1/2/5 AP
with value/cooldown/charge/range/effect deltas, slot unlocks (ultimate at level 6, `unlockSlot`, the `unlockAbilities`
option), `ability.upgraded`; the effect kinds area (5 shapes; burst or lasting; point/source/target; moving with
carry; tick/enter/exit/cross), summon (trap, decoy, wall, turret, hook behaviours, maxCount), tether, delay,
cooldownMod (abilities, slot, items) and hook; hero hooks (onCast, onEffect, onTick); private state in the hash.
`src/sim/data/abilities.ts` holds the numbers. `validateKit` checks all 24 kits; fixture kits for Shrike, Lyrebird
and Kingfisher in `fixtures.test.ts`; `testkit.ts` runs the system alone with its own router. D-ABIL-001…006.
**Verified:** `npm run check` → PASS typecheck, lint, test (124 tests, 87 in src/sim/abilities), sim (103k ticks/s),
e2e. Perf test: 0.034–0.037 ms/tick for the abilities phase with 12 heroes casting and 35 areas+summons live
(0.12–0.13 ms at 96 live).
**Blocked:** nothing.
**Interface requests:** Architect — a first-class way to target the caster from any cast (`onCaster` is the
stopgap); Magnitudes for DamageBonus.targetHpBelow, DamageEffect.missingHpPct and executeBelow (tiers raise them);
SummonEffect end effects (death or expiry bursts) and a direction spread for several summons; a wall's size on
UnitInfo so combat and physics can block shots with it; a tether event or view entry so the client can draw links.
Architect + Character Controller — DisplaceEffect.onWall effects (Impaling Bolt, Stomp Kick, Rogue Wave wall stuns);
Motor (or a condition) saying when a movement mode forbids abilities (Burrow, Toboggan); dash/teleport mover and
destination per D-ABIL-001. Combat — AREA_TICK_S in data/abilities.ts mirrors your 0.5 s tick; merge them.
**Next:** Hero Engineers run `npx vitest run src/sim/abilities/kit.test.ts` after each kit edit; the patterns in
D-ABIL-006 and `fixtures.test.ts` show how GDD tiers become data.
### W2 · Character Controller · 18/11/2026
**Done:** `src/sim/physics/` (rapier.ts: worlds, colliders, queries; controller.ts: hero controller; effects.ts;
index.ts wiring) and `src/sim/data/movement.ts` (every GDD §3 number). Rapier static world from the map prims
(box, ramp, cylinder), structure colliders on spawn/despawn, hero capsules on Layer.Hero; PhysicsService raycast,
shapeCast, overlap, moveCharacter (Rapier controller for heroes: collide and slide, 0.45 m step-up, 45° slopes,
ground snap; cached ground for units) and groundHeight. Controller: walk, sprint, jump (coyote, buffer), air control,
crouch, slide (slopes, steering, boost cooldown), dash, air dash, dash-jump, mantle, stamina, Updrafts (station and
jump-in mount, ride, boost, dismounts, forced dismounts, cast dismount), Chimneys, Vines, knockback/knock-up state,
bounds and kill plane, reseat on `hero.respawned`. Effects: displace, dash, teleport, movementMode (all six), attach.
`motor` and `movement` events written; private state folded into `System.hash`. D-CTRL-001…007.
**Verified:** `npm run check` → PASS typecheck, lint, test (13 files, 76 tests; physics 2 files, 39), sim, e2e. Physics tests
assert GDD §3 numbers with stated tolerances: 7.0 m/s in 0.15 s and stop in 0.2 s; sprint +2, crouch 3.5, slow floor
1.5; apex 1.6 ± 0.05 m; dash 5.5 m in 12 ticks, 1 pip, 0.4 s lockout; air dash 4.5 m, once; pip every 5.0 s;
dash-jump 13/7 m/s, 7.3 ± 0.15 m leap, clears an 8 m gap in coyote time; slide 9 m/s, 1.0 s ± 1 tick, faster on an
11° slope; mantle 2.2 m in 21 ticks, never 2.6 m even jumping; Updraft 0.3 s mount, 11 → 18 m/s, 12 s cooldown,
3 s damage lock, dismounts; Chimney 9 m/s, exit +6; Vine 4.5 m/s, shimmy 2 m/s; every effect kind; no tunnelling
through 0.1 m walls (dash, 40 m push, 30 m/s fall); identical hashes from identical runs (1 and 12 heroes).
**Performance:** city fixture (≈950 prims), 12 heroes running, jumping, dashing and sliding: 0.238 ms per whole tick
(core and W1 stubs included; core alone was ~0.06–0.09 ms in W1); 150 units through moveCharacter: 0.080 ms per tick
on fresh ground. Physics share ≈ 0.25 ms. `npm run sim` 3 min: 5,064 ticks/s, telemetry byte-identical across runs.
**Blocked:** nothing.
**Interface requests:** Architect — (1) displacement and dashes on units: physics may not write unit `pos`; either
world applies them or physics gets that right; (2) GDD §3.9 wall slam has no hook: `DisplaceEffect.onWallSlam` or a
`movement` action; (3) a `movement` action 'displaced' so abilities can cancel channels (GDD §3.9); (4)
MovementModeEffect `allowGun`/`allowAbilities` are invisible to combat and abilities: expose them on `Motor` (until
then, pair modes with disarm/silence statuses in data); (5) teleport `face: 'target'` sets `yaw`, but core re-latches
yaw from the command next tick, so input and ai need a way to adopt it; (6) 'wall' summons have no shape for a
collider: add `size` to UnitInfo or a service call; (7) ARCHITECTURE §4.6 "one world.step() per tick" → D-CTRL-001.
Objectives — move fledglings with `ctx.physics.moveCharacter` (cheap path); `groundHeight` is an exact raycast.
Game Director — GDD §3.4 "~8–9 m leap": the numbers give 7.3 m on flat ground; 8 m+ needs coyote time (tested).
**Next:** QA can drive the controller through `createSim` + commands; fixture maps via `vi.mock('../world/map')` as in
src/sim/physics/controller.test.ts. The real 'main' map needs no physics change.
### W2 · Level Designer · 18/11/2026
**Done:** the real 'main' map ("Old Mossmarket") in `src/sim/world/map/`: `data/main.ts` authors the Dawn half and the
z = 0 strip (every GDD §6.3 coordinate as written), `data/kit.ts` builders, `data/traversal.ts` GDD §3 reach,
`build.ts` (mirror, climbs, Updrafts, derived ledges, generated nav graph), `geometry.ts` (prim queries), `svg.ts`
(`mapSvg`, a top-down SVG, re-exported from `world/map` for the minimap). Three lanes with terraces and 4 m
balconies (Hedgerow), river, market square and mills (Riverbank), stilt platforms at 6 and 10 m with a rope walkway
(Pinewood); 12 Chimneys, 22 Vines (+2 on z = 0), 230 ledges, 16 Thicket yards, 32 Nests, both Egg plazas with ramps
for the Egg carrier, rune footbridges, the Hollow (octagon, two ramps, bridge piers), spawns, shops, every structure,
38 bot spots. 590 prims. Nav: 891 nodes, 3,662 links (walk, drop, mantle, jump, dashJump, chimney, vine, updraft).
Decisions D-LEVEL-001…004. 'arena' unchanged.
**Verified:** `npm run check` → PASS typecheck, lint, test (12 files, 72 tests), sim, e2e (43 s). 36 map tests in
`main.test.ts`: prim budget, load time, z-mirror of prims, anchors, lanes, Updrafts, climbs, ledges and the whole nav
graph; x-mirror of structures, camps and side stalls; every §6.3 anchor for both flocks; lanes on walkable ground
gate to gate (centre and ±1 m); Updrafts clear 3 m under / 1 m over; structure footprints clear; ledges in mantle
reach; ramps ≤ 45°; climbs 8–14 m / 5–12 m; cover within 12.5 m everywhere but the market squares and the Hollow;
nav reachable both ways from both spawns, a node at every named point, a walk-only route between the Egg Perches.
`loadMap('main')` in a fresh Node process: 30 ms; first `map.nav` access +77 ms; warm map + nav 36 ms (shared,
loaded machine). SVGs rendered to PNG with headless Edge (`out/map/full.png`, `out/map/base.png`) and looked at.
`npm run shots -- --scene blockout` still shows only the W1 stub's ground plane (Rendering replaces it this wave).
**Blocked:** nothing.
**Interface requests:** none to the contracts. Notes for owners — Character Controller: Updraft stations sit on the
line 12 m up, so measure "E within 2 m of a station" horizontally; Chimneys and Vines follow D-LEVEL-004.
Objectives (W3): every Hawk, Heron and Warden stands on the lane path (the outer side-lane Wardens 0.25 m from it),
so fledglings must steer round them. Technical Artist and Game Director: Herons (12 m) and Hawks (10 m column plus
statue) stand directly under the 12 m Updraft line; keep what's on the lane centre below ~9 m or move the line.
`MapData.nav` is a getter: the first read builds it (~40–75 ms).
**Next:** after the W2 merge, read the GDD §3 numbers from `src/sim/data/movement.ts` instead of
`data/traversal.ts`; W6 verticality pass (distinct east and west jungles, more rooftop routes) and bot-path tuning.
### W2 · Integration · 18/11/2026
**Done:** the five merge defects on `integrate/w2` (D-EP-018), one commit each:
1. *Real-physics shooting* (7729676, combat). Root cause: the test's line of fire. The first Dawn and Dusk arena
   spawns (x = −7.5, z = ∓15) face each other across the arena ramp (x −10…−6, z −3…3, 2 m); stub physics had no
   world, Rapier rightly stops the aim and muzzle rays on the ramp's slope. Not hero capsules (LAYERS_SOLID excludes
   Layer.Hero; proxies have no layer bits) and not settling. Fix: the test puts both heroes on x = 0.
2. *Sandbox aim test* (0fcf108, QA). Root cause: an idle grounded hero moves up to ~1e-4 m in y each tick under
   Rapier's character controller, and the test rebuilt the ray from the post-step feet. Fix: the check uses the
   feet aimAt aimed from, with the latched yaw/pitch, still to 1e-6 m. Helper unchanged.
3. *Damage suite* (9500456, QA). Falloff: Combat is right; Owl's 1° spread at 55 m reaches ±0.96 m, so a body-aimed
   bullet can truly hit the head (seen at y = 1.54). The check divides the beak multiplier out of beak shots (§5.2
   applies it after falloff) and still requires body hits. Unit death: `hit()` now treats a despawned target as hp 0.
   23/23, so the suite is always on (D-EP-006); pods and fledglings stay gated. tests/README.md updated.
4. *Menu map* (215c122, app + UI). The menu runs 'main' (no roster, waves or neutrals) under the overview camera;
   the menu panel darkens only a radial pool behind the title and Play, with a text shadow. app.test.ts expected
   'arena' and now expects 'main'.
5. *Tooling* (075d778, build). `npm run sim` prints `hash <hex>` on the single-run line; `npm run shots` takes
   repeatable `--param key=value` (bare `key` → `key=`).
**Verified:** `npm run check` → PASS typecheck 14 s, lint 8 s, test 15 s (313 passed, 22 skipped: pods and
fledglings), sim 6 s, e2e 21 s (6 passed); check 65 s. `npx vitest run tests/contracts/damage.test.ts` with no
PERCH_PENDING → 23 passed. `npm run sim -- --seed 1 --minutes 3 --bots 12` twice → hash 4acbedb035dce146 both
times, 3,416 and 3,262 ticks/s. Looked at `npm run shots -- --scene menu` (whole lit map, title and Play readable)
and `--scene blockout --cam overview`; `--param renderFixture --param renderCam=0,60,-120,0,0,0` showed the
fixture from the fixed camera.
**Blocked:** nothing.
**Interface requests:** none. Found, not fixed: Character Controller — idle grounded heroes jitter ~1e-4 m in y
every tick (Rapier contact tolerance), so `pos` never rests; Level Designer — the 'arena' ramp sits between the
first Dawn and Dusk spawns, a trap for any spawn-to-spawn test; Combat — a bullet counts as a beak shot if the head
sphere lies anywhere on its segment, even behind a body hit (matches GDD §5.4 "hits both"; Director to confirm);
EP — the "Print hash()" open request is done.
**Next:** QA gate review of `integrate/w2`.
### W2 · QA gate · 18/11/2026
**Verdict: APPROVE** (follow-ups for wave 3 below). No blocking defect.
**Evidence (integrate/w2):** `npm run check` → PASS typecheck 14 s, lint 12 s, test 17 s, sim 6 s, e2e 22 s, check 71 s.
`npm run sim -- --seed 1 --minutes 3 --bots 12` → 10,800 ticks in 3.6 s, **3,023 ticks/s = 0.33 ms/tick** against the
1 ms budget, hash 4acbedb035dce146 (same as the integration run). The bots are still stubs (Bot AI is W5), so this
is physics + combat + abilities + core only; the headroom is 0.67 ms for Economy, Objectives, AI and 24 kits.
Draw calls as Rendering reported (fixture 12–17, menu 6); not re-measured. Damage suite always on (23/23 in the
check). Pods and fledglings suites still `runIf(PENDING)` (tests/rules/pods.test.ts:106, fledglings.test.ts:131, :211,
:309). Looked at all five `out/shots/review/*.png` and `npm run shots -- --scene menu`: the menu shows the whole lit
map with title and Play readable; blockout is the lit overview; sandbox, lane and match are the placeholder hero box
at street level (match/lane camera sits inside the Home Roost: placeholder camera, W3 Camera & Input).
**Review:** (1) Ownership: the file list matches the ownership map; core, contracts, GDD untouched; DECISIONS and
STATUS are append-only; integration commits are the D-EP-018 exception. (2) Interfaces: no system imports another's
internals; combat and abilities import `heroes/registry` and `world/map` only in their testkit.ts (combat/testkit.ts:38-39,
abilities/testkit.ts:34-35); the client imports sim only through `index`, `core`, `data/core`, `heroes/registry` and
`world/map`. (3) Purity: no DOM, Node API, console, Math.random or clock in src/sim non-test code (grep, plus lint);
the only RNG use is `rng.stream('combat')` (combat/guns.ts:106, geometry.ts:78-80); Map and Set iteration is by
insertion order, sorts have numeric comparators. (4) Magic numbers: gameplay numbers are in src/sim/data; module
constants are named, a few weakly (`HALF`, `ARC`, `BITS`: physics/controller.ts:30-31, rapier.ts:29,37); object-literal
numbers are not linted (known, D-BUILD-009 / Build item). blockout.ts:340 has bare polygonOffset -2.
**Known issues classified:**
- Heroes never rest (~1e-4 m y per tick): **Medium, Character Controller.** Deterministic, so not a hash problem, but
  any "standing still" rule, stealth/idle test or dirty-flag on `pos` will misfire. Fix with a rest band in
  physics/controller.ts around the snap-down (rapier.ts:140-144, skin 0.02) before Camera & Input and Economy rely on it.
- Beak shot when the head lies behind a body hit: **Low, Combat + Director.** guns.ts:196-206 and hitboxes.ts:95-135
  follow GDD §5.4 literally ("hits both counts"); the brief asks for first-hitbox-wins. Director decides; if changed,
  edit §5.4 first, then hitboxes.ts (test in damage suite).
- Arena ramp between first spawns: **Low, Level Designer.** world/map/index.ts:33; only trips spawn-to-spawn tests
  on 'arena'; move the ramp or the spawns.
**Follow-ups by owner:**
- *Architect:* the W1 findings stand (spatial.ts:33-37 per-rebuild arrays, index.ts:213-214 unsanitised NaN commands,
  rng.ts:44 32-bit seed fold); the interface requests logged by Combat, Abilities and Character Controller need the
  contract round (displace on units, onWallSlam, Motor allowGun/allowAbilities, wall size on UnitInfo).
- *Combat / Abilities:* merge `AREA_TICK_S` (data/abilities.ts) with Combat's 0.5 s tick; Combat's pipeline constants
  `MAX_OWNER_HOPS`, `RETURN_LIFE_MULT` (damage.ts:36, guns.ts:36) belong in data/combat.ts.
- *Rendering:* only blockout and entities have tests; none for quality presets or the draw-call budget. Add a
  renderer smoke test that asserts `renderer.info` stays under a named budget.
- *QA (me):* flip pods and fledglings suites when W3 lands; keep the 20-minute fledgling test out of `check`; add a
  perf budget test around `npm run sim` ms/tick once bots act.
- *Build:* detectObjects on in no-magic-numbers for src/sim outside data/.
**Process note:** one of my shell commands (an unquoted `echo ... >sim`) created a stray 12-byte `sim` file in the repo
root; the EP deleted it. Nothing under src/, tests/ or e2e/ was changed by this review.
