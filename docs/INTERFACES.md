# PERCH — Interfaces

Owner: Technical Architect (#3). This is the index of the contracts and the map of who owns what. **The TypeScript
is the source of truth**: every type below is defined, with TSDoc, in
[`src/sim/core/contracts/`](../src/sim/core/contracts/index.ts) (sim) or
[`src/client/app/contracts.ts`](../src/client/app/contracts.ts) (client). If this page and the code disagree, the
code wins and this page is the bug. How the pieces run together: [ARCHITECTURE.md](ARCHITECTURE.md).

Contents: [1 Contract files](#1-contract-files) · [2 Context services](#2-context-services) ·
[3 Components](#3-components-who-writes-what) · [4 Effects](#4-effects) · [5 Events](#5-events) ·
[6 Damage pipeline](#6-the-damage-pipeline) · [7 Data shapes](#7-data-shapes) · [8 Client](#8-client-contracts) ·
[9 Responsibility matrix](#9-responsibility-matrix) · [10 Change process](#10-change-process)

---

## 1. Contract files

Import everything from `src/sim/core/contracts` (the barrel).

| File | Defines | Owner of the rules behind it | Main consumers |
|---|---|---|---|
| [base.ts](../src/sim/core/contracts/base.ts) | `Vec3`, `LocalOffset`, `EntityId`, `Tick`, `Team`/`PlayerTeam`, the 24 `HERO_IDS`, `Controller`, `BotDifficulty`, `LaneId`, data id aliases; the world frame convention | Architect | everyone |
| [command.ts](../src/sim/core/contracts/command.ts) | `PlayerCommand` (axes, look, `held`/`pressed` `Button` bits, upgrade, buy, sell, ping, concede), `HeroCommand`, `Ping`, `IDLE_COMMAND` | Architect | input, ai (write); physics, combat, abilities, items, world (read) |
| [stats.ts](../src/sim/core/contracts/stats.ts) | `STAT_DEFAULTS` (every stat), `CONDITIONS`, `StatModifier`/`ModifierSet`, `StatBlock`, `StatService` | core implements | every sim system |
| [statuses.ts](../src/sim/core/contracts/statuses.ts) | `StatusDef` (stacking per GDD §5.9, modifiers, periodic, onExpire, onLethal, endsOnAttack), `StatusInstance` | combat | abilities, items, world (apply); ai, ui (read) |
| [effects.ts](../src/sim/core/contracts/effects.ts) | the `Effect` union (19 GDD primitives + `hook`), `EFFECT_OWNERS`, `Magnitude`, `TargetFilter`, `EffectCause`, `EffectTarget`, `EffectRouter`, `TriggerDef` | each kind's owner (§4) | abilities, items, world, combat, hero data |
| [abilities.ts](../src/sim/core/contracts/abilities.ts) | `AbilityDef` (targeting, cooldown, charges, cast, channel, values, effects, 3 upgrades, hook), `AbilityTargeting` | abilities | hero data, ai, ui |
| [items.ts](../src/sim/core/contracts/items.ts) | `ItemDef` (category, tier, cost, component, passive, procs, active), `ItemActive` | items | economy data, ai, ui |
| [heroes.ts](../src/sim/core/contracts/heroes.ts) | `HeroDef`, `BodyPlan`, `WeaponDef`, `Archetype`, `HeroModule`, `HeroHooks`, `AbilityCast` | hero engineers (data), abilities (hooks) | physics, combat, render/models, camera, ai |
| [entity.ts](../src/sim/core/contracts/entity.ts) | entity kinds and records, every component (§3), `TeamState`, `ObjectiveState`, `SeenBy` | per component (§3) | everyone |
| [map.ts](../src/sim/core/contracts/map.ts) | `MapData` (prims, lanes, nav graph, Updrafts, climbs, ledges, every anchor, the Hollow, bot spots), the mirror rule | Level Designer | physics, world, ai, render, camera, ui |
| [physics.ts](../src/sim/core/contracts/physics.ts) | `PhysicsService`, `Physics`, `Layer`, `Shape`, `RayHit`, `CharacterMove` | physics | combat, abilities, world, ai |
| [events.ts](../src/sim/core/contracts/events.ts) | the `SimEvent` union (§5) | each event's emitter | systems, telemetry, client |
| [view.ts](../src/sim/core/contracts/view.ts) | `SimView`, `EntityView`, `HeroView`, `TeamView`, `ViewFlag` | core builds it | client |
| [telemetry.ts](../src/sim/core/contracts/telemetry.ts) | `MatchTelemetry`, `HeroTelemetry`, `ObjectiveTelemetry` | core collects it | tools/sim.ts, Balance, end screen |
| [sim.ts](../src/sim/core/contracts/sim.ts) | `PHASES`, `System`, `SystemFactory`, `SimContext`, `SimConfig`/`SimOptions`/`RosterSlot`, `Sim`, `Rng`, `EventBus`, `EntityStore`, `SpatialIndex`, `Hasher` | Architect | every system, tools, tests |

Pure helpers anyone (sim or client) may import: [`core/aim.ts`](../src/sim/core/aim.ts) (the aim model),
[`core/math.ts`](../src/sim/core/math.ts) (`ticks()`, vectors), [`core/vision.ts`](../src/sim/core/vision.ts)
(`canSee`). Constants: [`src/sim/data/core.ts`](../src/sim/data/core.ts).

## 2. Context services

Every system factory receives one `SimContext`:

| Field | What | Implemented by |
|---|---|---|
| `config` | resolved `SimConfig` (seed, map, roster, options: `waves`, `neutrals`, `unlockAbilities`, `startSeeds`) | core |
| `map` | the `MapData` | world/map |
| `heroes` | every `HeroModule` by id | heroes/registry |
| `clock` | `tick`, `seconds` | core |
| `store` | entity store: `spawn`, `get`, `getKind`, `despawn`, `all`, `list(kind)` | core |
| `bus` | `on(type, handler)`, `emit(event)` | core |
| `rng` | `stream(name)` → seeded `Rng` | core |
| `spatial` | `query(centre, radius, out)` → ids, ascending | core |
| `stats` | `create`, `set(entity, key, mods)`, `setBase`, `get(entity, stat)`, `has(entity, condition)` | core |
| `effects` | `handle(kind, owner, handler)`, `apply`, `applyAll`, `magnitude` | core (router); owners implement kinds |
| `physics` | `raycast`, `shapeCast`, `overlap`, `moveCharacter`, `groundHeight` | sim/physics |
| `teams` | `TeamState` per flock: `flexSlots` (economy), `emberUntil` (world) | fields' writers |
| `objectives` | `ObjectiveState` timers: next wave, Egg, runes, Roc | sim/world |

**Shared visibility service** (GDD §11.1, §5.9): `EntityBase.seenBy`, written by **sim/world** every tick in the world
phase from the vision rule (allied hero line of sight within 40 m, allied fledgling within 20 m, allied structure
within 30 m, or revealed) and the reveal, invisibility and true-sight statuses. Everyone reads it through
`canSee(team, entity)`: bots (sim/ai), fledgling and structure targeting (sim/world), the minimap and outlines (ui,
render). Entities spawn visible to both flocks until world computes them.

## 3. Components: who writes what

One writer per component; anyone may read. "core" means createSim or the store.

| Component | On | Writer | Main readers |
|---|---|---|---|
| `id`, `kind`, `team`, `removed` | all | core (store) | all |
| `pos`, `vel`, `yaw` | heroes | physics (yaw: core, from the command) | all |
| `pos`, `vel`, `yaw` | units, structures, pickups, areas | the spawning owner: world (fledglings, neutrals, structures, runes, Egg, Ember), economy (pods), abilities (summons, areas), combat (projectiles) | all |
| `radius` | all | spawner | spatial, combat |
| `seenBy` | all | world (store sets "all" at spawn) | ai, world, ui, render |
| `hero` (`HeroInfo`) | heroes | core | all |
| `pitch`, `shoulder`, `command` | heroes | core (latch); bots' `command` is written by ai in the ai phase | physics, combat, abilities, items, camera |
| `health` (`hp`, shields, `dead`, `respawnAt`, `inCombatUntil`) | heroes, units, structures | combat | all |
| `stats` (`StatBlock`) | heroes, units, structures | core via `ctx.stats` (sources set by their owners) | all |
| `statuses` | heroes, units, structures | combat | abilities, ai, ui |
| `motor` | heroes | physics | combat, abilities, render, camera |
| `weapon` | heroes | combat | ui, render, audio, ai |
| `abilities` (slots, AP, casting) | heroes | abilities | ui, ai, render |
| `progress` (level, Molts, Seeds, net worth) | heroes | economy | items (buying), ui, ai, telemetry |
| `inventory` (items, actives) | heroes | items (exception: `cooldownMod` with scope 'items' writes `readyAt`, applied by abilities) | ui, ai |
| `unit` | units | world (fledglings, neutrals, Roc); abilities (summons) | combat, ai, render |
| `structure` (`phase`, `target`, `body`, `weakPoint`) | structures | world | combat (weak point, hitbox), physics (collider), ai, render |
| `projectile` | projectiles | combat | render |
| `pickup` | pickups | economy (pods); world (runes, Egg, Ember) | combat (pods are hittable), ai, render |
| `area` | areas | abilities | render |
| `TeamState.flexSlots` / `.emberUntil` | ctx.teams | economy / world | items, combat (respawn), ui |
| `ObjectiveState` | ctx.objectives | world | ui, ai |

Stat source keys in use: `'economy:molts'` (economy), `'items:<item>'` (items), `'status:<n>'` (combat),
`'world:<rule>'` such as Brood Ward and gates (world).

## 4. Effects

`ctx.effects.apply(effect, target, cause)` routes each kind to its one owner (`EFFECT_OWNERS`; the router throws if
anyone else registers). Unregistered kinds are ignored, so stubs never crash.

| Kind (GDD §9.25) | Owner | Notes |
|---|---|---|
| `damage` | combat | Queued for the damage phase; supports beak-shot flag, conditional bonuses, % missing hp, execute |
| `heal` | combat | Instant or over time; healAmp and strongest heal reduction apply |
| `applyStatus` | combat | Any `StatusDef`; `magnitude` scales graded statuses |
| `statMod` | combat | Timed stat change; becomes a positive status |
| `cleanse` | combat | negative / positive / listed ids |
| `shield` | combat | Talon shield, Song shield or barrier; optional duration and recharge |
| `weaponMod` | combat | Ammo-free, instant reload, splash, bounce, pierce, ignore falloff, on-hit and every-Nth effects |
| `projectile` | combat | Ability projectiles: speed, radius, range, gravity, pierce, returns, max hits per target |
| `displace` | physics | push, pull, up (knock-up), along |
| `dash` | physics | aim / move / target, arc, pass-through, stop-on-hit, onHit and onArrive effects |
| `teleport` | physics | point, behind target, base |
| `movementMode` | physics | glide, flight, hover, cling, toboggan, burrow |
| `attach` | physics | Target held at the caster's socket; onRelease effects |
| `area` | abilities | Instant or lasting; sphere, cylinder, cone, ring, box; attached, fixed or moving; tick, enter, exit, cross effects |
| `summon` | abilities | trap, decoy, wall, turret |
| `tether` | abilities | Breaks beyond a distance; tick effects at both ends |
| `delay` | abilities | Effects later with the same target and cause |
| `cooldownMod` | abilities | Reset or refund abilities, items or a slot |
| `hook` | abilities | Calls the source hero module's `onEffect` |
| `trigger` | items | Timed trigger on the target; item procs use the same `TriggerDef` permanently |

`EffectCause` travels with everything an effect spawns (projectiles, areas, statuses, delays): credited `source`,
`team`, `via` ('weapon', 'melee', 'ability', 'area', 'item', 'status', 'rune', 'objective', 'unit', 'structure'),
`ability`/`item`, the ability's upgraded `values` (for string magnitudes), the source's Song power at cast, the
`proc` flag (trigger damage never fires triggers) and the `origin` point.

## 5. Events

Facts only; one emitter each. The client may read any event from `sim.drainEvents()`.

| Event | Payload (summary) | Emitter | Consumers |
|---|---|---|---|
| `match.started` | seed, map | core | telemetry, client |
| `match.ended` | winner, reason ('patron', 'concede') | world (Patron dies in phase 2); core (concession) | core (stops stepping), telemetry, client |
| `entity.spawned` | id, kind, team | core store | physics (colliders), owners initialising their components, client |
| `entity.despawned` | id, kind | core store (end of tick) | systems with private state |
| `weapon.fired` | shooter, muzzle, dir | combat | client (tracer, flash, gun sound), ai |
| `weapon.reload` | hero, done | combat | client |
| `projectile.impact` | owner, pos, normal, target (entity, pod or null), beakShot | combat | economy (pods), client |
| `melee` | attacker, heavy, target, parried | combat | economy (pods), world (Ember claim), items (meleeHit), client |
| `parry` | hero, outcome (start, success, whiff), attacker | combat | client, ai |
| `damage.applied` | source, sourceTeam, target, targetKind, amount, absorbed, damageType, via, ability, item, beakShot, weakPoint, proc, lethal, pos | combat (damage phase) | combat (assists), items (triggers), world (Hawk and fledgling aggro), ai, telemetry, client (numbers, hit markers) |
| `heal.applied` | source, target, amount | combat | combat (assists), telemetry, client |
| `status.applied` / `status.ended` | target, status, source, stacks, expiresAt / reason | combat | ai, client |
| `entity.died` | victim, victimKind, victimTeam, victimType, killer, creditHero, assisters, via, pos | combat (damage phase) | economy (bounties, comeback, last-hit share, pods, objective payouts), world (structures, gates, flex-slot sources, Roc, Ember drop), items and abilities (kill/assist triggers), ai, telemetry, client (kill feed) |
| `hero.respawned` | hero, pos | combat | physics (re-seat controller), ai, client |
| `movement` | hero, action (jump, dashJump, dash, land, slide, mantle, updraftOn/Off/Boost, climbOn/Off) | physics | client (FOV kick, sounds, dust) |
| `ability` | caster, slot, ability, stage (start, land, end, interrupted), point | abilities | items (cast triggers), ai, client |
| `ability.upgraded` | hero, slot, tier | abilities | telemetry, client |
| `item.bought` / `item.sold` | hero, item, cost / refund | items | telemetry, client, ai |
| `item.activated` | hero, item | items | client |
| `seeds.gained` | hero, amount, reason | economy | client, telemetry |
| `pod.resolved` | pod, by, outcome (secured, denied), pos | economy | telemetry, client (pop or crunch) |
| `hero.level` | hero, level, ap, unlockSlot | economy | abilities (AP, ultimate unlock), combat (heal by the max-HP gain), client, telemetry |
| `flexSlots` | team, slots | economy | items, client, telemetry |
| `wave.spawned` | wave | world | client, telemetry |
| `structure.state` | structure, state (phase2, wardUp, wardDown, vulnerable) | world | client, ai, telemetry |
| `objective` | action (egg spawned/taken/dropped/delivered, Roc spawned, Ember claimed, rune spawned/taken), hero, team, pickup, pos | world | economy (Egg payout), ai, telemetry, client |
| `ping` | by, team, kind, pos, target | core (rate-limited from commands) | ui (minimap, world markers), audio, ai |

## 6. The damage pipeline

GDD §5.2 is the rule; this is who does each step. Every source of damage goes through it.

1. **Request.** Anyone applies a `damage` effect: abilities (casts, areas, projectiles via combat), items
   (triggers, actives), world (fledglings, structures, neutrals, the Roc, the Home Roost zone), combat's own statuses
   (DoTs, `via: 'status'`). Combat builds requests directly for gun and melee hits (it knows falloff, the head
   hitbox and the weak point). Requests queue until the damage phase.
2. **Resolve** (combat, damage phase, arrival order): base (gun damage with Molt growth, ability base + k×SP, melee)
   → falloff (gun) → beak shot ×(multiplier + beakShotBonus) + beakShotFlat (gun, head; never on units and
   structures) → outgoing bonuses (gunDamage or songDamage, DamageBonus conditions) → incoming amplification
   (talonAmp/songAmp, capped) → resist (stacked resist − shred, clamped) → structure rules (`damageTaken`, which
   world sets for Brood Ward; `invulnerable` gates; ×0.5 melee and Song, nothing from `via: 'area'`/'status'; weak
   point ×1.5) → shields (matching typed shield, then barrier) → health (intangible ignores it; undying floors at 1;
   `onLethal` statuses save the holder).
3. **Applied.** Combat writes `health`, emits `damage.applied` (amount after step 7, absorbed part, flags) and heals
   the source by lifesteal.
4. **Death.** At hp ≤ 0 combat sets `dead` (heroes: `respawnAt` from the respawn rule and `TeamState.emberUntil`) or
   despawns the entity, and emits `entity.died` with **kill credit**: `killer` (killing blow), `creditHero` (the
   killer, or the owner of the killing summon or projectile) and `assisters` (allied heroes who damaged the hero
   victim, or healed, shielded or buffed someone who did, within 12 s).
5. **Payouts.** Economy turns `entity.died` into Seeds: hero bounty with streak and comeback multiplier split
   between killer and assisters (or heroes within 40 m for non-hero kills), the fledgling instant share, pods,
   structure, Roc, Thicket and Nest payouts. Items run kill and assist triggers. World reacts to structure deaths
   (gates, Patron phase, match end).

## 7. Data shapes

- **Heroes**: `HeroDef` in `src/sim/data/heroes/<id>.ts`: name, archetype, `BodyPlan` (height, capsule radius, head
  sphere, muzzle; the Technical Artist's model matches it), base stats (`weaponDamage` and `magazine` are stats),
  Molt growth, `WeaponDef` (pellets, spread, fire rate, hitscan or projectile speed, reload mode, falloff, range,
  optional beak multiplier and aim range), four `AbilityDef`s. Hooks only in `src/sim/heroes/<id>/index.ts`.
- **Abilities**: targeting (`self`, `direction`, `unit`, `point`), range, cooldown, charges, cast and channel times,
  `rooted`, named `values` (magnitudes may name them; upgrades add to them), effects, channel effects, three upgrade
  tiers (value deltas, cooldown, charges, range, extra effects), `hook`. AP costs and unlock rules live in
  `src/sim/data/abilities.ts`.
- **Items**: id (kebab-case), category (talon, plumage, song), tier 1–4, cost, component, passive `ModifierSet`,
  `procs` (`TriggerDef[]`), optional active (cooldown, targeting, range, effects, `whileSilenced`).
- **Statuses**: inline `StatusDef`s; shared ones exported from `src/sim/data/combat.ts`.
- **Map**: `MapData` from `loadMap(id)`; every GDD §6.3 object has a field (spawns and the Home Roost zone, shops,
  structures, lanes, Updrafts with stations, climbs, ledges, Thickets with tiers, Nests, rune spots, Egg perches, the
  Hollow, nav graph with link kinds, bot spots).

## 8. Client contracts

Defined in [`src/client/app/contracts.ts`](../src/client/app/contracts.ts); src/client/app wires them.

| Interface | Module (owner) | Called with |
|---|---|---|
| `InputController` (`createInput(target, settings, onUiAction)`) | client/input (Camera & Input) | `sample()` once per sim step → `PlayerCommand`; live `look` each frame; `onUiAction` for pause, shop, scoreboard, big map |
| `CameraRig` (`createCamera(settings)`) | client/camera (Camera & Input) | `update(frame, heroId, look, preset)` → `CameraPose` (horizontal FOV) |
| `Renderer` (`createRenderer(container, map, quality)`) | client/render (Rendering & VFX) | `render(frame, pose)`, `setMap`, `setQuality`, `resize` |
| `ModelKit` (`createModelKit()`) | client/render/models (Technical Artist) | `create(entityView)`, `pose(model, entityView, frame)` |
| `Vfx` (`createVfx(renderer)`) | client/vfx (Rendering & VFX) | `onEvents(events, view)` per step, `update(frame)` |
| `Ui` (`createUi(root, actions)`) | client/ui (UI/HUD) | `show(screen, context)`, `onEvents`, `update(frame)`, `onUiAction`; calls back `AppActions` (play, startMatch, toMenu, resume, concede, saveSettings) |
| `AudioOut` (`createAudio(settings)`) | client/audio (Audio) | `onEvents(events, view)`, `update(frame, listenerPose)`, `resume()` on first gesture |
| `Settings` store | client/app (Architect) | `loadSettings`/`saveSettings` (localStorage wrapped in try/catch); default bindings come from client/input |

`Frame` = `{ prev, curr: SimView, alpha, dt }`; interpolate with `app/loop.ts interpolate(frame, entityView)`.

## 9. Responsibility matrix

Every mechanic in BRIEF §2 and §3 (and the GDD rules they expand into) has exactly one owning system. Owning means:
the rule's logic lives there; others only read its outputs.

| Mechanic | Owner |
|---|---|
| Fixed tick, phase order, RNG streams, event bus, entity store, spatial hash, state hash | core (Architect) |
| Stat computation (base + Molts + items + statuses, stacking order) | core (stats service) |
| Effect routing (one owner per kind) | core (router) |
| Hero spawn at match start, roster validation, roster helpers | core |
| Command latch: look, pitch clamp, shoulder swap state | core |
| Pings (from commands, rate limit 3 per 4 s) | core |
| Concession (from 15:00) | core |
| Match telemetry (picks, K/D/A, Seeds curves, items, objectives) | core |
| Win condition (Patron destroyed in phase 2) | world |
| Aim model geometry (camera ray, pivot, boom, shoulder, muzzle) | core/aim.ts (Architect); aim-point hit resolution: combat |
| Over-the-shoulder camera, collision pull-in, shoulder-swap blend, FOV kick, presets | client/camera |
| WASD, mouse look, pointer lock, rebinding, sensitivity, building `PlayerCommand` | client/input |
| Walk, sprint, jump, air control, crouch, slide, dash, dash-jump, mantle, stamina | physics |
| Updrafts (mount, ride, boost, dismount), Chimneys, Vines | physics |
| Knockback, pull, knock-up, dashes, teleports, movement modes (glide, flight …), attach | physics |
| Guns: fire rate, spread, pellets, hitscan and projectiles, falloff, ammo, reload, reload-cancel | combat |
| Head and body hitboxes, beak shots, Patron weak point | combat |
| Damage pipeline, Talon vs Song, resists and shred, amplification, shields, lifesteal | combat |
| Kill credit and assists | combat |
| Light and heavy melee, parry | combat |
| Statuses (all of GDD §5.9), DoTs, cleanse, regeneration | combat |
| Hero death, respawn timer (scaling with time, halved by the Ember), respawn at the Home Roost | combat |
| Heal on level-up (the max-HP gain) | combat |
| Combat state (in combat for 4 s) | combat |
| Ability casting, targeting, cooldowns, charges, channels, `rooted` | abilities |
| AP spending, upgrade tiers, ultimate unlock (level 6), ability unlocks | abilities |
| Areas, summons (traps, decoys, walls, turrets), tethers, delays, cooldown changes, hero hooks | abilities |
| Hero kits (data and hooks) for the 24 heroes | Hero Engineer A / B |
| Seeds, passive income, net worth | economy |
| Seed pods: spawn, rise, ripe window, secure, deny, wither; the instant share | economy |
| Hero bounties, streak bonus, comeback multiplier, bounty split | economy |
| Structure, Thicket, Nest, Roc and Egg payouts | economy |
| Levels from net worth, AP grants, Molts (stat growth) | economy |
| Flex-slot unlocks (first and second Hawk, first Heron, first Shrine) | economy |
| Shop: buy, sell, refunds, component upgrades, shop zones, item slots and flex-slot use | items |
| Item passives, item triggers (procs), item actives and their cooldowns; the `trigger` effect | items |
| Fledgling waves (timing, composition, scaling), marching, targeting, fighting | world |
| Sentinel Hawk, Stilt Heron, Nest Wardens, Roost Shrines: behaviour, targeting, gates | world |
| Hawk targeting rule (heroes who hurt allied heroes nearby) | world (D-EP-008) |
| Brood Ward (sets the structure-rule multiplier) and the 35:00 lever | world |
| Two-phase Patron (attacks, transition, weak point placement) | world |
| Thickets, Nests and crumb buffs, Feather runes | world |
| Golden Egg: spawn, pick-up, carrier status, drop, return, delivery | world |
| The Roc and the Phoenix Ember (claim by heavy melee, team buff) | world |
| Home Roost zone (heals allies, hurts enemies) | world |
| Vision: the shared visibility service (`seenBy`, GDD §11.1 with reveal, invisibility and true sight) | world |
| Map geometry, lanes, mirror rule, nav graph, Updraft splines and stations, anchors | world/map (Level Designer) |
| Bot heroes: aim error, reaction time, last hits, denies, retreat, buying, AP, rotations, Egg and Roc, sieges, ping replies | ai |
| Bot hero picks (GDD §11.6) | ai (`pickBotHero`) |
| Rendering, blockout, lighting, instancing, LOD, team colours, quality presets | client/render |
| Procedural bird, unit, structure and Patron models, rigs and animation | client/render/models (Technical Artist) |
| Tracers, impacts, hit flashes, ability VFX, juice (hitstop, shake) | client/vfx |
| HUD, minimap, kill feed, damage numbers, hit markers, shop UI, scoreboard, all menus | client/ui |
| Synthesised audio, positional audio, adaptive music | client/audio |
| App states, fixed-step loop, interpolation, settings store, `?scene=` router | client/app (Architect) |
| Headless CLI, screenshot harness, `check.sh` | Build |
| All tuning numbers from W7 | Balance & Data |

## 10. Change process

1. Contracts are frozen during a wave. Need a new event, effect kind, component field, stat, condition, view field
   or service method? Write it under **Interface requests** in your STATUS.md Log entry: what, why, who emits or
   owns it, who consumes it.
2. The EP routes it to the Technical Architect, who lands accepted changes **between waves** (in the contracts,
   this page and, if needed, a D-ARCH decision), so every worktree of the next wave starts from the same contracts.
3. Until then, work around it inside your own area: a `hook` effect, private state, or a data-only approximation,
   marked `// TODO(interface request): …`.
4. Never edit `src/sim/core/**`, `src/sim/index.ts`, `src/sim/heroes/registry.ts`, `src/sim/data/core.ts` or
   `src/client/app/**` from another role's branch; QA blocks merges that do.
