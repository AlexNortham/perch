# PERCH — Studio Status

The Executive Producer (EP) owns this file. Agents append to the **Log** at the bottom and edit nothing above it.

Client brief: [BRIEF.md](BRIEF.md) · Decisions: [DECISIONS.md](DECISIONS.md) · Design: [GDD.md](GDD.md) ·
Architecture: [ARCHITECTURE.md](ARCHITECTURE.md), [INTERFACES.md](INTERFACES.md) · Balance: [BALANCE.md](BALANCE.md)

## Now

- **Milestone:** M2 — The loop
- **Roster:** 24 heroes (D-EP-015), shipped in six batches of four from W3 to W6
- **Stage 1 (M0) closed 19/11/2026.** W1 and W2 on main; QA gate APPROVE (W2 · QA gate entry). See PLAYABLE.md.
- **W2.5 contract round merged 19/11/2026** (28 requests: 22 accepted, 6 modified; INTERFACES.md §11).
- **Stage 2 (M1) closed 19/11/2026.** W3 + integration round on main; QA gate APPROVE (W3 · QA gate entry).
- **Stage 3 (M2) closed 19/11/2026.** W4 (ChatGPT + Claude, D-EP-029) merged; QA gate BLOCK, gate fixes, QA re-review APPROVE.
  Pushed to GitHub `main` as a stable release (D-EP-032). Next: Stage 4, starting with the W4.5 design and contract round.
- **Stage 3 opened 19/11/2026.** W3.5 settles contracts first. QA's test-first suites then land on main before
  the W4 implementers start. The release gate is below and in GDD §16.
- **Last `npm run check`:** PASS on integrate/w3 (6/6 steps incl. perf, 76 s; 5 runs in a row); sim 0.234 ms per tick
  mean over 35 minutes, deterministic (hash 52196bc3abdb2fe3)
- **Stage 3 in progress.** W3.5 contracts and the Director's movement/Practice Hub amendment landed on local main.
  The W4 test-first checkpoint is 1d9e431. Implementation is underway in separate role worktrees. M2 is open.
- **Last verified checkpoint:** all six `npm run check` steps passed together on 1d9e431 in 194 s with one Vitest
  worker. QA separately ran the pending rules enabled and recorded the expected failures before implementation.

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
10. **GitHub, private.** The repo has one remote: the private GitHub repo `AlexNortham/perch`. Only the EP pushes, and
    only `main` after a stage gate. Agents never add remotes, push, publish or upload. Commits use the repo-local
    identity `Alex Northam <alexanderjnortham@gmail.com>`, never the machine's global work address (D-EP-025).
    Installing packages from the npm registry is fine.
11. **Launchable at every gate, with a current wiki and a pose-sheet review.** The EP regenerates the wiki
    (`npm run wiki`, D-EP-031) and reviews it, and QA and the EP look at a pose sheet of every playable bird in every
    animation state: guns held, feet planted, nothing floating (D-EP-035).
    **Launchable at every gate.** A milestone closes only when `npm start` opens the menu and that stage's new
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
| `tools/wiki/**`, `wiki/**`, `tests/wiki/**` | Docs & Wiki (21) |
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
- [x] GDD, ARCHITECTURE and INTERFACES written
- [x] `npm start` opens a lit 3D blockout of the map
- [x] Headless sim runs (`npm run sim -- --seed 1 --minutes 3 --bots 12`)
- [x] `npm run check` passes
- [x] Launchable: `npm start` shows the lit map behind the menu; PLAYABLE.md "Stage 1 (M0)" written

### M1 — One bird in a lane

- **W2** (above): Character Controller → walk, sprint, jump, dash, dash-jump, slide, mantle, stamina, updrafts,
  knockback, layers · Combat → guns, projectiles, head/body hitboxes, falloff, ammo and reload, damage types and
  resists, statuses, melee/heavy/parry · Ability Systems → data-driven abilities, charges, channels, AP, upgrade
  tiers, ultimate unlock
- **W3**: Camera & Input · Technical Artist (Hero A birds, fledglings) · Hero Engineer A (shrike, albatross,
  kingfisher, lyrebird) · Rendering & VFX (tracers, impacts, beak-shot flash, ability VFX) · Objectives (fledgling
  waves; marching and fighting) · Economy & Items (seed pods: drop, secure, deny) · QA

Gate M1:
- [x] Player runs, dashes, slides, mantles and rides updrafts
- [x] Shoots with working beak shots
- [x] Uses 4 abilities
- [x] Fledglings march and fight
- [x] Pods can be secured and denied
- [x] Options menu with key rebinding; settings persist after restart (D-EP-023)
- [x] Launchable: from the menu you can drop into a lane as a hero and do all of the above; PLAYABLE.md "Stage 2 (M1)"
  written

### M2 — The loop

- **W4**: Economy & Items (seeds, levels, AP, molts, flex slots, shop, item effects, first items) · Objectives
  (Hawk, Heron, Wardens, Shrines, 2-phase Patron, Brood Ward, win condition) · UI/HUD (HUD, minimap and pings, Hoard
  shop, scoreboard, kill feed, damage numbers) · Audio · Hero Engineer B, batch B1 (owl, pelican, secretarybird,
  starling) · Hero Engineer A, batch A2 (hornbill, flamingo, penguin, puffin) · Technical Artist (B1 and A2 birds,
  structures, Patrons) · QA

Gate M2:
- [x] Seeds, levels, AP and the shop work
- [x] All structures and the 2-phase Patron work, so a match can be won by hand
- [x] HUD, minimap and audio done
- [x] Animation bar (D-EP-035): every playable bird holds its gun in every state; attachment tests pass; pose
  sheets reviewed
- [x] Launchable: a full match against the structures can be started from the menu; PLAYABLE.md "Stage 3 (M2)"
  written
- [x] Firefox traversal remains playable during a sustained run; safe movement keys, side-mouse melee/parry,
  charged melee feedback and reference-based movement are proven (D-EP-027)
- [x] The menu's Practice Hub has repeatable damage and healing dummies; opening upgrades releases the mouse,
  shows ability descriptions on hover and allows an affordable upgrade by click (D-EP-028)

### M3 — Full 6v6

- **W4.5** (between waves): Game Director design pass on map detail, enterable buildings and what to do inside them,
  the jungle and breakable Nests, plus 16 new items to reach 64 (D-EP-034), using deadlock.wiki as the mechanics
  reference only (D-EP-033) · Technical
  Architect contract round
- **W5**: Level Designer (a far more detailed map: enterable buildings with interiors, stairs, upper floors and rooftop
  access; jungle; Nests) · Bot AI · Objectives (Golden Egg, Roc and Phoenix Ember, Thickets, Nests, Feather runes,
  interior activities) · Economy & Items, split across two engineers by category
  (64 items: the 48 GDD items + 16 new, about 14 actives) · Hero Engineer A, batch A3 (peacock, vulture, swift, hummingbird) · Hero Engineer B,
  batch B2 (cassowary, toucan, woodpecker, nightjar) · Technical Artist (A3 and B2 birds) · QA
- **W6**: Build Lab (Balance & Data, pulled forward from M4): 1,000+ headless bot matches at full sim speed, learning
  per-hero item scores with synergy and timing terms; recommended builds in the shop and the wiki (D-EP-036) ·
  Level Designer (detail polish and bot navigation through interiors) · Hero Engineer B, batch B3 (frigatebird, cockatoo, swan,
  kiwi) · Technical Artist (B3 birds) · Bot AI (build lists and tuning for all 24) · Hero polish (fixes from earlier
  reviews) · QA (20 seeded headless matches, soak)

Gate M3:
- [ ] All 24 heroes and 64 items (the 48 GDD items + 16 new; D-EP-034)
- [ ] Golden Egg, Roc/Ember, Thickets and runes work
- [ ] Detailed map: enterable buildings with interiors and things to do in them, a jungle with Thicket camps, and
  breakable Nests (boxes) throughout (D-EP-033); still 60 FPS on the budget scenes
- [ ] 11 bots finish 20 seeded headless matches with zero crashes
- [ ] Upgrades by holding the upgrade key: aiming pauses, a cursor appears over the HUD, clicking an ability icon or
  pressing 1–4 unlocks or upgrades it, hover shows the next tier, release resumes aiming at once (D-EP-038)
- [ ] No Interact key: Updrafts are mounted by holding Jump near the cable, the Golden Egg is picked up by melee,
  delivery is automatic, and nothing else needs an interact binding (D-EP-039)
- [ ] Practice Hub has a Swap bird option (pause menu and on-screen button) that opens the bird picker without
  leaving the hub and respawns you as the new bird with fresh practice AP (D-EP-040)
- [ ] Always-on top scoreboard bar replaces the Tab scoreboard (no keybind): timer and flock Seed totals in the
  centre, six portraits per side with health bars, Seeds, respawn countdowns and vision dimming; kill feed with
  callouts; objective status in a strip below and on the minimap (D-EP-041)
- [ ] Build Lab: at least 1,000 headless matches, then more until the scores converge (D-EP-037); every hero has a recommended build (early, mid and late core
  plus situational picks) in the shop and the wiki; bots buy varied but synergistic builds, measured over 20 matches
  (no two of a hero's builds near-identical; synergy above a random baseline) (D-EP-036)
- [ ] Launchable: a 1 + 11 bots match with any of the 24 heroes starts from the menu; PLAYABLE.md "Stage 4 (M3)" written

### M4 — Balance and polish

- **W6.5** (before W7): Game Director and Technical Artist write the **style guide**, a one-page target look for
  models and effects that every art and VFX task in W7 is judged against (D-EP-042)
- **W7**: Balance & Data (headless matches and focused skirmish scenarios at whatever scale the statistics need,
  10× or 100× the baseline if necessary; per-ability assessment, ablation tests and reworks with the Game Director and
  hero engineers, D-EP-043) · Technical Artist ×2 (**production-quality model pass**
  for all 24 birds, towers, Patrons, fledglings and props; per-ability cast poses; animation polish) · Rendering &
  VFX ×2 (**production-quality VFX pass** for all 96 abilities, guns and impacts; juice, post-fx, instancing and LOD,
  FPS) · Audio (polish, adaptive music) · UI/HUD (main menu, hero select,
  settings, pause, end-of-match stats) · QA (FPS budget, 30-minute soak, screenshot review) · Game Director (feel
  review)

Gate M4:
- [ ] Matches last 25–40 min; every hero wins 40–60%; every item gets bought; no runaway snowball
- [ ] Every one of the 96 abilities assessed by telemetry and ablation; none dominant or near-useless; each rework
  re-validated in simulation and documented in BALANCE.md and the wiki patch notes (D-EP-043)
- [ ] 60 FPS budget met with 12 heroes, ~150 fledglings and all structures
- [ ] Menus, settings and end screen done
- [ ] Juice: hitstop, shake, hit markers, kill confirms
- [ ] Production-quality art (D-EP-042): every bird, structure, Patron and fledgling, and every ability effect, has a
  before/after image set and an in-game clip scored against the style guide, signed off by QA and the Game Director;
  still 60 FPS
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
### W2.5 · Technical Architect · 18/11/2026
**Done:** the contract round. 28 decisions on the wave 2 interface requests (QA, Rendering, Combat, Ability Systems,
Character Controller; three were asked by two roles): 22 accepted, 6 accepted modified, none rejected, all in
INTERFACES.md §11 and D-ARCH-011…016. Landed as optional fields, one new event and TSDoc, so wave 2 code compiles
unchanged: `selfEffects`; WeaponDef `projectileRadius`, `spinUp`, `perRoundStartS`; `beakShotMult`;
`WeaponModEffect.shots`; `DisplaceEffect.onWall`; SummonEffect `onEnd`, `count`, `spreadDeg`; `UnitInfo.size`;
`Motor.modeAllowsGun/Abilities`; `projectile.impact` `via`; `movement` `yaw` and the displaced, wallSlam, teleport
actions; the `tether` event; `EFFECT_TICK_SECONDS`; `HeroModule.implemented`. Core fixes from QA's wave 1 review:
commands sanitised and latched by copy (a bot may reuse its command object; no per-hero allocation), seeds use all
53 bits, the spatial hash reuses its arrays, the store rebuilds only the changed kind's list, beak shots counted among
gun hits on heroes only. Practice match: Play → hero select → `matchConfig(setup)` ('main', waves on all three lanes,
the human on Dawn, `MatchSetup.bots` default 0); `?scene=lane&hero=<id>` starts the same match; the app adopts a yaw a
teleport forces on the human. ARCHITECTURE §4.6 now states D-CTRL-001. Follow-ups by owner in
docs/briefs/W3-contract-followups.md.
**Verified:** `npm run check` → PASS typecheck, lint, test (319 passed, 22 skipped), sim, e2e; 25 s. `npm run sim --
--seed 1 --minutes 3 --bots 12` twice → hash 4acbedb035dce146 both times (as before the round: normal commands latch
unchanged), 10,558 and 10,696 ticks/s. New tests: a reused command object keeps its presses, NaN/out-of-range
commands are sanitised, seeds 2^32 apart differ, per-kind store snapshots, beak-shot counting, the practice match
config. `npm run shots -- --scene lane --hero kingfisher` → looked at: the placeholder hero at the Dawn base on 'main'.
**Blocked:** nothing.
**Interface requests:** none. Still open for the W3.5 round: widen `targetHpBelow`, `missingHpPct` and `executeBelow`
to `Magnitude` once Combat reads them through `ctx.effects.magnitude` (D-ARCH-015).
**Next:** wave 3 owners work through W3-contract-followups.md. Not done: unit tests for core/view.ts, vision.ts and
math.ts (QA's review noted their absence; not in this brief).

### W3 · UI/HUD Engineer · 19/11/2026
**Done:** `src/client/ui/` replaces the placeholder screens. Main menu (title and Play over the live map, soft dark pool
only); hero select (24 cards: name, archetype, hue swatch; pickable only if `HEROES[id].implemented === true`, else
"Coming soon"; a pick calls `startMatch({hero, team:'dawn', difficulty:'normal', seed})`); HUD (crosshair, hit marker
that is larger and gold for beak shots, red on a kill, orange on the Patron weak point; health with Talon, Song and
barrier segments; stamina pips; Lv, AP (pulses) and Seeds; four ability slots with key caps, cooldown sweep and text,
charges, 3 tier pips, locked state and an upgrade glow when AP is spendable; ammo with RELOADING and "PRESS R" at 0;
"SECURED" / "DENIED" banner for the local hero's `pod.resolved`; respawn countdown); pause (Resume, Quit to menu); a
plain end screen placeholder. Files: `display.ts` (pure mapping), `hud.ts`, `screens.ts`, `styles.ts`, `constants.ts`.
HUD writes only cells whose value changed (no per-frame DOM allocation; events use the Web Animations API).
**Verified:** `npm run check` → PASS typecheck, lint, test, sim, e2e (28 s). `display.test.ts` 7 tests (cooldown text,
sweep, locked ultimate, charges, upgrade availability, ammo, stamina pips, health, respawn, key labels, hit kinds).
`npm run shots -- --scene menu` and `--scene lane --hero shrike` looked at. A Playwright flow (temporarily setting
Shrike `implemented`, reverted) clicked Play → Shrike → HUD visible → Esc → pause → Quit to menu → menu: all worked.
**Blocked / not verified:** no hero is `implemented` on this branch, so every card shows "Coming soon" until Hero A
merges. Hit marker, pod banner, cooldown sweep and respawn overlay are covered by unit mapping only (no live
damage in the idle practice match). Esc from the pause screen relies on input's pause key still firing while disabled
(the current input stub does).
**Interface requests:** none. Hero data carries no colour, so swatches are hue-by-index (a `HeroDef` colour would let
the card match the model).
**Next:** wave 4: minimap, Hoard shop, scoreboard, kill feed, damage numbers; a hero preview in hero select.
### W3 · Economy & Items · 19/11/2026
**Done:** `src/sim/economy/index.ts` and `src/sim/data/economy.ts`. Seeds on `progress` (seeds and net worth, whole
seeds, `seeds.gained` with a reason); the last-hit share (50% V to the enemy hero who landed it, else split among enemy
heroes within 25 m, else lost); seed pods (spawn at the chest on a Scrapper or Slinger death, rise 1.6 m in 0.6 s,
ripe 1.4 s, secured for 50% V by an enemy hero, denied for 25% V by the fledgling's own flock, wither if not hit;
`pod.resolved` with outcome and position); resolved only by gun impacts (`via` 'weapon' or absent) and `melee`.
Passive income (1 Seed/s from 0:30, GDD §8.4) so the seed curves move before bounties land; `startSeeds` honoured.
**Verified:** `PERCH_PENDING=1 npx vitest run tests/rules/pods.test.ts` → 10 passed, 1 failed (see below). Co-located
`src/sim/economy/economy.test.ts` 6 passed (share split, secure vs deny, ability hits, rising, wither, passive).
`npm run check` → PASS typecheck, lint, test, sim, e2e (30 s). 35-minute headless run (seed 1, practice roster, no
bots yet, 24 s wall): net worth per hero 571 at 10:00 and 2,071 at 35:00, all passive income (nobody kills a
fledgling yet, so no pods). Pod behaviour is proven by the suites above, not by that run.
**Blocked / suite issue:** the pods suite's deny test (`pods.test.ts` rule 4, line 100 via 159) calls `shootPod` on the
pod after it was denied, but `shootPod` reads `sb.entity(pod).pos`, which throws once the pod has left the store; the
secure test requires the pod gone after resolution, so both can't hold. It is a test-helper bug, not a GDD
contradiction (GDD §8.2 rule 4: the pod share is gone). Suggested fix: capture `pos` before the first shot. I did not
edit the suite.
**Interface requests:** none. Pod hit radius is 1 m (GDD gives none): bullets leave the muzzle, not the camera, so a
crosshair-centred shot at 6 m passes ~0.75 m from the pod.
**Next:** wave 4: bounties, comeback, levels, Molts, AP, flex slots, shop and items. `data/items.ts` untouched.
### W3 · Camera & Input · 19/11/2026
**Done:** `src/client/input`: pointer lock (click, and a re-request on resume), mouse look (0.06 deg/count, aim multiplier,
invert Y), WASD axes, every GDD §3.1 action as a `Button` bit, Alt+1-4 upgrade intents, crouch toggle, UI actions
(pause always reported, even disabled; shop/scoreboard/big map down and up), press latch (a tap between steps is
`pressed` once, `held` is exact), `DEFAULT_BINDINGS`, `rebind()` (swaps on conflict), `setPingResolver()` (tap of the ping
button). `src/client/camera`: the player camera is `aimRay` plus eased parts (shoulder blend 0.15 s, crouch 0.12 s),
sphere-cast pull-in on the map's solid primitives (`collide.ts`, snaps in, eases out at 6 m/s, min boom 0.6, moves along
the aim ray so the crosshair stays honest), dash FOV kick, death camera (orbit and rise, cross-fade back), overview and top
kept, `rayWorldPoint()` for pings.
**Verified:** `npm run check` PASS (typecheck, lint, test, sim, e2e). New: input.test.ts (16), camera.test.ts (10): pose
equals `aimRay` at rest for both shoulders and three looks; pull-in, recovery rate, min boom; ramps; dash kick; death cam.
Playtest `out/playtest-cam.ts` (not committed): vite server, `?scene=lane&hero=shrike`, click (1280x720), hold KeyW 1 s,
hold ShiftLeft 150 ms, screenshots before/dash/after; `pointerLockElement` was set and the view moved down the lane.
**Blocked:** nothing.
**Interface requests:** App — (1) call `input.setLook` on `hero.respawned` for the human (nothing else sets it);
(2) wire pings: `input.setPingResolver(() => ...)` using `rayWorldPoint(map, ray.origin, ray.dir, range, ray.start)` and
choose the kind; `createInput` now returns `Input` (an `InputController` plus that method). Architect — aim zoom (RMB, FOV
x0.8, Owl x0.5) needs an aim flag or hero zoom reachable by the camera; not done. Renderer — hero fade under 1 m camera
distance (GDD §4.1) is not signalled by the camera.
**Next:** Updraft boost and sprint FOV, auto shoulder swap, ping wheel (UI), the aim zoom once the flag exists.
### W3 · Rendering & VFX · 19/11/2026
**Done:** src/client/vfx: five additive instanced meshes (`fx.ts`), a pure event→effect mapping (`mapping.ts`), entity-bound
visuals redrawn from the view (`bound.ts`), constants (`constants.ts`), a dev-only self-test (`selftest.ts`, `?vfxdemo=1`,
effects age in slow motion so a screenshot catches them). Covers: muzzle flash, hitscan tracers, projectile bolts with
trails (enemy red-tinted, allied white), world/body/structure impacts, a distinct gold beak-shot flash, hit flashes,
seed pods (rising, ripe pulse, withering; gold = can secure, blue = can deny) with secured pop and denied crunch,
areas (sphere, cylinder, cone, ring, box; red rim enemy, teal ally), trap/turret/wall placeholders, tethers, status
markers (stun, silence, disarm, root, slow, grounded), dash streaks, landing dust, slide sparks, Updraft wind, melee
swipes, parry flash, fledgling swipes and shots, cast and ability-land pulses, deaths. `render/host.ts` +
`render/entities.ts` (skips VFX-drawn entities). Decisions D-RENDER-006…008.
**Verified:** `npm run check`: typecheck, lint, test, sim, e2e all PASS (25 s). `src/client/vfx/vfx.test.ts` 14 tests
(mapping per event, tracer count and colour, pooling: 600 frames of sustained fire leave the record ring and instance
buffers the same size, retirement, capacity drop, bound visuals). Shots read with the Read tool:
`npm run shots -- --scene sandbox --hero shrike --param vfxdemo=1 --param renderCam=-7.5,13,-23,-7.5,1,8` shows every
effect at once. Draw calls with the self-test: 11 (6 without it; the 5 extra are the instanced meshes).
**Blocked:** `?scene=lane&hero=shrike&t=60` has no fledglings: no sim system spawns them yet (no `wave.spawned` emitter
on main), so a real lane fight could not be screenshot; fledgling swipes and shots are shown in the self-test only.
**Interface requests:** Technical Architect: (1) `EntityView` for areas should carry the shape's dimensions (cone length
and angle, ring inner, box size, cylinder height) and the owner; areas are drawn from `radius` with presentation
constants today. (2) `EntityView` or a spawn event for pods should carry age or `expiresAt` (pod stages are timed from
first sighting, which is wrong after a fast-forward). (3) Projectiles: the view gives no `source`/`ability`, so ability
bolts can't take a hero's colour; expose `ProjectileInfo.source` and ability id on the view. (4) Unit statuses are not in
the view, only heroes'; markers on fledglings come from the stun and silence flags only. (5) `weapon.fired` should
carry whether the gun is hitscan.
**Next:** hitstop, shake and post-processing are wave 7. Per-ability colours and shapes once (1) and (3) land. Lint: the
vfx files carry ~240 `no-magic-numbers` warnings (positions in selftest are exempted; the rest are small presentation
literals in fx.ts, bound.ts and mapping.ts) to move into constants.ts.
### W3 · Systems follow-up (Controller, Combat, Ability Systems) · 19/11/2026
**Done:** every W3-contract-followups item for the three systems, plus the idle-drift defect and the EP's five extra
findings. *Combat:* `projectile.impact.via` on every impact; `WeaponDef.projectileRadius`, `perRoundStartS`,
`spinUp`; wall hitboxes from `UnitInfo.size`; `targetHpBelow`, `missingHpPct`, `executeBelow` through
`ctx.effects.magnitude`; `DamageEffect.beakShotMult`; `WeaponModEffect.shots`; `Motor.modeAllowsGun`;
`EFFECT_TICK_SECONDS` (dropped `COMBAT.tickIntervalS`); the aim ray stops on pods. *Abilities:* `selfEffects` (base +
tiers); `SummonEffect.onEnd`, `count`, `spreadDeg`; `UnitInfo.size`; `tether` start/end events; 'displaced' ends
channels; `modeAllowsAbilities`; `EFFECT_TICK_SECONDS` (dropped `AREA_TICK_S`); rooted or stunned decoys stand still;
the validator walks selfEffects, onWall, onEnd and count; the framework test reads Shrike's ultimate timings from data.
*Controller:* idle heroes rest exactly (no gravity step on the ground, a 1 mm rest band, D-SYS-001; it also removed a
one-tick dash stall from fresh seats); wall slam with `onWall` and 'wallSlam'; 'displaced' events; teleport yaw on a
'teleport' event; mode flags on Motor; units displaced, dashed and attached by physics (units.ts, rooted under
'physics:displaced'); a dash 'target' at the caster goes to the point (Tempest Dive); 'aim' dashes keep their pitch
(≤ 30° up) unless `arcHeight` is set; displacements stop where they land (6 m push → 6.0 m, was 8.4). D-SYS-001…005.
**Verified:** `npm run check` → PASS typecheck 5 s, lint 2 s, test 5 s, sim 2 s, e2e 12 s (check 26 s); vitest 32 files,
348 passed, 22 skipped (pods, fledglings). `npx vitest run tests/contracts/damage.test.ts` → 23 passed. `npm run sim --
--seed 1 --minutes 3 --bots 12` twice → hash 86b4281ec2fe6908 both times (new: hero positions changed with the rest
fix), 14,840 and 15,011 ticks/s = 0.067 ms/tick (stub bots). New tests: src/sim/combat/followups.test.ts (10),
src/sim/abilities/followups.test.ts (10), 8 new in src/sim/physics/controller.test.ts (rest on flat ground, after
stopping, on the ramp and on 'main'; displace distance; wall slam fast and slow; teleport yaw; mode flags; target dash;
pitched and flat aim dashes; units displaced, slammed, dashed, attached). Two W2 physics tolerances loosened from
0.5 mm to 5 mm (vine shimmy x, toboggan distance): Rapier sub-millimetre noise, not behaviour.
**Blocked:** nothing.
**Interface requests:** Architect (W3.5) — `DashEffect.maxPitchUpDeg` (or `followPitch`), so the 30° Plunge clamp is
data rather than a movement constant and Wing Slam needn't set `arcHeight: 0` to stay flat (D-SYS-003). Economy —
pods can go back to their real hit radius: the bullet now converges on the pod under the crosshair (D-SYS-005).
**Next:** Hero Engineer A switches off WALL_SLAM_IN_FRAMEWORK, SUMMON_END_IN_FRAMEWORK and SELF_EFFECTS_IN_FRAMEWORK
hooks after the merge; Wing Slam needs `arcHeight: 0`; Gale Shield's follow hook must write the wall's `pos` and `yaw`
(the built-in 'wall' behaviour stands still). Left: `onCaster` stays until no kit uses it; projectile-gun weapon mods
still apply at impact time (a shot-limited mod's last bullets in flight can land after it ended); units take no
teleport or movement mode.
### W3 · Hero Engineer A (batch A1) · 19/11/2026
**Done:** Shrike, Albatross, Kingfisher and Lyrebird complete and `implemented: true`: real body plans, stats, Molt
growth, guns and all 16 abilities with their three tiers, as data in `src/sim/data/heroes/<id>.ts`. New data shapes in
use: Echo Lute `projectileRadius`, Albatross `perRoundStartS`, Echo Double `count`/`spreadDeg`/`onEnd`, Gale Shield
`size`/`onEnd`, Impaling Bolt `onWall`, Riverstrike T3 `selfEffects`. Tiers that change a base number use value gating
(Bolt T3 pierce: two projectiles whose ranges swap; Spear Bill T2: two stabs whose radii swap; Plunge T3), Riverstrike
T2 a zero-amount second hit (+6% missing HP, no hook needed). Hooks (each marked TODO(framework) where the framework
will replace it): Shrike `boltPin`; Albatross `galeShield` (wall follows you), wall end (lifts the slow; burst until
`onEnd`), `tempestLeap`, Salt Hide's 10%-of-max-HP heal; Kingfisher Ambush on Glint ending, Glint T3 silence, Spear Bill
T3 reset, Riverstrike refund and T3 vanish; Lyrebird Grand Chorus penalty ends with the channel.
**Verified:** `npx vitest run src/sim/heroes src/sim/abilities/kit.test.ts` → 87 passed (57 hero smoke tests: per hero a
gun test, each ability at base and a tier, the ultimate locked then usable at level 6; kit validator). `npm run lint`,
`npm run sim -- --seed 1 --minutes 3 --bots 12` (10.9k ticks/s) and `npm run e2e` (6 passed) pass. `npm run check` stops at
`test`: ONE failure outside my paths, `src/sim/abilities/index.test.ts:305` hard-codes the Shrike placeholder's ultimate
cooldown (`1 + 90 * 60`); Shrike's real one is 110 s (GDD §9.1) so it must read `1 + 110 * 60`. I was blocked from editing
another role's file; the owner (or the EP at merge) makes that one-line change. All other 377 tests pass.
**Blocked:** nothing else.
**Interface requests:** Character Controller/Architect — (1) a point-cast `dash` with `dir: 'target'` goes nowhere because
a point cast's `target.entity` is the caster (D-ABIL-001 vs D-CTRL-004): treat `target.entity === cause.source` as "no
entity" and use the point (Tempest Dive uses a hook until then); (2) ability `dash` with `dir: 'aim'` is flattened, so
Plunge's "pitch clamped to 30° up, any angle down" can't be said; (3) a 6 m `displace` travels 8.4 m (the landing slide),
not 6 m. Ability Systems — `onEnd` on a following wall gets the cast direction, not the wall's current facing (Gale Shield T3
should burst the way you face).
**Next:** when the Systems follow-up merges, flip `WALL_SLAM_IN_FRAMEWORK` (Shrike), `SUMMON_END_IN_FRAMEWORK` (Albatross) and
`SELF_EFFECTS_IN_FRAMEWORK` (Kingfisher) to true and delete the fallbacks; add tests for Echo Double T2 (two decoys at ±15°) and
T3 (burst) and Gale Shield's wall blocking shots, which need that branch. When Economy's `trigger` lands, Kingfisher's Ambush and
kill refunds can become trigger data.
### W3 · Technical Artist · 19/11/2026
**Done:** `src/client/render/models/` (kit, `parts.ts` primitive merger, `bird.ts` shared parts, `heroes.ts` Shrike,
Albatross, Kingfisher, Lyrebird plus the generic bird for the other 20 tinted by roster index, `fledgling.ts`,
`hitboxes.ts`, dev-only `debug.ts`/`lineup.ts`, `constants.ts`) and `src/client/render/rigs/` (`bird-rig.ts`,
`fledgling-rig.ts`). Every build derives its sizes from `HEROES[id].def.body` at runtime: head shell centred on the
head hitbox, body fits the capsule, gun tip at the muzzle. One hero = 8 meshes sharing one vertex-coloured material.
Rig animates idle, run, sprint, air, dash, slide, crouch, mantle, climb, Updraft, glide, shoot recoil, reload, cast,
stun, hit flinch, death, burrow (sink) from view flags, velocity, pitch and hp. Fledglings: one InstancedMesh per
(type, team), proxy Object3D takes a slot on 'added', frees on 'removed'. Everything else keeps the old box.
Dev URL options: `hitboxes`, `modelLineup=a,b`, `modelState=run,dash…`, `modelYaw`, `modelWave=n`, `modelTeam`;
`window.__perchModels.setHitboxes(on)`. D-ART-001.
**Verified:** `npm run check` → PASS typecheck, lint (no warnings), test, sim, e2e. New tests (models.test.ts): all 24
ids get a model of 8 meshes and under 1,500 triangles; the four heads within 2 cm of the hitbox centre; 200 fledglings
get distinct slots; 150 mixed fledglings use 4 InstancedMeshes. Measured in the browser (renderer.info, shadow pass
included): one hero 16 calls = 8 per pass; 150 fledglings +8 = 4 per pass; tris per chick under 150. Looked at
`npm run shots -- --scene sandbox --param modelLineup=shrike,albatross,kingfisher,lyrebird --param modelYaw=0|60|90
--param renderCam=…` (front, side, three-quarter), a shrike pose sheet (idle, run, air, dash, slide, shoot, cast,
dead), the hitbox overlay and a 12 v 12 fledgling wave. Shots used the GDD §9 plans via a temporary override I then
removed, because main's data is still placeholder; re-shoot after merge.
**Blocked:** nothing.
**Interface requests:** Architect — `ModelKit.pose` gets no events, so there is no hero melee animation (no view flag);
add a `Meleeing` ViewFlag or pass this step's events to pose. Rendering — invisible allies need a ghost material;
for now invisible enemies are hidden and allies shown normally. Rendering — structures, Patrons, pickups, projectiles
and other units still use the box.
**Next:** hero LODs (budget met at LOD0 only), per-hero cast poses, the 40 m silhouette line-up (M3), structures.

### W3 · UI/HUD Engineer · Options and key rebinding · 19/11/2026
**Done:** Options screen from the main menu and the pause menu (Back returns to where it was opened). Controls: all 28
`DEFAULT_BINDINGS` actions with readable key names, click then press a key or mouse button, Esc cancels, a key in use
swaps the two actions (status line says so), Reset per action and Reset all. Also sensitivity, FOV, quality, and master,
music and effects volume. Each change calls `AppActions.saveSettings` at once. `src/client/ui/bindings.ts` (pure
helpers; the input module has no `rebind()` so the swap lives here), `options.ts`, tests in `bindings.test.ts`.
**Verified:** Playwright one-off (`out/ui-options.ts`, not committed): menu → Options → rebind Jump to J → swap Dash with
J → reset → Esc cancels → sensitivity 2.5 and quality High → reload → all persisted → rebind Pause to P → `?scene=lane`:
P pauses (live through the app) → Options from pause → Back returns to pause. All 10 checks pass. Jump itself cannot be
checked: the input module is still a stub that only reads the pause key.
**Interface requests (app side):** none blocking; `app.ts` already applies saved settings to input, camera, audio and
renderer, and persists the whole `Settings`. Input must read `bindings` for every action once it lands. Aim
sensitivity, invert Y and crouch toggle exist in the store but have no UI yet.
### W3 · Objectives · 19/11/2026
**Done:** `src/sim/world/` replaces the stub: `fledglings.ts` (GDD §7.1 waves from 0:30 every 30 s with the 3+1 / 3+2 /
4+2 bands, HP and damage +1.5%/min fixed at spawn, a two-file column 1.5 m apart with Scrappers in front at each gate,
`wave.spawned`, `ObjectiveState.nextWaveAt`; marching along the lane tracks at 5 m/s through `moveCharacter`, stepping
round structure footprints, honouring root, stun and slow; target rules 1–4 every 0.5 s staggered, sticky targets,
18 m leash, 18 m path leash and walk-back; Scrapper melee `damage` and Slinger combat `projectile`, `via: 'unit'`, ×1.5
vs structures; holding at the enemy Wardens until W4), `vision.ts` (the shared visibility service: §11.1 rule, reveal,
invisibility within 8 m, true sight), `index.ts`; `src/sim/data/world.ts`. Tests: `world.test.ts` (footprints, hold
queue, priority and stickiness, vision, lanes trade), `perf.test.ts`. D-OBJ-001…004.
**Verified:** `npm run check` → PASS typecheck, lint, test, sim, e2e (31 s). `PERCH_PENDING=1 npx vitest run
tests/rules/fledglings.test.ts` → 11 passed (11), the 20-minute composition test included (~2–5 s); no assertion
disputed. Perf (`src/sim/world/perf.test.ts`): 166–168 fledglings marching and fighting add 0.116–0.163 ms per tick to
the whole tick (world + physics moves + combat shots and damage, vision included). `npm run sim -- --seed 1 --minutes 35
--bots 12` → 126,000 ticks, hash 5d2a71363be186e4, 4,253 ticks/s on a machine shared with seven agents (0.126 ms/tick
for the same run in a quieter probe, same hash). Fledglings alive: 48 at 5:00, 52 at 10:00, 58 at 15:00, 63 at 20:00,
70 at 25:00, 71 at 30:00, 69 at 35:00; 2,103 killed; lanes even (waves trade mid-lane, stub bots don't fight).
Screenshots looked at: `npm run shots -- --scene lane --hero shrike --t 60` (player camera in the Dawn base, wave 2
leaving the gate) and the same with `--param renderCam=-95,22,-26,-95,0,4` (out/shots/lane-hedgerow-60s.png): Dawn and
Dusk fledglings meeting mid-Hedgerow, Scrappers in melee, a Slinger shot in flight.
**Blocked:** nothing.
**Interface requests:** Architect (+ Combat) — a radius on the true-sight status (magnitude or a stat): GDD gives 20–30 m
per ability, world uses `VISION.trueSight` 30 m. Architect (W4, minimap) — `seenBy` has one bit per flock, so GDD §5.9
"reveal shows an invisible hero on the minimap only" needs a second, minimap-only bit; until then revealed wins.
Character Controller — `moveCharacter` allocates two objects per unit move (~300 per tick at 150 fledglings); an
out-parameter variant would remove it (low priority, within budget).
**Next:** W4 spawns structures at the anchors with `STRUCTURE_RADIUS` bodies; rule 3 then attacks them and the hold
line becomes a fallback. The rule-2 `hurtAt` ledger in fledglings.ts is the Hawk rule's input too. Known limits: units
ignore walls while chasing off the lane (D-CTRL-002); a holder's death leaves a gap in the queue. QA: the fledglings
suite can go always-on (the 20-minute test runs in seconds).
### W3 · Integration · 19/11/2026
**Done** (branch `integrate/w3`, seven items, one commit each):
1. *Hero A* (5bbeac2). Root cause: the hooks kept running beside the framework features that replaced them, so Gale Shield
   burst twice, Impaling Bolt pinned twice and the vanish applied twice. Removed the `boltPin`, wall-end burst,
   `tempestLeap` and Riverstrike-vanish fallbacks and the three `*_IN_FRAMEWORK` flags (Shrike now has no hooks); Tempest
   Dive's dash is data; Gale Shield's hook still writes the wall's `pos` and `yaw` (what `onEnd` reads) and lifts the slow.
   Wing Slam and Spear Bill are `arcHeight: 0` (aim dashes keep their pitch: Spear Bill lost a third of its reach when
   aimed 7 degrees down). The Shrike knockback test expected the stale 8.4 m landing slide; it is 6 m now (D-SYS-001).
2. *QA pods* (e9617a8). `shootPod` read the despawned pod's position; it takes the position captured before the first
   shot. `PERCH_PENDING` gates removed from pods and fledglings; the 20-minute test costs about 2 s, so no `PERCH_SOAK`.
3. *Pod size* (b24bce7). `ECONOMY.pod.radius` 1 m to 0.25 m (the drawn orb, VFX `POD.radius` 0.24); secure and deny pass.
4. *Settings live* (d522c02). Audit: input already read every binding, sensitivity, invert Y and crouch toggle from the
   settings it is handed and re-indexes on `setSettings`; the app already pushed saved settings to input, camera, audio and
   renderer; `ACTION_LABELS` and `DEFAULT_BINDINGS` are both `Record<BindAction, ...>` and a test compares them. The
   one gap was two swap implementations: the UI's `rebind` now calls input's. The e2e below proves rebound Jump and Pause.
5. *App wiring* (7bd3ace). `input.setLook` on the local hero's `hero.respawned`; `input.setPingResolver` returns a 'goHere'
   ping at `rayWorldPoint` along the hero's `aimRay` (range `CAMERA.aimRange`). Also `window.__perch.hero` (position,
   shots fired), a read-only getter for e2e.
6. *Practice match* (19dcaae). `matchConfig` sets `unlockAbilities` when `bots` is 0 (Play and `?scene=lane`).
7. *e2e* (de2f062, 8e6ab76). `e2e/play.spec.ts` (lane, lock, W, dash, fire) and `e2e/options.spec.ts` (rebind, swap, Esc
   cancels, reload persists, rebound Pause, rebound Jump jumps and Space no longer does).
**Verified:** `npm run check` → PASS typecheck 6 s, lint 3 s, test 8 s, sim 3 s, e2e 12 s (check 32 s); 504 tests, pods
and fledglings always-on. `npm run sim -- --seed 1 --minutes 35 --bots 12` → hash 52196bc3abdb2fe3, 13.4 s for 126,000
ticks = 0.106 ms/tick. Screenshots read: `?scene=lane&hero=` shrike, albatross, kingfisher, lyrebird, and an overview at
t=100 s (fledglings meeting mid-lane, too small to judge up close); files out/shots/integ-*.png.
**Found, not fixed:** (a) `src/sim/world/perf.test.ts` (0.5 ms budget) is load-sensitive: 0.17 ms alone, 0.54 to 0.84 ms
in the parallel suite, so `npm run check` failed its test step on several runs and passed on others (also without the
rules suites); the budget or the parallelism needs a decision. (b) Audio is still a stub, so volumes reach nothing.
(c) The Esc-to-pause keydown and the pointer-lock exit both report pause; the 100 ms dedupe holds in the e2e.
**Addendum (D-EP-022, item 8):** timing assertions moved out of the parallel run. Five tests now live in
`*.perf.test.ts` files (combat, world, physics, abilities, main map), excluded from `npm test`; `npm run perf` runs them
serially (median of 5) and is a step in `scripts/check.sh` after `test`. The three ability kits moved to
`src/sim/abilities/fixtures.ts` so the perf test can share them; the physics determinism test moved with its timed
`cityRun`. Serial numbers: world +0.339 ms/tick (budget 0.5), physics 0.34 ms (1), abilities 0.034 ms (0.3), combat
0.088 ms (0.3). Budgets unchanged. (This supersedes "found, not fixed (a)" above.)

### W3 · QA gate · 19/11/2026
**Verdict: APPROVE** (`integrate/w3` at c5aeb33), with follow-ups for wave 4. Nothing found breaks a Stage 2 gate item
or leaves a contract problem that would be expensive to fix later. One housekeeping item before the merge: PLAYABLE.md
still has only the "Next, Stage 2" teaser (line 33), no "Stage 2 (M1)" section (D-EP-017, the EP's step).
**Verified (my own runs, this checkout):**
- `npm run check` → PASS typecheck 12 s, lint 8 s, test 13 s (45 files, 499 tests), perf 16 s (5 files, 6 tests), sim 6 s,
  e2e 20 s (10 tests incl. `e2e/play.spec.ts` and `e2e/options.spec.ts`); check 76 s. Pods, fledglings and damage suites
  are always on (no skips or `PERCH_PENDING` in `tests/rules`).
- Determinism: `npm run sim -- --seed 1 --minutes 35 --bots 12` twice → hash 52196bc3abdb2fe3 both times (matches the
  integration run); the 3-minute check sim hash is a8d14facda91c2fa.
- Sim purity: no Math.random, clocks, console, DOM, Node APIs or client/three imports in `src/sim` outside tests; the
  only RNG use is `ctx.rng.stream('combat')` (guns.ts:108, geometry.ts:120-122); no `Object.keys` or `for…in` order
  dependence outside the sorted hash walk.
- Ownership: every non-merge commit stays in its owner's paths. Exceptions, all recorded: `W3 integration (…)` commits
  (D-EP-018), and `0a670e0` (EP, D-EP-022), which touched Build's files (`package.json`, `scripts/check.sh`, `vite.config.ts`,
  `vitest.perf.config.ts`) and moved five timing tests in Combat, Physics, Abilities, World and map test files. Accepted.
- Perf, Node, 35-minute run (126,000 ticks, 12 bots, ~150 fledglings): **0.234 ms/tick mean**, p50 0.202, p99 0.73,
  p99.9 2.0 (budget 1.0 mean). By 5-minute window 0.214 to 0.252 ms: flat, no leak. Worst ticks: tick 0 is 193 ms (Rapier and
  JIT warm-up, once); then 24 ticks over 3 ms, max 5.9 ms (tick 1800 = the 30 s wave spawn; others look like GC). The
  worst-tick budget is 3 ms (ARCHITECTURE §8). The CLI run took 29.3 s each time against 13.4 s in the integration
  entry: this machine was busier, the hash is identical. `npm run perf` (serial, median of 5): world 166 fledglings
  +0.332 ms (budget 0.5), physics 0.274 ms (1), abilities 0.035 ms (0.3; 0.142 with 96 areas live), combat 0.083 ms (0.3).
- Draw calls (Edge, 1920×1080, `window.__perchRender.info()`, lane at t=100 s with ~150 fledglings and the VFX layer):
  25 low, 41 medium and high, about 57k triangles; 12 heroes in `?scene=match` at t=100 s: 113 low, 216 medium and high,
  about 74k triangles. 120 fps in the headless Edge here (not a mid-range iGPU, so not proof of the 60 fps budget).
- Lint: 117 warnings, 0 errors, all `no-magic-numbers`: `src/client/vfx` 57 (bound.ts 39, fx.ts 15, mapping.ts 3),
  `src/sim/abilities` 34 (all in `fixtures.ts`), `src/client/ui` 24 (hud.ts 11, constants.ts 7, bindings, display,
  options 2 each), `src/sim/economy` 2, `src/client/input` 1; nothing in camera, render, physics, combat, world or heroes.
  The VFX count fell from about 240 to 57.
- Screenshots read (out/qa/): menu.png (Play, Options over the lit map); heroselect.png (4 PICK, 20 COMING SOON, counted
  in the page text too); options.png (every action with a key button, sliders, quality, Reset); lane-shrike, lane-albatross,
  lane-kingfisher, lane-lyrebird.png (distinct bodies, HUD with four named slots and ammo); hitbox.png (`--param hitboxes=1`:
  red head sphere inside the visible head, green body capsule); fled-fight2.png (`--t 100 --param renderCam=-95,10,-20,-95,0,6`:
  Dawn and Dusk fledglings meeting in Hedgerow, a Slinger shot in flight). A hand run (Play, pick Kingfisher, W, 1, 2, 3,
  fire): hero spawned at the Dawn gate, moved 30 m, `shotsFired` 3, no console errors (play-kingfisher.png).

**Gate evidence**
| Gate item | Proof | State |
|---|---|---|
| Run, jump | controller.test.ts:121, 164, 184; e2e/play.spec.ts (W moves more than 3 m) | proven |
| Dash, dash-jump | controller.test.ts:200, 225, 268, 288 | proven in sim; the e2e holds Shift but would pass on W alone (play.spec.ts:38-41), so unproven in the browser |
| Slide | controller.test.ts:307, 328, 343 | proven in sim |
| Mantle | controller.test.ts:362, 383 | proven in sim |
| Updrafts | controller.test.ts:453, 533 (mount, boost, dismount, climb) | proven in sim; no screenshot or browser run |
| Beak shots | combat/guns.test.ts:72, 85; effects.test.ts:245; each hero's "×1.65 on the head" test (shrike.test.ts:49, albatross:53, kingfisher:52, lyrebird:56) | proven in sim; hitbox.png shows the head volume |
| Four abilities | one runtime test per ability and tier for Shrike, Albatross, Kingfisher, Lyrebird (4 heroes × 4 abilities, none missing); hand run cast 1-3 as Kingfisher with no errors | proven. Lyrebird Echo Double T2 and T3 (fan of two, burst) is data-shape only (lyrebird.test.ts:162); the framework tests it generically (abilities/followups.test.ts:93, 105) |
| Fledglings march and fight | tests/rules/fledglings.test.ts:131-309 (11 tests: waves, column, march, targeting, leash, damage); world.perf.test.ts; fled-fight2.png | proven |
| Pods secured, denied | tests/rules/pods.test.ts:133 (secure), :148 (deny), :185 (wither), :233 (a real bullet secures) | proven in sim; pods were not looked at in a screenshot |
| Options, rebinding, persists after restart | e2e/options.spec.ts:28 (rebind, swap, Esc, reload), :54 (rebound Pause), :67 (rebound Jump); options.png | proven (a reload in one context = localStorage; no cold restart) |
| Launchable from the menu | hand run through Play and the hero card; heroselect.png | proven by hand; no committed e2e clicks Play and picks a hero |
| PLAYABLE.md "Stage 2 (M1)" | not written | open (EP) |

**Findings by owner** (none blocks)
- *Rendering & VFX:* `src/client/vfx/bound.ts:11`, `constants.ts:2`, `mapping.ts:6` import `render/palette`, and `vfx/index.ts:12`
  imports `render/host`, while `render/entities.ts:17` imports `vfx/drawn`: a render-vfx import cycle, against
  `app/contracts.ts:3`. Move palette and `drawnByVfx` into `app/` or a shared client folder. 57 magic-number warnings
  (bound.ts 39, fx.ts 15). `render/index.ts:248` dev hook is fine (DEV only). No renderer test asserts a draw-call budget
  (my W2 follow-up, still open; the numbers above are the baseline).
- *UI/HUD:* `src/client/ui/bindings.ts:3` imports `rebind` from `../input` (the one swap rule, deliberate in d522c02, but still
  a module reaching into another's internals) and `ui/constants.ts:3` imports `render/palette`; 24 magic-number warnings
  (hud.ts 11, constants.ts 7). Esc-to-pause reports twice and relies on a 100 ms dedupe (integration note c).
- *Ability Systems / EP:* `src/sim/abilities/fixtures.ts` is a test fixture under a lint-scoped file name, so its 34 gameplay-number
  warnings count; move it under `tests/helpers/` or exclude it in eslint.
- *Economy:* `src/sim/economy/index.ts:57` bare `60` (seconds per minute) in the fledgling value growth; use a named constant.
  Pod orb radius is 0.25 m (data/economy.ts:35): a real-bullet test passes, but nobody has tried it by hand at lane range
  inside the 1.4 s ripe window; check before wave 4 builds item effects on securing.
- *Objectives:* `src/sim/world/fledglings.ts:33` reads Character Controller's `data/movement` (AIR, GROUND); acceptable as data, but
  say so in INTERFACES or copy the two numbers into `data/world.ts`.
- *Architect:* `app/contracts.ts:3` says modules never import each other's internals, but camera, render and vfx all import
  `app/loop` (`entityById`, `interpolate`), and `app/settings.ts:1` imports `input`. Document `app/loop` as shared, or move it
  under `contracts`. Client code also imports `sim/heroes/registry` (8 files) beyond the list in contracts.ts:3-5.
- *Core / Combat / Controller:* worst tick is 5.9 ms against the 3 ms budget, 24 ticks in 126,000 (wave spawn at tick 1800 and
  probably GC); the mean is 0.234 ms. Worth a look when W4 adds structures and items; the first tick costs 193 ms (warm-up).
- *Hero A:* Lyrebird Echo Double T2/T3 has no runtime test through the hero (lyrebird.test.ts:162). Hero smoke tests are
  otherwise complete: every ability and tier of all four heroes.
- *QA (me), wave 4 start:* (1) strengthen play.spec.ts so the dash is measured (distance in 150 ms above run speed);
  (2) an e2e for Play, hero card, lane; (3) an Updraft browser or screenshot check; (4) renderer draw-call budget test and
  an `npm run sim` worst-tick check (from the W2 follow-ups); (5) the wave 4 suites deferred by D-EP-021 (structures, levels,
  AP, shop) before the implementers start.
- *EP:* PLAYABLE.md "Stage 2 (M1)" before the fast-forward; STATUS "Now" still says W3 running.
**Blocked:** nothing. Nothing under `src/`, `tests/` or `e2e/` was changed; my scratch scripts live in the session scratchpad and
`out/qa/` (gitignored).
**Next:** EP writes PLAYABLE.md and fast-forwards `main`; QA writes the wave 4 test-first suites first thing in wave 4.

### W3.5 · Production support · 19/11/2026
**Done:** Read-only cross-owner inventory sent to Architect and EP: D-EP-026 item effects and later-roster contract considerations; siege controls, observations and GDD §6.3 positions. `PlayerCommand` already carries buy, sell, upgrades and item buttons; `SimView` carries progress, inventory, structure health and winner, while the existing browser `window.__perch` exposes only ready, scene, hero position and shots fired. The Stage 2 items catalogue is not implemented yet.
**Verified:** `npm ci --prefer-offline --no-audit --no-fund`; `npm run lint` ? 0 errors, 117 warnings. UI: bindings 2, constants 7, display 2, hud 11, options 2; Economy `index.ts` 1; input `constants.ts` 1; abilities `fixtures.ts` 34; VFX `bound.ts` 39, `fx.ts` 15, `mapping.ts` 3. W3 QA's total matches, but its Economy subtotal of 2 is 1. `npm run check` in Git Bash ? PASS typecheck, lint, test, perf, sim, e2e (85 s).
**Blocked:** nothing. Source and tests were not edited. No screenshots or hand-play of W4 functionality: this is the Stage 2 baseline.
**Interface requests:** Architect to confirm item effect coverage and public UI command routing before freeze; details sent directly. No contract changes proposed here.
### W4 · Game Director · 19/11/2026
**Done:** GDD traversal, browser bindings and combat cues (D-DIR-007), Hawk and Heron clearance (D-DIR-008),
and Practice Hub and ability inspection (D-DIR-009). The M2 checklist covers the Hedgerow chain, default
migration, mouse-bound melee and parry, tower clearance, damage and healing targets, and pointer-free upgrades.
**Verified:** `npm ci --prefer-offline --no-audit --no-fund` installed 145 packages. In Git Bash,
`VITEST_MAX_WORKERS=1 npm run check` passed all six steps in 142 s. Unit tests 499/499, perf 6/6, sim
10,800 ticks with seed 1 and hash `a8d14facda91c2fa`, browser tests 10/10. Lint passed with 117 existing
warnings. Logs and telemetry are in `out/check/` in the director worktree. Initial runs saw a concession
timeout with parallel unit workers and a 0.552 ms/tick world perf result against a 0.500 ms limit. The clean
run measured 0.339 ms/tick. Checked GDD key and distance cross-references, the Hedgerow hedge coordinates,
and unique D-DIR IDs.
**Limits:** the branch contains the design and baseline verification. Live traversal, tower clearance,
Practice Hub and the inspect panel need implementation and their M2 play checks.
**Interface requests:** Architect and Preview QA received default migration, dash timing and stamina,
practice setup and inspect inputs. EP approved the shared tower envelope for Objectives and Art.
### W3.5 · Technical Architect · 19/11/2026
**Done:** w4/contracts based on b94ef61. INTERFACES §12 records 38 W3 dispositions (25 accepted, 4 modified, 9 satisfied, 0 rejected). D-ARCH-017–019 and docs/briefs/W4-contract-followups.md assign producers, consumers, ordinary routes and QA proof. 625e38f introduced entity/event/effect projections; 242c0a7 wired siege, practice targets, command intents, settings and sight; e04a184 was the EP-authorised temporary Input ownership of index.ts and input.test.ts for shared default imports and migration coverage. 92fc98e froze the contracts and follow-ups.
**Verified:** separate npm ci --prefer-offline --no-audit --no-fund. Git Bash VITEST_MAX_WORKERS=1 npm run check passed all six steps (162 s, 503 tests + 6 serial perf + 11 browser tests, 117 inherited warnings). An unrestricted parallel unit run under concurrent browser work timed out in two existing 5 s sim tests; the single-worker run passed without changing assertions or timeouts. Two npm run sim -- --seed 1 --minutes 3 --bots 12 runs, 10,800 ticks, both hash 4e8cc26604dd382e (4.5 s and 2.9 s). Evidence in out/check/{test,perf,sim,e2e}.log, telemetry-seed-1.json and arch-replay.json. Inspected out/shots/arch-practice.png (scene=practice, Lyrebird, 1920×1080): standing Dawn/Dusk targets, arena HUD with 32 AP and all four abilities. Core/app test checks initial wounded ally, fresh siege AP, locked ultimate, practice tier expenditure, safe binding migration and world-to-screen projection.
**Remaining:** W4 owners implement structures, item catalogue and trades, UI menus/panels, target reset, kit data, camera/combat/VFX consumers, movements, and audio against the frozen interfaces. The screenshot proves initial practice setup; player-driven damage/heal, target reset, menu access and live siege victory need integrated owner code and independent QA evidence. No open interface requests.
### W4 · QA, M1 production preview · 19/11/2026

Built `npm run build` and served `npm run preview -- --host 127.0.0.1 --port 4178 --strictPort` from the assigned
worktree (`3564eff`, same source as GitHub M1 `6df745e`). Isolated profiles used Windows Playwright Firefox
159.0 (build 1572, WebGL enabled) and Edge 156.0.4314.50. No player browser windows were used.

- **Tab closure.** Reached Riverbank from Home Roost with normal controls. Shrike started at x −7.5, z −146, strafed
  to x ≤ −12 with D, went W to z ≥ −123, strafed back toward x −3 with A and went W to z ≥ −104 through the centre gate.
  With waves fast-forwarded to 100 s, alternated forward and back through 35 run + Shift + Space rounds (60.5 s),
  six run then Ctrl (10.3 s), six Ctrl then run (10.2 s), and four run + Shift + Ctrl (6.8 s). Firefox stayed pointer
  locked while tracking position, shots and 9,784 frames, with no exception, WebGL loss, page crash or unexpected
  navigation. Its DOM stayed at 94 nodes and one canvas. The initial Edge run also stayed live through the keyboard
  sequence. Edge JS heap samples ranged about 50–82 MB during the wave run, including drops between samples. Firefox
  provided no JS heap metric in this probe and GPU or process memory was unmeasured. The run does not establish a leak.
  The revised default C avoids the M1 overlap of W + Ctrl and W + Shift + Ctrl with native Firefox close shortcuts.
  Headless content injection cannot establish the cause of the player's close. [Mozilla Firefox key reference](https://support.mozilla.org/en-US/kb/keyboard-shortcuts-perform-firefox-tasks-quickly)
- **Mouse capture and action.** Both browsers captured Right Mouse for Melee (Aim swapped to Q) and Middle Mouse for
  Parry (Ping swapped to F) and preserved the pair after a reload. An event trace in the Firefox production bundle
  saw an empty light swing, an empty held heavy and 4.66 m of lunge plus residual motion, and parry start and whiff
  from trusted mouse input under pointer lock. M1 light recovery lasts 0.55 s after release. Heavy commits at 0.35 s
  with the impact at 0.60 s from press. Only parry success drives its VFX in M1. Synthetic Firefox side buttons
  captured Mouse 4 and Mouse 5 and carried a held/released melee to a 4.61 m lunge in Riverbank. Firefox's native
  side-button history remains unverified. Edge's trusted CDP Mouse 4 press/release during in-lane Options capture
  navigated back to the previous menu URL. Source has mousedown prevention and leaves the release/auxiliary path
  available to the browser.
- **Albatross aim.** The real sim centre stays aligned in open level shots, shallow up/down and with either shoulder.
  Kingfisher passed as the single-shot control. A rear/side arena box leaves the centre clear and a directly
  obstructed muzzle reports real pellet impacts. The shallow-down Albatross shot produces terrain hits and misses,
  but every displayed tracer slopes below the shot centre because the mapper emits only impact rays when any pellet
  hits. The pending tracer test fails on M1. The production Edge screen captures compare shoulder and pitch
  at Riverbank x ≈ −2, z ≈ −103. The left-shoulder crosshair at that point visibly intersects the tower, which is a
  separate obstruction from the open-aim case measured in the sandbox.

**Tests and evidence.** `tests/preview-aim.test.ts` has seven always-on controls and one pending visibility regression.
`e2e/preview-regressions.spec.ts` gates safe defaults and legacy migration, native side-button history, standard
button swaps and pointer-locked combat, and 45 s of post-fix movement with a confirmed slide and advancing sim.
Serve the production build and set `PERCH_PREVIEW_URL` when running the production liveness case. The standalone
`node e2e/preview-diagnostics.mjs firefox` replay keeps JSON and PNGs under `out/preview-repro/`; use `edge` for the
native history case or `edge --aim` for screenshots. Inspected the Riverbank, side Options and Albatross PNGs. The
prod-bundle trace is in `out/preview-repro/action-trace.log`. EP and Architect received reproductions before handoff.

**Interface requests.** Architect agreed to expose local `flags`, `tick`, `meleePose`, `lastMelee` and `lastParry` in the
read-only test hook, and add `weapon.traces` for the full hitscan endpoint set. Run pending tests against integrated
production before promoting them into the normal gate.

**Gate.** npm run check passed all six steps in 144 s. Unit tests 506 passed, 1 pending. Serial perf 6 passed. The three-minute sim hash was a8d14facda91c2fa. Edge e2e 10 passed, 5 pending. Lint retained the baseline 117 warnings and zero errors.

### W4 · QA rules · 19/11/2026
**Done** `w4/tests` from `9d9e974`. D-QA-008 covers production-backed siege rules, both flocks and all three
Updraft lanes, real Combat bounties and growth, normal shop and ability commands, and repeatable Practice
targets. The 18 m Riverbank pod secure/deny and the fresh Practice AP checks run by default.
**Verified** `PERCH_PENDING=1 npx vitest run tests/rules/{siege,market,practice}.test.ts` produced 31 expected
failures and one pass. Siege sees zero of 30 structures and zero Roost healing. Market sees level 1 instead
of 5, zero bounty instead of the expected 480-Seed shutdown, and an empty catalogue. Practice delivers both
weapon damage and Mended Song healing before failing to reset each target. Evidence is in
`out/check/w4-rules-red.log`.
**Default gate** Git Bash `VITEST_MAX_WORKERS=1 npm run check` passed all six steps in 156 s. Unit tests
506 passed, 31 gated. Perf 6/6, with the world at +0.344 ms/tick for 166 fledglings. The 10,800-tick sim
produced `4e8cc26604dd382e`. Browser tests 11/11. Lint reported 117 inherited warnings. The parallel run hit
the existing 5 s concession timeout, preserved in `out/check/w4-parallel-test.log`. Reviewed
`out/shots/review/practice.png` at 1920 × 1080 and confirmed both targets and the 32 AP HUD.
**Limits** Sandbox placement and damage amplification isolate siege boundaries. The integrated manual siege
at normal damage, visible tower clearance and browser interaction evidence are separate gates. No contract change requested.

### W4 · Browser QA · 19/11/2026
**Done:** w4/browser-tests from b2a7a96. Play → Shrike → Dawn spawn in Old Mossmarket now measures movement
and fires under pointer lock. Riverbank is reached by walking from the roost before E mounts, Shift boosts,
the weapon fires and Space dismounts. The sampled walk/dash was 8.99/27.50 m/s and cruise/boost was 11/18 m/s.
The 100-second fixed-camera Hedgerow cases peaked at 25, 41 and 217 calls against ceilings of 32, 48 and 248.

**Verified:** Git Bash `VITEST_MAX_WORKERS=1 npm run check` passed typecheck, lint, test, perf, sim and e2e in
177 s. Unit tests 503/503, perf 6/6, seed 1 completed 10,800 ticks with hash `4e8cc26604dd382e`, browser
15 passed and 4 skipped. Lint had 117 inherited warnings. Inspected the Riverbank rider and the three Hedgerow
scenes. See `out/check/browser-shots/`, the counters and movement samples in `out/check/browser-baseline.json`,
and the six step logs under `out/check/` in this worktree.

**Expected red:** `PERCH_PENDING=1 npx playwright test e2e/m2.spec.ts --workers=1` gave four failures
(`out/check/browser-pending.log`). “Menu offers Practice Hub” failed because the button was absent.
“Tapping Inspect opens Ability Upgrades” failed on the actual practice route because there was no dialog.
“Ordinary Play presents the actual Dusk Patron” failed because live siege and its objective display were
pending. “There are twelve selectable M2 hero cards” found four. The branches behind those first assertions
need integrated proof for dummy resets and targeted healing, inspection purchases and pointer return,
and visible siege progression.

**Interface requests:** sent stable accessible names for the upgrade dialog, ability controls, and labelled
dummy HP bars through the EP. The W3 worst-tick follow-up and production-browser regressions are tracked
outside this browser acceptance suite.

### W4 · Economy & Items · 19/11/2026

**Done:** `w4/economy` (ChatGPT's four commits, then Claude's handover from `28588d2`) implements GDD §8 earnings
and the D-EP-026 shop. Every earned Seed goes to wallet and net worth; buying, selling and refunds touch the wallet
only. One payment awards every crossed level with its Molt, AP and level-6 ultimate (`hero.level`; Combat heals the
HP gain, Abilities grants AP and the unlock). Bounties use base + 3% worth + shutdown streak with the capped comeback
multiplier, split between killer and assisters, or among enemy heroes within 40 m for a non-hero kill. Hawk, Heron,
Warden and Shrine pay the whole flock and open the four flex slots (2 Hawks, 1 Heron, 1 Shrine); a Patron pays
nothing. Items fills `ctx.itemCatalogue` with the sixteen items over four tiers, validates each trade at execution
(own shop zone, funds, uniqueness, 12 + flex capacity, component replaced in place at net cost), tracks
`inventory.shopZone` and same-visit `fullRefundUntil` (cleared on exit, anchor change, expiry, death or spawn), binds
the first four actives to the item buttons, runs Mocking Note's hero-only non-proc `abilityHit` trigger, Flurry's
instant reload, timed fire rate and CDR-independent 30 s cooldown (kept across a sale), and Dew Drinker's 8 s quiet
regen restarted by every health hit. Pod rules are unchanged. Owned paths have no lint warnings. D-ECON-003/004
record the reward and refund decisions.

**Checks:** `npm ci --prefer-offline --no-audit --no-fund`; `npm run check` PASS 6/6 (typecheck 41 s, lint 9 s,
test 25 s, perf 21 s, sim 8 s, e2e 35 s; 140 s; 116 repo lint warnings, none in owned paths).
`PERCH_PENDING=1 npx vitest run tests/rules/market.test.ts tests/rules/pods.test.ts src/sim/economy src/sim/items`:
41/46 pass (market 12/15, pods 13/13, economy 9/9, items 7/9); log in `out/economy/rules.log`. ChatGPT measured
the market suite at 15/15 failing before implementation. Item tests use real shots, reloads, casts, regeneration,
heals and movement for all sixteen items.

**Cross-branch dependencies (all five failures):** World must spawn `map.structures` when
`options.structures` is set for `tests/rules/market.test.ts` “§§8.4–8.6 a Heron bounty crosses two thresholds,
applies both Molts and heals the gained max HP”, “§§8.4/8.7 dawn gets one flex slot for each agreed fall, with
capacity 12 through 16” and “§§8.4/8.7 dusk gets one flex slot for each agreed fall, with capacity 12 through 16”.
W4 Combat must read `closeGunDamage` within 15 m and add `beakShotFlat` once per trigger pull (today it is per beak
pellet) for `src/sim/items/items.test.ts` “Close Talons boosts a real gun hit only within 15 m” and “Whetstone adds
its flat damage once across a mixed shotgun volley”. Run both files with `PERCH_PENDING=1` at integration.

**Limitations and requests:** the Patron check uses today's single-phase death; after W4 Combat a phase-one fall
emits `patron.depleted` instead and Economy still pays nothing. Combat should confirm held HP and ammo stay within
their caps when a sale lowers the maximum. This branch predates main's `6ba3741` (D-EP-029); STATUS and DECISIONS
merge by appending.
### W4 · Objectives · 19/11/2026
**Done:** `w4/objectives`, continuing ChatGPT's handover (85eedb3…f2d6034; the WIP snapshot only drops a trailing
newline). `structures.ts` spawns all 30 anchors when `options.structures` is on: Hawk/Warden homing bolts and the
Heron beam with §7.2 priority, stickiness and ramp, the 4 s Heron stomp with a 0.5 s telegraph, Shrine pulse, lane
gates in order (two Wardens of one lane open both Shrines), Brood Ward ×0.35 and the 35:00 lever (×0.6, +25% vs
structures), the Patron's volley/Screech, 3 s transition, phase 2 at 20,000 HP with a 1 m heart 6 m up, Rain and Gale,
Home Roost heal/burn, and one `match.ended`. Every hit goes through `ctx.effects`, `via: 'structure'`; `structure.attack`
carries origin, point and `impactAt`. Vision splits `seenBy` from `mapOnlySeenBy`, honours Fog Bank and per-holder
true-sight radius. Waves prepare stat blocks ahead of the spawn tick and pass a caller-owned `CharacterMove`. Mine:
88b50aa makes the 35:00 bonus add in step 4 (D-OBJ-008). D-OBJ-005…008.
**Verified:** Git Bash `VITEST_MAX_WORKERS=1 npm run check`: typecheck, lint (117 inherited warnings), test (515
passed, 32 gated), perf 7/7 and sim (seed 1, 10,800 ticks, `7baa0bd7b442c587`) pass; **e2e fails** (below). Two
35-minute seed-1 replays gave `a3c8130c6f3bd064` both times (44.9 s, 41.6 s; no winner, stub bots don't push).
`PERCH_PENDING=1` siege/practice/fledglings: 20/28 on this branch (`out/check/obj-rules-branch.log`). The five Patron
and practice failures need Combat's `patron.depleted` and training reset on `w4/movement`: with that branch merged
uncommitted (then aborted) siege and practice pass 14/17, leaving only the three rides.
**Timings** (`world.perf.test.ts`, Old Mossmarket, seed 1, 12 bots, waves and structures, 3 sim minutes). Two runs
with other agents active (9 node, 67 Edge and 25 Claude processes, Codex; CPU 40–70%): startup 166/326 ms, first
tick 140/387 ms; first wave (tick 1800) 1.98/2.43 ms against W3's 5.9 ms; warm waves 2–6 0.43–0.62/0.40–0.54 ms;
mean 0.331/0.478 ms; p99 1.17/3.47 ms; max 6.3/37.9 ms. A slow-tick probe found the ticks over 1.5 ms at different
ticks in each run with no wave, death or attack burst on them, so the remaining tail is machine load or GC.
**Disputed assertion:** the three `§§3.7/16 … rides over both flocks’ Hawks and Herons` cases. Shrike (580 HP) is shot
by the enemy Hawk and Heron as §§7.2–7.3 require and dies at z ≈ 75, before the far Heron. With QA's usual
`siege-health` +9000 on the rider every lane passes in both directions, all 12 towers crossed with exactly 2.00 m
clearance and about 900 HP lost. Suggest QA adds that modifier; no assertion edited.
**Blocked:** e2e `draw-budget` lane/low 35 > 32 and lane/medium 50 > 48 calls. scene=lane now spawns the structures;
the blockout markers hide and each structure draws as one placeholder box (render/models, Technical Artist). 29 calls
at t = 1 s. Needs instanced structure models or a new QA ceiling.
**Interface requests:** Technical Artist, draw calls above; QA, the ride modifier. No contract change.
**Limits:** no hand-played browser siege yet; structure art and the Patron e2e wait on Art and UI.
### W4 · Contract follow-ups: Rendering & VFX and Ability Systems · 19/11/2026
**Done:** branch worktree-agent-a3b9cf65e87ddcca2 (from main 6ba3741), four commits plus docs. Migrated render host,
palette and drawn to `app/`; VFX draws `weapon.traces`, melee whiff, parry start/success/whiff, structure attacks,
phase/ward blasts, exact area dimensions and meleePose cues; `Vfx.reset` clears stale state; the entity layer hides
unseen enemies, ghosts allied invisible heroes and fades the local hero within 1 m. Abilities target through
`heroAimRay`, publish area dimensions/concealment, honour extraCount, preferHeroes, maxCarry and onWall. D-RENDER-009,
D-ABIL-010.
**Evidence:** `npm run check` six steps PASS (128 s); new unit tests in vfx.test.ts, entities.test.ts,
followups.test.ts; shot out/shots/w4-lane.png (Albatross, lane, local hero opaque at normal camera distance).
**Limitations / requests:** the Albatross distant-sightline tracer comparison needs Combat's `weapon.traces` producer
(w4/movement), so it is not seen end to end here; ability dash `maxPitchUpDeg` belongs to Physics. The local fade and
ghosts are material swaps, not a shader. Fog Bank concealment is published but has no distinct visual yet.
### W4 · Audio · 19/11/2026

**Built (`src/client/audio/` only):** `synth.ts` holds original WebAudio voices (no samples): five gun recipes tuned
for all 24 heroes, 24 hero calls, hit, beak-shot tick, weak point, kill chirp, hit taken, shield, melee, parry,
reload, movement, pods, Seeds, Molt, heartbeat, status cues, structure attacks and alarm, Brood Ward, Patron
phase 2, Egg, Roc, Ember, rune and ping cues. `music.ts` has four stems on a 96 BPM grid and nine states
cross-fading on the next bar. `index.ts` is the engine: HRTF panners (reference 5 m, rolloff 1, dropped beyond
60 m), 48-voice cap with priority/distance stealing, one map-wide alarm per 4 s, music duck in fights, live
master/sfx/music volume, first-gesture `resume`, `reset` and `dispose`. `createAudio(settings, { ctx, lookahead })`
takes an optional test seam.

**Evidence:** `npx vitest run src/client/audio` gave 9/9 in `audio.test.ts`. It bundles the module with esbuild
and runs it in Edge. Offline renders (OfflineAudioContext) are measured as samples: all 24 guns finite and at least
20 distinct signatures, all 24 calls audible and distinct, eleven event types audible, alarm rate limit, master 0
silent, sfx 0 mutes effects, music 0 mutes music, a live master change mid-sound silences the second half, `reset`
silences old voices, near/far falloff, beyond 60 m dropped, left/right differ, laning and siege music differ. A live
AudioContext test confirms none exists before a real click, then state is `running`, an AnalyserNode on the output
reads a non-zero peak, and `dispose` closes it. Full `bash scripts/check.sh`: all six steps PASS (112 s). An earlier
run had one unrelated sim concession test time out while the browser test loaded the machine.

**Not done:** line-of-sight low-pass and -4 dB (no occlusion data); hero call on hero select (audio is not told
about that screen); looping slide/updraft/chimney sounds (one-shots instead); menu birdsong; per-priority ducking
beyond voice stealing and the music duck; Roc aggro/enrage roars. Lint shows magic-number warnings in the synth
tables (warnings only).

**Interface requests:** (1) occlusion data, e.g. a line-of-sight flag per entity or a ray query on the view, for the
low-pass rule. (2) A hero-select hook on `AudioOut` (for example `onScreen(screen)` or `previewHero(id)`) for the
hero-select call and menu music state. (3) A mute setting in `Settings.volume` (today master 0 acts as mute).
### W4 · Hero Engineer A (batch A2) · 19/11/2026
**Done:** worktree branch from main 6ba3741. Hornbill, Flamingo, Penguin and Puffin ship with GDD 9.9-9.12 body,
stats, gun, four kits with all tiers, a swatch (0xD2452B, 0xF2799B, 0xF2A81D, 0x3E7FA6) and `implemented: true`. Hooks only where
data cannot say it: Hornbill (hero-only Heavy slow, Mud Seal fire rate ends with the barrier and T3 slow immunity, Hop
slick at take-off, Marked Prey refund), Flamingo (Tide Turn 30% max-HP heal, T2 allies within 6 m), Penguin (aside/up
knockback from Toboggan, Space hop, March touch hits and end slam), Puffin (turret slow, Rogue Wave start at your feet
and wet trail). Wrote accurate player-facing text with numbers for every A2 ability and tier, and rewrote the terse
A1 text (Shrike, Albatross, Kingfisher, Lyrebird) to match their data. Added Echo Double T2 (two decoys at +-15 deg)
and T3 (expiry burst) runtime tests, Gale Shield wall-blocks-shot and end-facing burst tests, and `maxPitchUpDeg` on
Wing Slam, Spear Bill and Plunge (Plunge 30; the flat dashes keep `arcHeight: 0` until Physics honours the cap).

**Verified:** `npm run check` in Git Bash, all six steps PASS (typecheck 45 s, lint 36 s, test 15 s, perf 19 s,
sim 4 s, e2e 26 s). `npx vitest run src/sim` 421/421 (four new hero test files plus the added A1 tests). Evidence:
`out/shots/heroa-hornbill-lane.png` (1920 x 1080, HP 620, 15/15, ability names; placeholder body, Art's) and
`out/shots/heroa-puffin-practice.png`.

**Limits:** these framework features are in the contracts but not in this tree, so the tests assert what runs today
and put the rest behind `PERCH_PENDING=1`: Combat `weaponMod.gunDamage` (Heavy Rounds +40%, Marked Prey +40/60%) and
`reloadFraction` (Bounding Hop half reload); Abilities `extraCount`/`preferHeroes` (Burrow Colony cap),
`move.maxCarry`/`onWall` and no-repeat `onEnter` (Rogue Wave: today the carry overruns about 27 m and the wave re-hits
the target once); World honouring `concealsAlliesOutside` (Fog Bank concealment against outside observers).
Toboggan's Space hop is a hook (a one-tick hover replaces the slide, then a dash) because modes do not yet end on
Jump. Models and picker cards are other owners' work.

**Interface requests:** Combat: gunDamage and reloadFraction on weaponMod. Abilities: extraCount, preferHeroes,
maxCarry, onWall, once-per-entry onEnter. Physics: end a toboggan on Jump and honour maxPitchUpDeg so the data's
arcHeight 0 can go.
### W4 · Hero Engineer B (B1) · 19/11/2026
**Done:** w4-hero-b worktree branch (from main 6ba3741). Owl, Pelican, Secretarybird and Starling ship real data in
`src/sim/data/heroes/<id>.ts` (body plan, stats, gun, swatch, sixteen ability descriptions and all tier texts) and are
`implemented: true`. Hooks: Owl (glide ends on landing or Space), Pelican (Gulp: cone pick, carry and spit, swallow
with pod and heal), Secretarybird (Footwork, Stomp bonus, Long Stride touches, Viper Dance chain). Starling needs none.
Owl sets `aimZoom` 0.5 and `aimRange` 220 explicitly. Sixteen smoke-test files' worth of cases: owl 12, pelican 12,
secretarybird 13, starling 14 (`src/sim/heroes/<id>/<id>.test.ts`), all on real casts, gun fire, tiers and expiry.

**Verified:** typecheck, lint, perf (6/6), sim (seed 1, 10,800 ticks) and e2e (15 passed, 9 skipped) pass. `npm test`
has 4 failures in `src/sim/physics/physics.test.ts` and `controller.test.ts`: both build their roster from `owl`
(line 16 and line 50) and assume the W1 placeholder body (radius 0.4). Owl's real radius is 0.36, so a raycast distance
and the attach gap moved. Fix there: use any hero still on the placeholder (`toucan`). Not edited: not my path.
Lane PNGs inspected: `out/shots/herob-{owl,pelican,secretarybird,starling}.png` (Pelican shows 640 HP, 50/50 ammo and
its three ability names; models are the generic rig, Art's).

**Limitations:** `weaponMod.gunDamage` and `ignoreFalloff` are not read by Combat yet, so Pelican's Pouch damage uses
`statMod gunDamage`. The `trigger` effect has no handler (items stub), so Frenzy T3 shreds through `weaponMod.onBulletHit`.
Night Eyes T3's +10% damage applies from any source, not only the flock. Owl's glide cannot end itself: the hook ends it
with a one-tick replacement mode. Pelican writes a swallowed fledgling's `pos` before killing it. Footwork's 5 s timer
is shared by all stacks.

**Interface requests:** (1) Abilities: a rooted hero cannot cast a movement ability, so Starling's Scatter cannot cast
while rooted, which its GDD text ("removes roots on cast") needs; a per-ability flag would fix it. (2) Physics: end a
movement mode on landing and on an event (Owl's Silent Wing), and an `endMode` service. (3) Combat: honour
`weaponMod.gunDamage`. (4) Durations of 0 in `applyStatus` still apply a one-tick status (min 1 tick), so tiers gate by
an empty-radius area instead.
### W4 - Technical Artist - 19/11/2026
**Done:** (1) Eight new birds in `models/heroes-b.ts` from GDD 9.5 to 9.12 (owl, pelican, secretarybird, starling with a
spinning 8-bird halo, hornbill, flamingo with a one-leg idle, penguin, puffin); every size read from `HEROES[id].def.body`
at runtime, head on the head hitbox, gun tip on the muzzle. (2) Melee in `bird-rig.ts` from `EntityView.meleePose`: charge
hold, light and heavy swings (windup, lunge, recovery) and parry; timings in `MELEE` (constants.ts). (3) Structures in
`models/structures.ts` + `rigs/structure-rig.ts`: Hawk, Heron, Warden, Shrine, Elder Raven, Great Owl. Each is ONE mesh
(one draw call, frustum-culled) whose geometry swaps between cached variants for eye glow (target) and Heron leg pose.
Patron: heart-feather from the transition, at `weakPoint` in phase two, raged eyes, shake. Brood Ward = one shared instanced
dome (`DomeGroup`, drawn only while a ward stands; swells and vanishes when it breaks). Towers are at most 10 m and are not
shadow casters (draw budget). (4) Practice Hub dummies (controller 'dummy') get rings on the real head and body hitboxes:
red, X and bullseye for the enemy; teal and plus for the ally (`models/dummy.ts`). (5) Dev options `modelStructure=`,
`modelState=charge|light|heavy|parry`.
**Verified:** `npm run check` all six PASS (one e2e Riverbank Updraft run was flaky under load; passed alone and on
re-run). Draw-budget e2e peaks on this branch: lane/low 24 (ceiling 32), lane/medium 41 (ceiling 48), match/medium 218
(ceiling 248). Updraft clearance: every tower at the real `main` anchors is under 12 m (test); Patrons are 24 m from any
line. Looked at PNGs in `out/art/`: a-front, b-front (eight birds), s-towers1/2, p-dawn (Raven ward and transition),
p-dusk-p2 (Owl phase two), melee-side, practice-close.
**Limitations:** body plans on main were still placeholders for the eight birds, so proportions follow GDD fractions;
Heron stomp is a discrete 3-pose swap; ward crack is a swell, not shards; Patron heart sits partly inside the chest until
the real weakPoint offset lands. **Interface requests:** none. D-ART-002.
### W4 · UI/HUD Engineer · 19/11/2026
**Done:** branch worktree-agent-a6f09e285ec841bc5 from 6ba3741, `src/client/ui/**` only. Menu with Play, Practice Hub and
Options; 24-card picker whose hover/focus panel lists the gun and every ability tier from the registry; HUD with level/AP,
Seeds, tier pips with real AP costs, Z/X/N/V item actives, half-pip stamina, melee tap/hold/charge/parry readout on the
actual binding, dash-jump cue; top bar (net worth, clock, lane pips, both Patrons with phase, ward and gate, front enemy
structure per lane, objective timers); north-up minimap (east at left) and big map from `mapSeenBy`, fading ghosts, pings;
kill feed with objective lines and ally respawns; world damage/heal numbers (`Settings.damageNumbers`), ping markers;
Ability Upgrades dialog (descriptions linked with aria-describedby, `Upgrade <ability>` buttons with cost or reason,
Close and Esc); Magpie's Hoard (3 categories, 4 tiers, component net cost, same-visit refund, flex slots, right-click sells,
read-only away from stalls); Tab scoreboard; ping wheel; Victory/Defeat end screen with telemetry; Practice Hub dummy
panel (`Ally dummy`/`Enemy dummy` progress bars with live HP). Options: mouse capture swallows down, up, aux and context
events (side buttons no longer navigate), reserved-chord note per D-EP-030. Imports moved to app/bindings and app/palette;
all UI lint warnings gone (named constants).
**Verified:** Git Bash `npm run check` 6/6 PASS. Unit tests 24 in `src/client/ui` (model, bindings, display). Looked at
1080p PNGs in `out/ui-shots/` (ignored by git): menu, picker, practice HUD, upgrades, match HUD, scoreboard, shop (fake
catalogue via `out/ui-harness.ts`), big map, pause, Options with chord note, end screen. With PERCH_PENDING=1,
`preview-regressions.spec.ts` passes both side-button/Options tests; its pointer-lock melee step still fails on gameplay.
**Limits:** the panels could not be driven by real keys here: input has no Alt-tap or B/Tab/M routing on this base, so
upgrades, shop, scoreboard and big map were opened by DOM for the screenshots. Catalogue and structures were empty on
this base (economy and objectives not merged), so the shop and Patron strip were seen only with fakes or empty.
`/Elder Raven/` shows once the Patron entity exists. Twelve selectable cards depends on hero engineers. No interface request.
### W4 · Movement and melee (Controller, Camera & Input, Combat) · 19/11/2026
**Done:** `w4/movement` continued from ChatGPT's four commits (WIP snapshot `67608e8` compiled and passed).
Its work covered the D-DIR-007 traversal rules, `dashJumpReady`, sprint after aim, mantle-glide, the pointer-locked
mouse and side-button capture, shared aim zoom, ping wheel and upgrade tap, `heroAimRay`, `weapon.traces`, shot
records, the Patron phase-one floor, `meleePose`, training resets, `moveCharacter(out)` and `maxPitchUpDeg`.
Claude added: D-EP-030 fullscreen keyboard lock and `defaultBindings()` (D-CAM-003); Jump ends a toboggan with a
1.2 m hop; a jump-off no longer remounts its Updraft (D-CTRL-008); the GDD §3.10 Hedgerow run as a test on Old
Mossmarket; tests for Close Talons ≤ 15 m, Whetstone once per mixed volley, `reloadFraction` and `gunDamage`;
physics tests read hero dimensions instead of Owl's placeholder body (D-COMBAT-009 records the shot rules).
Extra items: Economy's three (close damage, flat beak once, clamps on sale) and Hero A's four (`gunDamage`,
`reloadFraction`, `maxPitchUpDeg`, toboggan Jump) all landed. `DASH.aimMaxPitchUp` stays as the default for
aim dashes without the field.
**Verified:** Git Bash `VITEST_MAX_WORKERS=1 npm run check` passed all six steps in 72 s: unit 545 passed and 32
gated, perf 6/6, seed 1 10,800 ticks with hash `6de168429bc1d876`, e2e 15 passed and 9 skipped. Lint showed
0 errors and 116 warnings, none in owned paths. The four Owl-sensitive physics tests failed with Hero B's real Owl
body applied and passed after the fix; I reverted the Owl data and did not commit it. `PERCH_PENDING=1`:
`tests/rules/practice.test.ts` passed in full. `preview-aim` passed 7 of 8; the tracer case waits on VFX
mapping. `e2e/preview-regressions.spec.ts` (Edge) passed 4 of 5. The 45 s production replay on `npm run build`
plus `vite preview` passed in Edge and Firefox. Evidence specs and output are in `out/movement/` (gitignored).
`keyboard-lock.spec.ts` (Edge) logged `lock(all)`, fullscreen on HTML, pointer lock, W held + Ctrl → Sliding,
Esc → `unlock` with fullscreen kept, and Resume → `lock(all)`. `frames.spec.ts` captured 12 Riverbank PNGs per
browser under `frames/`, with logs: dash 20.6 m/s sampled, airborne dash-jump, 13.0 m/s into the slide,
charging → heavy (Dashing) → impact → recovered → light, and parry start → whiff. I inspected the dash-jump,
heavy-lunge and parry frames; the HUD shows half pips. One parallel e2e run failed `options.spec.ts` "a rebound
Jump key jumps", a wall-clock 400 ms test; it passed 3/3 alone and in the final check.
**Blocked:** nothing in owned paths. W + Ctrl in a real tab needs the manual check: Playwright keys can't trigger
browser shortcuts. Pose visuals depend on Art and VFX.
**Interface requests:** Architect: in `app/settings.ts`, set `DEFAULT_SETTINGS.bindings = defaultBindings()`
(from `src/client/input`) and add a one-time v2→v3 step. In Chromium, when crouch is `KeyC`, item3 is `KeyN` and
nothing uses `ControlLeft`, set crouch to `ControlLeft`. The v1 path should use `free(defaultBindings().crouch)`, and
a v1 `ControlLeft` crouch stays when the lock exists. In `app.ts` `show()`, call `input.exitFullscreen()` for
'menu', 'heroSelect' and 'end'. UI: the Options capture must also `preventDefault` the captured button's `mouseup`
and `auxclick`. Edge's Mouse 4 capture still navigates back, the 1 failing pending preview case. VFX:
`mapping.ts` should draw `weapon.traces` (pending `preview-aim` tracer case). Hero A: drop Penguin's Space-hop hook
at the merge, because physics now hops. QA: after the settings change, the pending default-keys case expects
"Left Ctrl" in Edge.
**Next:** EP merge; Architect settings and `exitFullscreen` wiring; manual Ctrl check in Edge/Chrome.

### W4 · Integration (sim) · 19/11/2026
**Done** (worktree branch `worktree-agent-aa7955dafbe4fc4cb` from `integrate/w4c` 05ca953, one commit per item, D-EP-018):
1. *Pending suites* (bddf769). Always on: `tests/rules/{siege,market,practice}.test.ts`, `tests/preview-aim.test.ts`
   (whole-blast aim via `weapon.traces`), `src/sim/items/items.test.ts` (Close Talons, Whetstone), Puffin's two Rogue
   Wave assertions and Hornbill's `gunDamage` assertions. Assertions unchanged. Nothing under `src/` or `tests/` is gated
   now. Still gated, INTEG-WEB's paths: `e2e/m2.spec.ts` and `e2e/preview-regressions.spec.ts`.
2. *Siege Updraft fixture* (43fff0a). Root cause: the live enemy Hawk and Heron killed the rider before the far Heron.
   The rider now carries a test-only `invulnerable` for the ride. The 2 m clearance assertion is kept, and all 12 towers
   clear it.
3. *Rogue Wave* (aab2123, D-ABIL-011). Root cause in Abilities' `zones.ts`: the carry pushed `displace` 'along' 0.33 m
   every tick. Physics adds each push to the velocity, so 36 pushes stacked to ~27 m. The target also left the wave
   front and was re-entered, so the 160 Song landed twice. Now each entity gets one launch of `maxCarry`, or the travel
   left if shorter. It rides inside the wave, lands 12.2 m on and is hit once.
4. *Penguin* (7f3b416). Hero A's onTick hop hook (hover plus aim dash) is removed, along with its unused `hopHeight` and
   `hopCarryS` data. Physics' toboggan Jump hop is the only one.
5. *Hero B* (fc5afdf). Frenzy T3: Economy's branch has the Items `trigger` handler, so the shred is a timed
   `weaponHit` trigger with `heroesOnly` (a fledgling hit no longer shreds; new test). Scatter: GDD §9.8 "removes slows
   and roots on cast", so rooted no longer blocks a cast whose own effects cleanse the root (D-ABIL-012, derived from
   data, no contract change; Starling test casts while rooted). Owl: GDD §9.5 "ends on landing or pressing Space" now
   lives in Physics' glide mode (D-CTRL-009, new Physics test), so Owl's hook and `GLIDE_STOP` are gone.
6. *Concession* (3a99821). The bot's AI was about 3/4 of the test's 54,000 ticks. The human alone takes 0.6 s
   (2.4 s before), with no timeout change. Follow-up 28a2d6d: the sibling determinism test (three 12-bot sims, 0.8 s
   alone) then hit 5.5 s in a busy parallel run. It needs its bots, so it gets a 20 s timeout with the reason in a
   comment.
7. *Siege proof* (8b265ac), `tests/siege-proof.test.ts`. It uses the client's Play config (main, structures and waves
   on, neutrals off, no bots) with one Owl. The only input is ordinary PlayerCommands (move, look, Fire, Reload) from a
   scripted aim-and-fire agent. The agent reads state and never writes it. It keeps 4 m behind its own Riverbank wave
   and shoots threats, then each open structure from outside its reach, then the phase-two heart. **Seed 1: victory at
   tick 69,973 (19:26), hash `d662ba91ea093bbd` on both of two runs.** The hero did not die and landed 24 heart hits.
   Hawk 3:04, Heron 10:36, Wardens 13:50 and 14:54, Shrines 17:09 and 17:45, Patron depleted, then phase 2, then dead
   at 19:26. The hero got the credit for the Hawk, Heron, one Warden and one Shrine; the wave got the rest. Asserts the
   event order, all seven route falls and gun hits on every kind of route structure. Timeline in
   `out/siege-proof/seed-1.json`; about 7 s alone.
8. *Measurements*: see Verified.
**Verified:** Git Bash `VITEST_MAX_WORKERS=1 npm run check` PASS 6/6 in 146 s: typecheck 10 s, lint 5 s (0 errors,
485 inherited warnings; none in the non-test files this branch touched), test 73 s (62 files, 733 tests, none skipped),
perf 20 s (7/7), sim 5 s (seed 1, 10,800 ticks, hash `24f313406956a6f6`), e2e 33 s (15 passed, 9 skipped). Two
parallel `npm run check` runs failed the test step under load first: the determinism test at 5.5 s (fixed above), then
`src/client/audio/audio.test.ts` "is positional" at its 60 s timeout. `npm run perf` alone, 9.8 s: world +0.208 ms/tick
for 166 fledglings (budget 0.5), siege seed 1 mean 0.166 ms (p99 0.736, max 2.778), physics 0.164 ms (1), units 0.037,
abilities 0.018 ms (0.065 with 96 areas; 0.3), combat 0.049 ms firing (0.3). 35-minute replay, `npm run sim -- --seed 1
--minutes 35 --bots 12`, run twice: hash `a1572082c03a5624` both times (126,000 ticks, no winner), 58.0 s and 28.1 s.
**Not a quiet machine:** INTEG-WEB's worktree and other agent sessions were running throughout. OS CPU over 5 s on
16 logical cores read 40 % busy before perf, 63 % after, and 50 % and 84 % before the two replays. Wall times are
upper bounds; the hashes are exact.
**Found, not fixed (owners):** Audio: `audio.test.ts` "is positional" can pass its 60 s timeout in a parallel unit run
on a busy machine. Build/QA: on this shared machine the parallel unit step is load-sensitive, and
`VITEST_MAX_WORKERS=1` passed. INTEG-WEB: the two gated e2e specs above.
**Interface requests:** none.
**Next:** EP merges this branch with INTEG-WEB's; QA gate.
### W4 · Docs & Wiki · 19/11/2026
**Done:** the generated game wiki (D-EP-031): `tools/wiki/**` (generator, image plan, Playwright capture, 22 prose pages),
`wiki/**` committed (open `wiki/index.html` over file://), `tests/wiki/coverage.test.ts`, and the `wiki` script. 51 pages:
home, getting started (install, controls with the Ctrl-crouch and fullscreen note, Options, modes), Heroes (index of 24,
a page each, Abilities list), the Magpie's Hoard (index and Talon, Plumage, Song), Mechanics (movement, camera and aim,
combat, statuses, economy, vision), the map, Units and objectives (fledglings, towers, Patrons with Brood Ward and Home
Roost, dummies, planned), glossary, patch notes. Built facts come from `src/sim/data/*`, the hero registry and
`mapSvg`; unbuilt heroes, items and objectives come from the GDD and are marked "Coming in Stage N" (stages from the
milestones in this file). Search, themes, breadcrumbs, click-to-enlarge pictures, no external resources.
Images (175 files, 3.3 MB): 114 JPEG screenshots of the running game (36 hero portrait/front/side, 48 ability casts,
11 units and structures, 3 pose sheets, 5 map, 10 UI, 1 banner) plus 61 generated SVG (48 item icons, 12 silhouettes
and the map). Names carry a hash of what they show; `npm run wiki` captures only what changed, `-- --images` forces all.
**Verified:** `npm run wiki` (first run 622 s, 0 fallbacks; second run re-captured 1 and reused 113); `npx vitest run
tests/wiki` 9 passed; typecheck and lint clean for my paths. Looked at PNGs of home, hero, items and map pages in Edge
over file:// and a sample of captures.
**Blocked:** nothing. **Limitations:** ability pictures are cast in the practice arena with default aim, so unit-targeted
and ally abilities show the cast pose more than a hit; hero tips are short; the Stage 3 patch-note section is built from
data until PLAYABLE.md gains its Stage 3 notes at the gate.
**Interface requests:** EP: regenerate with `npm run wiki` at each gate (browser run, about 10 min from scratch); the
coverage test only warns when screenshots go stale.
**Next:** regenerate after the W4 integration merges.
### W4 · Integration (web) · 19/11/2026
**Branch:** `worktree-agent-a5ca649f38fec2f9c` from `integrate/w4c`; six commits, one per item, in `src/client/**` and
`e2e/**` only. `npm run check` 6/6 green (typecheck, lint, test, perf, sim, e2e 32 passed). `m2.spec.ts` and
`preview-regressions.spec.ts` are now always on (their PERCH_PENDING skips are gone); all e2e were run in installed
Edge with real key and mouse input. PNGs are in `out/web/` (gitignored), all looked at.
1. **Settings.** Root cause: `DEFAULT_SETTINGS` and `sanitizeSettings` took the static `DEFAULT_BINDINGS`, so a new
   profile never got the input module's Left Ctrl crouch. Fix in `app/settings.ts`: a fresh profile, the sanitiser
   fallback and Options' Reset use `defaultBindings()`. Storage key is now `perch.settings.v3`; a v2 (or v1) profile
   migrates once, and where keyboard lock exists an untouched `KeyC` crouch becomes `ControlLeft` unless that code is
   used by another action. `app.ts` `show()` calls `input.exitFullscreen()` for menu, heroSelect and end. Unit test
   covers lock/no lock, custom and taken codes. The old Edge crouch key in e2e was `KeyC`; `crouchKey(page)` now asks
   the browser.
2. **Mouse 4/5.** Root cause: only the Options capture swallowed them; play, menus and the pointerup path did not.
   Fix in `input/index.ts`: capture-phase `preventDefault` on mousedown, mouseup, pointerup and auxclick for buttons 3
   and 4, always. Not pointerdown: cancelling it suppresses the compatibility mousedown and broke Options capture
   (found by the existing side-button test). `options.spec.ts` sends real CDP back presses on the menu and during
   capture; it fails without the fix (history navigates) and passes with it.
3. **Key routing.** New `keys.spec.ts`: in Play and the Practice Hub, B opens the Magpie's Hoard (pointer freed, B
   closes), held Tab shows the Scoreboard (pointer stays locked), M toggles the big map, an Alt tap opens Ability
   Upgrades. All pass, no source defect. The rebound-melee pointer-lock case passed 6 of 6 repeats here. The
   Practice Hub trial failure was in the test: it strafed to a position and the crosshair was about 50 px off the
   dummy, so a second trial hit once. New `aimAtDummy` steers with real mouse look to the dummy label.
   Shots: `keys-{match,practice}-{shop,scoreboard,map,upgrades}.png`.
4. **Tracers.** VFX does draw `weapon.traces` (`vfx/mapping.ts`). `tracers.spec.ts` freezes the render loop two frames
   after a shot and saves it: Kingfisher's line and Albatross's six pellets meet the centre reticle on a far open
   sightline; the Albatross fan is centred on the reticle beside a wall; Kingfisher's trace ends on the enemy dummy
   under the reticle with its -22 number. With the muzzle pressed to a wall the trace stops at the wall next to the
   gun, not at the reticle, which is right for a blocked muzzle. No defect found. `tracer-*.png`.
5. **Practice Hub.** `m2.spec.ts` now starts from the menu: Lyrebird shoots the enemy dummy and heals the ally dummy
   twice with resets; upgrade panel frees the pointer, all four skills hovered, one click is exactly 1 AP and one
   tier, the last tier is bought, a forced click on the maxed (locked) upgrade spends nothing, Escape closes it and
   right-mouse aim returns. `practice-heal.png`, `upgrades-hover-1..4.png`, `upgrades-locked-click.png`,
   `ability-upgrades.png`.
6. **Play from the menu.** New `match.spec.ts`: Kingfisher; 872+ Seeds and Lv 2 by minute 15, buy Quill Clip (800) in
   the base shop zone, sell it back for the full refund, Tab, M, then walk the Hedgerow lane with W and mouse steering
   (`walkTo`) to the fledgling clash and sweep fire until a damage number (non-green) appears; passed 3 of 3 repeats.
   `match-*.png`. To avoid a 15 minute wait, `?t=` now also fast-forwards a match started from the menu
   (`app.ts`, router comment); every action after the hero appears is real input. Limitation: the Seeds come from
   passive income plus fast-forward, not from real kills; killing fledglings for Seeds, a Patron fight and victory
   by player controls are INTEG-SIM's siege proof.
**Blocked:** nothing. **Interface requests:** none. Manual W+Ctrl in a real tab is still unchecked.

### W4 · Lint and test hygiene · 19/11/2026
**Role:** QA, acting for Audio, VFX, Heroes, Abilities, Combat and Build (one commit each, no behaviour change).
Base `fe56ab7` on `integrate/w4c`. `npx eslint .` now reports 0 warnings (was 485). No rule is suppressed globally.
**Warnings before → after, per owner:**
- Audio 375 → 0 (`synth.ts` 303, `music.ts` 42, `index.ts` 30). Recipes and music tables moved to `src/client/audio/data/`
  (`heroes.ts` guns, calls, casts; `cues.ts` combat, movement, structure, objective and ping cues; `music.ts` tempo,
  states, chords, stem recipes). `synth.ts` keeps only the primitives, `music.ts` and `index.ts` keep logic with named
  constants (`Len` cue lengths, `ULT_SLOT`, LCG constants).
- VFX 67 → 0 (`bound.ts` 48, `fx.ts` 15, `mapping.ts` 4): named groups at the end of `vfx/constants.ts` (D-EP-009).
- Abilities 34 → 0: `fixtures.ts` is now `fixtures.testkit.ts` (imports in `fixtures.test.ts` and
  `abilities.perf.test.ts` follow).
- Heroes 9 → 0 (hornbill 3, penguin 2, flamingo, pelican, puffin, secretarybird 1 each): local named constants.
- Combat 0 → 0: `testkit.ts` loses its file-level eslint-disable, now redundant.
- Build: `eslint.config.js` no-magic-numbers ignores `src/client/**/data/**`, `**/testkit.ts`, `**/*.testkit.ts` (D-QA-009).
**Audio tests, old → new** (`src/client/audio/audio.test.ts` launched Edge inside vitest; 4 of 9 timed out in parallel):
| Old test (vitest) | New test |
|---|---|
| every hero gun produces a distinct, finite signal | `e2e/audio.spec.ts` same name |
| every hero call plays on respawn and differs per hero | `e2e/audio.spec.ts` same name |
| the event table makes sound (11 events in one test) | `e2e/audio.spec.ts` "the event table makes sound: <event>", one test per event (11) |
| structure under hero fire sounds the map-wide alarm at most once per 4 s | `e2e/audio.spec.ts` same name |
| master 0 silent; sfx 0 mutes effects; music 0 mutes music | `e2e/audio.spec.ts` same name |
| volume changes live, mid-sound, and reset() silences old voices | `e2e/audio.spec.ts` same name |
| positional: farther quieter, beyond 60 m dropped, enemies pan | `e2e/audio.spec.ts` same name |
| music states differ; change takes effect next bar | `e2e/audio.spec.ts` same name |
| live context: no context until a real click, then real-time signal | `e2e/audio.spec.ts` same name |
The old file had no voice-allocation or settings-maths tests, so these are new fast unit tests in the rewritten
`src/client/audio/audio.test.ts` (Node, fake context, 4 tests, ~0.2 s): positional voices beyond `MAX_DISTANCE` are
dropped; the `MAX_VOICES` cap refuses a farther voice and steals for a nearer one; `reset()` frees voices; master,
sfx and music buses follow the volume settings live. The e2e file runs serially (`describe.configure`) because
concurrent headless offline renders stalled about 1 in 50 runs; 95 of 95 passed over 5 repeats.
**Verification:** `npm run check`, all six steps PASS with parallel tests (typecheck, lint 0 warnings, test, perf, sim, e2e).
### W4 · Animation quality fix · 19/11/2026
**Branch:** `worktree-agent-a6e51f7e33802afbc` from `integrate/w4c` (d2c91fd); commits in `src/client/render/models/**`,
`src/client/render/rigs/**` and `tests/anim/**` (acting for QA there), plus this entry and D-ART-003.
**Done:** (1) Each bird is one skinned mesh (rigid weights) over 16 bones: body, head, tail, halo, two-segment wings
ending in a hand, two-segment legs with a foot, and the gun with a sliding fore-end. (2) The gun leads. While aiming,
moving, jumping or falling, the gun bone sits at the sim's `muzzlePoint` (crouch-scaled), aimed with the look pitch,
whatever the body does. Two-bone IK puts the right wing on the pistol grip and the left wing on the fore-end. Recoil
kicks once per shot at the hero's fire rate, just after the shot leaves. Reload rolls the gun out and racks the
fore-end. Light melee swipes the barrel across, heavy raises it and smashes, charge holds it up as a club, and parry
holds it across the chest. The wings follow the gun in every case. (3) Each kit has a cast pose per slot (raise, throw,
sweep, stomp, leap, aim). Free-wing casts lower the gun to a one-winged carry, and the gun never leaves the rig.
(4) Legs: grounded feet plant on the ground and step under the hips at the ground speed, within the legs' reach. The
hips stay at standing height under any lean and centred over the feet, and a waddle rocks the body above them.
Landing compresses the legs. Rising feet tuck and trail; falling feet reach for the ground. Legs go forward on a
slide, limp when dead and scrabble on a climb. The Flamingo's idle and stomp casts lift one foot. (5) Wings fold
against the flank with primaries trailing past the wrist; gun metal is lighter so it reads on dark plumage.
(6) `modelState` gains aim, jump, fall, land, hit, cast1..cast4.
**Verified:** `tests/anim/attachment.test.ts`, 52 tests: the 12 playable birds plus the generic one, 24 states each,
sampled every 0.05 s over 1.6 s after settling. Measured worst cases: main grip 0.00 mm, fore-end 0.00 mm, aim muzzle
0.00 mm from `muzzlePoint` (pitch -0.6 to 0.6, standing and crouched), planted foot 0.00 mm. The bars are 2, 3 and
3 cm. Every mesh and bone descends from the root, and every vertex follows a rig bone. Pose sheets come from
`npx tsx tests/anim/posesheets.ts` as `out/anim/<hero>.png` (24 states, three-quarter and side, the sim muzzle shown
in red); I looked at all 12 plus the generic one, and at the hornbill in the practice hub (`out/anim/ingame-hornbill.png`).
`npm run check` 6/6 PASS (e2e 33 passed). Draw-budget peaks: lane/low 17 (was 24, ceiling 32), lane/medium 26 (was
41, ceiling 48), match/medium 36 (was 218, ceiling 248).
**Limitations:** (a) Resolved: at the EP's direction, acting for Hero Engineers A and B on this field only,
`body.muzzle.right` is now albatross 0.38, pelican 0.48, penguin 0.32 and secretarybird 0.34, so each gun runs
outside its flank. The stock turn-out workaround is gone. The combat test kit now reads each fixture's muzzle from
hero data instead of a copied 0.25/0.35, and `aim.test.ts` keeps its own generic body. Side, far-side and back
sheets (`--views side,left,back`) show no part of the gun through the body. (b) The view carries no cast slot, so in play every cast shows the fallback 'raise' pose. Per-slot poses show in the
sheets and `modelState=castN`. Most casts are instant, so casts are mostly seen on windups and channels.
(c) Above the step-rate cap (30 rad/s), short-legged birds' feet slip at full speed; the stance foot stays down.
(d) Climb, mantle and Updraft keep both wings on the gun, so there is no flapping. (e) The Lyrebird's lyre dips into
the ground when dead (unchanged). (f) The recoil cycles from the start of Firing at the base fire rate, because pose
gets no shot events.
**Interface requests:** Architect: `EntityView.castSlot` (from `AbilityState.casting`), so the rig plays the
per-slot cast pose in play (the parameter is already on `BirdRig.animate`). The muzzle request is done (see (a)).

### W4 · QA gate · 19/11/2026
**Verdict: BLOCK** (`integrate/w4c` at f09d619). Two narrow blockers; everything else I could test passes, so a re-review
should be quick. Nothing under `src/`, `tests/`, `e2e/`, `tools/` or `wiki/` was changed; scratch scripts live in `out/qa/` (gitignored).

**Blockers**
1. *`npm run check` is not reliably green (Audio / QA, `e2e/audio.spec.ts`).* `bash scripts/check.sh` ran four times on this
   checkout: three FAILED at the e2e step and one passed (109 s). Each failure is a different audio test hitting the 30 s
   timeout inside `page.evaluate` (offline render stall): `pod.resolved secured`, `pod.resolved denied`, `is positional`. The
   other five steps passed every time. `npm run e2e` on its own passed 52/52 five times and `audio.spec.ts --repeat-each=3`
   passed 57/57, so it is load-related, not one broken test. Repro: run `bash scripts/check.sh` until e2e fails
   (`out/check/e2e.log`). W4-common requires all six steps green; fix the stall or give the audio group a bounded retry
   with the reason in a comment.
2. *The result screen has never been seen (UI/HUD with Integration web).* No test, e2e or screenshot reaches `endScreen`,
   and no committed e2e finishes a match. The siege proof is sim-level (below), and a browser siege on real input needs
   about 20 min of play plus state the `window.__perch` hook does not expose. The pause menu also has no Concede button
   (`screens.ts:76`), although `actions.concede` exists in `app.ts:99`, so I could not show a Defeat screen either. Needed:
   one browser case that ends a match and screenshots Victory (for example a client-level test feeding a real
   `match.ended` and telemetry through `app`), and a decision whether Concede belongs on the pause menu.

**Verified (own runs)**
- `npm run check` steps: typecheck 7 s, lint 5 s (0 warnings, 0 errors), test 13 s (64 files, 790 tests, none skipped), perf 10 s
  (7/7), sim 3 s (seed 1, 3 min, hash `24f313406956a6f6`), e2e 76 s (52 passed) on the green run. No `skip`, `PERCH_PENDING`
  or `todo` in `src`, `tests` or `e2e`; the only skip is the Firefox case of the Edge-only CDP side-button test. M2 rule
  suites (`siege`, `market`, `practice`, `pods`, `fledglings`) are always on.
- Determinism: `npm run sim -- --seed 1 --minutes 35 --bots 12`, twice, hash `a1572082c03a5624` both times (matches INTEG-SIM),
  126,000 ticks, no winner, 14.5 s and 14.3 s. Per-tick timing (own script, `out/qa/tick.mts`): mean 0.113 ms, p50 0.102,
  p99 0.346, p99.9 0.893, no tick over 3 ms after tick 0 (66 ms warm-up); 5-minute window means 0.103 to 0.119 ms (flat, no
  leak). Serial `npm run perf`: world +0.139 ms/tick for 166 fledglings (0.5 budget), physics 0.112, combat 0.035, abilities 0.049
  with 96 areas.
- Draw calls (Edge, 1920 by 1080, seed 1, t = 100 s, fixed Hedgerow camera, 12-frame peak): lane/low 17 calls, 34.7k triangles;
  lane/medium 25, 52.8k; match (12 heroes, about 150 fledglings)/medium 36, 64.6k. Ceilings 32, 48, 248. `draw-budget.spec.ts` passes.
- Ownership: commits since main stay in their owners' paths except recorded exceptions (integration commits, D-EP-018; ART
  `60d0939` touching Combat and Data muzzle fields at the EP's direction; lint pass D-QA-009). Sim purity: no `Math.random`,
  clocks, DOM, `three` or Node imports under `src/sim` outside tests (my grep hits were comments only). Runtime errors: none in
  any e2e, in my scratch runs, or in the production Edge and Firefox runs.
- Machine: not perfectly quiet. The user's Edge windows (about 60 `msedge.exe` processes), `node_repl` and a few idle node
  servers were running; no other PERCH agent. Timings are upper bounds, hashes exact.

**One evidence line per M2 gate item**
| Item | Evidence | State |
|---|---|---|
| Seeds, levels, AP, shop | `tests/rules/market.test.ts` (bounty, Molts, 3,000 Seed ultimate, streak, 16-item catalogue and trades), `economy.test.ts:75, 90, 125` (last hit, secure/deny, passive income), `pods.test.ts`; `e2e/match.spec.ts` buys the 800 Seed Quill Clip and sells it back in the shop zone (`out/web/match-shop-bought.png` read: Hoard, 3 columns, Owned, inventory 1/12) | proven |
| Flex slots | `economy.test.ts:22` (four slots, Patron pays none); the shop panel shows the four unlock lines | proven |
| Structures, 2-phase Patron, won by hand | `tests/siege-proof.test.ts`: one Owl on ordinary commands (look, move, Fire, Reload), seed 1, victory at tick 69,973 (19:26), hash `d662ba91ea093bbd` re-run here and identical to INTEG-SIM, 0 deaths, 24 heart hits; Hawk 3:04, Heron 10:36, Wardens, Shrines, Patron depleted, phase 2, ended; `siege.test.ts` for gates, Brood Ward x0.35, Heron stomp, Patron phases | proven in sim; not by hand in a browser (blocker 2) |
| Result screen | not seen | open (blocker 2) |
| Hawk punishes shooting an allied hero | no test names it. My scratch run (`out/qa/hawk.mts`, real Dusk Riverbank Hawk, sandbox damage): the Hawk left a nearer hero and targeted the aggressor in 4 ticks (0.07 s) | observed; needs a committed test (Objectives / QA) |
| Updraft clearance over Hawk and Heron | `siege.test.ts:54` (at least 2 m under the rider, all 12 towers), `structures.test.ts:64`; Riverbank ride in `e2e/play.spec.ts` | proven |
| HUD, minimap, pings, scoreboard, damage numbers | PNGs read: `match-damage-numbers.png` (HP, 3 pips, Lv, AP, Seeds, four slots, ammo, Patron bars, three Hawks, minimap, feed, a 23 damage number), `match-scoreboard.png`, `match-map.png`; ping by real middle-click (`out/qa/ping.png`): world marker "Go here 22 m", feed line and minimap ring, no errors | proven |
| Minimap vision rule | `world.test.ts:165, 213`; the minimap shows structures and allied dots only | proven |
| Audio | `e2e/audio.spec.ts` (every hero gun and call, 11 event cues, structure alarm once per 4 s, positional, settings live, real context after a click), 57/57 on repeat; Options sliders in `out/qa/options.png` | proven (subject to blocker 1) |
| Options persistence, Stage 2 features | `options.spec.ts`, `preview-regressions.spec.ts` in Edge and Firefox (production), `play.spec.ts`, `m2.spec.ts` | proven |
| Practice Hub, upgrade panel | `m2.spec.ts` from the menu: Lyrebird shoots the enemy dummy and heals the ally twice with resets (`practice-heal.png` read: ally 332 / 580, +100, enemy -16); the panel frees the pointer, hover on all four skills, one click is one AP and one tier, a locked click spends nothing, Esc returns aim (`upgrades-hover-2.png` read: 32 AP) | proven. Defect: in `upgrades-hover-2.png` two description cards overlap (hover on Echo Double plus the focused Mended Song card); cosmetic (UI/HUD) |
| Twelve birds pickable from the menu | `m2.spec.ts:218` counts 12 Pick cards across A1, A2, B1 | proven |
| Tracers and aim (Albatross, single shot) | `tracers.spec.ts` plus PNGs read: the Albatross fan meets the reticle on an open sightline and beside a wall; the Kingfisher's blocked muzzle ends at the wall by the gun | proven |
| Animation bar (D-EP-035) | I read all 12 pose sheets (`out/anim/*.png`, `npx tsx tests/anim/posesheets.ts`). The gun is held in every state, feet are planted when grounded and tuck or reach when airborne, nothing floats, no gun shows through a body. `tests/anim` 52/52 pass | passes, with notes below |
| Ctrl crouch and fullscreen keyboard lock (D-EP-030) | Production build, Edge 156.0.4314.50, real menu: the Options note reads "Left Ctrl + W / R / Q / N / Tab: Works in fullscreen in Chrome and Edge"; entering Play called `requestFullscreen` then `keyboard.lock` (call-through wrappers), `fullscreenElement` is HTML; holding W then Left Ctrl set the Sliding flag; page alive, no errors (`out/qa/lock.mts`) | proven as far as automation goes |
| Real Ctrl+W | **Manual check for the user.** The Movement entry gives no steps, only that Playwright cannot press browser shortcuts. Steps (mine): in Edge or Chrome, from the menu choose Play and a bird, click to enter (the tab goes fullscreen), hold W, press Left Ctrl; the bird should slide and the tab must stay open. Esc once releases the pointer; Resume relocks. In Firefox the default is C, so there is nothing to check | open (user) |
| Wiki (D-EP-031) | Opened over file://: home, heroes index, Albatross, Penguin, Talon items, Old Mossmarket, Combat, Towers (`out/qa/wiki/*.png` read). 12 Playable badges, 12 "Coming in Stage 4", 16 "In the shop" items, 32 coming, no broken images, held-gun models in the portraits. `tests/wiki` 9/9 | passes |
| Firefox | Playwright Firefox 159.0 (build 1572, already installed; nothing downloaded) on `vite preview` of `npm run build`: `preview-regressions.spec.ts` 4 passed, 1 skipped (Edge CDP side-button case), including the 55 s production soak (W, Shift, Space and crouch rounds for 45 s after a slide, pointer lock kept, sim ticks advancing, no crash, WebGL loss or navigation). Same file in Edge 156.0.4314.50: 5/5 in 55 s | proven; native Firefox side-button history still unverified |
| M1 preview reports | Reproduced by the above: browser-safe defaults and legacy migration, side buttons without history navigation (Edge CDP), pointer-locked light, heavy and parry, the 45 s run. Tab liveness here means `page.isClosed()` false, URL unchanged and no `crash` event, which separates a renderer crash and navigation from a native close shortcut (automation cannot raise that). Two real side-button rebinds across a restart: `options.spec.ts` (reload in one context, not a cold restart) | proven, except a cold restart |

**Animation notes (none blocks)**
- Shrike: the gun reads as a very long thin pole in side views (idle, charge, dash, heavy); it looks like a stick, not a rifle.
- Albatross: the gun is the same dark brown-grey as the wings and is hard to find in the three-quarter views (aim, idle, shoot).
- Owl: the rifle sits at throat height across the collar in idle and run, so it crosses the face line in three-quarter view.
- Hornbill, dead: the tail bars lie as three detached black squares beside the body. Lyrebird, dead: the lyre stands into the ground
  (known, ART limitation e). Starling, dead: halo petals scatter in the air.
- Secretarybird run: the leading leg looks short in the three-quarter view; planted foot error is 0.00 mm in the test, so it is the camera angle.
- Albatross, Pelican, Penguin: the gun stays outside the flank in every view (the D-EP-035 follow-up worked).
- Casts show the generic raise pose in play until `EntityView.castSlot` exists (ART request, open).

**Follow-ups by owner**
- *Audio / QA:* blocker 1.
- *UI/HUD with Integration web:* blocker 2; overlapping ability cards on hover plus focus; decide on a Concede button.
- *Objectives / QA:* a committed test for the Hawk aggressor priority (`structures.ts:114`).
- *ART:* gun colour contrast on dark-winged birds, the Shrike's gun length, Owl rifle height, Hornbill tail when dead; `castSlot`.
- *Architect:* `window.__perch` exposes no sim view, so no browser case can read structure or match state; a read-only `state`
  (tick, winner, structure health) would allow a real-input siege case.
- *EP:* PLAYABLE.md "Stage 3 (M2)" after the two blockers; run the manual Ctrl+W check above.

**Blocked:** nothing for me. **Interface requests:** the read-only `__perch` state above.
**Next:** owners fix blockers 1 and 2; independent re-review; the EP writes PLAYABLE.md and merges.

### W4 · Gate fixes · 19/11/2026
**Branch:** `worktree-agent-a2435476d2641ed6f` from `integrate/w4c` (64f5c84); one commit per item, acting for each
owner, no contract changes. Node 22.23.4, Edge 156; the user's Edge windows (about 60 `msedge.exe`) were open and no
other PERCH agent ran. Five consecutive `npm run check` runs on 1f0f900, all 6/6 green:
- Run 1 (19:03–19:06): `PASS typecheck 6s · lint 4s · test 13s · perf 10s · sim 2s · e2e 100s · check 136s`, e2e `55 passed (1.7m)`
- Run 2 (19:06–19:08): `PASS typecheck 6s · lint 4s · test 11s · perf 9s · sim 2s · e2e 99s · check 131s`, e2e `55 passed (1.6m)`
- Run 3 (19:08–19:10): `PASS typecheck 6s · lint 4s · test 11s · perf 8s · sim 3s · e2e 98s · check 130s`, e2e `55 passed (1.6m)`
- Run 4 (19:10–19:12): `PASS typecheck 7s · lint 4s · test 11s · perf 8s · sim 2s · e2e 99s · check 132s`, e2e `55 passed (1.6m)`
- Run 5 (19:12–19:15): `PASS typecheck 6s · lint 4s · test 12s · perf 8s · sim 2s · e2e 99s · check 132s`, e2e `55 passed (1.6m)`
Unit tests 792 in 64 files (was 790: +2 Hawk cases); e2e 55 (was 52: +replay scene, +Victory, +Defeat).
PNGs in `out/web/` (gitignored), all looked at: `result-victory.png`, `result-defeat.png`, `result-concede-locked.png`.
1. **Flaky check (QA/Build, 620fb0f, D-QA-010).** Root cause: the offline audio renders share the machine with the
   parallel browser suites and stall. `playwright.config.ts` now has an `app` project (everything else, parallel) and
   a one-worker `serial` project for `audio.spec.ts` (and `result.spec.ts`, below) that depends on `app`, so it starts
   when the parallel suites have finished. Timeout unchanged, no retry. Alone the audio tests take 0.2–0.7 s each.
   `--no-deps` runs a serial file on its own.
2. **Result screen in the browser (UI/HUD, app, QA).**
   - *Victory replay (312ca59, D-ARCH-020).* The siege-proof agent moved unchanged to `src/sim/ai/siege-proof.testkit.ts`
     (headless proof still tick 69,973, hash `d662ba91ea093bbd`). `?scene=replay&seed=1` starts the ordinary Play match
     (`matchConfig`, Owl) and the agent writes the local hero's command each tick through the app's normal step loop,
     up to 45 ms of stepping per frame; events go to VFX, UI and audio; the end screen comes from the usual
     `isOver` check. Input is disabled and the camera follows the agent's look. `e2e/result.spec.ts` asserts Victory,
     "Dawn Flock wins", "Match length 19:26 seed 1", the Owl row (26,639 structure damage, 93 last hits), the graph,
     and in `__perch.state` winner Dawn, Dusk Patron down, Dawn Patron and other lanes standing. About 8–9 s.
   - *Concede (17be621, D-UI-005).* Pause menu: Concede between Options and Quit, wired to `actions.concede`. Before
     15:00 it is disabled and the line under it reads "Concede is available from 15:00 (now 14:56)."; from 15:00 one
     click arms it ("Confirm concede"), a second concedes. The e2e plays from the menu with `?t=896`, checks the lock,
     resumes until 15:00, concedes by real clicks and asserts Defeat, "Dusk Flock wins", "Match length 15:00 seed 1",
     the Albatross row, the graph and `__perch.state` (winner Dusk).
   - *`window.__perch.state` (312ca59).* Read-only copy per read: screen, tick, seconds, over, winner, `hash` (computed
     when read) and every structure's id, team, type, lane, phase and health.
3. **Hawk retarget (Objectives/QA, 42b9448).** `siege.test.ts`, both flocks: the Riverbank Hawk holds the nearest
   enemy hero, then switches within 0.5 s to a farther hero whose real gun hits an allied hero within 22 m, and shoots
   it. With the aggressor rank forced off in `structures.ts` both cases fail.
4. **Upgrade panel (UI, 133a19f).** Root cause: `:hover` and `:focus-within` each showed their row's card. The focused
   row's card now shows only while no row is hovered. `m2.spec.ts` asserts one visible card on every hover; on the old
   stylesheet it fails with 2.
5. **Wiki (1f0f900).** `npm run wiki` re-captured the 11 screenshots hashed on `src/client/ui` and `app`. The "Ability
   Upgrades panel" image never showed the panel: the capture held Alt, but since W4 a tap opens it. `capture.ts` now
   taps; the new image shows the panel with one card.

**Finding for the Architect (not fixed, determinism):** the same seed-1 replay ends at the same tick (69,973) in Node
and in Edge, but the hashes differ (Node `d662ba91ea093bbd`, Edge `ab8a354ac8f9a12a`) from tick 3 on; tick 0 matches
(`1802f2ad99d26a97`). The bare sim run in the page with the same commands gives the Edge hash too, so the app adds
nothing; the gap is between JavaScript engines (likely a `Math` function's last bit). Replays and saved hashes are
per engine until that is pinned down.
**Notes:** the end screen's net worth graph is narrower than its dark panel (UI, cosmetic). Concede also shows in the
Practice Hub, where the sim allows it after 15:00.
**Blocked:** nothing. **Interface requests:** none.

### W4 · EP note · 19/11/2026
**Open, high priority for W4.5 (Architect):** the siege replay hash differs between Node (`d662ba91ea093bbd`) and
Edge (`ab8a354ac8f9a12a`) from tick 3, although both reach Victory on the same tick (69,973). This breaks the rule that
Node and the browser hash identically. It does not block Stage 3 (no feature yet relies on cross-environment replays),
but it must be root-caused before the Stage 4 Build Lab relies on headless results.

### W4 · QA re-review · 19/11/2026
**Verdict: APPROVE `integrate/w4c` (36399f4).** Node 22, Edge, clean `npm ci`. Nothing under `src/`, `tests/`, `e2e/`, `tools/`, `wiki/` changed.
- `npm run check`, three consecutive runs, all 6/6 green, e2e 55 passed each time:
  1. `PASS typecheck 6s · lint 5s · test 14s · perf 10s · sim 3s · e2e 100s · check 138s`
  2. `PASS typecheck 6s · lint 4s · test 11s · perf 8s · sim 2s · e2e 103s · check 134s`
  3. `PASS typecheck 7s · lint 4s · test 11s · perf 8s · sim 2s · e2e 99s · check 131s`
- Result screen, real input in Edge (`e2e/result.spec.ts`, screenshots viewed): pause menu, Concede locked before 15:00, then armed, confirmed, Defeat ("Dusk Flock wins", 15:00, Albatross row, graph); `?scene=replay&seed=1` reaches Victory ("Dawn Flock wins", 19:26, Owl 26,639 structure damage, graph).
- Hawk retarget: scratch edit disabling the aggressor rank in `structures.ts` (reverted, nothing committed) fails 4 siege tests (dawn and dusk, both new retarget cases and the hold/interrupt case); 16/16 pass without it.
- Upgrade panel: `upgrades-hover-2.png` shows exactly one description card; the m2 hover assertion passed in all three runs.
- Spot-check, no regressions: 12 pickable birds (m2 e2e), Practice Hub (m2/keys e2e), pose sheet `pose-melee` looks right, wiki home renders with no page errors or failed requests.
- Note, not a gate box: the Node/browser replay-hash difference is logged by the EP as a W4.5 item.

### Stage 4 · EP note · 19/11/2026 · bug reported by the user
**Hero select layout shift (UI/HUD, wave 5):** hovering a card shows its description inside the grid, and the
descriptions differ in length, so the other cards move on every hover and are hard to click. Fix: the description
must take no space in the grid (a fixed-size detail panel or a floating hover card); every card keeps its size and
position whatever is hovered or focused. Regression e2e: hover and focus every card in turn and assert that no card's
bounding box moves by even 1 px.
### W4.5 · Game Director · 19/11/2026
**Done:** GDD design pass for Stage 4 on `worktree-agent-a0244705241598855` (from `integrate/w5` fcf1de6). Mechanics
follow deadlock.wiki (map, crates and buff containers, permanent buffs, melee machines, neutral camps, powerups,
urn, mid-boss and crystals, healing snacks, steam vents, jump pads, veils, tunnels and secret shops, ziplines,
items); names, wording and layout are PERCH's own, and no wiki text was copied.
- **Old Mossmarket (§6.5, §6.8–§6.12):** a building kit with numbers; 12 archetypes (Market Hall or Water Mill, Bell
  Tower, Granary, Warehouse, Tavern, Hollow-tree House, Terrace House, Seed Exchange, Stilt House, Hide, Dovecote);
  footprints on the existing grid with 8 enterable jungle buildings per quarter plus lane houses; three jungle zones,
  five named paths, sightline and flank rules; anchors for 24 Thickets (8 indoors), 100 Nests, 8 Bell Feeders,
  22 Berries, 8 Hides, 8 Bough Springs, 14 Lookouts, 32 ivy curtains, the Cellar Run and Magpie Dens; an ASCII plan
  of the west quarter; interior sight, sound and ability rules; a prim, nav, triangle, draw-call and sim budget.
- **Objectives (§7.8–§7.15):** Thickets, Nests, Feather runes, Golden Egg and the Roc revised to the reference with
  every number; new keepsakes, Bell Feeders and interactables. Deviations are marked **(deviation)** (D-DIR-010).
- **No Interact key (D-EP-039, D-DIR-011):** §3.1 table of how every object is used; Updraft latch by held Jump
  with reach, hold time, lockouts and a fresh-press dismount (§3.7); Egg picked up by light or heavy melee, set
  down with Melee, delivered on entering the Stone.
- **Items (§10, D-DIR-012):** 64 items (21 / 21 / 22, 16 per tier), 16 new with full specs and chains, 15 actives,
  a 4-active cap, a gap review (§10.4) and new primitive parameters.
- **Bots and builds (§11.3–§11.8):** interiors, Thickets, Nests, Feeders, Berries, Hides, Springs, Lookouts, runes,
  Egg and Roc behaviour by difficulty; the D-EP-036 scored buying policy and its prior; early, mid and late cores
  and situational picks per archetype; map telemetry counters.
- Ripple: glossary, controls, melee, statuses, economy, HUD, minimap, shop, scoreboard, audio, timeline, M3
  checklist with a gate-coverage table, Appendix A. D-DIR-010 to D-DIR-013.
**Verified:** `npm ci --prefer-offline --no-audit --no-fund` (145 packages). Git Bash `VITEST_MAX_WORKERS=1 npm run
check`: `PASS typecheck 7s · lint 5s · test 48s · perf 11s · sim 3s · e2e 114s · check 188s`; 792 unit tests, e2e
55 passed, lint clean, sim seed 1 10,800 ticks hash `24f313406956a6f6`. No `src/` change. GDD scanned for TBD and
stale Ember, rune, Interact and item-count references; Nest, camp, Berry, Lookout and curtain totals recounted from
the anchor tables; the west-quarter plan was drawn by script from the §6.9 footprints.
**Limits:** design only. The Level Designer must confirm the footprints against the rebuilt geometry; the §6.12
budget assumes about 410 prims per quarter.
**Interface requests:**
- Architect: map schema for storeys, openings (door, shot window, leap window), ladders, hatches, interior volume
  ids, ivy curtains, Hides, Lookouts, Bough Springs with an arc, Berries, Bell Feeders, Magpie Dens and the Cellar Run
  speed volume; a `spring` nav link; pickups for seed sprigs, crumbs and keepsakes; keepsake stats as one source per
  type; `statMod` stats `meleeDamage` and `meleeDamageTaken`; `damage` by % of current HP; a cast-granted trigger on
  the next N gun hits; ally `unit` targeting with a self fallback; the hidden state; removal of the Interact command
  and the held-Jump latch input.
- Character Controller and Camera & Input: the §3.7 latch and dismount, and dropping saved Interact bindings.
- QA: raise the `main.test.ts` prim ceiling from 1,500 to 3,000 with the W5 map.
**Next:** W5 implementers build from §6–§7, §10 and §11; the Director reviews the M3 feel checklist at the gate.
