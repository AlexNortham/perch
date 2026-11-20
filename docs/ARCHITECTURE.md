# PERCH — Architecture

Owner: Technical Architect (#3). The TypeScript under `src/sim/core/contracts/` is the source of truth for every
cross-system type; [INTERFACES.md](INTERFACES.md) indexes it and assigns every mechanic to one owner. This document
explains how the pieces fit, the rules that keep the sim deterministic, and how new work plugs in.

Contents: [1 Module map](#1-module-map) · [2 Data flow](#2-data-flow) · [3 The tick](#3-the-tick) ·
[4 Determinism](#4-determinism) · [5 Sim and client](#5-the-simclient-boundary) · [6 Frame, units and aim](#6-frame-units-and-aim) ·
[7 How systems talk](#7-how-systems-talk) · [8 Performance](#8-performance-budgets) · [9 Plugging in](#9-plugging-in) ·
[10 Tests](#10-test-strategy) · [11 Risks](#11-known-risks)

---

## 1. Module map

```
index.html                     <div id="app"> + /src/client/main.ts                         Build
src/
  sim/                         pure TypeScript, ES lib only: no DOM, no Node, no Three, no clocks
    index.ts                   createSim(), Sim API, roster helpers; composition root         Architect
    core/                      runtime every system shares                                  Architect
      contracts/               every cross-system type and event (no logic)
      events.ts store.ts rng.ts spatial.ts stats.ts effects.ts hash.ts telemetry.ts
      view.ts aim.ts vision.ts math.ts dmath.ts
    data/core.ts               sim-wide constants (tick rate, camera rig, limits)             Architect
    data/<system>.ts           each system's tuning (movement, combat, abilities, economy,    system owner;
                               items, world, ai) and data/heroes/<id>.ts                      Balance from W7
    physics/                   Rapier world, character controller, PhysicsService             Character Controller
    combat/                    guns, hitboxes, damage pipeline, statuses, melee, respawn      Combat
    abilities/                 ability framework, AP, areas, summons, tethers, hero hooks     Ability Systems
    heroes/registry.ts         HeroId → module                                                Architect
    heroes/<id>/               one module per hero (data + optional hooks)                   Hero Engineer A / B
    economy/                   Seeds, pods, bounties, levels, Molts, flex slots              Economy & Items
    items/                     shop, inventory, passives, item actives, triggers              Economy & Items
    world/                     fledglings, structures, neutrals, objectives, vision           Objectives
    world/map/                 MapData for 'main' and 'arena'                                 Level Designer
    ai/                        bot heroes (commands), bot hero picks                          Bot AI
  client/                      browser only; reads the sim through SimView and events
    main.ts, app/              boot, state machine, fixed-step loop, settings, ?scene=        Architect
    input/  camera/            PlayerCommand from keys and mouse; the third-person camera      Camera & Input
    render/                    Three.js scene, blockout, instancing, LOD                      Rendering & VFX
    render/models/, rigs/      procedural birds, units, structures; rigs and animation        Technical Artist
    vfx/                       tracers, impacts, ability effects, post-fx                     Rendering & VFX
    ui/                        HUD, minimap, shop, scoreboard, menus (DOM overlay)            UI/HUD
    audio/                     WebAudio synthesis, positional audio, music                    Audio
tools/ scripts/                headless sim CLI, screenshot harness, check.sh                 Build
tests/ e2e/                    cross-system suites, Playwright                                QA
```

Two TypeScript projects enforce the split: `tsconfig.sim.json` compiles `src/sim` with only the ES2023 library (no
`console`, no `window`, no Node), and ESLint bans Three, `src/client` imports, `Math.random`, `Date.now`,
`performance.now`, `window` and `document` inside `src/sim`.

## 2. Data flow

```
                         ┌─────────────────────────── browser (src/client) ───────────────────────────┐
 keys, mouse ──► input ──► PlayerCommand ─┐                                                            │
                   │ look (every frame)   │      app/loop: fixed 60 Hz steps, render interpolation      │
                   ▼                      ▼                                                            │
                camera ◄── Frame ◄── {prev, curr: SimView, alpha} ◄── sim.view (snapshot per tick)     │
                   │                      ▲                                                            │
                   ▼                      │   sim.drainEvents() ──► vfx, ui, audio                     │
   render ◄── CameraPose                  │                                                            │
                         └────────────────┼────────────────────────────────────────────────────────────┘
                                          │ sim.step([{ hero, command }])
 ┌──────────────────────────── sim (src/sim, also headless in Node) ─────────────────────────────────────┐
 │  createSim(config) ──► SimContext { store, bus, rng, spatial, stats, effects, physics, teams, ... }  │
 │                                                                                                     │
 │  per tick:  ai ─► [latch commands] ─► movement ─► [spatial] ─► abilities ─► combat ─► world          │
 │             ─► damage ─► statuses ─► economy ─► [flush despawns, telemetry]                          │
 │                                                                                                     │
 │  systems ── read/write their own components on Entity records (ctx.store)                            │
 │          ── request effects from their single owner (ctx.effects.apply)                              │
 │          ── announce facts on the bus (ctx.bus.emit) ──► other systems, telemetry, per-step log      │
 │  telemetry() ──► tools/sim.ts ──► out/telemetry/*.json (Balance)                                     │
 └─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## 3. The tick

`sim.step(commands)` advances exactly one 1/60 s tick. Phases run in this order; within a phase, systems run in
`SYSTEM_ORDER` = ai, physics, world, abilities, combat, economy, items (src/sim/index.ts). A system declares handlers
only for the phases it uses (`System.phases`).

| # | Phase / core step | Who | What happens |
|---|---|---|---|
| 0 | core: start | core | Clear the event log, `tick += 1` |
| 1 | `ai` | sim/ai | Bots write `HeroEntity.command` from what their flock saw last tick |
| – | core: latch | core | `step()` commands override bots; the command is copied into the hero's latch and sanitised, or the last one repeats without its one-shot fields (D-ARCH-011); look yaw/pitch and shoulder swap applied; pings (rate-limited) and concession handled |
| 2 | `movement` | physics, world | Hero controllers from commands (walk, sprint, jump, dash, slide, mantle, Updrafts, Chimneys, Vines), displacements of heroes and units; world steers fledglings and neutrals that aren't rooted or stunned |
| – | core: spatial | core | Spatial hash rebuilt from every live entity; structures (towers, Nests, Feeders, the Patron) are re-indexed only on a tick when their list, a position or a radius changed (D-ARCH-029) |
| 3 | `abilities` | abilities, items | AP upgrades, casts, channels, areas, summons, tethers, delays, hero hooks; item actives |
| 4 | `combat` | combat | Guns (aim model, fire, reload), melee, parry, projectiles; hits become damage requests |
| 5 | `world` | world | Vision (`seenBy`); fledglings, structures and neutrals pick targets and attack; waves, Brood Ward, gates, Patron phases, Egg, runes, Nests, Roc and Ember |
| 6 | `damage` | combat | Resolve this tick's damage requests in arrival order (GDD §5.2) → `damage.applied` → `entity.died` with kill credit |
| 7 | `statuses` | combat | Status timers, periodic effects (DoTs), expiry; regeneration; respawns |
| 8 | `economy` | economy, items | Passive income, pods, bounties, levels and AP grants, Molts, flex slots; shop buy and sell |
| – | core: end | core | Despawned entities leave the store (`entity.despawned`); telemetry samples; a `match.ended` stops further steps |

Consequences worth knowing:
- Damage requested in phases 3–5 lands in the same tick (phase 6). Damage requested later (DoT ticks in phase 7)
  lands next tick. Every tick is 16.7 ms, so this is invisible but deterministic.
- Stat and condition changes apply at once (`ctx.stats.set` recomputes immediately), so a stun applied in phase 6
  stops the hero's movement from the next tick's phase 2.
- `ctx.spatial` holds positions as of the end of phase 2; entities spawned later in the tick are not in it yet.
- Events are delivered synchronously, breadth-first: an event emitted inside a handler is delivered after every
  handler of the current event has run. Handlers run in subscription order, which is system creation order
  (physics, ai, world, abilities, combat, economy, items, then core's telemetry).

## 4. Determinism

Same seed + same commands ⇒ the same `sim.hash()` after any number of ticks, in Node and in the browser on the same
machine. `e2e/determinism.spec.ts` holds us to it: the siege script and a 12-bot match run in Node and in Edge, and
every tick's hash must match (D-ARCH-021). The rules:

1. **No wall clock in the sim.** Time is `ctx.clock.tick` (and `seconds = tick / 60`). Durations in data are
   seconds; convert with `ticks(s)` from core/math.ts. The client's frame time never enters the sim.
2. **Seeded randomness only, one stream per purpose.** `ctx.rng.stream(name)` gives an sfc32 stream seeded from
   (match seed, name). Name streams by owner: `'combat'`, `'world/waves'`, `'ai/' + heroId`. A stream's sequence
   never depends on another stream's use or on creation order, so a system drawing more numbers can't shift anyone
   else's sequence. The roster uses its own `'roster'` stream.
3. **Deterministic iteration.** `store.all()` and `store.list(kind)` are in ascending id order; ids are assigned in
   spawn order and never reused. `ctx.spatial.query` returns ascending ids. Iterate Maps and Sets only when their
   insertion order is itself deterministic; never iterate object keys of data whose shape varies, and never sort
   with a comparator that can tie on different elements.
4. **No module-level mutable state.** Several sims run in one process (tests, the batch CLI). Keep private state in
   the closure your factory returns.
5. **Floating point.** `+ − × ÷`, `Math.sqrt`, `abs`, `floor`, `round`, `min`, `max`, `fround` and `imul` are exact
   in IEEE-754 and identical in every engine. Everything the spec calls "implementation-approximated" is not:
   `Math.sin`, `cos`, `tan`, `atan2`, `asin`, `acos`, `exp`, `log`, `pow`, `hypot` and `**` (except `x ** 2`) differ
   in the last bit between V8 versions (Node 22 against Edge 156 on 3–18 % of inputs), let alone engines. The sim
   uses `core/dmath.ts` instead (`import * as dmath`): fdlibm and V8's hypot ported to plain arithmetic, equal to
   Node 22's `Math` bit for bit, so old hashes stay valid. `dmath.test.ts` fails on any banned call under `src/sim`;
   a new function means porting it there first. Accumulate in a fixed order; don't mix float32 and float64 for the
   same quantity.
6. **Rapier.** No per-tick `world.step()`: nothing is dynamic, so nothing integrates (D-CTRL-001). Map prims and
   structures sit in a static world stepped only when a collider is added or removed; hero query capsules sit in a
   small second world stepped only when a query asks for heroes after they moved. Create and remove colliders in
   response to deterministic events (`entity.spawned` / `entity.despawned`, ascending id) and read results back into
   components in id order. `@dimforge/rapier3d-compat` runs the same WASM in Node and the browser and matched
   tick for tick in the D-ARCH-021 test (D-ARCH-007).
7. **What the hash covers:** the tick, every RNG stream's state, every live entity record with all its components
   (generic walk, object keys sorted, numbers by exact bits), team state, objective timers, core's ping history,
   and each system's `hash(h)` for private state. A system with private state that can diverge should implement
   `hash`; the determinism test then catches divergence before it reaches public state.
8. **Commands are the only input.** Everything the player does (including conceding) goes through `PlayerCommand`,
   so a match is reproducible from its seed and command log.

## 5. The sim/client boundary

- The client imports from `src/sim` only: `createSim` and the roster helpers (src/sim/index.ts), contract types,
  the pure helpers `core/aim.ts`, `core/math.ts`, `core/vision.ts`, `core/dmath.ts`, the hero registry (for body
  plans and names), `world/map` (`loadMap`: collision, anchors and, from Stage 4, `MapData.dressing` for the
  environment art, D-ARCH-028) and, from Stage 4, `data/builds.ts` (recommended builds
  for the shop, INTERFACES §14.1). Never `sim.ctx`, never a system module.
- The sim never imports `src/client` (lint-enforced).
- Each tick the client reads `sim.view` (a snapshot: plain copies, built lazily once per tick) and drains
  `sim.drainEvents()` (the events of the last step; drain after every step, and once after `createSim`).
- Rendering interpolates entity transforms by id between the previous and current views with the loop's `alpha`
  (`app/loop.ts interpolate`). The local camera uses the live look angles from input every frame, so mouse look is
  never 60 Hz-quantised.
- The app loop runs at most `MAX_STEPS_PER_FRAME` (5) sim steps per frame and drops a longer backlog rather than
  spiralling. Pausing stops stepping (single-player, GDD §12.10).
- Start-up is staged (D-ARCH-031, `app/stages.ts`). `window.__perch.stage` goes `'boot'` → `'menu'` (the sim, UI,
  input and audio are up and the first screen has drawn 3 frames over the page background) → `'world'` (the deferred
  work queue is empty and the full scene has drawn 3 more). `__perch.ready` is true from `'world'`; the screenshot
  harness and e2e wait on it, and a spec that needs only the menu can wait on `stage`. Generation that can wait goes
  through `deferWork(label, job)`: jobs run after `'menu'`, in order, one per browser task, each awaited (so a job
  may hand work to a Web Worker), each recorded as a `perch:job:<label>` performance measure next to the
  `perch:boot`, `perch:sim`, `perch:menu` and `perch:world` marks. Until Rendering queues its own generation the
  whole renderer is the first job. `?scene=menu|blockout|sandbox|lane|match` (`lane` is the practice match that Play
  starts, D-ARCH-013) plus `seed`, `hero`, `cam` (player, overview,
  top), `quality` and `t` (seconds fast-forwarded before the first frame): see `src/client/app/router.ts`.

## 6. Frame, units and aim

- Right-handed, +y up, metres, seconds, radians in code (degrees only in data names ending `Deg`). Dawn's base is
  at −z, Dusk's at +z; the mirror plane is z = 0 (GDD §6).
- Yaw 0 faces +z and grows counter-clockwise seen from above: forward = (sin yaw, 0, cos yaw), right =
  (−cos yaw, 0, sin yaw). Pitch is positive looking up, clamped to ±80°. Use `LocalOffset {right, up, forward}` and
  `toWorld` instead of raw local axes.
- Seen from above with Dusk at the top of the screen, +x is on the left. The GDD names +x "east", so a north-up
  map shows east on the left: the minimap and any top-down camera must map screen-right to −x for a Dawn-at-bottom
  view (D-ARCH-008).
- **Aim model** (GDD §4.5, `src/sim/core/aim.ts`): `aimRay(pos, yaw, pitch, shoulder, body, crouching)` rebuilds the
  camera from the pivot (head centre − 0.05 m), the boom (3.2 m scaled by hero height, clamped 2.6–4.0 m) and the
  shoulder offset (0.75 m right, 0.35 m up); hits nearer than camera-to-pivot + 0.3 m are ignored; the first world
  or enemy hitbox hit up to 300 m (WeaponDef.aimRange overrides) is the aim point; shots leave `muzzlePoint` toward
  it. The client camera calls the same function and only its wall pull-in is extra, so the crosshair is honest.
  Bots aim by writing look yaw/pitch.

## 7. How systems talk

Four channels, nothing else. A system never imports another system's module (except the documented helpers:
`pickBotHero` from sim/ai, used by the roster helpers).

| Channel | For | Rule |
|---|---|---|
| **Components** on entity records (`ctx.store`) | State others read | Exactly one writer per component (INTERFACES.md). Read anything; write only your own. |
| **Effects** (`ctx.effects.apply(effect, target, cause)`) | Asking for something another system owns: damage, heal, status, displace, dash, area … | Each effect kind has one owner (`EFFECT_OWNERS`); the router refuses any other registrant. Effects are data, so abilities, items, runes, the Ember and objectives share one machinery. |
| **Events** (`ctx.bus.on` / `emit`) | Announcing facts | Past tense, one emitter each, any number of consumers; also the client's per-step log. Never use an event as a request. |
| **Services** on the context | Queries and shared machinery | `physics` (raycasts, character moves), `stats` (the one stat model), `spatial`, `rng`, `clock`, `teams`, `objectives`. |

**Private state.** State nobody else reads lives in your factory's closure, keyed by `EntityId`; drop it on
`entity.despawned`. Fold it into `System.hash` if it can diverge.

**Stats.** One model (contracts/stats.ts): base values from data, every other source sets a `ModifierSet` under its
own key (`'economy:molts'`, `'items:<slot>'`, `'status:<n>'`, `'world:broodWard'`), core recomputes at once. Order per
stat: add → pct → mul → max (strongest only) → stack (1 − Π(1 − x)). Consumers apply caps from their data.

**Entities.** Plain records (no classes) with required components per kind (`HeroEntity`, `UnitEntity`, …). Create
with `ctx.store.spawn`, remove with `ctx.store.despawn` (leaves at the end of the tick). Initialise your own
components for other systems' entities in your `entity.spawned` handler.

## 8. Performance budgets

| Budget | Target | W1 measurement |
|---|---|---|
| Sim tick in Node, full 6v6 + ~150 fledglings + all structures | ≤ 1.0 ms average, ≤ 3 ms worst tick | Core alone with 162 entities and 150 spatial queries per tick: 0.087 ms. Systems share the remaining ~0.9 ms. |
| View snapshot (client only) | ≤ 0.1 ms | 0.04 ms per tick for step + view with 12 heroes |
| `hash()` | tests and CLI only | 4 ms for 162 entities |
| Browser frame, 1080p, mid-range iGPU | ≤ 16.6 ms (60 FPS) | stub renderer; Rendering owns the budget from W2 |
| Page load to the first screen (`perch:menu`), production build | as low as it goes; the world follows | W6: 1.8 s (was 10.7 s to first paint, 11.7 s to ready); the world at 8.9 s (D-ARCH-031) |

Guidance: query `ctx.spatial` instead of scanning `store.all()` for proximity; reuse output arrays (`query(…, out)`);
keep per-tick allocation low in hot loops (fledglings, projectiles); fledglings need not have Rapier controllers.
The headless CLI prints ticks per second; QA tracks it in the soak test.

## 9. Plugging in

- **A system's logic** goes in its entry module's factory (`createXSystem(ctx)`): subscribe to events, register
  owned effect kinds with `ctx.effects.handle(kind, '<system>', handler)`, return `{ name, phases, hash }`. createSim
  already wires every entry module; nobody edits src/sim/index.ts.
- **A hero**: fill `src/sim/data/heroes/<id>.ts` (HeroDef: body plan, base stats, growth, gun, four abilities as
  effect data) and, only for what data can't say, `hooks` in `src/sim/heroes/<id>/index.ts` (onCast, onEffect,
  onTick; HookEffect calls onEffect). The registry already lists all 24 ids. Each hero ships an ability smoke test,
  then sets `implemented: true` on its module so hero select offers it.
- **An item**: add an `ItemDef` to `src/sim/data/items.ts` (passive modifiers, triggers, active effects). No code
  unless a new effect kind is needed.
- **A status**: a `StatusDef` in data (shared ones in `src/sim/data/combat.ts`), applied with `applyStatus`.
- **An effect kind, event, component field, stat or condition**: an interface request (INTERFACES.md §10).
- **A map**: `MapData` from `src/sim/world/map` (`loadMap(id)`), its look in `MapData.dressing`; 'arena' stays a flat test map.
- **A client module**: implement its interface in `src/client/app/contracts.ts`; the app already calls it.

## 10. Test strategy

Per D-EP-006 and D-EP-010:

| Layer | Where | Owner | What |
|---|---|---|---|
| Unit | `src/**/*.test.ts` next to the code | code owner | Core: RNG streams, bus order, store, spatial hash (vs brute force), hash, stat stacking, effect routing, aim maths, telemetry, createSim (determinism, rosters, latch, pings, concession), client loop, router, settings |
| Rules suites (tests-first) | `tests/` | QA | Damage pipeline (GDD §5.2 step by step), economy (pods, deny, bounties, levels, shop), objectives (Brood Ward, gates, Patron phases, Egg, Roc). Drive them through `createSim` + `sim.ctx` + `ctx.effects` + events; don't reach into system closures. |
| Determinism | `tests/`, `e2e/determinism.spec.ts` | QA | Two runs, same seed and command script → equal `hash()` at several ticks; different seeds differ. Node against Edge: equal hash every tick (D-ARCH-021) |
| Ability sandbox | `tests/` helper | QA, used by hero engineers | `createSim({ map: 'arena', options: { unlockAbilities: true, waves: false } })`, place a caster and targets, press an ability in a command, assert the effect |
| Headless matches | `npm run sim` | Build, Balance, QA | 3-minute gate in `check.sh`; 20 seeded matches with zero crashes (M3); 100+ per balance iteration |
| Browser | `e2e/`, `npm run shots` | QA, visual owners | Boot smoke test; a screenshot of every scene, looked at before reporting done |

## 11. Known risks

- **Rapier cross-environment determinism.** The compat build is "locally deterministic". If
  `e2e/determinism.spec.ts` ever diverges in physics with no `Math` call to blame, switch to
  `@dimforge/rapier3d-deterministic-compat` (same API; needs an ADR because it changes the BRIEF §1 stack).
- **Firefox and other engines.** dmath makes the sim's own arithmetic engine-proof, so a Firefox run should match
  too, but only Edge is in the test. Add a Firefox project to the determinism spec before relying on it.
- **Effect vocabulary gaps.** If a kit can't be expressed, use a `hook` effect first and file an interface request
  for a new kind; never implement another owner's effect kind locally.
- **Vision cost.** The §11.1 rule needs line-of-sight raycasts; sim/world should test only hero-to-hero pairs within
  40 m and stagger checks across ticks if needed (`seenBy` may lag by a few ticks, never more than 0.25 s).

## 12. Stage 3 match and presentation ownership

Play and the lane router share matchConfig. The Practice Hub builds a separate arena roster and fresh sim; the test sandbox remains available. Training targets are real heroes with dummy controllers. Core establishes initial identity, placement and practice health/AP; Swap bird starts the new bird where the old one stood through `SimOptions.practiceStart` (D-ARCH-026). Combat owns subsequent health, target resets and ordinary respawn behaviour.

Client modules read detached snapshots. UI queues one buy/sell/upgrade/ping through AppActions.submit for the next sim tick. Shop, upgrades and the ping wheel release the cursor while the clock continues. Renderer, VFX, input and UI consume shared app bindings/palette/host/drawing policy. Core projects a per-team map visibility mask, actual resolved area dimensions, structure phase/body/weak point, item refund window and zone from the owners' components. Item definitions are static and delivered once per screen via the catalogue. See INTERFACES §12 and W4-contract-followups.md for the producers.

The app includes the last displayed player crosshair line in human commands. The sim validates the finite, bounded origin and uses its physical muzzle for actual wall and entity impacts. Headless commands and bots use the deterministic geometric camera model. A shot's pellet endpoints, hit status and applied damage are distinct facts. Combat supplies all three so visible rays, hit markers and audio match misses, partial hits and cover.
