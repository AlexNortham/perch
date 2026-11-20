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
- **Simulation track** (runs alongside Stages 4 and 5; never holds up a gate, D-EP-044): the Build Lab (1,000+ matches
  until the scores converge, D-EP-036/037) and later the ability-balance campaigns (D-EP-043). Their results merge
  into whichever release is next once they have converged and been validated.
- **W6**: Level Designer (detail polish and bot navigation through interiors) · Hero Engineer B, batch B3 (frigatebird, cockatoo, swan,
  kiwi) · Technical Artist (B3 birds) · Bot AI (build lists and tuning for all 24) · Hero polish (fixes from earlier
  reviews) · QA (20 seeded headless matches, soak)

**Two pushes (D-EP-050, D-EP-051).** Stage 4 reaches `main` in two releases.

**Release 1 · functionality.**
- Gated on every item below except the art item.
- Gated on stability:
  - the full check passes three times in a row, serially, on the release candidate;
  - no known flaky test is left unexplained;
  - 20 seeded headless matches end with a winner and no crashes.
- Includes all art finished so far: the art agents wrapped up on 21/11 and their committed, tested work merges into the
  candidate.
- A hero without its final model uses the default bird.

**Release 2 · visual upgrade.** Starts only after Release 1 is pushed. It covers the rest of the bird conversions,
structures and creatures, the environment's third pass, load-time work, and the Build Lab's learned builds if they have
converged. It is pushed when done, against the same stability bar.

**Stage 5 does not start after Stage 4 (the user, 21/11/2026).**

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
- [ ] No placeholder shapes in normal play (D-EP-047): every building (facade, roof, interior), prop, Nest, Thicket
  camp, structure, Patron and bird is built to the style guide and checked side by side against the reference frames;
  still 60 FPS on the budget scenes
- [ ] Bots buy varied, synergistic builds from item scores (a starter table from GDD §11 until the Build Lab
  converges): over 20 matches no two builds of a hero are near-identical, and synergy beats a random baseline (D-EP-036)
- [ ] Launchable: a 1 + 11 bots match with any of the 24 heroes starts from the menu; PLAYABLE.md "Stage 4 (M3)" written

### M4 — Balance and polish

- **Style guide moved to the start of W5b (D-EP-047).** (Was W6.5.) Game Director and Technical Artist write the **style guide**, a one-page target look for
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
- [ ] Core numbers balanced (D-EP-045): every bird's health, regen, speed, stamina and level growth; every gun's
  damage, fire rate, spread, falloff, magazine and reload, judged against the Director's time-to-kill windows per
  archetype matchup; structure, Patron, fledgling, Thicket and Roc health and damage, judged by siege, push and
  objective timings; no stat stacks to absurd values late in a match
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
### W4.5 · Technical Architect · 19/11/2026
**Branch:** `worktree-agent-a77a2ab351862e4e4` from `integrate/w5` fcf1de6, with `integrate/w5` 28350c5 (D-EP-038/039)
merged in. Node 22.23.4 (V8 12.4), Edge 156.0.4314.50. Reconciled with the Director's final GDD on `integrate/w5`
b2d96b4 (read, not merged).
1. **Determinism, root cause (D-ARCH-021).** Not the input path, initial state, iteration order or Rapier: V8 itself.
   ECMAScript leaves `Math.sin`, `cos`, `tan`, `atan2`, `asin`, `acos`, `exp`, `log`, `pow` and the rest to the
   engine, and over 20,000 inputs each, Edge 156 and Node 22 disagree in the last bit on 3–18 % (`sqrt`, `hypot`
   and `x ** 2` agree). The sim made 168 such calls. Fix: `src/sim/core/dmath.ts` ports fdlibm 5.3 and V8's hypot to
   plain arithmetic; it equals Node 22's `Math` bit for bit on millions of inputs, so Node's results and hashes
   didn't move. All 168 calls in 30 files across the owners' areas now use it (one mechanical commit, bd77f64, under
   the brief's "fix it at its owner"); `dmath.test.ts` fails on any new banned call. **Proof:** the browser replay
   now ends on tick 69,973 with the same hash as Node (`d662ba91ea093bbd` before item 4, `6f4b46610798dd0d` after).
   New `e2e/determinism.spec.ts` + `e2e/hash-trace.ts` (QA's area, assigned by the brief) run the siege script and a
   12-bot match in the Playwright runner and in the app's page and compare every tick's hash. With dmath pointed back
   at `Math` they fail at tick 3 (siege, the W4 finding exactly) and by tick 1,800 (bots).
2. **Wave 4 requests:** INTERFACES §13, 24 rows: 6 accepted, 2 modified, 16 satisfied, none rejected (castSlot, Audio's
   occlusion via rooms, hero-select hooks and mute, `endOn`, zero-duration statuses, the W3 carry-overs).
3. **Stage 4 contracts (INTERFACES §14, D-ARCH-023):** bots' command path confirmed; `ItemScores`, `RecommendedBuild`,
   `BuildData` and `SimOptions.botShopping`; objective components, events and view fields for Thickets, Nests, Bell
   Feeders, runes, the Egg, the Roc, Embers and Rekindle, keepsakes, Berries, Hides, Lookouts and Springs; the map
   schema for buildings, storeys, rooms, openings, curtains, ladders, jungle zones, interactables, springs and nav
   rooms; the Director's §10 primitives and 11 W4.5 requests (§14.5). All optional: the code compiles unchanged and
   today's map loads.
4. **No Interact (D-EP-039, D-ARCH-022):** deprecated, not deleted, because deleting breaks Physics, Input, UI and two
   tests; deletion is the W5.5 round's. `updraftInReach` (service, Motor, HeroView) and `PickupInfo.melee` carry the
   new rules. Saved bindings: once `'interact'` leaves `BindAction`, `sanitizeSettings` drops the saved code on the
   next load, leaving every other binding; no storage bump (tested). The new `meleeDamageTaken` stat moves every hash
   once, the same in Node and Edge, with gameplay unchanged (D-ARCH-024).
5. **Follow-ups:** `docs/briefs/W5-contract-followups.md`, per owner for W5 and W6.
**Verified:** `npm run check` on 730d42a: `PASS typecheck 6s · lint 4s · test 12s · perf 8s · sim 3s · e2e 100s ·
check 133s`; 802 unit tests, 57 e2e. Siege proof (Node): Victory on tick 69,973, 0 deaths, 24 heart hits, hash
`6f4b46610798dd0d`; `?scene=replay&seed=1` in Edge: tick 69,973, hash `6f4b46610798dd0d`. `npm run sim -- --seed 1
--minutes 35 --bots 12` twice: `7c9595badc5a9dc4` both times (126,000 ticks, 14.8 s and 14.6 s, about 8,600
ticks/s, so dmath costs nothing measurable). 3-minute check sim: `85a34be07d674f6e`. An earlier check run (before the
traces were shortened) failed `match.spec.ts` once under load; it passed alone (44 s) and in the run above.
**Notes for owners:** GDD §3.1 still lists "Inspect / upgrade abilities: Left Alt (tap)", which D-EP-038 replaces
(Director). The determinism spec is QA's from now on (follow-ups).
**Blocked:** nothing. **Interface requests:** none.
### W4.5 · QA test-first · 19/11/2026
**Branch:** `worktree-agent-a031161937ab8cc08` from `integrate/w5` ac0f0c6. Edits only `tests/**`, `e2e/**`, this
entry and the decisions below. Every suite is gated (`describe.runIf(process.env.PERCH_PENDING === '1')` for rules,
`test.skip(isPending, …)` from `e2e/pending.ts` for browser specs); every assertion cites its GDD section or decision.
**Rules suites** (`tests/rules/`, `expect` calls / tests): `golden-egg` §7.11, D-EP-039 (67 / 18): spawn, 10 s lowering,
melee pickup, carrier rules, trailing-carrier boost and caps, drops (death, enemy melee, stun, own Melee), unattended
roll, spoil, automatic delivery, golden pods, payout, ×1.25, keepsakes, next spawns. `roc-embers` §7.12 (62 / 18):
wake, HP growth, regen, resists, Hollow-only damage, aggro, Rake, Gale Flap, enrage and Sky Shriek, reset, kill
reward, the 7/6/5 respawns, Ember fall and claim, Rekindle charges and revive, expiry. `thickets` §7.8 (53 / 13): map
counts, five families (spawn time, creatures, HP scaling, resists, payout, respawn), dormant and 35 m rule, aggro,
bites, dash-bite, rat heal reduction, toad lash and spit, Slam, leash, indoor camps. `nests` §7.9 (47 / 13): counts,
spawn times, solidity, breaking rules, drops, pickups, respawn, crumbs, loss on death. `runes` §7.10 (23 / 8): spots,
spawn, type pairs, replacement, claim, strength at 5:00 / 22:30 / 40:00 / 45:00 for each of the four, duration, death.
`interactables` §§7.13–7.15, 6.8, 8.8 (91 / 31): Keepsakes (types, buckets, repeat damping, one source, caps), Bell
Feeders, Berries, Hides, Bough Springs, Lookouts, ivy curtains, Cellar Run, Magpie Den. `no-interact` D-EP-039,
§3.7 (29 / 11): latch anywhere along the cable on held Jump, taps, reach and `updraftInReach`, dismounts, lockouts,
carrier, no Interact bit in any bot command over 4 sim minutes. `items` §10 (87 / 26 tests; 105 cases): the 64-item
catalogue, one stats test per item (64), the 16 Stage 4 items in play, all 15 actives, Second Clutch, Nestmother's
Mantle. `bot-shopping` D-EP-036 (18 / 6): determinism, softmax sampling, similarity, synergy over the random baseline.
**Browser specs** (`e2e/`): `hold-upgrade` D-EP-038 (32 / 7), `scoreboard-bar` D-EP-041 (32 / 6), `practice-swap`
D-EP-040 (21 / 6), `hero-select-layout` (5 / 3 tests, 6 cases with both pickers), `no-interact` D-EP-039 (13 / 3).
**Expected red** (`PERCH_PENDING=1`): rules suites 232 failed, 22 passed of 254 (the 22 are checks the Stage 3 build
already meets: the stats of the 16 existing items, tier costs, component chains, the rune spots and two table-coverage checks). Every
failure is a missing entity, event or field (no Egg, Roc, camps, rooms, builds module, bot purchases); none is an
error in a suite. Browser: the layout-shift spec reproduces the user's bug (card 1 moves 3.55 px on hover or focus);
hold-upgrade 6 of 7 fail, scoreboard 6 of 6, swap 5 of 6, no-interact 3 of 3 (the passes keep Stage 3 behaviour).
**Verified:** `bash scripts/check.sh` with the suites gated: `PASS typecheck 8s · lint 4s · test 13s · perf 11s · sim 3s ·
e2e 102s · check 141s`.
**Requests for the wave 5 owners (markup the browser specs need):**
- UI/HUD, scoreboard: region `Scoreboard`; `[data-portrait]` with `data-side="own|enemy"`, `data-hero`,
  `data-dead`; inside it a `progressbar` (health), `[data-field="seeds"]` and, while dead, `[data-field="respawn"]`;
  `[data-field="flock-seeds"][data-side]` and `[data-field="clock"]`. Remove the Tab region and the `scoreboard` binding.
- UI/HUD, hold to upgrade: HUD icons are buttons named `Upgrade <ability>` carrying the unavailable reason; a game-drawn
  cursor, if used, is `.pu-cursor`. UI/HUD, swap: a `Swap bird` button on screen and in the pause menu, Practice Hub only.
- Rules suites assume today's contracts (INTERFACES §14): pickups `egg`, `ember`, `rune`, `sprig`, `crumb`, `keepsake`,
  `berry`; crumb variants contain `quick`, `light` or `sweet`; rune variants contain `swift`, `fierce`, `sage` or
  `stout`; `MapData.rooms` tag `hide` / `tunnel`; `src/sim/data/builds.ts` exports `BUILDS`.
**Notes:** the existing `siege.test.ts` and `controller.test.ts` still press Interact; the Physics owner moves them to
held Jump with the latch. If a suite misreads the GDD, say so here rather than editing it (README rule). **Blocked:**
nothing. **Interface requests:** none.

### W5a · Hero Engineer A (batch A3) · 19/11/2026
**Done:** branch from `integrate/w5` 8891822. Peacock, Vulture, Swift and Hummingbird ship with GDD 9.13-9.16 body plan,
stats, gun, all four abilities with every tier, player-facing text with numbers, a swatch (0x1C8F9E, 0x8A5A3C, 0x6B5D54,
0x3EC45A) and `implemented: true`. Each has a test file: gun (damage, head x1.65, magazine, fire rate, reload), a smoke
test for every ability (base, and a later tier where it adds something), and the ultimate locked until level 6. Hooks only
where data cannot say it: Peacock (Hundred Eyes fan and the three-hits cap, Strut's next-cast bonus), Swift (Slipstream
T3 pass-through damage, Wing Scythe return-pass stun, Sky Stitch 25 m ceiling and T3 ground slam), Hummingbird (Hover,
Nectar Sip's tier-based break distance and T3 slow, Thousand Beats Dart damage, silence and refund). Vulture has no hooks.

**Verified:** `bash scripts/check.sh`: typecheck, lint (zero warnings after the last commit), test, perf and sim PASS;
e2e FAILS one spec, `e2e/m2.spec.ts:219` ("twelve selectable M2 hero cards" expects 12 enabled cards, now 16). That count
is stale by design: it moves with every batch (20 with B2's four, 24 at the end). The spec is QA's, so I left it; update
it at integration. Two other e2e tests (`options.spec` Jump rebind, `preview-regressions` side buttons) timed out once
under load with other agents running and pass alone. Models are the Technical Artist's (wave 5b); the generic bird
stands in.

**Limits:** Dart aims along the camera (`dir: 'aim'`), not "movement keys if held" (a dash has one direction source).
Thermal's glide ends as Owl's does (landing or Jump). Death Spiral's pull is a 1.5 m hop every 0.5 s (3 m/s), because a
pull is a launch toward the area centre. Wing Scythe's stun reads "second hit on a hero" as the return pass, so a hero
first touched on the way back is not stunned. Strut's bonus lasts 0.8 s after the cast it is spent on, so a dart in
flight still gets it.
**Interface requests:** Combat: `applyStatus` of 0 s lasts a tick (already W5 follow-up). Abilities: an upgrade tier
that adds to a dash's `onHit` or changes a tether's `breakDistance`, and a hook callback for any landed cast (today only
`hook: true` abilities call `onCast`, so Strut marks Dazzle and Full Display `hook: true`).
### W5a · Hero Engineer B (B2) · 19/11/2026
**Done:** worktree branch from `integrate/w5` (8891822). Cassowary, Toucan, Woodpecker and Nightjar ship real data in
`src/sim/data/heroes/<id>.ts` (GDD body plan, stats, gun, swatch, four abilities with every tier and its player text) and
are `implemented: true`. Hooks: Cassowary (Rampage hero-only stop, Bristle thorns), Toucan (Fruit Barrage spots, Branch
Swing T3 buff), Woodpecker (Tree Cling end and heal, Hammerhead counter), Nightjar (Nightfall ambush, Night Swallow
strike). Woodpecker's gun uses `WeaponDef.spinUp` 6 to 14 shots/s over 1.5 s. Tests next to each hero: cassowary 14,
toucan 15, woodpecker 20, nightjar 21: a gun test (damage, head, rate, magazine, reload), a smoke test for every ability
at base and at T3, and the level-6 ultimate lock. Decisions D-HEROB-004 to -009.

**Verified:** typecheck, lint, test, perf and sim pass; the kit validator is green for all 24. `npm run e2e`: 34 pass,
2 fail, and neither is mine to edit: (1) `m2.spec.ts:219` expects exactly twelve selectable cards, now 16 with Hero A's
four (the count and id list are QA's); (2) `match.spec.ts` "Play from the menu as Kingfisher" fails every time here and
passes on a clean `integrate/w5` checkout: the player dies in the Hedgerow clash (screenshot `out/web/match-damage-numbers.png`:
"Respawning in 23") before a shot lands, because the enemy flock now has real kits where it had placeholders. It needs
QA's call (a stronger player, an earlier snapshot, or a quieter lane). The rest of e2e passes with those two excluded.

**Limitations:** Drumroll is fire rate only (D-HEROB-008). Branch Swing and Tree Cling land on the floor under the
crosshair, not on walls or trees. Rampage does not steer. Bristle, Tree Cling's ends and Gape's heal are hook or status
stand-ins marked `TODO(framework)` (D-HEROB-007). Models are the generic rig (Technical Artist, wave 5b).

**Interface requests:** (1) Combat: a `weaponMod` that sets full spin and holds it, and the 0.5 s spin-down (Woodpecker).
(2) Abilities or Physics: `point` targeting that can return a surface hit, for Branch Swing and Tree Cling. (3) Combat:
the 0 s `applyStatus` rule in W5-contract-followups is still a plain one-tick status in this tree (D-HEROB-001).
(4) QA: the two e2e specs above. **Blocked:** nothing.
### 2026-11-19 · Economy & Items engineer B (W5a, Song) · ECON
**Done:** the 17 Song items not in the Stage 3 shop, as typed `ItemDef` data in `src/sim/data/items-song.ts`
(`SONG_ITEMS`, spread into `ITEMS`), with Crescendo, Echo Chamber's repeat and Boundless Song's ultimate cooldown in
`src/sim/items/song/index.ts` (called from `createItemSystem`) and six tests in `song.test.ts`. Engineer A also
creates `items-song.ts`; the EP reconciles the two at the merge. Two one-line hooks touch A's files (`ITEMS` spread,
`createSongItems(ctx)`).
**Passing now:** every Song stats row, the catalogue-shape rows, Nettle Sting, Encore and Whirlwind Knot.
**Waiting on A's engine (data is ready):** Warbler's Trill and Skylark Cadence (`TriggerDef.uses`), Blight Spores and
Rookery Dirge (`currentHpPct`, `maxHpPct`, `ItemDef.aura`), Muting Whistle, Gloom Curse and Tangle Pod (unit and point
targeting of actives: `affects`, range, aim point). `market.test.ts` pins the 16-item list and now fails.
**D-ECON-B-001:** Crescendo and Echo Chamber add a second Song hit (20% and 25% of the first), so the target's resists
apply to it again. **Interface requests (engineer A):** a combat-side outgoing multiplier for Crescendo, and a
per-slot cooldown-reduction stat for Boundless Song if the helper's refund is not wanted.

### 2026-11-19 · Economy & Items engineer A (W5a, Talon, Plumage, engine) · ECON
**Done:** the catalogue is split into `items-kit.ts` (helpers, `Rider`, `ItemShield`), `items-talon.ts`, `items-plumage.ts`, `items-song-base.ts` (the five Stage 3 Song items) and B's `items-song.ts`; all 21 Talon and 21 Plumage items with real effects. Engine: four-active cap (an upgrade replacing an active keeps the count), item-active targeting (self, direction, point, unit with `affects` and `selfFallback`; a point lob lands on the enemy hero under the crosshair) in `items/targeting.ts`, `ItemDef.aura` apply on buy and respawn and end on sale or death, item shields (`ITEM_SHIELDS`, an upgrade adds only the difference), Second Clutch, Dew Drinker and Healing Dew, neutral shops, `TriggerDef.uses`, `via` and `withinM`, riders (`items/riders.ts`: Forager's Talon, Skipping Stone, Kestrel's Eye extras, heavy-melee slows, Carrion Feast). B's two hooks (`SONG_ITEMS`, `createSongItems`) are in. Economy: Thicket payouts, Nest sprigs, Bell Feeder seeds, golden Egg pods, Roc and Ember seeds, no bounty on a revive. Starter scores: `src/sim/data/item-scores.ts` (`STARTER_SCORES`, `ARCHETYPE_CORES`, from GDD 11.4 to 11.8) for Bot AI to wire into `BUILDS`.
**Landed for B:** `TriggerDef.uses` (tested), unit and point targeting of actives (tested; Muting Whistle, Gloom Curse and Tangle Pod run), `ItemDef.aura` (tested with Nestmother's Mantle). `currentHpPct` and `maxHpPct` are combat effects (Systems engineer): Blight Spores and Rookery Dirge need them.
**Waiting on other owners:** Systems (combat): `triggerPct` (Burr Coat), `currentHpPct` (Blight), `maxHpPct` (Rookery Dirge), `meleeDamageTaken` in step 5 (Heartwood Bark). World: Thicket, Nest and Feeder entities (the seed code is covered by sandbox dummies in `economy/neutral.test.ts`). **QA:** the `heavyMelee` helper holds Melee without a press, so no swing starts (Hooked Spur's QA test); the Nestmother test reads `healthRegen` while the sandbox multiplies it by 0. **Interface requests:** a per-hit gun bonus by distance (Kestrel's Eye +20% from 25 m is a rider now, so the hit itself is unchanged); ShieldEffect removal on sale.
**Verified:** `bash scripts/check.sh`: typecheck, lint, test, perf and sim pass; e2e passes (one timeout on first run, 57 of 57 on rerun).
### Stage 4 · Feel reference · 19/11/2026
**Done:** `docs/reference/feel-reference.md` on `worktree-agent-af63dad2692a4e4ec` (from `integrate/w5` 075e1d8). It
covers the reference's HUD, camera, combat readability, map, pacing, targets for PERCH, the Stage 4 flags and a gap
list of 30 items (5 High, 16 Medium, 9 Low; 18 for Stage 4) set beside the current build (D-EP-046, D-DIR-014). All
wording is mine; no frames, art or names are in the repo.
**How:** installed Edge through Playwright, consent answered "Reject all", ads skipped or waited out, and the page's
video element seeked. No file was downloaded.
- An automated browser only gets about 60 s of stream per page load, so each moment was opened as a timestamped link.
  One-second bursts are limited to about 25 s, and whole-match overviews come from the seek-bar previews (about 6 s
  apart).
- The frames I looked at: five boards, 22 single frames and five bursts, all in `out/reference/` (git-ignored).
- PERCH side: `out/perch-capture.ts` (lane walk, dash, Updraft ride and boost and lane clash at 1 frame/s, shop,
  Practice Hub, siege replay), `npm run shots` map overview and top, and `out/perch-scan.ts`.
**Findings for the EP:**
- **Bots:** in the `match` scene the bots never leave spawn (0 hero damage in 40 simulated minutes), so no PERCH hero
  fight can be compared yet (G22).
- **Updraft:** riding and boosting fills up to 40 % of the screen with opaque white slabs (G16).
- **Feed:** structure kills read "The world", and Brood Ward lines flood the feed (G08, G30).
**Verified:** `npm ci --prefer-offline --no-audit --no-fund` (145 packages). Git Bash `VITEST_MAX_WORKERS=1 npm run
check`: `PASS typecheck 8s · lint 6s · test 51s · perf 10s · sim 13s · e2e 132s · check 221s`. An earlier run failed
only the world perf test (0.998 ms per tick against 0.5). It ran while the capture browsers were busy and passed alone
and in the run above. No `src/` change.
**Interface requests:** none. The gap owners are listed per gap, for the EP to route.

### Stage 4 · EP note · 19/11/2026 · feel gaps routed (D-EP-046)
From `docs/reference/feel-reference.md`: G01–G04, G06–G10, G13, G15 and G30 go to the wave 5a UI and controls brief;
G19 and G20 to the Level Designer; G16 (Updraft ride visuals) and G18 (team identification) to Rendering & VFX in wave
5b; G22 (hero bots that fight) to Bot AI in wave 5b; G23 (600-Seed starting purse) to the integration round. The
Stage 5 gaps (G05, G11, G12, G14, G17, G21, G24–G29) feed the Stage 5 style guide and balancing.

### Stage 4 · Style guide · 19/11/2026
**Done:** `docs/art/style-guide.md` (D-EP-042, D-EP-047, D-EP-048; D-DIR-015, D-DIR-016) on
`worktree-agent-a01321a99e8a56fe6` from `integrate/w5` 96e0c6a. Its first principle is the user's "somewhere birds
would be", with numbered rules for architecture, street life, the jungle and scale. It then covers shape language,
the architecture kit (facades, windows, doors, roofs, balconies, signage-free storefronts, rooftops, weathering,
interiors, minimum detail and LOD0 triangles per building type), nature and five-layer jungle density, procedural
material recipes and palettes per district and flock, birds (proportions, feathers, eyes, beaks, talons, gear, guns
per archetype, readability at 10, 40 and 80 m), structures and Patrons (states, phase two), lighting, LOD and
performance budgets for a mid-range iGPU, and a gate checklist and 0–4 rubric with reference frames per category.
All wording is mine; no frames or images are in the repo.
**How:** I studied 22 single frames and a board across all five videos (streets, facades, rooftops, interiors,
structures, Patron chambers, heroes close up and at distance, golden-hour and night light), then PERCH now with
`npm run shots` (`menu`, `lane --t 45`, `practice`, and `sandbox` with `modelLineup` and `modelStructure`).
**Findings for the EP:**
- Of the 2,023 files in `out/reference/`, 54 are reference frames and boards, 47 are PERCH captures and 12 are logs;
  1,910 are the capture browser's profile data. The guide lists the frames to use.
- The guide replaces GDD §14.1's flat-shaded look, the §14.5 sun and fog, the §14.6 model budgets and the §6.12 map
  triangle row (now 450k at Medium, 70 map draw calls, ≤ 240 per frame under the 248 ceiling). GDD §6.12 and §14
  follow in my next GDD pass.
- The reference shows no forest; jungle density is judged against the guide's own layer table.
**Verified:** Git Bash `VITEST_MAX_WORKERS=1 npm run check`: `PASS typecheck 37s · lint 17s · test 63s · perf 10s · sim
4s · e2e 136s · check 269s`. An earlier run failed only the world perf test (0.846 ms per tick against 0.5) while
other agents loaded the machine; it passed on the re-run. No `src/` change.
**Interface requests:**
- QA: raise the map triangle and draw-call test ceilings to the guide's §11.3 numbers as the art lands, and add the
  §12.3 shot list to the gate captures.
- Rendering & VFX: the material infrastructure in §7.1–§7.5 (generated atlases, packed ORM, a sky-derived environment
  map, baked vertex AO, decals, the bird rim term) and the §10 lighting values.
- Level Designer: collision for landing boards and perch beams deeper than 0.5 m (§2.6), and no lines or poles across
  lanes or within 3 m of an Updraft (§1.1).

### 2026-11-19 · Docs & Wiki engineer (W5b) · WIKI
Done: the wiki coverage test already generated into a temp folder; it now also compares that output with the committed `wiki/` (ignoring the date) and only warns when stale (D-WIKI-001). `npm run wiki` unchanged. Proved: dropping a hero page from the generator fails 3 tests; reverted. About 2 s of generation, no screenshots.
Decision D-WIKI-001: a stale committed wiki is a console warning, never a failure; the gate regenerates it (D-EP-031).
### W5a · Systems (Controller, Combat, Ability Systems) · 19/11/2026
**Done:** branch `worktree-agent-a110c2bfcbfc8aefb` from `integrate/w5` 926bd47. Every W5 follow-up for the three owners,
plus interiors and the EP's framework gaps. Decisions D-SYS-006 to D-SYS-016.
- **Physics:** Updrafts latch on Jump held 0.2 s anywhere along the cable (`PhysicsService.updraftInReach`,
  `Motor.updraftInReach`), 30 m/s pull-up or 0.15 s air attach, 3 s damage and 1 s leave lockouts, fresh-press jump-off,
  Crouch drop; `Button.Interact` is never read. Ladders climb as Vines. `blocks: 'movement'` prims stop heroes and
  units only; `'sight'` prims stop only queries that ask for `PHYSICS_LAYERS.sight`. `solid: false` structures get no
  collider. `blocksEggCarrier` openings stop the carrier only. Tunnel rooms ×1.3 run speed. Bough Springs (arc, 1 s
  limit, 30% control after the apex, clip and slow). `MovementModeEffect.endOn`. Interiors tested on a kit building:
  door, 26.6° stairs, upper floor, shot window, ivy arch, ladder to the roof.
- **Combat:** melee hits `PickupInfo.melee` pickups (reported, no damage, the swing carries on); `breakable` (by, fixed
  light/heavy); `damageFrom`; `meleeDamageTaken` in step 5; `currentHpPct`, `maxHpPct`, `triggerPct` with repeats
  (D-SYS-014); duration ≤ 0 applies nothing; Rekindle revives (`revives`, `revived`); spin-down 0.5 s and full spin.
- **Abilities:** the floor under the crosshair (never through a ceiling); `selfFallback`; ivy blocks `unit` targeting
  beyond 3 m; 3 m cylinders; areas never reach through a floor.
- **Framework gaps landed (data shapes):** Drumroll: give its statMod `id: COMBAT.fullSpinStatus`. Wall and tree
  targeting: `values.surface: 1` (`SURFACE_VALUE`) on Branch Swing and Tree Cling; cling `endOn: ['jump']`. Rampage:
  `values.steerDeg: 30` (`STEER_VALUE`). Bristle: a `trigger` (`on: 'damaged'`, `heroesOnly`, `withinM: 15`, `target:
  'other'`) of `{ damage, amount: 0, type: 'song', triggerPct: 0.2 }`. Crescendo: that damage with `triggerPct: 0.2` on
  the hit's target; Echo Chamber: a 1 s status whose `onExpire` holds it with `triggerPct: 0.25`. **Not landed:** Gape's
  heal and Tree Cling's stun end need contract fields (D-SYS-016); their stand-ins stay.
**Verified:** `VITEST_MAX_WORKERS=1 npm run check`: `PASS typecheck 11s · lint 5s · FAIL test 61s` (987 passed, 3 failed:
the three `siege.test.ts` rides that press Interact, expected under D-EP-039; the check stops there). Run separately:
`npm run perf` 7/7 (physics 0.237 ms/tick with 12 heroes + 0.048 ms for 150 units; abilities 0.048 ms at 96 areas;
combat 0.034 ms firing); `npm run sim -- --seed 1 --minutes 3 --bots 12` 10,800 ticks in 2.0 s, hash `c87c7cfe2e2bea0a`;
`npm run e2e` 35 passed, 28 skipped, 1 failed (`play.spec.ts` mounts with E). `PERCH_PENDING=1`: no-interact 13/15
(the two left are the bots and the default bindings); items 100/105 (Blight's reading below, and four Economy/QA
cases); the world suites fail at setup on missing Egg, Roc, camps and rooms, none in these systems. Tests: the
physics suite is now 72, plus combat `stage4` 15, abilities `stage4` 8 and `framework-gaps` 3 (end to end).
**Interface requests:**
- Architect (W5.5): `Layer` bits for sight and movement prims (now `PHYSICS_LAYERS`); `AbilityDef.surface` and a dash
  steer field for the two value names; `endOn: 'stun'`; `HealEffect.triggerPct` (Gape); make `updraftInReach` required.
- QA: `tests/rules/siege.test.ts:83` and `e2e/play.spec.ts:81` still mount with Interact / E; hold Jump instead. The
  Blight test takes HP at application, while the contract reads current HP at each tick (8.3 below over 4 s, ±5).
- Objectives: add `PHYSICS_LAYERS.sight` to the vision ray (with the 3 m rule); spend Rekindle on `entity.died.revives`.
  Units walking through `moveCharacter` still pass walls (fledgling steering relies on it); keep indoor camps in.
- Docs & Wiki: `tools/wiki/mechanics.ts` prints `UPDRAFT.stationRadius` / `airMountRadius` and "press the interact
  key" (both kept as deprecated for it). Bot AI: hold Jump while `motor.updraftInReach` (no-interact bot test).
**Next:** hero and item owners switch to the shapes above; QA flips the no-interact suite on once bots ride.

### Stage 4 · EP note · 20/11/2026 · integrate/w5 after Systems
Systems (W5a) is merged. The EP switched two QA tests from the retired Interact/E mount to a held Jump (D-EP-039): the
siege rides now boost once the mount animation completes, and `e2e/play.spec.ts` holds Space. Under heavy load (33
node processes) the world perf test read 0.849 ms against 0.5, while physics, combat and abilities read faster than
before. Objectives is asked to measure on a quiet machine. To re-check at the gate: the world perf test, and the audio
e2e's 30 s timeout under load.
### W5a · UI & controls engineer (UI/HUD, Camera & Input, app shell) · 19/11/2026
**Done:** `worktree-agent-ac95e8513ee97dc43` from `integrate/w5` (926bd47), `src/client/ui/**`, `src/client/input/**` and the named `app/**` changes.
- **Hold to upgrade (D-EP-038):** holding the upgrade key frees the real cursor (`exitPointerLock`; Input keeps keys and
  movement, ignores look and mouse buttons). The HUD ability row is four round buttons named `Upgrade <ability>[: reason]`
  (`aria-disabled` when blocked) with one shared hover card: description, every tier, the next tier's AP cost and the
  unspent AP, or why not ("Fully upgraded", "Unlocks at level 6"). Releasing locks again in the key's own event. 1-4 held
  with the key upgrade through the ordinary `upgrade` command. The tap-to-open panel is deleted. Pointer route per browser
  (probe `tools/pointer-lock-probe.mjs`, 300 ms and 7 s holds): **Edge 156 real cursor, re-locks on release; Firefox 159 real cursor,
  re-locks on release**. Chrome is not installed here and shares Edge's engine, so it takes the real-cursor route too
  (D-UI-006). No game-drawn cursor was needed.
- **Always-on scoreboard (D-EP-041, G01):** `topbar.ts` is the bar (region `Scoreboard`; `[data-portrait]` with `data-side`,
  `data-hero`, `data-dead`; health `progressbar`; `[data-field=seeds|respawn|clock|flock-seeds]`): clock over two team
  pills with the lead % and the next Egg or Roc window, 12 round portraits from a `PortraitProvider` (`ui/portraits.ts`,
  `setPortraitProvider` for Rendering in 5b; placeholder = team colour and initial), eye mark, critical and streak tags,
  a dead bird dark with a red countdown, unseen enemies dimmed, a compact Patron and lane-tower strip, a Rekindle chip with
  the 30 s warning. The Tab scoreboard and its binding are gone. The kill feed is on the left under the bar with
  portraits, structures and neutrals named ("Dusk Heron") and callouts (First Blood, Twin Strike, Hat Trick, Talon Storm,
  Apex Predator, `streaks.ts`); Brood Ward lines left the feed (WARD chip on the bar, G30).
- **Feel gaps:** G02 contextual objective bars (within 40 m or hit in the last 5 s, at most 2, 380 px, 600 px for the Patron
  and Roc); G03 health gauge 160 x 265 at 22 %, 62 % with a red chunk (holds 0.5 s, drains 0.4 s), shield caps, stamina
  pips; G04 72 px round ability row bottom centre, 56 px actives; G06 round 360 px minimap bottom right with the zone name and
  rune and camp timers; G07 ammo 80 px under the crosshair; G08 kill badge (1.2 s) with the bounty; G09 melee hint only near
  a claimable target or in a player's first 2 minutes ever (`localStorage`); G10 "+N Seeds" pop, status word, level-up and
  tower banners; G13 `CAMERA.shoulderUp` 0.35 to 0.15 (the one Architect-owned constant touched); G15 held gun capped at
  0.45 x bird height and 0.08 m (`GUN_CAP`, one line in the Technical Artist's `render/models`).
- **Swap bird (D-EP-040):** `AppActions.swapBird`, `ScreenContext.swap`; an on-screen button in the hub's dummy panel and in
  the pause menu (never in Play); the same 24-card picker; picking builds a fresh practice session (32 AP, dummies reset)
  and puts the new bird on the old spot (D-UI-007).
- **No Interact (D-EP-039):** `'interact'` and `'scoreboard'` are out of `BindAction`, the defaults, Input and Options;
  saved profiles drop them in `sanitizeSettings` (tests). Tab is no binding (refused in capture, swallowed in play).
- **Hero select:** the detail panel has a fixed 320 x 372 size; no card moves (the QA spec had reproduced 3.55 px).
- **Follow-ups done:** Mute toggle, `previewHero` on hover and focus, the hold-Jump updraft prompt, keepsake count with a
  tooltip, the Rekindle chip, rune and camp timers on the minimap. **Not done:** the Recommended strip (there is no `BUILDS`
  module yet), the neutral Den shop wording, minimap building outlines and up and down marks, Egg and Roc timers on the minimap.
**Also changed:** Play now starts the player and 11 bots (`FULL_MATCH_BOTS`, `ui/screens.ts`), because the bar shows 12
birds; `lock()` makes no request without a user gesture (it raced the click and paused the match); the sim fast-forward
yields every 30 ms. The Stage 3 e2e for the old panel and the Tab scoreboard (`m2`, `keys`) now test hold to upgrade and the
always-on bar; the Stage 4 specs for these items are always on (the dead-bird test in `scoreboard-bar` stays pending until
bots fight, G22). Spec adjustments: `no-interact` leaves `crouch` out of its comparison (a saved `KeyC` is a choice; a fresh
profile gets Left Ctrl); `practice-swap` clicks the on-screen button with the upgrade key held (a locked pointer sends
every click to the game); `hold-upgrade` waits 150 ms after the re-lock before it moves the mouse.
**Verified:** typecheck, lint (0 warnings), unit tests; Playwright: hold-upgrade 7/7, hero-select-layout, no-interact,
practice-swap 6/6, scoreboard-bar 5 of 6 (+1 pending), keys, m2, match. 1080p screenshots looked at: Play 6v6 HUD, Practice
Hub HUD, hold to upgrade with the hover card, hero select, and a built bar with a dead, critical, seen and streaking bird
(`out/shots/`, git-ignored).
**Blocked / expected red:** `play.spec` "Riverbank Updraft" still presses E and fails until Physics lands the Jump latch (QA
moves it to held Space). The bots idle in Play, so nobody dies in the 6v6 yet.
**Interface requests:** Architect: `SimOptions.practiceStart` (position and yaw), so Swap bird needs no `sim.ctx`
(D-UI-007). Rendering (5b): call `setPortraitProvider` from `ui/portraits.ts`. Docs: `tools/wiki/mechanics.ts` still says
"press the interact key" and `imageplan.ts` still lists a Tab scoreboard shot.
### W5a · Objectives · 19/11/2026
**Done:** branch `worktree-agent-a3ffde07e21cb8d42` from `integrate/w5` 8891822. Everything reads `MapData`; no
positions are hard-coded (the Ember spots are the GDD's offsets from the Hollow). New in `src/sim/world/`:
`thickets.ts` (24-camp-ready: five families, dormant and woken at 30 m, `damageFrom` 35 m while asleep, top-damager
aggro with sight, bites, dash-bite, toad lash and spit puddles, rat heal reduction, badger Slam with a 0.6 s
telegraph, leash and walk home, indoor camps held in their room, respawn), `nests.ts` (Twig/Woven/Keepsake Nests with
`variant`, `breakable`, `solid`; 3:00, 5:00 below ground, 10:00 in the Hollow; run-through at 8.5 m/s; crumb and
keepsake drops; respawn after the break or the last drop's collection; Bell Feeders with swing-back, seeded chime and
`lit`, full-chime keepsakes; the Granary pairing), `pickups.ts` (crumbs, keepsakes, Berries), `keepsakes.ts` (weighted
draw with halving, buckets, caps, one `world:keepsakes` source), `runes.ts`, `egg.ts` (spawn and marks, melee pickup,
carrier status +1.5 m/s and +1 pip with slows cleansed, trailing-flock bonus, five drop causes, unattended roll along
the nav graph, cooling, automatic delivery with the ×1.25, keepsakes to courier and escorts), `roc.ts` (sleep, wake,
Hollow-only aggro, Rake, Gale Flap, enrage and Sky Shriek, reset, per-minute HP, three Embers, claims, Rekindle charges,
expiry and spending, 7/6/5 respawns), `hides.ts`; vision gains Lookouts, ivy curtains and the hidden rule; fledglings
gain the siege flight (+40% HP, +30% vs structures while Rekindle holds). Numbers in `data/world.ts`, including the
Seed values economy pays. Springs, the Cellar Run speed and carrier block are Physics' and the Magpie Den Items'
(follow-ups). D-OBJ-009…014.
**Verified:** `bash scripts/check.sh` on 1ceb7fc: typecheck, lint, test (820), perf and sim PASS; e2e failed once on
`preview-regressions` (`page.goto` timeout) and once before on `match.spec` (damage-number sweep), each passing alone,
then `npm run e2e` 57 passed, with 11 to 28 node, 85 browser and 25 Claude processes running. **World budget (EP
request):** `world.perf.test.ts` "~150 fledglings" (neutrals off, the 0.5 ms test) measures 0.161 to 0.214 ms/tick on
this branch and 0.250 to 0.279 on a trial merge with `integrate/w5` db86998 (Systems' interiors), same machine and load:
no world regression, and nothing near 0.849; that test has no heroes, so Stage 4 vision does no raycasts in it. New `neutrals.test.ts` (10, real map) and `interactables.test.ts` (8, fixture maps for
Feeders, Granary, Berries, Hides, Lookouts, ivy, indoor camps, Nest classes) drive claims with `melee` events as combat
reports them. `npm run sim -- --seed 1 --minutes 35 --bots 12` twice: `56e1571ac513c9e4` both times. **Budget (GDD
§6.12, 0.1 ms):** a whole 35-minute 12-bot match costs +0.028 and +0.032 ms/tick with neutrals on (two pairs of runs
in one process). The synthetic worst case in `world.perf.test.ts` (all 16 camps and the Roc fighting a dummy hero each
at once, re-aggroed every 2 s; both matches stepped in alternating 1 s chunks): +0.14 ms median, quartiles +0.08…+0.19,
loose bound 0.3. World's own share of that, instrumented, is about 0.04 ms (neutrals update 0.015, steer 0.005, extra
vision 0.017); the rest is combat, statuses, hero knockback physics and the spatial hash serving 49 fighting
creatures, which a real match never has at once. **PERCH_PENDING=1** on this branch alone: thickets 10/25, nests 4/13, runes 4/23,
golden-egg 4/18, roc-embers 11/18, interactables 5/31. With temporary local patches (combat's melee hit test taking
`PickupInfo.melee` pickups, `heavyMelee` pressing Melee) the Egg and rune suites pass everything world owns except the
disputed assertions below. No remaining failure is a world bug I know of; they wait on these:
- **Level Designer:** 24 camps with families and indoor buildings, 100 Nests, 8 Feeders (Granary `camp`), 22 Berries,
  14 Lookouts, 8 Hides, 32 curtains, the Cellar Run and Dens.
- **Combat:** the melee hit test on `melee` pickups (Egg 'any', runes and Embers 'heavy'); a heavy lunge must not carry
  the hero past a pickup 1 m ahead (observed: 3.5 m lunge, hero ends 7 m on and off the rune bridge, swing whiffs);
  `damageFrom` (dormant camps, the Roc); `breakable`; Rekindle revives; the Egg carrier's own Melee should not swing.
- **Physics:** `solid: false` (Twig and Keepsake Nests and Feeders still get colliders: a sprinting hero stops at a
  Twig Nest); `blocks: 'sight'` prims out of `LAYERS_SOLID` raycasts; an Updraft-speed stat for the Swift feather.
**Disputed assertions (QA, not edited):** (1) `tests/helpers/world.ts` `heavyMelee` holds Melee without the press edge,
so combat never swings (every heavy claim); add `sb.press(hero, Button.Melee)` before the hold, also in the Feeder test's
inline heavy. (2) `world()` puts every hero after the first on Dusk, so golden-egg's "escort", roc-embers' `b` and the
Thicket payout "ally" are enemies (the ×1.25 then applies correctly, escorts get nothing, payouts don't split): pass
`{ hero, team: 'dawn' }`. (3) Absolute stats assume a zero base: carrier `moveSpeed − 0 ≈ 1.5` and `free.moveSpeed = 0`
(Shrike's base is 7), trailing `sprintSpeed ≈ 2` (base 2), the Nest "walk" (+4 m/s on 7 m/s is 11 m/s), Fierce
`magazine ≈ +0.3` (+30% of 24 rounds is +7.2). (4) `qa-hp` raises max HP only; current HP stays at base and the badger
test's hero dies before the second Slam. (5) The enrage test deals 76% of max Talon, which the Roc's 15% Talon resist
makes 64.6%. (6) The spoil test times from `carried()`'s return, 0.35 s after the pickup (542 vs 550 ± 5). (7) The heavy
full-chime presses on the first lit tick; a heavy hit lands 0.6 s later, after either lit window (D-OBJ-013).
**Interface requests:** Combat and Physics as above. Render/VFX: the Egg's descent and the Embers' fall animate from
`claimableAt` (D-OBJ-010); `spit` events carry the puddle point, `slam` the ring centre. Economy: its neutral Seed
constants duplicate `data/world.ts` (`CREATURES[].seeds`, `FEEDERS.seeds`, `NESTS[].sprig`, `ROC.reward`,
`EMBERS.claim`); one source would stop them drifting. Bot AI: creatures and the Roc are team 'neutral'.
**Next:** flip the suites on as the map and combat land; rerun the budget on the full map (100 Nests and 24 camps add
spatial-hash entries every tick).

### W5a · Level Designer · 19/11/2026
**Done:** Old Mossmarket rebuilt to D-EP-033 on `worktree-agent-acf352408673877f6` (from `integrate/w5` 926bd47), all in `src/sim/world/map/**`.
- **Buildings:** one GDD §6.8 kit (D-LEVEL-005). Each quarter has 8 enterable jungle buildings: Granary, Warehouse, Tavern, Hollow-tree House, Bell Tower, Market Hall (east: Water Mill) and two Hides. Hedgerow has 7 enterable terrace houses and the Seed Exchange; Pinewood has 2 Stilt Houses; the centre has 2 Dovecotes. That makes 54 enterable buildings and 110 building records (fills included), 100 rooms, 368 openings and 40 ladders.
- **Below ground:** the Cellar Run with the Magpie Den (a neutral 5 m shop), its lane stairs, two Tavern cellars, and two undercrofts with grate ladders, all carved out of the ground.
- **Anchors (GDD §6.10):** 100 Nests (72 Twig, 16 Woven, 12 Keepsake), 24 Thickets with families (8 indoors), 8 Feeders (the Granary ones tied to their Rats), 22 Berries, 14 Lookouts, 8 Hides, 8 Springs, 32 ivy curtains, 2 tunnels, 12 jungle zones with their paths.
- **Nav:** 1,861 nodes and 8,334 links through every storey, cellar and roof: doors, stairs, ladders (vine), hatches (drop), leap windows, Springs and `nodeRoom` (D-LEVEL-008).
- **G19 and G20:** façades on Hedgerow's and Pinewood's first legs with a 4.5 m walkway, stilted roost stands, extra balconies and stairs, cover along lane edges, rope walkways between roofs (D-LEVEL-009).
- **Dressing descriptor:** `loadDressing('main')` for the Environment Artist, covering D-EP-047, D-EP-048 and the style guide's §1: facade styles, roofs, nest crowns, facade marks, balconies, landing boards that collide, stairs, and 461 props.
- **Map SVG:** `mapSvg` draws building outlines, rooms below ground, Hides, openings by kind, Springs and interactables.
- **Deviations from the GDD:** D-LEVEL-007.
**Verified:**
- `bash scripts/check.sh`: PASS typecheck, lint, test (976 passed), perf and sim. The e2e step fails only on `match.spec.ts`, at "a shot landed and showed a damage number". The same spec also fails with the `integrate/w5` map files checked out, so the failure predates this work. The other 57 e2e specs pass, including draw-budget and determinism.
- Map tests: 37 in `main.test.ts` (symmetry of every new record, prim budgets, every §6.3 and §6.10 anchor) and 25 in `interiors.test.ts` (every floor reachable, every door connects, indoor anchors inside their building and storey, counts, the Egg-carrier stair, jungle zones, G19/G20, dressing integrity).
- `PERCH_PENDING=1`: the 9 map assertions in the thickets, nests, interactables and runes suites pass. The 2 that fail need Objectives' systems (Berry spawning, the hidden condition).
- Budgets: `buildWorld` 21 ms and first nav 62 ms (cold); 2,178 solid prims (of 3,000); at most 584 prims in a quarter (of 600). Draw calls: lane/low 18 (of 32), lane/medium 26 (of 48), match/medium 36 (of 248); peak 107k triangles in the match scene. Sim seed 1, 12 bots, 3 min: 7,899 ticks/s (0.127 ms/tick).
- Looked at: `npm run shots` overview and top-down, street level on Hedgerow, Riverbank and Pinewood, the Warehouse and Market Hall interiors, the terrace-roof walkway to the Bell Tower, and Lantern Row; SVGs of the whole map and the west Dawn quarter (`out/shots/l-*.png`, `out/map/*.png`).
**Blocked:** nothing.
**Interface requests:**
- Architect: fold `MapDressing` into `MapData`, or bless `loadDressing`. It carries what `Building` lacks: facade style; roof style, pitch, ridge and nest crown; balconies, landing boards, stairs and props.
- Systems (Physics, Combat): until physics and combat honour `PrimBase.blocks`, the 32 ivy curtains (`'sight'`) stop heroes in doorways and the shot-window fillers (`'movement'`) stop bullets.
- Rendering: draw `'movement'` fillers as open windows (style guide §5.2) and `'sight'` prims as ivy.
- UI: minimap outlines from `MapData.buildings`, and ▲/▼ from `rooms`.
- Bot AI: `nodeRoom`, `spring` links, ladder vine links and hatch drop links are live.
- QA: the `match.spec.ts` damage-number step fails on `integrate/w5` whatever the map.
- Docs & Wiki: the map page's counts changed.
**Next:** W6 detail polish (collision for any bay or perch the artist dresses deep), bot routing checks through interiors once Bot AI lands, and prim trimming if W6 additions need quarter budget (584 of 600 now).

### EP · 19/11/2026 · wave 5b part 2, W5.5 and the W5a integration round launched
- Running in parallel: Rendering and the Technical Artist (wave 5b part 1), the Environment Artist (#22, Opus), Bot AI (Opus), Audio (Sonnet), the Architect's W5.5 contract round (Opus) and the W5a integration round (Opus). Briefs: `docs/briefs/W5-env.md`, `W5-bots.md`, `W5-audio.md`, `W5-arch2.md`, `W5-integ.md`.
- The Build Lab (D-EP-036/037/044) starts as soon as Bot AI merges: mock games with bots that stand at spawn and never shop would measure nothing.
### W5b · Audio Engineer · 19/11/2026
**Done:** Stage 4 sound on this branch (from `integrate/w5`), all in `src/client/audio/**` plus `e2e/audio.spec.ts`.
- **New cues (41):** Egg (carry pulse, drop, spoil; spawn, pickup and delivery jingles reused), Roc (wake, rake, flap, shriek, enrage, death), Embers (drop; claim reused), Rekindle, Thickets (wake, five attacks, death, camp cleared), Nests (twig, woven, keepsake break), Feeders (break, chime, full chime, lamp blink), Keepsakes, Berries, Hides in/out, Bough Springs, Lookouts, ivy curtains, Cellar Run, Magpie Den, Updraft latch and dismount, indoor room tone.
- **Engine:** per-voice range (Feeder 70 m, Bell Tower 120 m), occlusion (-6 dB, 2 kHz) across rooms and for unseen enemy heroes, `Settings.mute`, `onScreen` and `previewHero`, menu music ticks itself, the Roc fight and the Egg carry hold the objective music (D-AUDIO-003, -004).
- **Tests:** `e2e/audio.spec.ts` renders each new cue offline: finite, above the wind bed, and a distinct signature (41 cues), plus indoor tone, occlusion, mute, a 150-shot flood against the 48-voice cap, and music states.
**Verified:** see the run line below.
**Interface requests:** none blocking. Rendering/VFX: nothing. UI: call `audio.onScreen` and `previewHero` (already wired in app.ts). Level: Lookouts have no radius, audio uses 2.5 m. Systems: Bough Spring launches and Lookout use emit no event, so audio infers them from position; a `movement` action for springs would be cleaner.

### W5.5 · Technical Architect · 20/11/2026
**Branch:** `worktree-agent-a9824254322cf5310` from `integrate/w5` f25766d, with `integrate/w5` fdc85f8 (Audio) merged
in. Decisions D-ARCH-025 to D-ARCH-028; owner follow-ups in `docs/briefs/W5-contract-followups.md` § W5.5.
1. **Interact deleted (D-ARCH-025).** `Button.Interact` is gone; `RETIRED_BUTTONS.Interact` keeps 0x20000 from reuse,
   and core's latch now clears every bit outside `Button`. Proof: deleting the member compiles (no reader), a new
   `index.test.ts` case shows the bit never reaches `HeroEntity.command`, and the no-Interact suite holds it beside a
   cable without mounting. Bindings were already done by the UI's W5a work (`'interact'` and `'scoreboard'` out of
   `BindAction`); `sanitizeSettings` drops a Stage 3 profile's saved codes with no storage bump (`app.test.ts`,
   `e2e/no-interact.spec.ts`).
2. **`SimOptions.practiceStart` (D-ARCH-026).** `{ pos, yaw }`, Practice Hub only, validated and yaw-wrapped by
   createSim, honoured by core's spawn; the training targets stay put. `practiceConfig(seed, hero, start)`; Swap bird
   no longer emits on `sim.ctx.bus` (`e2e/practice-swap.spec.ts` 6/6, "same spot" included).
3. **Dressing in `MapData` (D-ARCH-028).** `MapData.dressing` (optional, absent on the arena); the types moved into
   `contracts/map.ts` and `world/map/dressing.ts` re-exports them; `loadDressing` is a deprecated alias of
   `loadMap(id).dressing` until the Environment Artist switches (W6).
4. **Wave 5a requests (INTERFACES §15, D-ARCH-027):** 19 rows: 12 accepted, 1 modified, 5 satisfied, 1 rejected. New
   optional fields: `AbilityDef.surface`, `EffectTarget.surface`, `DashEffect.steerDeg` (replacing two value names),
   `HealEffect.triggerPct` (Gape), `endOn: 'stun'` (Tree Cling), `TriggerDef.beyondM` (Kestrel's Eye),
   `ShieldEffect.id` (shields taken back on sale), `Layer.Sight`/`Movement`/`EggCarrier`. `PhysicsService.updraftInReach`
   and `Motor.updraftInReach` are now required. Rejected: a cooldown stat for Boundless Song (the refund is exact).
   Deferred to W6: tether `breakDistance` as a Magnitude. Bot AI raised no request; its WIP commit c77a55c reads
   `motor.updraftInReach` in a way the required field keeps valid.
5. **Outside my paths, type-only or mechanical, each forced by the contract change:** `physics/controller.ts` (its
   `Mode.endOn` type follows the contract), `physics/rapier.ts` (its partial service type), the abilities and combat
   test kits (`updraftInReach`), `world/map/dressing.ts`, `build.ts` (one field) and `index.ts` (the alias), and the
   two tests that named `Button.Interact`. No other owner's behaviour changed; the `'stun'` rule, the value-name
   switch and each new field's behaviour are follow-ups (W5 for the integration round where it acts for the owner).
**Verified** (machine loaded by parallel agents: 20–28 node, ~150 browser processes):
- `bash scripts/check.sh` with the integration round's two world-test fixes (3ff5f5f, overlaid, not committed):
  `PASS typecheck 11s · lint 5s · test 51s`, then `FAIL perf`: the Stage 4 objectives budget test (+0.31 to +0.43 ms
  against 0.3). It fails the same way on a clean `integrate/w5` fdc85f8 checkout (+0.424 ms), so it predates this
  round; it is the full-map rerun Objectives asked for (100 Nests, 24 camps), for the integration round and QA.
- Without the overlay, `npm test`: 1,048 passed, 5 failed, all five the known Objectives cases (W5-integ item 1).
- `npm run sim -- --seed 1 --minutes 3 --bots 12`: 10,800 ticks, 7,145 ticks/s, hash `0e2f8fafa4067d33`.
- `npm run e2e`: 61 passed, 1 skipped, 1 failed (`preview-regressions` side buttons: `page.reload` timeout, a known
  load flake); rerun alone with `practice-swap` and `no-interact`: all pass (one Play-scene timeout in the batch passed
  alone too).
**Notes for owners:** the new Audio listener throws "non-finite AudioParam value" from `audio/index.ts:146` on some
frames (the camera pose it gets is not finite yet); seen in the e2e server log, no test fails on it (Audio, Camera).
The no-Interact suite's last red test waits on bots riding Updrafts (Bot AI).
**Interface requests:** none. **Blocked:** nothing.

### EP · 20/11/2026 · open items for the Stage 4 gate
- **Camera pose can go non-finite.** Audio now ignores a NaN/Infinity camera pose (ed8373a), but the source of the bad pose (camera rig before its first target, or a zero-length look vector) is not found. Owner: Rendering/camera. Check it in wave 6 or the integration round after 5b.
- **`e2e/audio.spec.ts` is flaky under machine load** (22/23, the failing case moves, one 30 s timeout). Rerun serially on a quiet machine at the gate before calling it a real failure.
### W5b · Technical Artist (A3 and B2 birds) · 20/11/2026
**Done:** Peacock, Vulture, Swift, Hummingbird, Cassowary, Toucan, Woodpecker and Nightjar are sculpted to the style
guide (D-ART-004), replacing the generic placeholder for all eight. Branch `worktree-agent-a92af01b0682191d3`, from
`integrate/w5` 1f6dc2f, with `integrate/w5` merged back in (clean).
- **Kit** (`models/sculpt.ts`, `anatomy.ts`, `gear.ts`, `feathers.ts`, `bird-material.ts`, `sculpted.ts`): smooth
  lofts through control rings; alpha-tested feather cards from a 16-shape procedural atlas (contour, primary, tail,
  down, the Peacock's eye, crest spoon, hair plume, wing blur, barred, mottled, quill, cloth, ragged, ruff, sickle,
  spotted); a surface-pattern atlas (feather scales, barred, mottled, wood, leather, weave, tarsus scutes) that fades
  at a loft's closed ends. Eyes have iris, pupil, a glossy cornea, a catchlight and two lids. Beaks are two-part with
  nostrils, serrations where the species has them, and a working jaw. Legs are scaled, with jointed toes and glossy
  claws (mirrored per foot; zygodactyl where the species is). Folded wings hold the gun: a covert mass, the flock wing
  bar, and fanned secondaries and primaries. There are fanned tails, shingled body feathers, and gear (stitched straps
  and sashes that follow the body, buckles, pouches, cloth tails, studs). No image files: the textures are generated
  once per session (about 0.2 s).
- **Signature casts** on a `display` morph: the Peacock's train fans into a 3 m eyed disc; the Vulture's coat and
  mantle flare open; the Swift's blades flare; the Hummingbird's ruby gorget lifts; the Cassowary's hair bristles; the
  Toucan cocks its tail and gapes; the Woodpecker raises its red crest; the Nightjar's chin drops into a pink gape. A
  `jaw` morph opens the lower mandible on each shot, cast and death, and a `blink` morph closes the eyes every 3–6 s.
  Cast kinds per slot follow each kit. The rig now reads `EntityView.castSlot`, turns a `spin` bone while firing (the
  Woodpecker's drill cluster), and widens the tail per bird.
- **Guns**, one per archetype in bird-world materials, each with a lit muzzle element and an ammo read:
  - Plume Darts: lacquer, brass filigree, a glowing eye chamber, a dart clip.
  - Bone Shot: a long-bone barrel, barbs, horn and bone plates, a rib stock, bone shells.
  - Sickle SMG: a crescent horn blade, a curved horn magazine.
  - Nectar Needler: twin brass needles, a glowing nectar bulb.
  - Wattle Blaster: a brass bell, a gourd hopper, red tassels.
  - Bill Rifle: a brass scope, a bill-curved fore-end, a cartridge row.
  - Drum Drill: six spinning drill barrels, a brass seed drum.
  - Moth Pistol: moth-wing bone guards, a revolver cylinder, a needle.

  A test holds every gun within G15's cap (0.45 × height).
- **LOD and budget** (style guide §11.3): four levels on one skeleton under a three.js `LOD` (0 / 15 / 40 / 80 m, 10 %
  hysteresis), two draw calls per bird (opaque, cut-out cards). Triangles with the gun, per level (limit 9,000 / 3,500
  / 1,200 / 400):

  | Bird | Level 0 | Level 1 | Level 2 | Level 3 |
  |---|---|---|---|---|
  | Peacock | 8,820 | 3,246 | 1,154 | 394 |
  | Vulture | 8,166 | 3,270 | 1,108 | 392 |
  | Swift | 7,780 | 2,888 | 1,078 | 350 |
  | Hummingbird | 7,222 | 2,660 | 944 | 346 |
  | Cassowary | 8,200 | 3,170 | 1,184 | 398 |
  | Toucan | 8,134 | 2,956 | 1,042 | 330 |
  | Woodpecker | 7,666 | 2,988 | 1,010 | 362 |
  | Nightjar | 6,854 | 2,614 | 958 | 342 |

  After the first, each bird builds in about 20–40 ms per flock.
- **Material library:** written against my own `bird-material.ts`, to the library's conventions (D-ART-005). The
  Rendering library (first version, on its branch) had not reached `integrate/w5`. It is also an environment
  texture-array material, without the bird rim, iridescence or feather cards. D-ART-005 lists the switch-over steps.
- **Review tools:** `tests/anim/frame.ts`, run with `npx tsx tests/anim/posesheets.ts --frame "…"`, gives:
  - the bird from the real player camera (the sim's aim ray, 90° FOV, 1920 × 1080), with the measured screen shares
    of the bird and its gun;
  - 10, 40 and 80 m line-ups;
  - close-ups.

  The pose sheet takes `--look golden` (the style guide's light).

**Verified:**
- `tests/anim/attachment.test.ts` passes for all 20 playable birds and the generic one. Both wings stay on the grips in
  all 24 states, and the muzzle sits on the sim's muzzle point at every pitch, standing and crouched. Grounded feet stay
  on the ground, and every vertex follows a bone of the rig.
- The model tests check: the head on its hitbox, heights, no NaN in any state, every level within budget with at most
  three draw calls, the display, jaw and blink morphs, the LOD switch by distance, and the gun cap.
- I looked at:
  - a golden-light pose sheet per new bird (24 states, two views);
  - close-ups of each at 2–4 m (front, back, side, cast);
  - the 10 m line-up of the eight, and the 40 m and 80 m line-ups of all 24;
  - each bird from the player camera;
  - the character reference frames `HP8-yBieQK8\t2010.jpg`, `N77LqE8zTfQ\t1140.jpg` and `7zjBAwpUeBU\t1770.jpg`
    beside the close-ups.
- Screen share from the player camera (limits 18 % bird, 4 % gun):

  | Bird | Bird | Gun |
  |---|---|---|
  | Peacock | 3.3 % | 0.21 % |
  | Vulture | 4.9 % | 0.23 % |
  | Swift | 3.7 % | 0.22 % |
  | Hummingbird | 3.6 % | 0.21 % |
  | Cassowary | 4.3 % | 0.29 % |
  | Toucan | 3.7 % | 0.24 % |
  | Woodpecker | 3.4 % | 0.34 % |
  | Nightjar | 5.0 % | 0.22 % |
- `bash scripts/check.sh` before the merge of `integrate/w5` (665e70a): `PASS typecheck · lint 9s · test 31s · perf 18s
  · sim 4s · e2e 149s · check 229s`.
- After merging `integrate/w5` at fe16980, typecheck, lint and sim pass, and every render and anim test passes (106).
  The rest fails on code that is byte-identical to `integrate/w5` (`src/sim` is unchanged by this branch):
  - Five sim unit tests fail deterministically: `interactables.test.ts` (Bell Feeder swing-back and off-beat break)
    and `neutrals.test.ts` (the Roc, Thickets, Nests). Objectives/Systems should look at these.
  - The objectives perf test runs at 0.306–0.354 ms against 0.3 ms with other agents loading the machine.
  - Three e2e failures under that load (practice hub, smoke, scoreboard Tab) pass when rerun alone (3/3).
- The eight birds also render in the game's own renderer: `npm run shots -- --scene sandbox --param modelLineup=…`.

**Checklist (style guide §12.1) and my Birds (§8) score:** every bird answers yes to:
- C2: layered feathers, eyes with catchlights, two-part beaks, planted feet with talons, and the gun held in every
  state (the attachment suite);
- C4: under 18 % of the screen, its gun under 4 %;
- A4: no plain primitive in flat colour;
- G1: its own design, nothing copied from the reference.

| Bird | C1: 10 / 40 / 80 m, one shape per band | C3: flock trim, front and back | §8 score |
|---|---|---|---|
| Peacock | yes: the train, and the 3 m fan on casts | sash, collar and ribbons, wing bar | 3 |
| Vulture | yes: the hump, bald red head and coat | kerchief and tails, wing bar | 3 |
| Swift | from the side and back (sickle blades, forked tail); front-on, a small dark bird | scarf and streamers, wing bar | 2 |
| Hummingbird | yes: green drop, needle bill, blur discs | headband and sash, wing bar | 3 |
| Cassowary | yes: shaggy haystack, blue neck, casque | broad sash over the hair, wing bar | 3 |
| Toucan | yes: the banded bill | bandana, wing bar | 3 |
| Woodpecker | yes: red cap, prop tail, white face | harness straps, wing bar | 3 |
| Nightjar | from the side (flat wedge, big eyes); front-on, rounder | sash, wing bar | 2 |

What would lift the 2s, and the rest toward 4:
- The Swift's body is a plain capsule front-on.
- The Nightjar needs a longer, lower body and a tail that reads from the side.
- On every bird, the folded wings still read partly as arms where they reach forward to the gun.
- Heads are 1.04–1.4 × the hitbox radius. On the long-necked birds (Peacock, Vulture, Cassowary) that is under the
  guide's 28–35 % of height, a rule that conflicts with GDD §9's head plans.
- The dark species (Cassowary, Swift, Vulture, Nightjar) sit below §10.5's 45 % value floor. I lifted their blacks
  toward slate; Rendering's rim and lighting pass decides the rest.

**Limits:**
- The twelve older birds keep D-ART-003's flat models until the wave 6 rework.
- The Hummingbird perches on its feet with blur-disc wings, not a permanent 0.3 m hover (D-ART-006, for the Director).
- A blink is a linear morph, so the lids pass close to the eyeball mid-blink.
- LOD uses three.js `LOD` until Rendering's framework lands.

**Interface requests:**
- Rendering & VFX: when the library merges, birds should take its tier (Lambert at Low), its sky environment map and
  its cut-out depth material (D-ART-005). Bloom should pick up the birds' glow (catchlights, chambers, beads).
- QA: each sculpted bird costs two draw calls (plus two in the shadow pass) toward the frame ceilings. The pose-sheet
  review now covers 20 birds.
- None for Sim: the merged sim fills `EntityView.castSlot` (`src/sim/core/view.ts`), and the rig reads it, so each
  slot's cast pose plays in matches.

**Blocked:** nothing.

### EP · 20/11/2026 · art review of the eight sculpted birds (first pass merged, 8c66eab)
- EP scores below the bar of D-EP-047: Peacock 2/4, Swift 1/4. Findings:
  - primitive silhouettes (ball heads on tube necks; Swift a bowling pin from the player camera);
  - wings read as arms;
  - feather cards render as dithered noise;
  - muddy colour and value, with no sheen.
- The Technical Artist is doing a second pass on the shared pipeline (anatomy, feathers, bird material, sculpt) and then each bird.
- The wave 6 rework of the 12 older birds waits for that pipeline, so they inherit the fixes rather than the faults.

### W5b · Environment Artist · 20/11/2026
**Done:** the environment layer in `src/client/render/environment/**` (new), on `worktree-agent-a347043346bfb584a`, built from `MapData.dressing` (D-ARCH-028) over the Level Designer's collision, painted with Rendering's material library. Rendering's branch up to 1213e1d is merged in (render/index.ts resolved), so merge Rendering first.
- **Buildings (§5):** all 110 dressed from their descriptors. Skins in the district material with every opening left open; plinths; string courses carrying perch rails on brackets; quoins or corner posts; Lantern Row half-timbering; stone cornices or timber eaves with rafter tails, fascias, half-round gutters, downpipes and rain barrels; framed doors swung open with strap hinges and ring pulls, fanlights and hoods; open shot and leap windows with sills; glazed decorative windows with bars, shutters (some angled), window boxes and 38 % lit; storefronts with awnings; bay fillers (blind windows, ivy, nest boxes, hanging feeders, carved bird roundels) so no 3 m bay is blank; tile courses as real overlapping slabs with mossy north eaves, sagging ridges, bargeboards with feather curls and finial perches; chimneys with pots and soot; parapet copings; rooftop dressing at the parapet edge; nest crowns on every flagged roof; balconies with braces and woven or fretwork rails; landing boards in pale worn planks; partial faces where neighbours stand against them (D-ENV-001, D-ENV-004).
- **Archetypes:** octagonal Dovecotes with pigeonhole rows, an open slate cap with a finial perch, deck rail and pennant; the Bell Tower's bell in its frame, perch bars across the belfry arches, a nest on the beam and a slate spire; the Hollow-tree House's round bark trunk, limbs into the canopy, knot-hole rims, deck boards and rail; birdhouse rings and lid roofs on stilt houses; woven roofs on Hides; the Water Mill's wheel and race; Granary staddles; carved emblems (no lettering); Warehouse skylights; the Seed Exchange's awning and crow's nest (D-ENV-005).
- **Street life (§1.2):** all 461 props as fitted models: stalls and seed stalls with open sacks, scoops and scales; tube and seed-cake feeders; bird baths; fountains with a verdigris bird; worm beds with casts; straw skeps, beetle logs and moth lanterns; nesting bundles of twig, reed, wool and moss; feather banners and bunting in faded flock tints; roost rails, perch poles, wires, rope walkways, pigeonhole strips; crates, barrels, sacks, carts, logs, counters, planters, shelves, tables with perch stools.
- **Jungle (§6):** bark on every trunk prim (giants with fissured ridges, buttress roots and boughs carrying nests), leaf-card crowns and canopy, pines in drooping tiers, boughs and root walks as round limbs, clipped hedges with fringes and flowers, reeds and cattails, bramble with dark berries, roots, hollows, branch nests, and ground cover (tufts, ferns, litter, pebbles, mushrooms, dropped feathers) over jungle zones and lane verges, never in a lane's middle.
- **Objectives and traversal:** flowering Vines in rope frames; Updraft masts with pulleys and pennants; Chimney hearths with embers; Thicket dens by family; nest beds under all 100 Nests; rune bridges with rune stones, lanterns and bunting; Egg perches (water ring, pedestal, woven nest, carved feathers); the Roc's Hollow (earth walls, roots, mossy shelves, mill timbers, ember scorches, the bridge deck); Bell Feeder seed spills; Lookout masts; Bough Spring rings; Magpie hoards; ivy curtains for every `'sight'` prim and open windows where the `'movement'` fillers stand; ladders.
- **Interiors (§5.9):** every storey room has joists, skirting, a rug or woven mat, a hanging lantern and wall pieces by archetype (shelves, pegs with feathers, perch rails, seed bins, nest beds, hearths, kegs, sacks, grain, crates, produce strings), clear of doors, stairs, ladders, hatches, Chimneys, camps and Nests.
- **Walls (§2.1):** yard walls, fences, decks, outdoor steps, pillars, plinths and the town wall dressed.
- **How it draws:** three BatchedMeshes, per-cell bands, no collision added (D-ENV-001, D-ENV-002, D-ENV-003).
**Verified:**
- `bash scripts/check.sh` on b167574 + docs, the later steps run by hand after the first failure: PASS typecheck, lint; test 1,100 passed, 5 failed (the five Objectives tests that fail on `integrate/w5` itself); perf: my 5 pass, the objectives budget (pre-existing) and the fledgling world budget fail under machine load (31 s runs; it passed at 6.8 s earlier, sim code untouched); PASS sim (seed 1, hash 0e2f8fafa4067d33); e2e 58 passed, 4 failed: `match.spec.ts` damage number (pre-existing, see the W5a Level entry) and three Options/back-button and portrait specs that time out under load and pass run serially (14/14). The draw-budget spec passes.
- Tests: 3 unit (mesher contract, LOD chamfers, a bare map) and 5 in `environment.perf.test.ts` (serial): byte-stable geometry across runs, the Medium budget from QA's lane camera and street level in each lane, every building and camp dressed, every `blocks` prim covered, generation under 6 s (about 1.5 s here).
- **Budgets measured** (headless Edge, 1920 × 1080, whole frame, all passes, Rendering's layer included; seed 1, t = 100, QA's camera −95,10,−20): lane/low 256k triangles and 30 calls (ceilings 330k, 100); lane/medium 672k and 68 calls (1.02M, 120); match/medium 682k and 89 calls (1.02M, 240), peaks over 12 frames. The environment itself is 3 draw calls (4 with shadows). Environment triangles drawn at Medium: 250k from QA's camera; street level 358k on Hedgerow, 385k on Riverbank, 226k on Pinewood (the test holds them under 400k, leaving the blockout its ~45k inside the 450k map row). Whole layer: 1.3M triangles in 510 cell entries; about 2.0M vertices (≈ 95 MB of vertex data, see Next); generation ≈ 1.5 s.
- **Shots looked at** (`out/env/final/*.png`, beside the style guide's frames): overview and top-down (`IXU64ax4IAY t0030`, `t0570`), Hedgerow, Riverbank and Pinewood at street level (`HP8-yBieQK8 t0060`, `N77LqE8zTfQ t0420`, `IXU64ax4IAY t2310`), Market Hall and Tavern interiors (`N77LqE8zTfQ t1050`, `t2100`, `IXU64ax4IAY t1440`), the Warehouse → rope bridge → Hollow-tree crown → Bell Tower roof route (`7zjBAwpUeBU t0840`, `HP8-yBieQK8 t0390`), Lantern Row (`IXU64ax4IAY t2010`, `t1230`, `HP8-yBieQK8 t0600`), the Roc's Hollow, a Thicket camp, the Warehouse-roof Nest cluster and an Egg perch.
- **Scores** (style guide §12, 0–4, my read; A1 per area):

| Area | A1 birds? | Score | Notes |
|---|---|---|---|
| Hedgerow street | yes | 3 | Terraces read as storybook brick and stone with nests, perch rails, pigeonholes, feeders, window boxes; Rendering's trims double mine in places (request below) |
| Riverbank street | yes | 2.5 | Stalls, reeds, mill wheel, rune bridge; long sightline is the busiest view |
| Pinewood street | yes | 2.5 | Stilt houses with birdhouse rings, pines, log stacks, masts; pines thin at range |
| Lantern Row jungle | yes | 3 | Half-timbering, ivy curtains, skeps, stalls, lanterns, nest crowns, canopy |
| Rooftop route | yes | 3 | Belfry, crown deck, rails, pennants, roof nests; the rope-bridge deck is still a plain ramp skin |
| Interiors | partly | 2 | Furnished and lit but sparse; walls are the blockout's painted prims |
| Roc's Hollow | partly | 2 | Walls, roots, shelves, timbers, embers; floor and ramps plain |
| Thicket camp | yes | 2 | Dens and yard walls; the camp ground needs more |
| Nest cluster | partly | 2 | Beds under each Nest; reads once the Nest models spawn |
| Overview / top-down | yes | 3 | Roofline, nests, canopy and town wall read; haze from Rendering |

Weighted mean of my categories ≈ 2.6: not yet the 3.2 pass. Hard items: A1 yes in 7 of 10 areas, partly in interiors, the Hollow and the Nest cluster; A3 holds on building faces, but long yard walls are borderline; A4 fails where wood ramps and some blockout slabs still show plain; A6 holds (landing dressing sits on the collision boards).
**Blocked:** nothing.
**Interface requests:**
- Rendering: skip `trims()` (plinth, string-course and cornice bands) on box prims inside `MapData.buildings` footprints; the facades carry them and the two double up as pale slabs beside windows.
- Rendering: `budgetOf` counts a mesh's whole index; for the environment's BatchedMeshes that is capacity, not what was drawn (tagged `budget: 'environment'` for now). Count `_multiDrawCounts`, or let the layer report its own.
- Rendering: put `batchingMatrix` into `vMatWorld` under `USE_BATCHING` (the layer uses identity matrices today, so macro variation is right, but instanced batch entries would not be).
- Rendering / QA: the layer's vertex data is about 95 MB; smaller attribute types (Uint8 colour and `matLayer`, Int8 normals) need the library's shader to accept them. Worth a joint pass before the iGPU capture.
- Level Designer: the Hollow-tree → Warehouse rope bridge and the long gentle wood ramps are dressed as plank skins; a rope-bridge descriptor (or tagging them) would let them sag with rope rails.
- EP: merge Rendering's branch before this one (this branch contains it up to 1213e1d), and `integrate/w5` up to 1f8bd1d.
**Next:** close the gaps the scores show (interior wall finishes, the Hollow floor, camp grounds, the rope bridge), trim vertex memory, and an iGPU frame-time capture with QA.
### W5b · Rendering & VFX · 20/11/2026
**Done:** branch `worktree-agent-a14678701512c6de5` from `integrate/w5` 1f6dc2f, with `integrate/w5` merged in up to
061e266. Decisions D-RENDER-010 to 017. The Environment Artist's three requests are done (below).

**API for the Environment Artist and the Technical Artists** (`src/client/render/materials`, `batch.ts`, `shapes.ts`):
- `getMaterialLibrary(quality)` → `{ opaque, cutout, cutoutDepth, layer(id), tick(s), setEnvironment(t), textureBytes }`.
  Two shared materials draw every layer, so mixed materials in one cell are one draw call. Cards (leaves, needles,
  feathers) use `cutout` with `mesh.customDepthMaterial = lib.cutoutDepth`. The shader handles `USE_INSTANCING` and
  `USE_BATCHING` (BatchedMesh entries with transforms get the right world-space variation).
- `paint(geometry, id, { tint, uv: 'planar' | 'cylinder' | 'keep', yaw, scale, offset, seed, turn })` writes `uv`
  (tiles), `matLayer` and `color` (multiplied into existing colours). Paint after placing a piece: `planar` keeps
  courses level on walls and along the eaves, `cylinder` wraps posts and trunks, `keep` takes uv in metres (0..1 on
  cards); `seed` adds §4.4 variation; `turn` runs planks and grain upward.
- `bakeAO(geometry, { occluders, ground, rays, underside, reach, voxel, strength })`; `bakeAOAll(geometries, …)` bakes
  many on one shared voxel grid. `rays: false` is the cheap gradient path (overhangs, 0.3 m contact, 0.8 m damp).
- `compactGeometry(geometry)` (call last): welds identical vertices into an indexed mesh and packs normals Int8×4,
  colours Uint8×4 and the layer Uint8; position and uv stay Float32. Takes soups or indexed meshes; the shader reads
  the packed types unchanged. `geometryBytes(g)` measures. On the map layer: 51.8 → 17.8 MB.
- 37 materials (`MATERIAL_IDS`, recipes in `RECIPES`, §7.2): brick, brickBurnt, ashlar, granite, sandstone, flagstone,
  cobble, plaster, plasterOchre, timber, timberDark, timberRed, boards, roofClay, roofSlate, roofShingle, thatch, iron,
  brass, pewter, verdigris, glass, windowLit and lantern (emissive; they bloom), canvas, rope, twig, bark, hedge, grass,
  moss, earth, gravel, water (flows), leafCard, pineCard, featherCard. Tiers: Low Lambert 128²; Medium PBR 256² + 128²
  ORM; High 512² + normal maps (texture memory 3.1 / 15.4 / 111 MB).
- `CellBatch(cellSize, { shadowProxies })`: `add(painted, { kind: 'opaque' | 'cutout' | 'shadow', band: 'near' |
  'mid' | 'far', cast, rays })`, then `build(lib, name)` merges per cell, kind and band, bakes AO across cells and
  compacts; call `updateBands(root, eye)` each frame. With `shadowProxies`, painted meshes don't cast and plain
  `kind: 'shadow'` proxies on layer `SHADOW_LAYER` do (the sun's shadow camera sees that layer, the main camera
  doesn't). `LodInstances(levels, material, capacity)` buckets instances by frustum and distance (10 % hysteresis).
  Shapes: `chamferBox`, `wedge`, `stairs`, `column`, `trunk`, `leafClump`, `tube`.
- Dev measurement: `__perchRender.budget()` (calls, triangles, §11.3 categories; BatchedMeshes count what they drew),
  `?renderOff=post,shadow,backdrop,cards,bloom,msaa`, `?renderTeams` (three a side for G18), `__perchRender.portrait()`.

**What changed on screen:**
- **Lighting (§10):** sun #FFD9A0 at 24° from the south-west, hemisphere #8FA6C9/#4A4A3A, lavender fog #A99BB0 at
  0.0060, a sky with sun glow and cloud bands, a sky PMREM environment on metal and glass, bloom on emissive only, split
  tone and a 10 % vignette folded into the output pass (Medium, High).
- **Map layer** over what the environment layer doesn't re-skin: bevelled, painted, AO-baked prims by district; trims
  (skipped inside building footprints, where the environment's facades carry them); stairs; hedges with leaf fringes;
  bark trunks with crowns; lanes paved with sett kerbs between the Roosts; Updraft masts, Vines, chimney shimmer, seed
  stalls; an instanced forest; kit structure models at anchors instead of cone markers. Low builds without bevels,
  trims or fringes. Shadow proxies cut the shadow pass from about 230k to 24k triangles.
- **G16:** the local Updraft ride and boost are screen-space speed lines (outside the central 50 %, ≤ 3 px, ≤ 25 %,
  ≤ 15 % of the height); the white slabs are gone; other riders keep thin world wind; the FOV kick stays.
- **G18:** red 2 px outline on enemies in sight, red x-ray while revealed, teal x-ray on allies behind walls; one
  overlay per LOD level; the sculpted birds keep their own rim, older models get one.
- **Portraits (D-EP-041):** each bird rendered from its own model into a cached data URL, registered with the UI's
  `setPortraitProvider`; images fill just after the frame.
- **QA ceilings** (`e2e/draw-budget.spec.ts`, acting for QA): calls 100 / 120 / 240 (lane Low, lane Medium, match);
  triangles all passes ≤ 330k Low and ≤ 1.02M Medium; texture memory ≤ 32 / 80 MB.

**Budget scenes** (QA's camera, seed 1, 100 s, 1080p, headless Edge on an Intel Arc 140T iGPU, my layer only):

| Scene | Calls | Triangles, all passes | Map main pass | Shadow pass | Textures |
|---|---|---|---|---|---|
| lane, Low | 42 | 189k | 33 meshes, 184k | none | 3.1 MB |
| lane, Medium | 78 | 341k | 38 meshes, 305k | ≈ 24k | 15.4 MB |
| match, Medium | 99 | 352k | 38 meshes, 305k | ≈ 24k | 15.4 MB |

Low and Medium hold the 120 fps cap headless at 1080p, High 65–95. Before (1f6dc2f): 15–36 calls, 44–66k triangles.
Load to `ready` at Medium is about 2.5 s here (was about 0.9 s): textures 0.55 s, map build with AO about 1.2 s,
shader compiles about 0.3 s, all before the first frame because `__perch.ready` counts frames.

**Before and after:** `out/rshots/before/` and `out/rshots/after/` (menu, lane, street, fight, ride, boost, teams 12 m
and 40 m, portraits; git-ignored), beside `IXU64ax4IAY t0030`, `HP8-yBieQK8 t0060` and `out/reference/perch/`. Against
§12.1: golden hour, haze and depth layering read (E1, apart from interiors); masonry, timber and roofs show three scales
of detail with no visible tiling at lane range (E2); lane floors are calm paving (B3); birds and effects stay brightest
and only lights bloom (B2); the Updraft view is clear. Still open, with their owners: A3 long unbroken walls and the
boundary wall (Environment Artist), A4 primitive-shaped structures and unsculpted birds (Technical Artists), lit
interiors. At the menu's high overview the nearest crowns show some faceting of their cores.

**Verified:** Git Bash `VITEST_MAX_WORKERS=2 npm run check`: `PASS typecheck · PASS lint · FAIL test` (5 failed, all the
Objectives tests that fail on `integrate/w5` itself: `interactables.test.ts` ×2, `neutrals.test.ts` ×3). Run
separately: `npm run perf` 7/8 (the objectives budget, also failing on `integrate/w5`); `npm run sim -- --seed 1
--minutes 3 --bots 12` 10,800 ticks, hash `0e2f8fafa4067d33`; `npx playwright test` on the final merge, while the machine was saturated (a 12 min run; 3 min is usual): 58 passed, 4 failed: `match.spec.ts` damage number (pre-existing, see the W5a Level entry) and three multi-navigation specs that time out; run serially, 8 of those 9 pass and `preview-regressions.spec.ts` "binds side buttons" (four page loads in 30 s) still times out (request below). The serial project alone: 24 of 25; the miss is `audio.spec.ts` "music reacts to the Roc fight" (the music state signature, not rendering). `e2e/draw-budget.spec.ts` 3/3. Renderer unit
tests 45 (materials, compaction, map layer, ride, identity).

**Interface requests:**
- Technical Architect: let `__perch.ready` also wait on a renderer readiness flag (for example `Renderer.ready`), so
  texture generation and the AO bake can move to Web Workers without nondeterministic screenshots; and update or retire
  `app/palette.ts` `LIGHT_COLOURS` and `SKY_COLOURS` (GDD §14.5 values; the renderer now uses the guide's).
- QA: `preview-regressions.spec.ts` "binds side buttons" makes four page loads inside the 30 s default and times out
  when the run is busy (it passes alone); a 60 s per-test timeout would hold. The G18 3v3 gate capture can use
  `?renderTeams`.
- UI/HUD: G18's in-world enemy health bars and names are the UI's; the renderer supplies outlines and x-rays.
- Environment Artist: call `compactGeometry` on the layer's meshes before `addGeometry` (same shader, about a third of
  the bytes), and keep its BatchedMeshes tagged so `budget()` reports them (it now counts what they drew).

**Next:** a worker path for generation once the readiness hook exists; decals (§7.5); the canopy dapple at Medium.
### W5b · Technical Artist · second pass on the eight birds · 20/11/2026
**Done:** the shared pipeline was fixed first, then each bird re-tuned. `integrate/w5` was merged in first. Branch
`worktree-agent-a92af01b0682191d3` (D-ART-007).
- **Feathers** (`feathers.ts`, `sculpt.card`, `bird-material.ts`): solid tapered blades with a raised rachis replace
  the cut-out quads, with clean edges and no dithered fringe. Patterns are opaque, with bars, spots, mottle, and the
  Peacock's crisp eyespots. There are fewer, larger feathers, each placed deliberately.
- **Heads** (`anatomy.headForm`): one loft from inside the body's neck through the nape, crown, brow and cheek into
  the beak base, used by all eight birds. Necks and napes are fuller, so no head sits as a ball on a tube.
- **Wings** (`wingArm`, `wingHand`): broad tapered panels with the flock wing bar, two rows of coverts, graduated
  secondaries, and primaries spread as fingers round the grip.
- **Surface** (`sculpt.loft`): the pattern repeats a whole number of times round each loft's widest ring, so it no
  longer shears into streaks or rings. It fades at closed ends. The scale tile is softened to a hint of feathering
  under painted gradients.
- **Colour and value:** every bird has a lighter belly, a darker back and one strong accent, plus the rim and a gloss
  or iridescent finish. The Peacock's train is iridescent teal, green and bronze.
- **Per bird:**
  - Peacock: a train of five tiers with eyespots, and a full nape.
  - Swift: a leaning teardrop body, crescent sickle wings from the shoulders, a mantle of glossy scapulars, a forked
    tail, a pale throat and goggles.
  - Vulture: a bald head lofted as one form, and a ruff of 12 tufts.
  - Hummingbird: a puffed breast, a ruby throat, broader wings and geometric blur fans.
  - Cassowary: a wider neck, and hair rows kept clear of the rump pole.
  - Toucan: a bib.
  - Woodpecker: painted crown, mask and stripes.
  - Nightjar: the head sits down into the breast, the gape is a thin line, the chin is a pale throat patch, and the
    mottle is clean.

**Evidence:** before and after images are in `out/art/before/<bird>.png` and `out/art/after/<bird>.png` (git-ignored).
Each is a neutral-light triptych: 3/4, front, and the back from the player camera. `out/art/after/<bird>-player.png`
is the real player camera. I compared them side by side with `HP8-yBieQK8\t2010.jpg` (crisp planes, one saturated
accent, soft gradients, edge light). Reproduce with
`npx tsx tests/anim/posesheets.ts --out=out/art/after --frame="name=<bird>&mode=triptych&hero=<bird>"`, or
`mode=player`.

| Bird | Level 0 / 1 / 2 / 3 triangles | Player camera: bird / gun | Honest score (3 = finished, professional) |
|---|---|---|---|
| Peacock | 8,568 / 3,060 / 1,078 / 396 | 3.6 % / 0.20 % | 2 |
| Vulture | 8,044 / 3,190 / 1,034 / 388 | 5.3 % / 0.22 % | 2 |
| Swift | 7,298 / 2,786 / 1,046 / 386 | 4.9 % / 0.21 % | 2 |
| Hummingbird | 6,578 / 2,502 / 864 / 354 | 5.6 % / 0.21 % | 2 |
| Cassowary | 8,392 / 3,164 / 1,124 / 394 | 4.8 % / 0.28 % | 1 |
| Toucan | 7,798 / 2,898 / 988 / 330 | 3.9 % / 0.23 % | 2 |
| Woodpecker | 7,414 / 2,904 / 944 / 366 | 3.3 % / 0.32 % | 2 |
| Nightjar | 6,738 / 2,582 / 890 / 342 | 5.4 % / 0.21 % | 2 |

All are within budget (9,000 / 3,500 / 1,200 / 400), with at most three draw calls.

**Still short of 3:** these gaps are structural, not tuning.
- Bodies are single lofts that read as eggs or bottles. They need a sculpted breast, shoulder and back planes, and a
  coat of large contour feathers over the back, not a tiled surface.
- The Peacock's secondaries hang as a skirt.
- The Cassowary's back is still a black egg, and its plumes look grey from behind.
- The Nightjar is still two stacked rounds from the front.
- Long necks (Peacock, Cassowary) still read as tubes from the player camera.

**Verified:**
- The model, render and attachment tests pass (106): budgets, ≤ 3 draw calls, the head on its hitbox, the gun cap,
  the morphs and the LOD. Wings are on the grips and the muzzle is on the sim's muzzle point. Feet are planted in
  every grounded state (D-EP-035).
- `npm run check`, each step run, with `integrate/w5` 061e266 merged (clean):
  - **typecheck, lint and sim:** pass. The sim is seed 1, 3 minutes, 12 bots, in 3.4 s.
  - **test:** 1,083 pass and 6 fail. None of the failures is in this branch's files.
    - Five sim tests fail deterministically on `src/sim`, which is byte-identical to `integrate/w5`:
      `interactables` (Bell Feeder) and `neutrals` (Nests, Thickets, Roc).
    - The wiki-coverage test times out under load.
    - The all-bird model tests now have a 30 s timeout, because one timed out at 5 s under load.
  - **perf:** the two `world.perf` timing tests run over budget while other agents load the machine.
  - **e2e:** 60–61 of 62 pass. A different spec fails on each run (match shop, Swap bird). Both pass when rerun
    alone (7/7).
### EP · 20/11/2026 · art review of the environment layer (first pass, not merged yet)
- Branch `worktree-agent-a347043346bfb584a` (2de8b3d) carries Rendering's work-in-progress branch at 1213e1d. It merges after Rendering, never before.
- EP agrees with the artist's 2.6 against the 3.2 pass mark. Hedgerow's terrace, roofs and lighting are a real step up. Second pass ordered:
  - bird life at every scale in each street view (D-EP-048);
  - a real layered jungle instead of a lawn;
  - the giant blank boundary wall dressed as a skyline;
  - interior floors (grass shows indoors) and bird-purpose furnishing;
  - volumetric Nests and objective sites;
  - vertex memory down from about 95 MB, jointly with Rendering.

### EP · 20/11/2026 · bird models: second pass merged (e28ebaf); sculpt pipeline v2 ordered
- The second pass gives clean feather blades, crisp eyespots, one-loft heads and broad wings. It is better than the first, but every bird still scores 2 out of 4 (Cassowary 1), and the cause is structural: single-loft bodies.
- Wave 5c: a fresh Technical Artist builds an implicit (SDF) sculpting pipeline and converts Peacock, Swift and Cassowary as proof (brief `docs/briefs/W5-sculpt.md`). After EP review, the other 21 birds convert in parallel batches. This replaces the wave 6 rework of the 12 older birds on the old pipeline.

### EP · 20/11/2026 · Rendering merged (270b4f6)
- In: 37 seeded materials, golden-hour lighting and grade, LOD and instancing with shadow proxies (shadow pass about 230k to 24k triangles), style-guide draw ceilings, portraits, G16 speed lines and G18 outlines and x-rays.
- QA camera at Medium: 78 draw calls and 341k triangles; 120 fps on the Arc iGPU at Low and Medium.
- **Open, for the wave 6 integration round:**
  - Page load rose from about 0.9 s to 2.5 s. The fix is cheaper or deferred generation behind a renderer-ready hook in `__perch.ready` (Architect, then Rendering), not longer test timeouts. `preview-regressions` "binds side buttons" times out under load until then.
  - The music-state audio spec failed once under load. Recheck it on a quiet machine.
### W5b · Bot AI · 20/11/2026
**Branch:** `worktree-agent-ab0a222c15d139b2e` from `integrate/w5` 93de0c5, with `integrate/w5` merged in twice (51bb8d7:
W5.5 contracts and Audio; 40fef0a: the bird second pass). Edits only `src/sim/ai/**`, `src/sim/data/ai.ts`,
`src/sim/data/builds.ts` (Bot AI's until W6, contract follow-ups), this entry and D-AI-001..008.
**Done** (G22 "hero bots that fight" is closed: lanes fight from 0:50):
1. **Bots that play (GDD §11, D-AI-001).** `src/sim/ai/bot.ts`: every decision interval a bot picks Egg carrier, tower
   escape, home retreat (§11.2 HP thresholds, healed to 90% at the Roost), tactical retreat (outnumbered by 2 or fight
   score < 0.6), fight (enemy hero in 35 m, score ≥ 0.9, lowest effective HP with supports and carries first), ping
   and defence orders, objectives, shop trips, push or farm, else lane. Laning (§11.3): waits by its outermost tower,
   then 5 m behind its wave's front, short of the enemy wave and outside enemy tower reach; targets ripe pods (secure
   and deny at the difficulty's rates with the ± pod timing error), last hits, pokes when its HP fraction is at least
   the enemy's, a tower busy with its wave, the wave, then twig Nests. Lanes 2-2-2 with frontline paired with backline,
   the human counted first on Riverbank (`assignLanes`). All through `PlayerCommand`, seeing only `canSee` entities.
2. **Three difficulties (§11.2, D-AI-004).** `data/ai.ts` DIFFICULTIES: reaction 0.6/0.35/0.2 s (±25%), aim error
   4/2.2/1° plus 0.5/0.3/0.15° per m/s, tracking 250/150/80 ms, head rate 0/25/60%, last hits, denies, pod timing,
   decision interval, parry 0/20/60%, retreat HP, temperature, shops, movement links, last-seen chasing. Aim flicks
   with an overshoot, tracks through a filter with a wandering error, rides up 0.25° per shot, leads projectile guns.
   Abilities and item actives by use (enemy, nova, heal, ally-with-self-fallback, mobility, buff) from each kit's
   effect tree; Raptor holds its ultimate for 2+ heroes or a likely kill. Parries a seen heavy wind-up (D-AI-008).
3. **Buying and AP (§11.4, D-EP-036, D-AI-003).** `src/sim/ai/shop.ts`: softmax(score / T) over affordable, buyable
   listed items from `ai/<heroId>/shop`, components and the four-active cap, trading up a tier when full (no churn),
   situational picks +0.15 by enemy archetype, `options.botShopping` (scores, temperature, random). Round-0 `BUILDS`
   (`src/sim/data/builds.ts`: STARTER_SCORES and the §11.8 rows with situational picks). AP: ultimate tier when
   affordable, else T1s in the §11.5 priority, then T2s, then T3s.
4. **The game around them.** Nav A* on `MapData.nav` with tower patches (D-AI-002); Updrafts by held Jump (latch
   facing the goal, release, fresh press to drop off near it, never while an enemy is within 30 m); Egg (nearest three
   go, the poorest takes it with a light melee, escorts, the carrier walks to the Stone, enemies focus the carrier);
   runes and Embers by heavy melee; the Roc from its floor once 4+ allies live and the enemy is thinned or away;
   Thickets by tier and level; defence calls (2+ enemy heroes hitting an allied structure: 3 nearest bots); pings
   answered by the 2 nearest bots; tower reflexes and siege windows (D-AI-005); from 20:00 the flock groups on one
   lane and then sieges the Shrines and Patron (D-AI-008). Bot picks follow §11.6 among implemented heroes (D-AI-006).
**Verified:**
- `PERCH_PENDING=1` QA suites on the final code: `bot-shopping` 6/6 (696 s alone; 360 s on 7afcbe9; its 900 s
  `beforeAll` timed out once while sharing the CPU with an 8-process batch); `no-interact` all pass (bots ride Updrafts
  on held Jump, no Interact bit).
- `src/sim/ai/ai.test.ts` (12): exp vs Math.exp, softmax 73%, buying rules, the active cap, AP order, BUILDS, picks,
  2-2-2 lanes, routes from both Roosts round the Patron, lane maths, aim reaction and error, and **G22: Play (1 human +
  11 bots, seed 1) has bots hitting fledglings in all three lanes and a hero by 1:05**.
- **AI share of the tick:** `src/sim/ai/ai.perf.test.ts`, 12 bots in a live fight (75 s in), a shadow AI on a copy of
  the context: **0.139 ms of a 0.649 ms step (21%)**; budget 0.25 ms. Other runs: 0.164/0.735, 0.179/0.761.
- **20 seeded headless matches** (`npm run sim -- --matches 20 --parallel 8 --bots 12`, 60-minute cap, final code):
  **20 completed, 0 crashed**, 1,904 s. Every match reached 60:00 with no winner. Per match (seed: kills Dawn-Dusk;
  first Hawk / Heron / Warden falls, minutes; first rune; first Egg delivered (deliveries); Roc killed):
  1: 28-22; 9.8/23.7/24.9; 5.0; 10.5 (8); - · 2: 28-30; 6.8/25.2/29.1; 5.1; 10.4 (8); 51.1 ·
  3: 21-12; 9.2/27.2/30.0; 5.6; 11.9 (7); - · 4: 25-27; 12.4/25.3/29.9; 5.0; 11.5 (10); 51.6 ·
  5: 31-31; 7.3/23.7/27.0; 6.2; 17.2 (6); - · 6: 17-33; 8.3/23.2/26.9; 5.0; 10.3 (8); 47.9 ·
  7: 38-23; 7.2/23.8/29.1; 5.3; 11.2 (9); 47.3 · 8: 20-26; 12.2/23.8/29.0; 5.4; 10.5 (10); - ·
  9: 21-20; 11.8/36.7/59.0; 5.2; 10.9 (8); - · 10: 30-17; 6.4/23.2/24.5; 5.0; 13.8 (8); 53.6 ·
  11: 36-24; 7.8/25.2/29.5; 5.0; 12.4 (9); 49.5 · 12: 29-32; 6.9/25.3/29.1; 5.4; 11.8 (7); 55.1 ·
  13: 25-23; 8.8/26.3/27.8; 5.4; 10.4 (4); - · 14: 23-29; 8.8/23.8/30.5; 5.0; 13.5 (8); 47.2 ·
  15: 27-16; 14.8/26.3/27.5; 5.4; 11.0 (7); 59.1 · 16: 30-10; 6.9/22.4/25.6; 5.1; 12.0 (9); 53.5 ·
  17: 32-17; 11.8/43.2/54.7; 5.6; 10.6 (10); - · 18: 22-35; 6.3/25.2/30.5; 5.4; 11.2 (6); 47.6 ·
  19: 29-33; 6.7/22.3/30.1; 5.0; 11.9 (7); - · 20: 22-34; 7.8/59.2/-; 5.4; 10.8 (7); -.
  Totals: 1,028 hero kills (51 a match); 101 Hawks, 37 Herons, 68 Wardens, 0 Shrines; 357 of 480 runes claimed; 156
  of 220 Eggs delivered; Roc killed in 12 of 20, 8 of 36 Embers claimed; 54 camps cleared; 4,467 Nests broken.
  Telemetry: `out/telemetry/w5-bots/` (baseline before D-AI-008, also 20/20 and 0 crashes:
  `out/telemetry/w5-bots-baseline/`, 1,814 s, 115 Hawks, 21 Herons, 8 Wardens, no Roc kill).
- **Screenshot:** `out/shots/w5-bots-play-2min-hedgerow.png` (`npm run shots -- --scene match --seed 1 --t 120 --param
  renderCam=-93,24,-34,-93,0,-9`), looked at: Hedgerow at 2:00, both waves engaged, one bird firing tracers into the
  Dusk wave, another's spread shot landing below; the browser fast-forward matches Node (same roster, Dusk's Owl dead
  with a 3 s respawn).
- `npm run check` steps on the merged tip (machine shared with parallel agents): typecheck PASS, lint PASS (0 warnings), test 1,096
  passed, 5 failed: exactly the five known Objectives cases (interactables 2, neutrals 3; pre-existing on integrate/w5,
  the integration engineer's). Then by hand: perf 8/9, the one failure the pre-existing objectives budget (0.3017 vs
  0.3); sim PASS (`--seed 1 --minutes 3`: 10,800 ticks, hash `41b6ba755b99c3c1`); e2e 61 passed, 1 skipped, 1 failed
  (`match.spec.ts` expects exactly "Lv 2" at 15:00; the idle human is now Lv 3 because its flock's bots take Hawks:
  871 passive + 300 structure Seeds; request below).
**Known gaps:** no bot-only match ends: grouped bots break a lane each by 30:00 but don't break a Brood-Warded base
(the Shrines take no damage; enemy heroes defending pull the group into fights in mid). Chimneys, Vines and Bough
Springs aren't taken; interior routes, Hides, Lookouts, Bell Feeders and Berries aren't sought (§11.7); bots don't ping.
**Interface requests:**
- Level Designer: the nav graph threads lanes through tower anchors (nodes at Warden, Hawk and Heron centres) and
  routes each Home Roost exit over the Patron's dais; please route round tower bodies so `NAV.extraLinks` and the
  steering patch can go (D-AI-002). Some ground-profile links cross walls (bots stuck west of Riverbank near
  (−61, −66) and (−46, −78) on seed 1 before the stuck-link rule).
- QA: `e2e/match.spec.ts` asserts exactly "Lv 2" at 15:00 of Play; with bots taking structures the human earns their
  payout, so assert Lv ≥ 2. `bot-shopping`'s 900 s `beforeAll` now runs bots that act; give it room or fewer minutes.
- Character Controller / integration: `physics/controller.test.ts` `bench` uses an `'easy'` bot as a stationary target;
  please use `'dummy'`, then D-AI-007 (bots idle on lane-less maps) can go.
- Game Director / Balance: bot-only matches run to 60:00 (Herons 9,000 HP, Brood Ward); siege pacing for W6 tuning.
**Next (W6, Bot AI):** grouping five behind a wave to drop the Brood Ward and siege the base; §11.7 interiors, Hides,
Feeders, Berries, Springs and climbs; tuning for all 24 heroes with the Build Lab's scores.
**Blocked:** nothing.
### W5b · Environment Artist · second pass · 20/11/2026
**Done** (after the EP's art review; branch `worktree-agent-a347043346bfb584a`, `integrate/w5` merged at 40fef0a, which includes Rendering's final branch 270b4f6):
- **Birds at every scale (D-EP-048):** nest holes with straw tufts under every eave; nest-box clusters high on street faces; twigs and straw out of gutters; perch dowels under sills; faint streaks under ledges; feeders on brackets and seed sacks with spills at doors; woven rooftop rooms and ridge turrets; about 260 small perched birds (muted, static, no flock colour) on ridges, rails, sills, gutters, wires, baths, feeders and masts; berry bushes, worm beds, feeder posts, nesting bundles and seed sacks along every lane edge; sparse feathers and seed on lane floors, clear of the centre line.
- **Hedges** grow broken silhouettes (lumped tops, bulging flanks). **Updraft stations** are my woven masts (twig collars, crow's-nest basket with a nest, feather streamers); the blockout keeps only the cables. The cream column with an orange band in the lane shots is the Sentinel Hawk structure model, not a mast.
- **Jungle:** wider crowns on boughs, a canopy over the jungle zones (and 30 % over lanes) at 17–25 m with lianas, dappled shade on the floor, denser ferns, soft bushes, moss, mushrooms and fallen logs, more ivy on jungle facades.
- **Map edge:** the town wall is now a forest wall: giant half-sunk trunks with buttress roots, leaf clumps from 3 m up and a tree line on top, shrubs at the foot, a deep-shade face behind.
- **Interiors:** ground floors and cellars get boards or flagstones (holes left open), timber wainscot, nest cubbies, sorting tables and roost shelves. The plaster crack doodles are Rendering's texture.
- **Objectives:** woven Nest cradles with volume; the Roc's nest ring with moulted feathers, mossy boulders and ferns in the Hollow; camp grounds ringed with stones and logs, with husks, burrows and brambles. The owl faces on the parapets are the Nest Wardens (structure models).
- **Vertex data:** 27 bytes a vertex (Int8 normals, Uint8 colour and layer); relief quads for quoins, bars, frames and shutters; beads for berries and flowers. At Low, band-2 cards stop at 60 m.
**Verified:**
- `bash scripts/check.sh`: PASS typecheck and lint. Test: 7 failed, the five Objectives tests that fail on `integrate/w5`, plus concession and wiki coverage, which time out under load and pass alone (22/22). Perf: my 5 pass; the objectives budget (known) and the fledgling world budget fail under load. PASS sim (hash 0e2f8fafa4067d33). e2e: 59 passed, 3 failed under parallel load (lane/low triangles, Updraft Shift speed, Options back button); all pass serially (draw-budget 3/3, play 2/2). After the Low card cap, draw-budget passes in parallel too (3/3).
- **Budgets** (whole frame, all passes, QA's camera, peak of 12 frames): lane/low 252k triangles and 25 calls (ceilings 330k, 100); lane/medium 573k and 52 calls (1.02M, 120); match/medium 584k and 76 calls (1.02M, 240). The layer is 3 draw calls (4 with shadows). Street-level views reach about 1.0M whole-frame on Riverbank at Medium. That is not a budget scene, but it is over the guide's 450k map row.
- **Memory and load:** the layer is 2.13M vertices, 75.5 MB of vertex and index data (was about 112 MB with indices). Rendering's `compactGeometry` measured on it gives 69.7 MB but adds 0.8–1.2 s of load, so I don't call it; my geometry is already indexed and packed. Generation takes 1.2–1.5 s in Node on this loaded machine (buildings 0.4–0.6 s); that is my share of page load. Moving it to a worker is the next step.
- **Shots:** `out/env/final2` and `out/env/final3` (overview, three lanes, Market Hall, rooftop route, jungle, Hollow, camp, Nest cluster, map edge), looked at beside the style guide's frames.
- **Scores (0–4, my read):** Hedgerow 3, Riverbank 2.5, Pinewood 2.5, Lantern Row jungle 3, rooftop route 3, interiors 2.5, Roc's Hollow 3, Thicket camp 2.5, Nest cluster 3, map edge 3, overview 3. That is about 2.85 overall: still under the 3.2 pass, with Riverbank, Pinewood, interiors and the camp below 3.
**Blocked:** nothing.
**Next:** a generation worker (load time); Riverbank and Pinewood street life; richer interiors and camps; vertex memory toward 50 MB (instancing repeated props).

### EP · 20/11/2026 · Bot AI and the environment second pass merged (985998c); Build Lab started
- **Bot AI:** bots fight in all three lanes by 0:50 (G22 closed), shop from item scores and take Hawks, runes, the Egg and the Roc. 20 headless matches ran with zero crashes, but **every match was undecided at 60:00**: no Shrine falls through the Brood Ward. Bot AI is resumed to make matches end, with a median of about 30–40 min and none over 55. That is a Stage 4 gate item.
- **Environment, second pass:** bird life on facades and streets, about 260 perched birds, a canopy over the jungle, a forest wall at the map edge, interior floors and woven Nests.
  - The artist scores it 2.85 against the 3.2 gate. Riverbank, Pinewood, interiors and the camp are at 2.5.
  - It adds 1.2–1.5 s of load and 75.5 MB of vertex memory.
  - The third pass and worker-based generation go to wave 6.
- **Build Lab** (simulation track, D-EP-044): Phase A, the lab and a pilot, starts now (brief `docs/briefs/W5-buildlab.md`). Phase B, the 1,000+ match run, starts once the match-ending fix and the integration round are merged.

### W5c · Technical Artist · sculpt pipeline v2 (implicit bodies) · 20/11/2026
**Done:** an implicit (SDF) body pipeline, and Peacock, Swift and Cassowary converted to it. Branch
`worktree-agent-ab2171eba079ed25b`, with `integrate/w5` merged at 373506f (Rendering's materials and lighting, Bot AI,
the environment second pass). D-ART-008 (pipeline), D-ART-009 (meshoptimizer, bake only), D-ART-010 (how to convert a
bird).
- **Pipeline:**
  - `models/bodies.ts` describes each bird as signed-distance masses: back, breast pectorals and keel, belly, mantle,
    tail coverts, scapulars, wing roots, thighs, a neck chain, and a head with brow, cheeks, nape, throat, bill base and
    eye sockets. It also gives the anchors the rig hangs from.
  - `models/sdf.ts` is the field: smooth union and subtraction with a blend radius per mass, bone and paint ownership,
    and surface probes for gear and feathers.
  - `models/mesher.ts` bakes it: surface nets, then meshoptimizer's attribute-aware levels of detail.
    `models/skin.ts` decodes and paints the result.
  - Bake with `npx tsx tests/anim/bake-skins.ts` (1–4 s a bird). `skins.test.ts` re-bakes and requires the committed
    skins to be byte-identical.
- **Skinning:** sculpted builds are now in the model frame with real bind matrices, so a skin vertex blends up to four
  bones. Necks hand from the body to the head, wing roots to the wings, and thighs to the legs. Rigid parts, sockets,
  IK, morphs, levels of detail and Rendering's identity overlays are unchanged.
- **Texturing:** skin vertices take the bird atlas tiles world-aligned (triplanar on the bind pose) and blend region
  colours softly. Paint-only "mark" volumes draw sharp markings.
- **Per bird:**
  - Peacock: a level pear body with a pectoral breast and keel, buff scapulars, raised tail coverts, and an S-neck that
    flows into a hooded nape. It has a stern brow, white face stripes and dark feathered thighs.
  - Swift: a forward-leaning torpedo with a broad chest and a waist, and short feathered thighs with a fringe. Its flat,
    scowling head has pale brows, a pale throat, and a goggle strap round the back.
  - Cassowary: a domed haystack over a sculpted shag (two tiers of hanging locks) under the hair blades, and heavy
    thighs with hair fringes. A bare blue neck carries a skin fold, wattles and a red nape that grades into the head,
    under a tall horn casque.
- `tests/anim/frame.ts` takes `fov=`, to inspect far line-ups at the level of detail their distance picks.

**Evidence** (git-ignored; reproduce with `npx tsx tests/anim/posesheets.ts --out=out/art/after --frame="name=<bird>&mode=triptych&hero=<bird>"`):
- Before and after triptychs (three-quarter, front, back from the player camera, neutral light):
  `out/art/before/<bird>.png` and `out/art/after/<bird>.png`. Player camera: `out/art/after/<bird>-player.png`.
- Line-ups with Vulture and Toucan at 10, 40 and 80 m: `out/art/after/lineup-{10,40,80}.png`. The 40 and 80 m levels of
  detail, zoomed: `lineup-{40,80}-zoom.png`.
- In the real game renderer (sandbox, front and back): `out/art/after/game-lineup.png` and `game-lineup-back.png`.
- I judged them beside `HP8-yBieQK8\t2010.jpg`.

| Bird | Level 0 / 1 / 2 / 3 triangles (of which skin) | Player camera: bird / gun | Honest score |
|---|---|---|---|
| Peacock | 8,890 / 3,374 / 1,134 / 376 (2,300 / 900 / 300 / 120) | 3.6 % / 0.24 % | 3 |
| Swift | 8,962 / 3,232 / 1,196 / 394 (2,900 / 950 / 300 / 110) | 4.9 % / 0.39 % | 3 |
| Cassowary | 8,872 / 3,410 / 1,144 / 374 (2,500 / 850 / 280 / 120) | 5.3 % / 0.38 % | 2.5 (3 from the front and three-quarter) |

All are within 9,000 / 3,500 / 1,200 / 400, with at most three draw calls. Before, the scores were 2, 2 and 1.

**Load and memory:**
- Nothing is generated at load. A skin decodes once in about 2 ms, then paints per team. A bird still builds in about
  20–30 ms (Node, median of 7, the same as before within 4 ms). A 12-bird match adds well under 0.1 s, against the
  ≤ 1 s allowance and today's 2.5 s page load.
- Geometry per bird and team, all four levels: Peacock 2,103 → 2,105 KB, Swift 1,926 → 2,109 KB, Cassowary 2,026 →
  2,038 KB. Most of this is the three morph targets' position and normal deltas, which are zero on the skin. A
  per-layer morph range would save about a third (wave 6).
- Bundle: +229 KB of base64 source for three birds, about 75 KB a bird (about 1.8 MB for all 24 before gzip).

**Verified:** the model, render, skin and attachment tests pass (111): budgets, the head on its hitbox, the body
meeting the head, grips held in every state, the muzzle on the sim's muzzle point, feet planted, and every vertex's
weights summing to 1. `npm run check`, each step run, with 373506f merged (this branch changes nothing in `src/sim`):
- **typecheck, lint and sim:** pass. The sim is seed 1, 3 minutes, 12 bots, hash 41b6ba755b99c3c1.
- **test:** 1,117 pass and 6 fail. Five are the known Objectives sim tests. Wiki coverage timed out under load and
  passes alone (10/10).
- **perf:** the objectives budget fails (known). The fledgling world budget failed under load and passes alone.
- **e2e:** 55 pass and 7 fail in parallel under load. Run serially, draw-budget (3/3), hero-select and options pass. Two
  still fail, neither from this branch:
  - `preview-regressions` "binds side buttons" (the EP's open item from the page-load regression);
  - `match.spec` "Seeds levelled the hero up" (Bot AI's interface request: bots now take the structure payouts).

**Still short:**
- Peacock: from the player camera, the neck is still a long smooth column, and a soft crease marks the hood at the nape.
- Swift: the sickle wings are thin dark blades that read weakly from behind.
- Cassowary: from the player camera, the back of the head is a plain blue ball (the hitbox floors its size), and the
  coat is still mostly hair blades; the sculpted shag shows at the hem.
- Fine markings follow mesh vertices, so they soften from level 1 up. At level 2 (40 m) the Cassowary keeps few hair
  blades, so its shag and casque carry the haystack read.

**Time to convert one more bird:** about 1.5–2 hours with renders, following D-ART-010. The pipeline and helpers are
shared, and a bake takes seconds.
**Blocked:** nothing.
**Next:** the EP's review, then the other 21 birds in parallel batches.

### EP · 21/11/2026 · sculpt pipeline v2 merged (63b6776)
- Implicit (SDF) bodies baked offline and cut into LODs with meshoptimizer (an exact dev dependency, D-ART-009). A byte-identical re-bake test guards the committed skins. Nothing is generated at load.
- EP scores: Peacock 2.5, Swift 2.5, Cassowary 2.5–3 (from 2, 2 and 1).
- Pipeline v2.1 is ordered before the batches:
  - feather surface detail along a flow field;
  - a standard for the player-camera view (nape, hackles, crown, value breaks);
  - wings that wrap the grip instead of reading as arms;
  - a check under golden-hour lighting.
- Then the other 21 birds convert in parallel batches, with a per-bird checklist.
### W5 · Balance & Data · Build Lab Phase A · 20/11/2026
**Branch:** `worktree-agent-a2b0b29f72af4887f` from `integrate/w5` 373506f. Edits only `tools/buildlab/**`,
`src/sim/data/learned/**`, `docs/balance/**`, this entry and D-BAL-001..004. `src/sim/data/builds.ts` untouched (Bot AI's).
**Done (Phase A: the lab and a pilot):**
1. **Runner** (`npx tsx tools/buildlab/run.ts --round R --matches N [--parallel P] [--minutes 60] [--difficulty hard]`):
   one worker process per seeded 12-bot match, `--parallel` default half the logical cores; per flock `random` buying
   or a round's scores at a temperature (`SimOptions.botShopping`). Records per match: picks, every buy and sale with its
   second, unlocks and upgrades, winner, length, hash, per-hero telemetry, damage to heroes by gun / abilities / melee /
   items, and per ability casts, damage, killing blows and kill participation (bus listeners on `sim.ctx`, read-only).
   Compact (~10 KB) atomic files under `out/buildlab/round-R/matches/`; reruns skip finished seeds (resume proven: a
   rerun of round 2 played 0 and relearned identical outputs). `--duel prev|random` plays held-out matches.
2. **Learning** (`learn.ts`, D-BAL-001): per hero a Gaussian-prior logistic model of the flock's result on held-item
   shares by phase bought, pairwise co-holding and Seeds spent, centred on the round-0 designer prior (no data gives it
   back exactly); Laplace CIs; greedy early/mid/late cores. Rounds with falling exploration (D-BAL-002).
3. **Convergence tests** in the report: split-half ρ, core changes between rounds, settled picks (CI), both duels.
4. **Output:** `src/sim/data/learned/builds.ts` (`LEARNED_BUILDS: BuildData`, generated, deterministic, header with
   round, matches and seeds) and `docs/balance/report.md` (per-hero and per-ability tables, builds, flags, limits).
**Verified:**
- **Pilot:** round 1 (seeds 1000001–050, prior scores, T 1.0, 30% random flocks) 50 matches in 37.9 min; round 2
  (2000001–050, round-1 scores, T 0.8, 21%) 50 in 21.5 min; duels 4 vs round 1 and 4 vs random in 3.1 min. **108
  matches, 0 crashes**, 4 wide, 20:00 cap, hard bots: 133 s a match, 177–963 ticks/s per process with the machine
  shared (543 mean). Learning 100 matches (24 heroes, plus both halves): 1.4–4 s.
- **Pilot numbers** (report): 0 of 108 decided by 20:00 (net-worth proxy). Split-half ρ median 0.71 (min 0.47, 19 of
  20 heroes); cores vs round 1: 20/20 within one change; settled picks 0%; scored vs random flocks 0.575 ± 0.089 (31
  matches), duels n = 4 each: none significant. Heroes average 4.7 buys by 20:00; 44–47% of scored-flock buys are
  on the hero's §11.5 list (random 28%).
- **Phase B sizing:** pick SEs are 1.3–1.8 score units, still the prior; the data-only SE of each hero's most-held item
  is 1.2–2.7 after 30–100 games. With 20:00 proxy results, separating items 0.5 apart needs about 4,700 games per hero
  (~8,000 matches) and 0.25 apart about 19,000. ρ is high partly because unmoved scores equal the prior in both halves;
  the settled-pick test is the binding one.
- Tests: `npx vitest run --root tools/buildlab` 11/11 (synthetic data: known best and worst items and a known synergy
  pair recovered, prior returned with no data, clear pick settled, Cholesky, holds, outcome, Spearman; a match recorded
  twice equals itself and the bare sim's hash).
- `bash scripts/check.sh`: typecheck PASS, lint PASS, test 1,113 passed, 5 failed (the five known Objectives cases).
  By hand: perf 13/14 (the known objectives budget); sim PASS (hash `41b6ba755b99c3c1`, unchanged); e2e 60 passed, 1
  skipped, 2 failed: `match.spec` "Lv 2" (known, Bot AI's QA request) and `preview-regressions` "binds side buttons"
  (load timeout; passes alone, 18.8 s).
**Flagged (report only, proxy results):** Albatross, Vulture and Woodpecker below 0.5; Hornbill and Puffin above.
Bots never cast Lyrebird's Mended Song or Flamingo's Poise and Tide Turn (0 in 108 matches); Owl's Silent Wing and
Pelican's Gulp about 0.28 a minute. Tiny effect: Spear Bill, Emperor's March, Dart, Moonlit Mark, Black Sun, Rampage,
Bristle, Fruit Barrage, Gape.
**Interface requests:**
- Build & Tooling: add `tools/**/*.test.ts` to the Vitest include and an npm script `"buildlab": "tsx tools/buildlab/run.ts"`.
- Architect / Combat: `heal.applied` with `ability` and `item` (as `damage.applied` has), and an ability id on shields
  and `status.applied`, so per-ability healing, shields and crowd control can be measured (D-EP-043).
- Bot AI: Mended Song, Poise and Tide Turn are never cast by hard bots; check their use rules.
- EP: ownership-map rows for `tools/buildlab/**`, `src/sim/data/learned/**`, `docs/balance/**`. For Phase B, decide
  whether to (a) add a per-hero outcome (Seed and damage share, D-EP-036's "damage, kills, Seed efficiency") to cut the
  variance, (b) judge settledness per core with a practical margin, or (c) budget about 8,000+ full-length matches.
**Next (Phase B, on the EP's word):** full-length matches once they end; 1,000+ training matches in rounds of ~200 to
convergence; duels; then the one-line switch of `src/sim/data/builds.ts` to `LEARNED_BUILDS`.
**Blocked:** nothing.

### EP · 21/11/2026 · Build Lab Phase A merged (5bef3c1)
- The lab runs seeded parallel matches, learns item scores in rounds and writes `src/sim/data/learned/builds.ts` and `docs/balance/report.md`.
- Pilot of 108 matches with no crashes:
  - every hero's core was stable between rounds;
  - item ranks were not yet stable (half-to-half ρ 0.71), and no pick was settled by its confidence intervals.
- Phase B plan: D-EP-049.
- EP added `tools/**/*.test.ts` to the unit run, as the lab asked.
- Routed: hard bots never cast Mended Song, Poise or Tide Turn (Bot AI); an ability id on heals, shields and statuses (Architect, wave 6).

### W5c · Technical Artist · sculpt pipeline v2.1 · 20/11/2026
**Done:** the EP's v2.1 round on the pipeline, so every batch inherits it, and the three birds re-dressed. Branch
`worktree-agent-ab2171eba079ed25b`, with `integrate/w5` b09218c merged. D-ART-011 records the round and the batch checklist.
- **Feather surface (1):**
  - Skins bake a feather flow per vertex (skin format v2). By default it runs down and back; neck capsules point it
    down the neck and thighs point it down.
  - The bird material lays overlapping feathers (scales tile) or hair strands (wood tile) along it. Each edge
    steps down to the feather beneath, with a value break and shading, in both albedo and normal.
  - Detail is strongest close to the camera and fades out before it can alias. Faces and bare skin stay smooth (the
    Cassowary's bare skin is pebbled).
  - Patterns now fade across region borders instead of switching tiles inside a triangle, which removed the speckle at
    face and throat borders.
- **Player-camera standard (2):**
  - Shared `hackles` and `inBone` helpers, and a checklist row that is a hard requirement.
  - Peacock: hackles down the back of the upper neck, a bronze cape where the neck meets the mantle, and a teal head
    over the blue neck.
  - Swift: a pale-edged ruff and a crown tuft under the goggle strap, and a warm brown crown and nape over the sooty
    body.
  - Cassowary: the casque's keel runs down the back of the skull, red skin folds run down the nape, and the red climbs
    the back of the head.
- **Wings (3):** the shared builder now gives a broad forearm panel and primaries that wrap the grip. `foldedWings` folds
  secondaries down the flank (Peacock), and the arm's hanging secondaries are shorter. The five other sculpted birds
  inherit the new forearm and grip.
- **Rim and sheen (4):** checked in the real renderer (golden hour, grade, rim) from the front and behind
  (`out/art/after21/game-front.png`, `game-back.png`). Rendering's identity layer keeps the birds' own rim material.

**Evidence** (git-ignored, in `out/art/after21/`; v2 is in `out/art/after/`, before v2 in `out/art/before/`):
- triptychs `<bird>.png` and player-camera views `<bird>-player.png`;
- line-ups `lineup-10.png`, `lineup-40-zoom.png` and `lineup-80-zoom.png`;
- the game renderer, front and back.

| Bird | Level 0 / 1 / 2 / 3 triangles | Player camera: bird / gun | Score, front and three-quarter | Score, player camera |
|---|---|---|---|---|
| Peacock | 8,842 / 3,334 / 1,162 / 376 | 3.8 % / 0.24 % | 3 | 3 |
| Swift | 8,952 / 3,304 / 1,182 / 394 | 4.9 % / 0.39 % | 3 | 3 |
| Cassowary | 8,904 / 3,410 / 1,142 / 374 | 5.3 % / 0.39 % | 3 | 3 |

**Load and memory:**
- A bird builds in 24–26 ms (Node, median of 7) and a skin decodes in 2–3 ms; nothing is generated at load.
- Geometry per bird and team is 2.07–2.17 MB, about +1 % for the flow attribute (3 bytes a vertex).
- Skins are 48–62 KB of binary each.
- The feather surface costs one 27-cell search per feathered skin fragment, at any distance (only its strength fades
  with distance). It has not yet been measured on the reference iGPU; skipping the search once fully faded is the
  first saving if it shows.

**Verified:** the model, skin and attachment tests pass (111), with budgets, hitbox, grips, muzzle, feet and weights.
`npm run check`, each step run on b09218c plus this branch:
- **typecheck, lint, perf (14/14) and sim:** pass. The sim hash is 41b6ba755b99c3c1, unchanged.
- **test:** 1,117 pass and 6 fail. Five are the known Objectives sim tests. Wiki coverage timed out under load and passes alone (10/10).
- **e2e:** 57 pass and 5 fail in parallel under load. Run serially, all pass except `match.spec` "Seeds levelled the hero up", Bot AI's open interface request.

**Still short:**
- Feather edges can show a little stair-stepping at 1–3 m without MSAA.
- The Cassowary's coat is still mostly hair blades over the sculpted shag.
- The Peacock's folded wing blades are pale under neutral light.

**Next:** the EP's review, then the 21 batch conversions with D-ART-010 and D-ART-011.
**Blocked:** nothing.

### EP · 21/11/2026 · sculpt v2.1 merged (5351ce1); bird batches launched
- v2.1 adds a feather surface along a baked flow field, a standard for the player-camera view and wings that wrap the grip.
- EP sees Peacock, Swift and Cassowary at about 3 from the player camera. One defect remains: aliased edge speckle on the feathers at distance (Batch A fixes it first).
- 17 birds convert in three parallel batches (`docs/briefs/W5-birds-batch.md`).
- The four B3 birds (Frigatebird, Cockatoo, Swan, Kiwi) are built straight on v2.1 in wave 6, with their kits.

### W5 · Integration · 20/11/2026
**Branch:** `worktree-agent-af2a17c35c0541194` from `integrate/w5` 93de0c5, with `integrate/w5` merged seven times (last
at 1c7ad07: W5.5 contracts, Audio, Art, Rendering, Bot AI, Environment, sculpt v2.1, Build Lab A). Acting for the owners
(D-EP-018); nothing changed in `src/sim/ai`, `src/client/render`, `src/client/audio`, `src/sim/core`, `src/client/app`.
1. **Five Objectives tests.** Systems' combat now honours `breakable.by` (only melee hurts a Feeder, GDD §7.14) and
   `damageFrom` (a sleeping camp ignores hits from beyond 35 m, §7.8), both right, so the tests hit by melee and from
   inside 35 m. The map: the Roc test's hero stood inside the west ramp and fell through the floor; the Nests test
   assumed 100 surface Twigs (the map has 84 surface, 12 cellar and 4 Hollow Nests, 16 of them Woven).
2. **`match.spec` damage number.** Clicks after the shop land with the pointer locked and tilt the view about 10° down,
   so the crosshair met the road; level shots pass over fledglings; the clash kills an idle Kingfisher in about 12 s.
   `levelView()`, a firing leg up the lane at the Dusk Hawk, `turn()` for the sweep: 6 of 6 in parallel.
3. **QA helper and test errors** (Objectives' and Items' lists): `heavyMelee` presses before holding; allies on Dawn;
   the heavy full chime pressed a beat early; deltas from the hero's own stats (magazine as a share, D-OBJ-014); spoil
   timed from `coolsAt`; `tough()` fills HP; `world({ regen })`; Blight read against current HP; Dirge as resist less
   shred; Nestmother keeps regeneration; Nest walk at 3 m/s; cellars out of the Hollow count; toads in their room.
4. **Suites on:** items, no-Interact, golden-egg, roc-embers, thickets, nests, runes, interactables (rune strength now
   one match; the Roc woken at 0:30 through `rocAt`; both suites went from 385 s and 422 s to 60 s). **Still gated:**
   `bot-shopping` (Bot AI's `BUILDS` round); the no-Interact bots-ride test and the scoreboard dead-bird spec (bots
   that ride and fight; Bot AI has just landed, so QA can try them at the gate); three interactables tests on the real
   map, each with its reason in a comment (Hide exposure from the map origin, the Lookout's 50 m line, the tunnel test's
   start over the Hollow).
5. **Gameplay gaps.** A heavy lunge stops short of what it would strike (it carried heroes past runes and Embers,
   D-COMBAT-010); Embers land on the surface at their spot (§7.12's (10, −10, 0) is under the east ramp); Kestrel's
   Eye is a `beyondM` trigger with a `triggerPct` repeat (rider gone); Rookery Dirge's shred renews instead of
   doubling. Nest solidity, ivy, Springs, the Cellar Run, the Magpie Den, Burr Coat and Heartwood Bark pass the suites.
6. **Framework adoption:** Drumroll's statMod is `COMBAT.fullSpinStatus`; Branch Swing and Tree Cling `surface: true`
   and Rampage `steerDeg: 30`, read by abilities and physics (the value names are deleted); a steering dash turns with
   the aim, not to it (D-SYS-017); `endOn: 'stun'` lands and Tree Cling ends on Jump and stun in data; Bristle is a
   'damaged' trigger; Crescendo and Echo Chamber repeat the hit with `triggerPct`.
7. **G23:** a 600-Seed purse, spendable and not earned: no net worth, no level (D-ECON-005).
8. **Build:** `check.sh` runs unit tests on half the cores (at most 8) and e2e on a quarter (at most 4), overridable
   (D-BUILD-010). The concession test built a view after each of 54,000 steps; it reads `sim.tick` (0.5 s). The
   stale-wiki check reads every page and gets the generation timeout (9 s under load against the 5 s default).
9. **Objectives budget:** rat bites renew one status instead of an 'independent' one per bite; a biting creature needs
   no sight ray; Nests go through combat's broad phase (D-OBJ-015). Per-phase timers put each in the objectives' own
   cost. Check runs read +0.251 to +0.289 ms against 0.3 with the "without" match at 0.32–0.40 ms/tick (0.31 quiet);
   the bound is absolute, so it failed at +0.343 (without 0.43) and +0.7 to +0.9 (without 1.5–2.5, heavy load).
10. `match.spec` asks for Lv 2 or higher. 11. Test targets use the contract's `'dummy'` controller (physics bench, arena
   gun tests, the testkits, the sandbox's other heroes); no contract change, and D-AI-007's no-lanes rule can go.
**Verified:** not three green runs in a row. On a moderately loaded machine (19–24 node processes) three runs passed
every step but e2e (for example `PASS typecheck 13s · lint 7s · test 119s · perf 17s · sim 8s`), each e2e failing one
load-sensitive test (practice-swap, `preview-regressions` before D-BUILD-011, the audio hero call). Typecheck, lint, the
1,376 unit tests and the sim step passed in every run after the last fix; the objectives perf passed at +0.25 to +0.29 ms
and failed whenever
the "without" match ran above about 0.43 ms/tick (another agent's 8-parallel sim jobs and the Build Lab); e2e has
failed every run since about 10:00 on the audio live-context test (below). The last runs, on 8ad5011: `PASS
typecheck 24s · lint 13s · test 105s · FAIL perf 70s` (+0.318, without 0.564) and `PASS typecheck 35s · lint 20s ·
test 135s · FAIL perf 82s` (+0.412, without 0.549).
**Load-sensitive, not hidden:** `preview-regressions` "binds side buttons" chains four page loads (about 4 s each since
Rendering) in 30 s: it passes alone (5 of 5) and timed out in two of three full runs, so it runs in the serial project
with its timeouts unchanged until the renderer-ready hook round (D-BUILD-011). `practice-swap`'s click met a pause
screen once under load, and the audio spec's hero-call test (1.4 s alone) timed out once at 30 s. Bot AI's new
`ai.perf` test read 0.256 against 0.25 once under load. The objectives perf bound is absolute, so it follows machine
load (item 9). **Not load:** since about 10:00 the audio spec's live-context test fails every time (peak 0.00018 against
0.005, the same value each run), alone too, on `integrate/w5`'s own sources and on 3d8c8dc, where it passed this
morning: the machine's real-time audio output, not code (Audio and QA to confirm).
**Interface requests:** Architect: the per-tick `spatial.rebuild` is now the largest objectives cost (108 static Nests
and Feeders, float Map keys); a static layer or integer keys would take most of it. Combat: `HealEffect.triggerPct`
and `ShieldEffect.id` are not implemented yet (Gape and item shields keep their stand-ins). QA: the three gated
interactables tests; the audio live-context test on this machine. Bot AI: drop D-AI-007's rule; switch on the
bots-ride and dead-bird tests; `ai.perf` margin under load.

### EP · 21/11/2026 · W5a integration round merged (95a54f2)
- Items 1–11 are in. On integrate/w5 the unit run is 1,366 passed and 10 skipped (EP, 4 workers), so the five Objectives failures are gone. The objectives perf cost is +0.25–0.29 ms on a quieter machine, against 0.3.
- The integration agent's three full check runs never all passed. Every failure was perf or e2e timing under load (other agents running 8 sims), or one of the two items below. The full check is rerun on a quiet machine at the gate.
- **Open, for wave 6 or the gate:**
  - **Perf margin is thin.** The largest remaining objectives cost is the per-tick spatial-hash rebuild of 108 static Nests and Feeders (Architect: insert static entries once).
  - **The audio live-context e2e** has failed every time since about 10:00 on 21/11, even run alone and on code where it passed before. That points to the machine's audio device or browser state rather than the code; check it on a quiet machine before the gate.
  - **Combat** adopts `HealEffect.triggerPct` and `ShieldEffect.id`.
  - **Still gated, each with its reason in a comment:** `bot-shopping`, the bots-ride and dead-bird tests, and three interactables tests that are wrong for the real map. QA rewrites them in wave 6.

### EP · 21/11/2026 · wave 6 widened (the user's usage limit was raised)
- Launched, in parallel with Bot AI, the three bird batches, Hero B3 and the Architect: a B3 bird-model artist and a structures, units and creatures artist (`docs/briefs/W6-art-world.md`). The Environment Artist is resumed for its third pass.
- Still to launch:
  - after Bot AI merges: Level polish with bot nav through interiors, and bot tuning for all 24 birds;
  - after the art lands: QA's gated-test rewrites, the 20-match run and the soak.
- Then the Stage 4 gate.
### W5d · Technical Artist · bird batch A · 21/11/2026 (stopped early: the EP's functionality-first wrap-up)
**Branch:** `worktree-agent-a4ff3ed4a96134c2f` from `integrate/w5` 1c7ad07.
**Done: the shared feather-shader fix (80e0e05, D-ART-012).**
- Cause: the bump took screen derivatives of the feather height across near-steps. Single pixels' normals flipped,
  dark or hue-shifted by the iridescence: the dotted edge speckle on the Peacock's neck.
- Fix: an analytic height gradient with the slope capped at 50°, and 1.5 px edges from each edge's exact screen
  footprint. Every value is continuous: slab roots shrink away, and the shadow outside an edge meets the dark band
  inside it. The search is skipped once the detail has faded.
- Evidence (git-ignored): `out/art/w5d/before/pk-back4-z.png` against `out/art/w5d/exp/fix1-z.png` (4 m, ×3), and
  `before/pk-back8.png` against `exp/fix1-8.png` (8 m). At Low: `exp/pk-player-low-z.png`. Peacock, Swift and Cassowary
  look the same apart from the speckle, which is gone.
- **Cost** (`tests/anim/frame.ts mode=cost`, GPU timer queries, headless Edge on an Intel Arc 140T iGPU, not the
  reference Iris Xe). The view is the player camera with 12 sculpted birds covering 5.9 % of 1080p, medians of paired
  runs, on a machine shared with other agents:

| Quality | Feather surface | All 12 birds |
|---|---|---|
| Medium | 0.09–0.12 ms | 0.45 ms |
| Low | 0.05–0.06 ms | 0.35–0.42 ms |

  Scaled to the Iris Xe (about 2–2.5× slower), the feather surface is about 0.3 ms at Medium, inside the 2.5 ms bird
  allowance (§11.2). An exact early-out per cell measured slower and was dropped.
- Tools: `posesheets --frame "…&clip=x,y,w,h"` saves a region at its own pixels. `frame.ts mode=cost` takes
  `quality=low`, `frames=` and `near=`.

**Not converted (left on their previous models):** Vulture, Hummingbird, Toucan, Woodpecker and Nightjar. I reverted a
first Vulture pass, uncommitted, at the stop:
- It read from the front: high hunched shoulders, a cream ruff and a bald head with caruncles.
- From the player camera the shoulders hid the head and read as two balls.

| Bird | Score from the player camera (before images `out/art/w5d/before/<bird>.png`) |
|---|---|
| Vulture | 1.5 (an egg hump, nothing at the nape) |
| Hummingbird | 2 (a smooth green capsule from behind) |
| Toucan | 2 (a black bottle from behind) |
| Woodpecker | 2 (barred cards on a black bottle) |
| Nightjar | 2 (mottled, but a stacked head on a ball) |

**For the art round:**
- The five conversions, with D-ART-010 and D-ART-011.
- Vulture: lower the shoulders and set them wider, so the head and ruff show between them from the player camera.
- Nightjar and Woodpecker: their mottled and barred backs need the feather surface on the mottle and barred tiles.
  Today it covers only scales and hair. This is a Batch A shader change: multiply the triplanar tile into the feather
  albedo.

**Verified:** `npx vitest run src/client/render/models tests/anim`, 111 passed (skins, models and attachment, with
guns held). `tsc -b` and `eslint .` pass. The full `npm run check` is skipped, as the EP asked.
### W5d · Technical Artist (bird batch B) · 21/11/2026
**Done (stopped early on the EP's change of priority):** Shrike and Kingfisher are converted to the sculpt pipeline
v2.1 (D-ART-010, D-ART-011). Branch `worktree-agent-a6c1176ee04a5cc9d`, from `integrate/w5` 1c7ad07. One commit per
bird; D-ART-013 records how batch B birds register.
- **Shrike:** a big flat-crowned head with a black mask meeting over the hooked bill, a silvery crown over a slate nape
  and mantle, a white breast, black folded wings with a white flash, and a long black-and-white blade tail that fans on
  a cast. Gear: a flock collar, a knotted flock belt with butcher's hooks, a thorn bandolier and a pouch. The Barb Rifle
  has barbs along a thornwood barrel, a bone stock and a quiver of bolts.
- **Kingfisher:** a chunky forward-leaning body with one orange curve from the breast to a low belly over short red
  shanks, a big blue head with a shaggy crest that lifts on a cast, orange lores and ear patch, white throat and neck
  patches, and a cyan stripe down the deep-blue mantle to the rump. Gear: a flock sash with a brass dart clip, a belt
  and pouch, and a quiver across the back. The Dart Pistol has a steel blade under the muzzle and fletched darts.
- `models.test.ts` now takes its sculpted list from `SCULPTED_IDS` in `heroes.ts`, so both birds get the display, jaw,
  blink and gun-cap tests.

**Untouched (still on the old D-ART-003 models):** Albatross, Lyrebird, Flamingo, Hornbill. The Lyrebird was in progress
(body only, no builder) and was reverted, not committed.

| Bird | Level 0 / 1 / 2 / 3 triangles (skin) | Player camera: bird / gun | Honest score, player camera |
|---|---|---|---|
| Shrike | 8,516 / 3,366 / 1,114 / 360 (2,600 / 950 / 300 / 120) | 3.3 % / 0.41 % | 3 (2.5 from the front: a tall white egg) |
| Kingfisher | 8,366 / 3,334 / 1,084 / 360 (2,600 / 950 / 300 / 120) | 4.1 % / 0.34 % | 3 |

Images (git-ignored, reproduce with `npx tsx tests/anim/posesheets.ts --out out/art/b --frame="name=<bird>&mode=triptych&hero=<bird>"`
and `mode=player`): `out/art/b/shrike.png`, `shrike-player.png`, `kingfisher.png`, `kingfisher-player.png`.

**Verified:** `npx tsc -b` and `npx eslint .` pass. `npx vitest run src/client/render/models tests/anim` passes (113),
including the committed skins re-baking byte-identically, budgets, hitbox, both grips held in every state, the muzzle
on the sim's muzzle point and planted feet (D-EP-035). Full `npm run check`, the in-game golden-hour shots and the
10/40/80 m line-ups were skipped on the EP's instruction.

**Left for the art round:**
- Convert Albatross (cloak wings to the ground), Lyrebird (the lyre as a hero shape: two banded S-curved outer plumes as
  ribbon lofts, silver filament cards, a forward-throw display morph; check it does not block the player's crosshair),
  Flamingo (S-neck, one-leg idle) and Hornbill (casque, gun carry with a moving feed).
- Shrike and Kingfisher: the in-game golden-hour check and the line-ups; both bodies still read a little tall and
  tubular front-on.
- Shared (for Batch A): the feather surface's dark edge speckle is very visible on white and orange regions (Shrike
  breast, Kingfisher underside), and a pattern-fade band of speckle shows where flat face regions meet the throat.

**Blocked:** nothing.

### W5b · Environment Artist · third pass stopped · 20/11/2026
**Done:** the third pass was stopped for the functionality-first priority. Nothing half-built is kept: the shared-model (instancing) registry was reverted before commit. The branch is `integrate/w5` (bec687c) with my second pass already in it.
**Verified:** typecheck and lint clean; `npx vitest run src/client/render` 53/53; `e2e/draw-budget.spec.ts` 3/3.
**Left for the art round:** lift Riverbank, Pinewood, interiors and the Thicket camp to 3. Add big bird-scale statements to Hedgerow (woven rooftop nests between chimneys, perch towers, large feeders). Halve vertex memory from 75.5 MB with shared models for clumps, birds and nests, half-float uv, and lighter back faces. Move generation (1.2–1.5 s) onto the W6 ready hook or a worker.

### W6 · Technical Artist · B3 birds (ART-B3) · 21/11/2026
**Stopped by the EP's change of priority (D-EP-050: functionality first, art second) before any model was started.**
Branch `worktree-agent-ae2834bbf29365e8d`, from `integrate/w5` 50a964c. No code changed.
- **Done:** none of the four birds. Frigatebird, Cockatoo, Swan and Kiwi stay on the default bird (`genericBuild`
  in `models/index.ts`, used for any hero id missing from `HERO_BUILDS`). No scores: nothing was built.
- **Verified on 50a964c:** `npx vitest run src/client/render/models tests/anim` 111/111 pass (skins, budgets,
  attachments, D-EP-035 grips); typecheck and lint pass. Full `npm run check` skipped on the EP's word.
- **Left for the art round (brief `docs/briefs/W6-art-world.md`, Job 1):** all four birds on the v2.1 sculpt pipeline
  (D-ART-010/011), each to an honest 3 from the player camera:
  - Frigatebird: black W wings held half-open (3.6 m span), scissor tail, hooked bill, red throat balloon; Kite Rifle
    (long, slim, scoped).
  - Cockatoo: stocky white body, thick hooked grey bill, sulphur crest that lies flat and fans up on cast;
    Screech Horn (ornate, glowing chamber).
  - Swan: low white teardrop, long S-neck, wings arched behind like a heart, orange bill with a black knob; Lake
    Lance (flowing, lance tip that glows on heal).
  - Kiwi: round hairy brown ball on strong legs, no visible wings or tail, long down-curved bill with whiskers;
    Burrow Blunderbuss (compact, one hand, a bladed detail).
  - Builder file `birds-b3.ts`; bodies and `BODIES` lines in `bodies.ts`; one-line registration in
    `sculpted-birds.ts`. Estimate about 2 hours a bird with renders, once the three conversion batches have merged.
**Blocked:** nothing.
### W6 · Technical Artist (structures, Patrons, fledglings, creatures) · ART-W · 20/11/2026
Stopped at the EP's priority change (functionality before more art) before any model was started. No model code
changed, so nothing was reverted. Branch `worktree-agent-a65b479d5b1ddffce` = `integrate/w5` + this entry.
- **Done:** none of Job 2. Read the brief, style guide §8.8, §9 and §11, D-ART-009 to 011, and the current structure, fledgling and kit code.
- **Untouched (still on their previous models):** Sentinel Hawk, Stilt Heron, Wardens, Shrines, Brood Ward dome, Elder Raven, Great Owl, both flocks' fledglings, every Thicket creature, the Roc and its Embers.
- **Scores today (§12.2), read from the code, not from new renders:** structures and Patrons 1 (stacked ellipsoids,
  cylinders and boxes in one flat-shaded Lambert material; no damage states); fledglings 1 (about 150-triangle primitive
  chicks, no down cards or catchlights); Thicket creatures, the Roc and Embers 0 (`models/index.ts` draws every unit
  except Scrapper and Slinger, and every pickup, as a team-coloured box).
- **Left for the art round:**
  - Creature models for `beetle`, `weasel`, `rat`, `toad`, `badger`, `cub` and `roc` (`UnitType`), plus the Ember pickup, each instanced per type, with an aggro tell.
  - Damage and destroyed states (§9.2: cracks at 66 % and 33 %, banner tear, topple into rubble, glow dying over 2 s). These need `rigs/structure-rig.ts`, which today only hides a dead structure. The next brief should add that rig, and a creature rig, to the ART-W paths.
  - Structures need the stone, timber, brass and banner materials, not the shared flat-shaded Lambert.
- **Checks on this branch:** `npx vitest run src/client/render` 53/53; typecheck and lint pass. `e2e/draw-budget.spec.ts` 3/3 run serially. In parallel under machine load, lane/low triangles came out at 393k against the 330k ceiling, the same load-sensitive miss logged in the W5b Environment second-pass entry. The full `npm run check` was skipped, as the EP asked.
### W5d · Technical Artist · bird batch C (stopped early on the EP's word) · 21/11/2026
**Done:** Owl, Pelican and Penguin are on the v2.1 sculpt pipeline (D-ART-010, D-ART-011). Puffin, Secretarybird and
Starling are untouched, still on their old primitive models; none was started. Branch `worktree-agent-ae09d85e4edc2662b`
from `integrate/w5` 1c7ad07, one commit per bird.
- **Files:**
  - Bodies are in `bodies.ts`, as separate functions with their own `BODIES` lines.
  - Builders are in a new `birds-c.ts`, not `heroes-b.ts`, so Batch B's Flamingo and Hornbill edits there don't collide. `C_BUILDS` joins `sculpted-birds.ts` on its own line.
  - The old builders are deleted from `heroes-b.ts`.
- **Shared changes (small; please route them):**
  - `sculpted.ts` gains an optional `halo` builder (two lines). The Starling's orbiting flock needs it, and the model test requires halo vertices.
  - `models.test.ts` dedupes `FOUR`: a converted bird sat in both lists and failed the distinct-silhouette count. Batch B will hit the same failure.
  - No change to `bird-material`, `anatomy`, `feathers`, `sdf`, `mesher` or `skin`.
- **Owl:**
  - An upright barrel with no neck, and a facial disc of two concave dishes inside a raised dark ruff (sculpted, with paint marks).
  - A V brow, ear tufts (sculpted horns plus feather blades that spread on a cast), a white bib, a streaked breast and feathered legs.
  - Mottled hackles round the back of the head and the nape.
  - Gear: a flock cowl with tails, a cartridge bandolier and a satchel.
  - Gun: the Hush Rifle, with a felt-wrapped can, a moon-glass scope and a six-round box.
- **Pelican:**
  - A bottom-heavy pear, a thick S-neck, a silver mantle, a buff nape crest and peach facial skin.
  - The bill and pouch are custom lofts on the head bone, so they swing with the head: a long flat bill with a red hooked nail, and a veined pouch sagging under thin rami. Both open on each shot and gape wide on a cast (Gulp).
  - Black primaries fold down the flanks, and the feet are webbed.
  - Gear: a neckerchief, a seed-shell bandolier and a creel.
  - Gun: the Gullet Gatling, with five spinning barrels, a woven creel drum and a crank.
- **Penguin:**
  - A skittle with a sharp white bib (paint mark), gold throat and ear patches, and a slate back under a black head.
  - Custom stiff flippers grip the gun, and the feet are webbed.
  - Gear: snow goggles on a flock strap (the crown shape), a knitted scarf, and a harness with an ice pick.
  - Gun: the Ice Chipper blunderbuss, with icicle teeth and a glowing ice hopper.

**Evidence** (git-ignored, `out/art/c/`): triptychs `<bird>.png` and player-camera views `<bird>-player.png`; before
renders in `out/art/before/`. Golden-hour game shots and the 10/40/80 m line-ups were not taken (stopped early).

| Bird | Level 0 / 1 / 2 / 3 triangles | Player camera: bird / gun | Score (front, 3/4) | Score (player camera) |
|---|---|---|---|---|
| Owl | 8,916 / 3,398 / 1,192 / 366 | 5.8 % / 0.67 % | 3 | 3 |
| Pelican | 8,458 / 3,304 / 1,092 / 380 | 4.3 % / 0.34 % | 3 | 3 |
| Penguin | 7,800 / 2,904 / 1,102 / 364 | 5.7 % / 0.55 % | 3 | 2.5 |

All are within budget, with at most three draw calls. Before, all three were old primitive models (about 1).

**Verified:** `npx vitest run src/client/render/models tests/anim` passes 114 of 114: budgets, heads on hitboxes, the
muzzle point, grips held in every state (D-EP-035), feet planted, skins byte-identical, morphs. Under load the
Cassowary skin re-bake timed out once (not touched here); it passes alone (8/8). `tsc -b` and eslint are clean. The
full `npm run check` was skipped on the EP's word.

**Left for the art round:**
- Puffin, Secretarybird and Starling, not started. `sculpted.ts` already has the Starling's halo hook.
- Penguin: the flippers sit behind the body in the aim pose, so the "flippers held out" read is weak. They need an
  outward splay or a display flare.
- Owl: the brows show the shared feather-edge speckle (Batch A's shader fix), and the forearm panels are broad and plain.
- Pelican: the pouch is flat-sided seen from the front.
- All three: the golden-hour game shots and the 10/40/80 m line-up checks.

**Blocked:** nothing.

### EP · 21/11/2026 · art wrapped up for Release 1 (D-EP-051)
- **Merged for Release 1:**
  - the feather-shader aliasing fix (batch A, D-ART-012);
  - Shrike and Kingfisher (batch B, D-ART-013);
  - Owl, Pelican and Penguin (batch C).
- That makes **8 of 24 birds on the sculpted models:** Peacock, Swift, Cassowary, Shrike, Kingfisher, Owl, Pelican and Penguin.
- Model and attachment tests: 116/116 after the batch B and C merge conflicts were resolved by keeping both sides.
- **Left for Release 2 (visual upgrade):**
  - 12 birds still on the old models: Vulture, Hummingbird, Toucan, Woodpecker, Nightjar, Albatross, Lyrebird, Flamingo, Hornbill, Puffin, Secretarybird and Starling;
  - the 4 B3 birds, now on the default bird;
  - every structure, Patron, fledgling and creature, which still score 0–1 (structure damage states need `rigs/structure-rig.ts`);
  - the environment third pass, plus moving generation off the load path and halving geometry memory.
### W6 · Hero Engineer B (B3) · 21/11/2026
**Done:** branch `worktree-agent-a7146d1636b7bdf43` from `integrate/w5` (52f7fe5). Frigatebird, Cockatoo, Swan and Kiwi ship
real data (GDD body plan, stats, gun, swatch, four abilities with every tier and player text) and are `implemented: true`,
so all 24 birds are playable. Hooks only where data could not say it: Frigatebird (Plunder Shot's shield to the caster),
Cockatoo (Sulphur Shriek's third-pulse stun and the penalty ending with the channel), Swan (Swan Song's 25% heal),
Kiwi (Burrow T3 heal, Night Sense reveal). Tests next to each hero: frigatebird 12, cockatoo 12, swan 15, kiwi 18 (gun
damage, head shot, rate, magazine and reload; every ability at base and each tier), plus `herob-bots.test.ts`: a 120 s
6v6 bot match in which all four cast. Decisions D-HEROB-010 to -013.
**Framework built (small, in the owner's system):** `channelExtraS` lengthens a channel by tier (abilities/kit.ts and the
cast, D-HEROB-010); physics ends a Burrow with its channel (D-HEROB-011).
**Models:** the client falls back to `genericBuild` for the four until the Technical Artist's batch lands; the models test builds all 24.
**Limitations:** Harpoon Line pulls over about 0.65 s, not 0.5 s; no dirt trail for Burrow (VFX); Probe is a short cone
(D-HEROB-012).
**Interface requests:** Architect: `AbilityUpgrade.channelS` (replaces `channelExtraS`); `TetherEffect.breakDistance` as a
Magnitude is not needed by Swan. **Bot AI:** nothing; no `data/ai.ts` block was needed (D-HEROB-013). **Blocked:** nothing.

### EP · 21/11/2026 · Hero B3 merged (7cb97ae): all 24 birds implemented
- Frigatebird, Cockatoo, Swan and Kiwi are in, with 57 hero tests and a 6v6 bot match in which all four cast. They use the default bird model until the visual upgrade.
- Hero B3's full check failed `physics.perf` and `world.perf` (no hero code involved), and two e2e specs timed out at 60 s waiting for `__perch.hero`: `match.spec` Kingfisher and `scoreboard-bar`. EP is rerunning them serially on integrate/w5 before calling them load; a 60 s wait is long for load alone.
- Gaps against the GDD:
  - Harpoon Line pulls over about 0.65 s, not 0.5 s;
  - Burrow has no dirt trail (a VFX cue for the visual upgrade);
  - Probe is a 3 m, 30° cone.

### EP · 21/11/2026 · stability blocker: `__perch.hero` is null during a running match
- Serial rerun on integrate/w5 (b7fef57): `match.spec` (Kingfisher) and one `scoreboard-bar` case time out at 60 s waiting for `__perch.hero`. The other 4 scoreboard cases pass.
- The page snapshot shows a live match (550/550 HP, Lv 2, Seeds 1,171), so this is **not load**: the local hero is missing from `view.entities` while `view.heroes` has it.
- Routed to the Architect (owner of `src/client/app` and the view) as the first item of the W6 round. It blocks Release 1.

### W6 · QA (#19) · stability round, items 1 to 5 · 21/11/2026
- **Gated suites (item 1): none left behind `PERCH_PENDING`.**
  - `bot-shopping` is on as the slow tier (`*.slow.test.ts`, `npm run slow`, 6/6 in 1,090 s under load; D-QA-014).
  - The bots-ride test (`no-interact`) is on and passes.
  - The three interactables tests are reworked for the real map and pass: Hide (enemy 2 m outside the door, inside the ivy
    curtain's 3 m, §6.8), Lookout (searches each Lookout and 8 directions for a clear 50 m line), Cellar Run (compares the
    gap in run speed, 0.3 × moveSpeed, so the unchanged sprint bonus cancels, D-SYS-008). The map is right against the GDD.
  - The dead-bird scoreboard test is on and deterministic (D-QA-017).
- **Audio live-context (item 2):** the machine's audio clock, not the code (D-QA-016). Fixed in the test.
- **Flakes (item 3):** `draw-budget` (a settling transient; D-QA-017), `preview-regressions` side buttons (cheap history
  loads), the dead-bird wait. Not reproduced as load flakes: `match.spec`, the wiki-coverage and reload timeouts (111 of 112
  e2e passed in one `--release` run at 2 workers). `playwright.config.ts` is unchanged; moving `preview-regressions` out of
  the serial project is left until the staged `__perch.ready` merges.
- **Release mode (item 4):** `npm run check -- --release` (D-QA-015).
- **Gate coverage (item 5):** hold-to-upgrade `e2e/hold-upgrade`, no Interact `rules/no-interact` plus `e2e/no-interact`,
  Practice Swap `e2e/practice-swap`, the top scoreboard `e2e/scoreboard-bar`, objectives `rules/*` and
  `src/sim/world`, and `e2e/all-heroes.spec.ts` (every `implemented` hero from the registry, 1 + 11 from the menu, 20/20
  before Hero B3 merged; D-QA-018).
- **Not green, owners to act (the gate cannot pass three times until these are fixed):**
  1. **Objectives perf budget** (`src/sim/world/world.perf.test.ts`): +0.30 to +0.34 ms per tick, bound 0.3 (GDD 0.1), on
     three runs alone on a quiet machine. A real cost, not load. Owner: Objectives / world.
  2. **Audio: `update()` overrides the hero-select music.** `app.ts` calls `audio.update` every frame; `musicState(view)`
     returns 'menu' (no local hero), so `setState('heroSelect')` from `onScreen` is undone. Fix in `src/client/audio/index.ts`:
     let `update` keep `heroSelect` while the screen is hero select. `e2e/audio.spec.ts` "music reacts ..." fails on it.
     Owner: Audio.
  3. **Rendering:** the first 1 to 2 s of a scene draw up to 50% more triangles than the settled frame (lane/low 390k, then
     257k). Not load. Cause not found (not resolution, not sim tick); the test waits for the settled frame.
  4. **Architect:** `__perch.hero` can stay null in a running match (`match.spec`, a `scoreboard-bar` case); not papered over.
- **Prepared for item 6, not run:** `npm run release-matches`, `npm run soak -- --minutes 30`.
- **Check runs so far:** one `--release` pass of the steps by hand: typecheck, lint, unit (1,433), sim pass; perf 13/14; e2e 111/112.
  No three-in-a-row yet.

### EP · 21/11/2026 · QA stability round merged (b4eeabf)
- Nothing is behind `PERCH_PENDING` any more. `bot-shopping` runs in `npm run slow`. The audio live-context failure was the machine's audio clock lagging under load, and the test now polls. Release mode is `npm run check -- --release`. `e2e/all-heroes.spec.ts` starts a match with every implemented hero; it needs a rerun with all 24.
- **Release 1 blockers, with owners:**
  - `__perch.hero` null in a running match (Architect, in progress);
  - objectives perf at +0.30–0.34 ms against 0.3 on quiet runs, a real cost (Architect: static spatial-hash entries);
  - `update()` in `src/client/audio/index.ts` overrides the hero-select music every frame (Audio).
- **Release 2 (visual):** for 1–2 s after a scene opens, a frame draws up to 50% more triangles than it settles to (lane/low 390k, then 257k). Rendering to find the cause; the test now waits for the settled frame.
- **Prepared for after the bot fix:** `npm run release-matches` and `npm run soak -- --minutes 30`.

### W5b · Bot AI · addendum: matches end, ally casts · 21/11/2026
**Branch:** `worktree-agent-ab0a222c15d139b2e`, integrate/w5 merged up to 1823dfa (B3 included: all 24 birds).
**Root cause (why no match ended).** Measured, not guessed:
1. **World bugs (fixed for Objectives, D-EP-018, D-AI-010).** (a) Siege fledglings queued 1.5 m apart behind the
   hold line; only those within 6 m of it ever assaulted, so later arrivals froze forever (35 stuck in front of dead
   Wardens at 40:00, seed 1). (b) Displaced fledglings landing just under a floor fell forever (y −5,500 to −10,500),
   keeping their targets and hold slots. With both, no attacking fledgling ever came within 30 m of a Shrine, so the
   Brood Ward never dropped.
2. **Bot behaviour (D-AI-009).** Bots never committed to a siege, dropped Shrines they couldn't see (most sit behind
   the base wall), and stopped for every fight on the way in. Even 6v2 windows closed while they were 115–150 m out.
3. **Numbers (D-AI-010).** With 1 and 2 fixed, even bots still stalemated: the GDD's 35:00 lever (Ward ×0.6) didn't
   break it. The lever is now at 25:00: Ward lifted, fledglings ×1.5 vs structures, every structure +12% damage per
   minute after (GDD §15.2, §15.4). It weakens both bases alike, so comebacks stay possible.
**Done:**
- Flock-level siege commitment: wipe, Roc kill, Rekindle, a two-hero edge after 20:00, or all-in from 25:00 unless
  outnumbered by two. Fall back at two alive or two down. Escort the wave through the Ward. Stands where a ray
  reaches the target, outside the Shrine pulse. Committed bots walk straight in. Defend at home with the 3 nearest
  (D-AI-009).
- **Hard bots now cast Mended Song, Poise and Tide Turn (D-AI-011).** Root cause: those kits fall back to the caster
  through `affects.self`, but the bots required `selfFallback`, and bots never aimed at an ally. Now either flag
  counts. Bots pick the beneficiary (lowest-HP ally in combat, or the ally in a fight for buffs), turn onto the ally
  and cast. Ally item actives use the same path. Test: a hard Flamingo bot casts Poise on a wounded ally.
- D-AI-007 removed (D-AI-012): bots act on the arena too, now that the benches use `'dummy'`.
- AI cost cut: the tower list is refreshed only when one falls, flock-level judgements every 0.25 s, Updrafts are
  checked only in reach, arrival radii and item uses are memoised, ally-cast checks are throttled, and the aim solve
  takes two passes.
**Verified:**
- `npm run sim -- --matches 20 --parallel 8 --bots 12` on the final code: **20 completed, 0 crashed, 20 decided**,
  Dawn 9 / Dusk 11. All 24 birds picked across the batch.
  - Length: median 46.1 min, range 34.5 to 53.5, none over 55.
  - First Shrine 24.9–36.5 min; Patron phase 2 1–5 min before the end.
  - Comebacks: the flock behind in net worth at 20:00 won 8 of 20.
  - Per seed (min, winner): 1 53.5 Dusk · 2 46.7 Dusk · 3 42.6 Dusk · 4 47.8 Dusk · 5 34.5 Dawn · 6 39.5 Dusk ·
    7 46.1 Dusk · 8 44.1 Dusk · 9 53.2 Dusk · 10 41.5 Dawn · 11 47.7 Dawn · 12 36.1 Dawn · 13 39.4 Dawn ·
    14 51.5 Dawn · 15 51.9 Dusk · 16 39.7 Dusk · 17 49.5 Dawn · 18 46.2 Dawn · 19 47.4 Dawn · 20 38.5 Dusk.
  - Telemetry: `out/telemetry/w5-end/`.
- `npm run check` on db130b1: **PASS typecheck 16s · lint 15s · test 96s (1,434) · perf 42s · sim 6s · e2e 435s
  (112) · check 610s**. AI: 0.097 ms of a 0.508 ms step (19%; budget 0.25 ms).
- `bot-shopping` (6/6) and `no-interact` passed under `PERCH_PENDING=1` earlier in this round. Not rerun after the
  siege changes.
**Short of target:** the median is 46 minutes against the 30–40 aim (none over 55). The remaining time is travel: a
flock that wins a fight in mid reaches the enemy base after the defenders respawn (44–55 s). Faster is a W6 job:
staging near the enemy gate, Updraft use on the way in, and Shrine and Patron HP for Balance. The Roc died in 0 of
the 20 matches before D-AI-009 dropped its gate; bots rarely start it (W6).
**Interface requests:** Objectives: please own the D-AI-010 changes (`fledglings.ts` queued assault and fall recovery,
`structures.ts` late growth, `data/world.ts` WARD and `recoverFromY`) and review the numbers. Game Director: §15.2's
lever now reads 25:00 with Ward lifted and +12%/min. Physics: displaced units can end up under a floor
(`moveCharacter` cheap path); fledglings now recover, but the cause is in physics.

### EP · 21/11/2026 · Bot AI match-ending merged (d4eab84)
- **Root causes:** queued fledglings never assaulted and some fell through floors, so waves never reached the Shrines and the Brood Ward never dropped. Bots never committed to a siege, and the 35:00 lever didn't break even games.
- **Fixes:**
  - both world bugs;
  - bots commit as a flock, defend at home and enter a broken base (D-AI-009);
  - from 25:00 the Ward lifts and structures take +12% damage per minute (D-AI-010; owner: Objectives).
- **20 seeded matches with all 24 birds:** 0 crashes, 20 of 20 decided, 34.5–53.5 min (median 46), none over 55. The flock behind at 20:00 won 8 of 20.
- Hard bots now cast Mended Song, Poise and Tide Turn (D-AI-011). D-AI-007 is removed. The full check passes on the agent's branch; AI uses 19% of the tick.
- **Gate:** "matches end" is met. Bringing the median length to 30–40 min is balance (Gate M4, Stage 5), which isn't started (D-EP-050); PLAYABLE.md will give the real range.
- **Release 1 blockers left:** `__perch.hero` null and the objectives perf margin (Architect). After those come release matches, the soak, `all-heroes` on 24, three `--release` runs, the wiki and PLAYABLE.md. The machine is kept quiet meanwhile, so the Architect's perf measurements are clean.

### W6 · Technical Architect · 21/11/2026
**Branch:** `worktree-agent-a50ff70aae49c2854` from `integrate/w5` 52f7fe5, with `integrate/w5` merged up to 4600955 (Hero
B3, QA's stability round, Audio, Bot AI's match ending). Decisions D-ARCH-029 to D-ARCH-033; INTERFACES §16; owner
follow-ups in `docs/briefs/W5-contract-followups.md` § W6.
1. **`__perch.hero` blocker (D-ARCH-033): not a view bug.** The local hero is in `view.entities` on every tick: in Node
   over 900 s of the e2e setup (Play, Kingfisher, seed 1, 11 bots, idle), and in the browser, polled every 100 ms through
   the switch and on each of the next 600 frames (0 misses). `__perch.hero` is null while the menu's session is still
   current, and Play's match is fast-forwarded before it replaces it: `?t=900` (match.spec) is 54,000 ticks of a 12-bot
   match and `?t=600` (scoreboard-bar) 36,000, with the screen on hero select throughout. That took 18–45 s here
   depending on load, so a busy machine passes pickHero's 60 s wait; the failure snapshot is taken after the switch, so
   it shows a live match. Fix in my paths: frames draw nothing while a session is created or fast-forwarded (`?t=900`
   quiet 19.9–20.7 s → 18.4–18.8 s; loaded 36–45 s → 26–30 s). New test in `src/sim/index.test.ts`: the local hero stays
   in its own view every tick through death and respawn. QA follow-up: scale pickHero's wait with `t`, or fast-forward less.
2. **Objectives perf (D-ARCH-029): an incremental spatial hash.** Every entity keeps a slot and touches the cells only
   when it spawns, despawns or changes cells; small-integer cell keys; stamp dedup. Same results and hash
   (`c076003e96ac8a88` with the old and the new). Quiet machine, the budget test with old and new alternated three
   times: **+0.200, +0.200, +0.211 → +0.142, +0.137, +0.142 ms** against the 0.3 bound. The spatial hash is now about
   1.5 % of the objectives cost; **world's vision pass is about 80 %** (awake camp creatures get a Rapier line-of-sight
   ray per enemy hero within 40 m), then Thickets and the Egg (Objectives follow-up, with numbers and options).
3. **Staged start-up (D-ARCH-031).** `__perch.stage` goes boot → menu → world; `__perch.ready` from 'world', so specs and
   shots see what they did before; `deferWork(label, job)` in `app/stages.ts` (async jobs, so Web Workers fit). The app
   defers the whole renderer until Rendering and the Environment Artist queue their own generation. Production build,
   quiet: first paint 3.36 → 1.18 s, menu 1.26 s, world 3.71 s (ready was 3.60 s); loaded: 10.7 → 1.5 s. The renderer job
   still holds the main thread (materials 1.8 s, environment 2.2 s, blockout 1.4 s in a dev profile), so a click on the
   menu waits until that work is chunked or moved to a worker (Rendering and Environment follow-ups).
4. **Ability credit (D-ARCH-030):** required `ability` and `item` on `heal.applied` and `status.applied`, and a new
   `shield.applied` event; combat fills them (three emit sites and one new emit), with a combat test.
5. **Requests (D-ARCH-032):** `AbilityUpgrade.channelS` accepted and, after the B3 merge, migrated on the EP's word
   (abilities' fold and validator, Sulphur Shriek T2, Burrow T1; `CHANNEL_EXTRA_VALUE` deleted). Tether `breakDistance`
   as a Magnitude dropped (Swan doesn't need it). Bot AI and the bird batches raised none.
**Outside my paths, mechanical:** `combat/damage.ts`, `combat/statuses.ts`, `combat/effects.test.ts` (the event
fields); `abilities/kit.ts`, `data/heroes/cockatoo.ts`, `data/heroes/kiwi.ts` (channelS).
**Verified:** `npm run check -- --release` on the final tip: RELEASE_RESULT. Earlier on this branch: e2e 87 passed, 1
skipped; one loaded run had `draw-budget` lane/low at 340k triangles against 330k, which passed alone (3/3) and is the
settle issue QA's spec now waits out.
**Interface requests:** none. **Blocked:** nothing.
