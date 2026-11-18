# Client brief (verbatim)

> Kept as received on 18/11/2026. The brief is addressed to the Executive Producer. Agents read it for
> context, then follow their own role brief and [STATUS.md](STATUS.md).

---

# PROJECT: "PERCH" — a bird-themed Deadlock-style third-person hero shooter

You are the **Executive Producer / Orchestrator** of a simulated 20-person game studio. You do not
write gameplay code yourself. You plan, spawn subagents (Task/Agent tool), set interface contracts,
sequence the work, merge it and keep the build green. The deliverable is a playable **3D third-person
6v6 hero shooter / MOBA** (1 human + 11 bots) that copies Valve's Deadlock gameplay loop as closely as
possible, with every name, visual and sound reworked around birds.

Work autonomously. Don't stop to ask me questions. Decide, record it in `docs/DECISIONS.md`, and keep
going. Stop only when every milestone's acceptance criteria pass.

===================================================================================================
## 1. TECH STACK (decided; don't relitigate without a written ADR in DECISIONS.md)
- **TypeScript (strict) + Three.js** for rendering, **Vite** for building,
  **@dimforge/rapier3d-compat** for physics and the character controller (its WASM is inlined),
  **Vitest** for tests, **Playwright** for browser smoke tests and screenshots.
- Use the latest stable versions. Lock them in package-lock.json.
- **Simulation and rendering are strictly separate.** `src/sim/` has zero DOM/Three.js imports and runs
  in Node at a fixed 60 Hz tick. It is deterministic for a given seed (seeded RNG only, no `Math.random`).
  `src/client/` reads sim state and renders it, interpolated.
- Headless runner: `npm run sim -- --seed 1 --minutes 35 --bots 12`, which writes match telemetry JSON.
- **No external assets.** All models are built procedurally from primitives (low-poly stylised birds
  with code-driven rigs and animation). All textures are procedural or flat-shaded. All audio is
  synthesised with WebAudio. No copyrighted names or IP from Deadlock or anyone else.

### "Easy to run" requirements (part of the final acceptance gate)
1. `npm install && npm start` builds, serves locally and opens the browser on the main menu.
2. `npm run build:single` produces **`dist/perch.html`**, one self-contained file that runs offline
   when double-clicked (file://) in Chrome, Edge or Firefox. If a dependency makes file:// impossible,
   ship `play.bat` / `play.sh` that start a zero-dependency static server and open the browser, and
   explain why in DECISIONS.md.
3. README: one-paragraph install instructions, controls and a hero/item guide.
4. Performance: 60 FPS at 1080p on a mid-range laptop iGPU with 12 heroes, ~150 troopers and all
   structures. Use instanced meshes, LODs, pooled projectiles and a spatial hash.

===================================================================================================
## 2. THE DEADLOCK LOOP TO REPRODUCE (with bird translations)

### Camera, controls and movement (match Deadlock's feel)
- Over-the-shoulder third-person camera with shoulder swap, collision pull-in, a slight FOV kick on dash,
  and a centred crosshair. Hit detection: raycast from the camera through the crosshair to find the aim
  point, then fire the projectile from the muzzle toward that point.
- WASD, mouse look (pointer lock), jump, crouch, **slide** (crouch while moving), **dash** (Shift, costs
  stamina), **dash-jump**, **mantle** onto ledges, **light melee / charged heavy melee**, **parry**,
  reload (with reload-cancel), abilities on 1–4, item actives on Z/X/C/V, shop on B, scoreboard on Tab,
  pings on middle mouse. All keys rebindable.
- Real verticality: rooftops, balconies, vent shafts/ropes ("Chimneys" and "Vines"), and **Updrafts**
  (ziplines above each lane with boost and dismount). No free flight for the base kit. Gliding or flight
  may appear only as specific hero abilities.

### Map, units and economy
| Deadlock concept | PERCH version | Behaviour to match |
|---|---|---|
| 6v6, two Patrons | **Dawn Flock vs Dusk Flock**. Patrons are the **Great Owl** and the **Elder Raven** | Kill the enemy Patron to win |
| 3 lanes plus jungle (current live map) | **Hedgerow, Riverbank, Pinewood** | Mirror-symmetric city-in-a-forest map with streets, alleys, rooftops, a central pit |
| Troopers in waves every ~30s | **Fledglings** (melee and ranged) | March down the lane, fight what they meet, follow authored lane paths |
| Souls (gold and XP in one number) | **Seeds** | Pay for items and levels |
| Last hit drops a soul orb; shoot it to secure; shoot your own to deny | **Seed pods** | Same timing window, with a visual and audio "secured" pop |
| Guardian | **Sentinel Hawk** | Lane tower. Prioritises heroes who hurt allied heroes nearby. Team bounty |
| Walker | **Stilt Heron** | Big tower with stomp area damage and a beam. Large team bounty. Unlocks a flex slot |
| Base Guardians, Shrines, 2-phase Patron | **Nest Wardens**, **Roost Shrines**, Patron | Shrines must fall before the Patron can be damaged. Phase 2 has new attacks and a weak point |
| Backdoor protection | **Brood Ward** | Big damage reduction for structures when no enemy fledglings are nearby |
| Jungle camps, breakable crates, bridge powerups | **Thickets**, **Nests**, **Feather runes** | Respawning neutrals, small seed payouts, timed temporary buffs |
| Soul Urn (~10 min) | **The Golden Egg** | Carrier can't shoot or use abilities and is revealed to enemies. Delivering it pays the team plus a bonus |
| Mid-Boss, drops Rejuvenator | **The Roc**, drops **Phoenix Ember** | Ember claimed by charged melee. Gives faster respawns, buffed fledglings and a team buff for a few minutes |
| Curiosity Shop (Weapon/Vitality/Spirit, 4 tiers) | **The Magpie's Hoard**: **Talon / Plumage / Song** | 3-column, 4-tier shop UI. Upgrades consume their component. Sell refunds. Shop at spawn plus lane shops |
| Item slots plus flex slots from objectives | Same | **Data-driven.** Default: 12 base slots plus flex slots unlocked team-wide by destroying the first Hawk(s), first Heron and first Shrine |
| Levels, Ability Points, 3 upgrade tiers, ultimate unlock, Boons | Same; Boons are **Molts** | 4 abilities per hero. Upgrades cost AP (e.g. 1/2/5). Each level adds base stats |
| Weapon vs Spirit damage, resists, headshots | **Talon vs Song damage**, **beak shots** | Real head hitbox on every hero model. Crit multiplier is in data |
| Respawn scaling, comeback bounties | Same | Respawn time grows with match time. Killing a hero far ahead pays extra |

### Match phases
1. **Laning (0–10 min):** 1v1 and 2v2 lanes, last-hitting and denying, poking, shop trips.
2. **Mid game:** Hawks fall, players roam, take Thickets and runes, fight over the Golden Egg, push Herons.
3. **Late game:** grouped 6v6 fights, Roc and Phoenix Ember, then siege Wardens, Shrines and the
   2-phase Patron.

===================================================================================================
## 3. CONTENT SCOPE
- **8 bird heroes**, each with a distinct procedural model, silhouette, gun (spread, pellets, falloff,
  fire rate, magazine) and 4 abilities. Archetypes to cover: gun carry, spirit burst, tank/initiator,
  support, assassin, area control, long-range poke, mobility skirmisher.
  Suggested roster (change if needed): Shrike (impaling traps), Albatross (tank, gale shield),
  Kingfisher (dive assassin), Lyrebird (mimic and illusion support), Owl (silence and true sight),
  Pelican (swallow/displace), Secretary Bird (kick combos), Starling (murmuration swarm area damage).
- **At least 48 items** (16 per category across 4 tiers, e.g. 800/1600/3200/6400 seeds, all in data),
  including about 10 actives.
- **Bots** with 3 difficulty levels that can play whole matches. They aim with human-like error and
  reaction time, last-hit and deny, retreat, buy from build lists, level abilities, rotate, contest the
  Egg and the Roc, and group for sieges.
- Menus: main menu, hero select (rotating 3D preview), settings (sensitivity, FOV, keybinds, volume,
  graphics quality), pause, scoreboard, end-of-match stats.

===================================================================================================
## 4. ARCHITECTURE (Technical Architect finalises this in M0)
src/
  sim/                 # PURE, deterministic, Node-runnable — no DOM/Three
    core/              # tick loop, seeded RNG, event bus, entity store (lightweight ECS)
    physics/           # Rapier world wrapper, character controller, layers, updrafts, mantling
    combat/            # hitscan/projectiles, hitboxes (head/body), damage pipeline, statuses, melee/parry
    abilities/         # data-driven ability framework, AP, upgrades
    heroes/            # one module per hero
    economy/ items/    # seeds, pods, bounties, levels, molts, flex slots, shop, item effects
    world/             # map data, nav graph, lanes, fledglings, structures, thickets, egg, roc, patron
    ai/                # utility-AI bots and unit targeting
    data/              # ALL tuning tables (typed TS consts)
  client/
    render/            # Three.js scene, procedural bird models and rigs, instancing, LOD, lighting
    vfx/               # particles, tracers, hit flashes, ability VFX, post-processing
    camera/ input/     # third-person camera, pointer lock, bindings
    ui/                # HUD, minimap, shop, scoreboard, menus (DOM/CSS overlay)
    audio/             # WebAudio synth, positional audio, adaptive music
  tools/               # headless sim CLI, balance reports, screenshot harness
tests/  e2e/  docs/ (GDD.md, ARCHITECTURE.md, INTERFACES.md, DECISIONS.md, BALANCE.md, STATUS.md)

Systems talk to each other only through the event bus and `docs/INTERFACES.md`. A system never
reaches into another system's internals.

===================================================================================================
## 5. THE STUDIO (20 agents)
Spawn each agent with: its role, exclusive file ownership, inputs and outputs, and the current
milestone's acceptance criteria. An agent may edit **only its own paths**. Anything else goes to the
owner as a request through `docs/STATUS.md`.

| # | Role | Owns | Responsibilities |
|---|---|---|---|
| 1 | **Executive Producer** (you) | `docs/STATUS.md` | Plan, spawn, sequence, merge, unblock, enforce gates |
| 2 | **Game Director** | `docs/GDD.md` | Canonical GDD from Section 2. Final say on fidelity to Deadlock. Reviews feel using screenshots and the playtest harness |
| 3 | **Technical Architect** | `docs/ARCHITECTURE.md`, `docs/INTERFACES.md`, `sim/core/` | Skeleton, entity schema, event names, damage-pipeline contract, sim/client boundary, determinism rules. Approves interface changes |
| 4 | **Build & Tooling Engineer** | `package.json`, Vite config, `tools/`, CI script | `npm start`, `build:single`, headless sim CLI, `scripts/check.sh` (typecheck, lint, vitest, 3-min sim, Playwright smoke test) |
| 5 | **Character Controller Engineer** | `sim/physics/` | Rapier controller: walk, sprint, jump, dash, dash-jump, slide, mantle, stamina, updrafts, knockback, layers |
| 6 | **Camera & Input Engineer** | `client/camera/`, `client/input/` | Over-the-shoulder camera, collision, shoulder swap, aim raycast, pointer lock, rebinding, sensitivity |
| 7 | **Combat Engineer** | `sim/combat/` | Guns, projectiles, head/body hitboxes, falloff, ammo and reload, damage types and resists, statuses, melee/heavy/parry |
| 8 | **Ability Systems Engineer** | `sim/abilities/` | Data-driven abilities (targeting, charges, channels, upgrade tiers), AP, ultimate unlock |
| 9 | **Hero Engineer A** | `sim/heroes/` (heroes 1–4) | Implements 4 heroes using the frameworks only |
| 10 | **Hero Engineer B** | `sim/heroes/` (heroes 5–8) | Implements 4 heroes. Shares hero test patterns with A |
| 11 | **Economy & Items Engineer** | `sim/economy/`, `sim/items/` | Seeds, pods, deny, bounties, levels, molts, flex slots, shop, item effects and actives |
| 12 | **Objectives Engineer** | `sim/world/` (units/structures) | Fledgling waves, Hawk, Heron, Wardens, Shrines, 2-phase Patron, Brood Ward, Thickets, nests, runes, Egg, Roc and Ember |
| 13 | **Level Designer** | `sim/world/map*`, map data | 3-lane symmetric 3D map in data (blockout geometry, rooftops, chimneys, updraft splines, shops, pit), nav graph for bots and lanes |
| 14 | **Bot AI Engineer** | `sim/ai/` | Utility-AI bots with human-like aim error, laning, retreat, buying, rotations, objective play, 3 difficulty levels |
| 15 | **Technical Artist (Models & Animation)** | `client/render/models/`, `rigs/` | Procedural low-poly bird heroes, fledglings, structures and Patrons, with code-driven rigs and animation (run, dash, shoot, cast, death) |
| 16 | **Rendering & VFX Engineer** | `client/render/` (core), `client/vfx/` | Scene, lighting, fog, instancing, LOD, outlines and team colours, tracers, impacts, ability VFX, post-fx, quality presets |
| 17 | **UI/HUD Engineer** | `client/ui/` | HUD, minimap with pings, Hoard shop, scoreboard, kill feed, damage numbers, all menus |
| 18 | **Audio Engineer** | `client/audio/` | Synthesised guns, hits, beak-shot tick, a call per hero, structure alarms, Egg jingle, Roc roar, positional audio, adaptive music |
| 19 | **Balance & Data Designer** | `sim/data/`, `docs/BALANCE.md` | Owns all numbers. Runs 100+ headless bot matches per iteration. Targets: 25–40 min matches, every hero's win rate 40–60%, every item bought, no runaway snowball. Iterates |
| 20 | **QA, Performance & Code Review** | `tests/`, `e2e/`; can block merges | Unit tests for every system, determinism test (same seed gives same result hash), 30-min soak, Playwright screenshots of each scene for visual review, FPS budget, reviews every merge for interface violations, cross-ownership edits, magic numbers, missing tests |

Concurrency rules:
- Run at most about 6–8 agents at once, in waves that follow the milestone dependencies.
- Each agent gets its own git branch or worktree. Merge only after QA/Review approves and
  `scripts/check.sh` passes.
- Agents can't watch the game, so **visual work must be checked with Playwright screenshots**, which the
  agent looks at before reporting done.
- Each agent ends its task by appending to `docs/STATUS.md`: done / blocked / interface requests / next.

===================================================================================================
## 6. MILESTONES & GATES
**M0 — Foundations** (Director, Architect, Build, Level Designer, QA)
  GDD, architecture and interfaces written. `npm start` opens a lit 3D blockout of the map.
  Headless sim runs. `check.sh` passes.
**M1 — One bird in a lane** (Controller, Camera, Combat, Abilities, Hero A, Tech Art, VFX)
  Player runs, dashes, slides, mantles and rides updrafts. Shoots with working beak shots. Uses 4
  abilities. Fledglings march and fight. Pods can be secured and denied.
**M2 — The loop** (Economy, Objectives, UI, Audio, Hero B)
  Seeds, levels, AP and the shop work. All structures and the 2-phase Patron work, so a match can be
  won by hand. HUD, minimap and audio done.
**M3 — Full 6v6** (Bot AI, Heroes, Objectives, Level)
  All 8 heroes and 48+ items. Golden Egg, Roc/Ember, Thickets and runes work. 11 bots finish 20 seeded
  headless matches with zero crashes.
**M4 — Balance & polish** (Balance, Art, VFX, Audio, UI, QA)
  Balance targets met. FPS budget met. Menus, settings and end screen done. Juice added (hitstop,
  shake, hit markers, kill confirms).
**M5 — Release candidate**
  "Easy to run" requirements from Section 1 verified on a clean clone. README done. Zero failing tests.
  QA/Review signs off.

===================================================================================================
## 7. QUALITY BAR
- Strict TypeScript, no `any`, no magic numbers outside `sim/data/`.
- Every hero has an ability smoke test: cast each ability in a headless sandbox and assert its effect.
- The sim writes per-match JSON telemetry (duration, seed curves, kills, items bought, objective
  timings, hero win rates) for the Balance Designer.
- When something is ambiguous, follow Deadlock's live behaviour, check with the Game Director, and log
  deliberate deviations in DECISIONS.md.

Start now: write `docs/STATUS.md` with the full plan, then spawn the M0 wave.
