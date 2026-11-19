# PERCH — Interfaces

Owner: Technical Architect (#3). This is the index of the contracts and the map of who owns what. **The TypeScript
is the source of truth**: every type below is defined, with TSDoc, in
[`src/sim/core/contracts/`](../src/sim/core/contracts/index.ts) (sim) or
[`src/client/app/contracts.ts`](../src/client/app/contracts.ts) (client). If this page and the code disagree, the
code wins and this page is the bug. How the pieces run together: [ARCHITECTURE.md](ARCHITECTURE.md).

Contents: [1 Contract files](#1-contract-files) · [2 Context services](#2-context-services) ·
[3 Components](#3-components-who-writes-what) · [4 Effects](#4-effects) · [5 Events](#5-events) ·
[6 Damage pipeline](#6-the-damage-pipeline) · [7 Data shapes](#7-data-shapes) · [8 Client](#8-client-contracts) ·
[9 Responsibility matrix](#9-responsibility-matrix) · [10 Change process](#10-change-process) ·
[11 Wave 2 requests](#11-wave-2-requests) · [12 Wave 3 requests](#12-wave-3-requests-and-the-m2-contract-freeze-19112026) ·
[13 Wave 4 requests](#13-wave-4-requests-w45-19112026) · [14 Stage 4 contracts](#14-stage-4-contracts-w45)

---

## 1. Contract files

Import everything from `src/sim/core/contracts` (the barrel).

| File | Defines | Owner of the rules behind it | Main consumers |
|---|---|---|---|
| [base.ts](../src/sim/core/contracts/base.ts) | `Vec3`, `LocalOffset`, `EntityId`, `Tick`, `Team`/`PlayerTeam`, the 24 `HERO_IDS`, `Controller`, `BotDifficulty`, `LaneId`, data id aliases; the world frame convention | Architect | everyone |
| [command.ts](../src/sim/core/contracts/command.ts) | `PlayerCommand` (axes, look, `held`/`pressed` `Button` bits, upgrade, buy, sell, ping, concede), `HeroCommand`, `Ping`, `IDLE_COMMAND`; how core latches and sanitises commands | Architect | input, ai (write); physics, combat, abilities, items, world (read) |
| [stats.ts](../src/sim/core/contracts/stats.ts) | `STAT_DEFAULTS` (every stat), `CONDITIONS`, `StatModifier`/`ModifierSet`, `StatBlock`, `StatService` | core implements | every sim system |
| [statuses.ts](../src/sim/core/contracts/statuses.ts) | `StatusDef` (stacking per GDD §5.9, modifiers, periodic, onExpire, onLethal, endsOnAttack), `StatusInstance` | combat | abilities, items, world (apply); ai, ui (read) |
| [effects.ts](../src/sim/core/contracts/effects.ts) | the `Effect` union (19 GDD primitives + `hook`), `EFFECT_OWNERS`, `Magnitude`, `TargetFilter`, `EffectCause`, `EffectTarget`, `EffectRouter`, `TriggerDef` | each kind's owner (§4) | abilities, items, world, combat, hero data |
| [abilities.ts](../src/sim/core/contracts/abilities.ts) | `AbilityDef` (targeting, cooldown, charges, cast, channel, values, effects, 3 upgrades, hook), `AbilityTargeting` | abilities | hero data, ai, ui |
| [items.ts](../src/sim/core/contracts/items.ts) | `ItemDef` (category, tier, cost, component, passive, procs, active), `ItemActive` | items | economy data, ai, ui |
| [heroes.ts](../src/sim/core/contracts/heroes.ts) | `HeroDef`, `BodyPlan`, `WeaponDef`, `Archetype`, `HeroModule` (with the `implemented` flag hero select reads), `HeroHooks`, `AbilityCast` | hero engineers (data), abilities (hooks) | physics, combat, render/models, camera, ai |
| [entity.ts](../src/sim/core/contracts/entity.ts) | entity kinds and records, every component (§3), `TeamState`, `ObjectiveState`, `SeenBy` | per component (§3) | everyone |
| [map.ts](../src/sim/core/contracts/map.ts) | `MapData` (prims, lanes, nav graph, Updrafts, climbs, ledges, every anchor, the Hollow, bot spots), the mirror rule | Level Designer | physics, world, ai, render, camera, ui |
| [physics.ts](../src/sim/core/contracts/physics.ts) | `PhysicsService`, `Physics`, `Layer`, `Shape`, `RayHit`, `CharacterMove` | physics | combat, abilities, world, ai |
| [events.ts](../src/sim/core/contracts/events.ts) | the `SimEvent` union (§5) | each event's emitter | systems, telemetry, client |
| [view.ts](../src/sim/core/contracts/view.ts) | `SimView`, `EntityView`, `HeroView`, `TeamView`, `ViewFlag` | core builds it | client |
| [telemetry.ts](../src/sim/core/contracts/telemetry.ts) | `MatchTelemetry`, `HeroTelemetry`, `ObjectiveTelemetry` | core collects it | tools/sim.ts, Balance, end screen |
| [sim.ts](../src/sim/core/contracts/sim.ts) | `PHASES`, `System`, `SystemFactory`, `SimContext`, `SimConfig`/`SimOptions`/`RosterSlot`, `Sim`, `Rng`, `EventBus`, `EntityStore`, `SpatialIndex`, `Hasher` | Architect | every system, tools, tests |

Pure helpers anyone (sim or client) may import: [`core/aim.ts`](../src/sim/core/aim.ts) (the aim model),
[`core/math.ts`](../src/sim/core/math.ts) (`ticks()`, vectors), [`core/vision.ts`](../src/sim/core/vision.ts)
(`canSee`), [`core/dmath.ts`](../src/sim/core/dmath.ts) (`sin`, `cos`, `tan`, `atan`, `atan2`, `asin`, `acos`,
`hypot` with 2 or 3 terms; the sim must use these, never `Math`'s, D-ARCH-021). Constants: [`src/sim/data/core.ts`](../src/sim/data/core.ts), including `EFFECT_TICK_SECONDS` (0.5 s, the
GDD §5.12 tick that DoTs, lasting areas and tethers share).

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
| `pos`, `vel`, `yaw` | heroes | physics (yaw: core, from the command); combat writes `pos` once at respawn (D-COMBAT-002) | all |
| `pos`, `vel`, `yaw` | units, structures, pickups, areas | the spawning owner: world (fledglings, neutrals, structures, runes, Egg, Ember), economy (pods), abilities (summons, areas), combat (projectiles); physics moves a unit while a displace, dash or attach acts on it (D-ARCH-014) | all |
| `radius` | all | spawner | spatial, combat |
| `seenBy` | all | world (store sets "all" at spawn) | ai, world, ui, render |
| `hero` (`HeroInfo`) | heroes | core | all |
| `pitch`, `shoulder`, `command` | heroes | core (latch); bots' `command` is written by ai in the ai phase | physics, combat, abilities, items, camera |
| `health` (`hp`, shields, `dead`, `respawnAt`, `inCombatUntil`) | heroes, units, structures | combat | all |
| `stats` (`StatBlock`) | heroes, units, structures | core via `ctx.stats` (sources set by their owners) | all |
| `statuses` | heroes, units, structures | combat | abilities, ai, ui |
| `motor` (incl. `modeAllowsGun`, `modeAllowsAbilities`) | heroes | physics | combat, abilities, render, camera |
| `weapon` | heroes | combat | ui, render, audio, ai |
| `abilities` (slots, AP, casting) | heroes | abilities | ui, ai, render |
| `progress` (level, Molts, Seeds, net worth) | heroes | economy | items (buying), ui, ai, telemetry |
| `inventory` (items, actives) | heroes | items (exception: `cooldownMod` with scope 'items' writes `readyAt`, applied by abilities) | ui, ai |
| `unit` (incl. `size` for walls) | units | world (fledglings, neutrals, Roc); abilities (summons) | combat, ai, render |
| `structure` (`phase`, `target`, `body`, `weakPoint`) | structures | world | combat (weak point, hitbox), physics (collider), ai, render |
| `projectile` | projectiles | combat | render |
| `pickup` | pickups | economy (pods); world (runes, Egg, Ember) | combat (pods are hittable), ai, render |
| `area` | areas | abilities | render |
| `TeamState.flexSlots` / `.emberUntil` | ctx.teams | economy / world | items, combat (respawn), ui |
| `ObjectiveState` | ctx.objectives | world | ui, ai |

Stat source keys in use: `'economy:molts'` (economy), `'items:<item>'` (items), `'status:<n>'` (combat),
`'world:<rule>'` such as Brood Ward and gates (world), `'physics:displaced'` (physics: `rooted` on a unit while it
displaces it; world and abilities don't move a rooted or stunned unit).

## 4. Effects

An ability's `effects` land on the target its targeting chose and its `selfEffects` on the caster (D-ABIL-001).
`ctx.effects.apply(effect, target, cause)` routes each kind to its one owner (`EFFECT_OWNERS`; the router throws if
anyone else registers). Unregistered kinds are ignored, so stubs never crash.

| Kind (GDD §9.25) | Owner | Notes |
|---|---|---|
| `damage` | combat | Queued for the damage phase; supports beak-shot flag and multiplier, conditional bonuses (additive in step 4), % missing hp, execute |
| `heal` | combat | Instant or over time; healAmp and strongest heal reduction apply |
| `applyStatus` | combat | Any `StatusDef`; `magnitude` scales graded statuses |
| `statMod` | combat | Timed stat change; becomes a positive status |
| `cleanse` | combat | negative / positive / listed ids |
| `shield` | combat | Talon shield, Song shield or barrier; optional duration and recharge |
| `weaponMod` | combat | Ammo-free, instant reload, splash, bounce, pierce, ignore falloff, on-hit and every-Nth effects; ends after `shots` |
| `projectile` | combat | Ability projectiles: speed, radius, range, gravity, pierce, returns, max hits per target |
| `displace` | physics | push, pull, up (knock-up), along; heroes and units; `onWall` wall-slam effects |
| `dash` | physics | aim / move / target, arc, pass-through, stop-on-hit, onHit and onArrive effects; who moves: D-CTRL-004 |
| `teleport` | physics | point, behind target, base; a forced facing is reported as `movement.yaw` |
| `movementMode` | physics | glide, flight, hover, cling, toboggan, burrow |
| `attach` | physics | Target held at the caster's socket; onRelease effects |
| `area` | abilities | Instant or lasting; sphere, cylinder, cone, ring, box; attached, fixed or moving; tick, enter, exit, cross effects |
| `summon` | abilities | trap, decoy, wall, turret; `count` and `spreadDeg`; `onEnd` death or expiry effects |
| `tether` | abilities | Breaks beyond a distance; tick effects at both ends; `tether` events at start and end |
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
| `projectile.impact` | owner, pos, normal, target (entity, pod or null), beakShot, via | combat | economy (pods: `via` 'weapon' only), client |
| `melee` | attacker, heavy, target, parried | combat | economy (pods), world (Ember claim), items (meleeHit), client |
| `parry` | hero, outcome (start, success, whiff), attacker | combat | client, ai |
| `damage.applied` | source, sourceTeam, target, targetKind, amount, absorbed, damageType, via, ability, item, beakShot, weakPoint, proc, lethal, pos | combat (damage phase) | combat (assists), items (triggers), world (Hawk and fledgling aggro), ai, telemetry, client (numbers, hit markers) |
| `heal.applied` | source, target, amount | combat | combat (assists), telemetry, client |
| `status.applied` / `status.ended` | target, status, source, stacks, expiresAt / reason | combat | ai, client |
| `entity.died` | victim, victimKind, victimTeam, victimType, killer, creditHero, assisters (damage, or heal/shield/buff of one who did, 12 s), via, pos | combat (damage phase) | economy (bounties, comeback, last-hit share, pods, objective payouts), world (structures, gates, flex-slot sources, Roc, Ember drop), items and abilities (kill/assist triggers), ai, telemetry, client (kill feed) |
| `hero.respawned` | hero, pos | combat | physics (re-seat controller), ai, client |
| `movement` | hero, action (jump, dashJump, dash, land, slide, mantle, updraftOn/Off/Boost, climbOn/Off, displaced, wallSlam, teleport), yaw when the move turned the hero | physics | client (FOV kick, sounds, dust; app adopts `yaw`), abilities (`displaced` ends channels), ai (adopts `yaw`) |
| `tether` | source, target, ability, stage (start, end) | abilities | client (draws the link) |
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
| `objective` | action (egg spawned/taken/dropped/rolling/spoiled/delivered, Roc spawned, Ember dropped/claimed, rune spawned/taken, camp spawned/cleared, keepsake gained, berry eaten), hero, team, pickup, pos, camp, variant, value | world | economy (Egg payout and golden pods), ai, telemetry, client |
| `unit.attack` | unit, attack (bite, dashBite, lash, spit, slam, rake, flap, shriek), origin, point, impactAt | world | client (telegraphs, audio), ai (dodging) |
| `unit.state` | unit, state (awake, asleep, enraged) | world | client (the Roc's roar), ai |
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
  optional beak multiplier, aim range, projectile radius, spin-up and per-round start delay), four `AbilityDef`s. Hooks
  only in `src/sim/heroes/<id>/index.ts`, which also sets `implemented: true` once the kit is complete (hero select).
- **Abilities**: targeting (`self`, `direction`, `unit`, `point`), range, cooldown, charges, cast and channel times,
  `rooted`, named `values` (magnitudes may name them; upgrades add to them), effects, `selfEffects` (on the caster),
  channel effects, three upgrade tiers (value deltas, cooldown, charges, range, extra effects and self effects), `hook`. AP costs and unlock rules live in
  `src/sim/data/abilities.ts`.
- **Items**: id (kebab-case), category (talon, plumage, song), tier 1–4, cost, component, passive `ModifierSet`,
  `procs` (`TriggerDef[]`), optional active (cooldown, targeting, range, effects, `whileSilenced`).
- **Statuses**: inline `StatusDef`s; shared ones exported from `src/sim/data/combat.ts`.
- **Map**: `MapData` from `loadMap(id)`; every GDD §6.3 object has a field (spawns and the Home Roost zone, shops,
  structures, lanes, Updrafts with stations, climbs, ledges, Thickets with tiers, Nests, rune spots, Egg perches, the
  Hollow, nav graph with link kinds, bot spots). Stage 4 adds optional buildings, rooms, openings, jungle zones,
  interactables and springs (§14.3).
- **Learned builds**: `BuildData` (contracts/items.ts) in `src/sim/data/builds.ts`: per-hero `ItemScores` and
  `RecommendedBuild` (§14.1).

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

**Historical Stage 2 practice route** (D-ARCH-013, replaced by §12.1). Menu → Play (`AppActions.play`) → hero select → `AppActions.startMatch(setup)`.
Hero select lists all 24 heroes from `HEROES` (src/sim/heroes/registry.ts) and lets the player pick only those whose
module has `implemented: true`. `app/router.ts matchConfig(setup)` builds the sim config: 'main', fledgling waves on
all three lanes, the human on `setup.team` ('dawn' for practice) with the chosen hero, and `setup.bots` bot heroes
(default 0; a later wave turns them on). `?scene=lane&hero=<id>` starts the same practice match without clicking.

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
| Knockback, pull, knock-up, dashes, teleports, movement modes (glide, flight …), attach, wall slams; also on units | physics |
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
| App states, fixed-step loop, interpolation, settings store, `?scene=` router, the practice match config | client/app (Architect) |
| Which heroes hero select offers (`HeroModule.implemented`) | Hero Engineer A / B |
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

## 11. Wave 2 requests

Every interface request from the wave 2 Log entries, decided in the W2.5 contract round (18/11/2026). All changes are
additive and optional, so wave 2 code compiles unchanged. What each owner must now implement is in
[briefs/W3-contract-followups.md](briefs/W3-contract-followups.md). A = accepted, M = accepted modified, R = rejected.

| # | From | Request | Decision | Landed as / why |
|---|---|---|---|---|
| 1 | QA | `projectile.impact` must say what fired the shot (pods ignore abilities) | A | `ProjectileImpactEvent.via?: EffectVia`; absent means 'weapon' until Combat sets it |
| 2 | QA | Say how `DamageBonus.mult` combines | A | TSDoc: adds (mult − 1) to the step-4 outgoing bonus, applied once (what Combat does; D-QA-004) |
| 3 | QA | Document `DamageAppliedEvent.pos` | A | TSDoc: hit point for gun and melee hits, else the effect's `target.point` |
| 4 | QA | Tell bots to write a fresh `PlayerCommand` object every tick | M | Fixed in core instead: freshness no longer depends on identity, so bots may reuse one object (D-ARCH-011) |
| 5 | QA (review) | `EntityDiedEvent.assisters` TSDoc omits heal/shield/buff assists | A | TSDoc matches GDD §8.3 and D-COMBAT-007 |
| 6 | Rendering | The menu should run 'main', not 'arena' | A | Already landed by the integration round (215c122) |
| 7 | Combat | `WeaponDef.projectileRadius` (Echo Lute 0.25 m) | A | Optional; default stays combat data's 0.06 m |
| 8 | Combat | Gun spin-up (Woodpecker 6 → 14 shots/s over 1.5 s) | A | `WeaponDef.spinUp: { fromRate, seconds }` |
| 9 | Combat | Per-round reload start delay (Albatross 0.3 s) | A | `WeaponDef.perRoundStartS`; default stays combat data's |
| 10 | Combat | `DamageEffect.beakShotMult` (Moonlit Mark ×1.5) | A | Optional; default `COMBAT.abilityBeakShotMult` |
| 11 | Combat | A shot count on `WeaponModEffect` (Heavy Rounds) | A | `shots?: Magnitude`, so Heavy Rounds T1 "+2 rounds" is a value; `durationS` stays the cap |
| 12 | Combat | TSDoc: decoys can be beak-shot | A | `UnitInfo.height` TSDoc (GDD §5.4, D-COMBAT-003) |
| 13 | Combat | TSDoc: unstoppable blocks crowd control only | A | `StatusDef.negative` TSDoc (D-COMBAT-004) |
| 14 | Combat | INTERFACES §3: combat writes `pos` at respawn | A | §3 and `EntityBase.pos` TSDoc (D-COMBAT-002) |
| 15 | Ability Systems | A first-class way to target the caster from any cast | A | `AbilityDef.selfEffects` and `AbilityUpgrade.selfEffects`; replaces `onCaster` |
| 16 | Ability Systems | Magnitudes for `targetHpBelow`, `missingHpPct`, `executeBelow` | M | Staged (D-ARCH-015): Combat resolves them with `ctx.effects.magnitude` in W3, the W3.5 round widens the type. Widening now breaks Combat's compile |
| 17 | Ability Systems | Summon end effects (death or expiry bursts) | A | `SummonEffect.onEnd` (also on replacement past `maxCount`) |
| 18 | Ability Systems | A direction spread for several summons | M | `SummonEffect.count?: Magnitude` + `spreadDeg` rather than a per-effect offset: a tier adds a decoy with a value (Echo Double T2: count 1 → 2, spread 30°) |
| 19 | Ability Systems, Controller | A wall's size on `UnitInfo` | A | `UnitInfo.size`; combat's hitbox for walls. No physics collider: Gale Shield blocks shots, not movement |
| 20 | Ability Systems | A tether event or view entry for the client | M | A `tether` event (start, end). A view entry would need a public component for state only abilities holds |
| 21 | Ability Systems, Controller | `DisplaceEffect.onWall` / a wall-slam hook | A | `DisplaceEffect.onWall`, plus the `wallSlam` movement action for the client |
| 22 | Ability Systems, Controller | Expose a movement mode's `allowGun`/`allowAbilities` | A | `Motor.modeAllowsGun`, `Motor.modeAllowsAbilities` (optional, absent = allowed); not conditions (D-ARCH-016) |
| 23 | Ability Systems | Dash and teleport mover and destination per D-ABIL-001 | M | The TSDoc states D-CTRL-004, which physics implements; it agrees with D-ABIL-001 for every cast |
| 24 | Ability Systems | Merge `AREA_TICK_S` with combat's 0.5 s tick | A | `EFFECT_TICK_SECONDS` in src/sim/data/core.ts; both systems import it |
| 25 | Controller | Displacement and dashes on units (physics may not write unit `pos`) | M | Physics moves units under displace, dash and attach, roots them meanwhile (`'physics:displaced'`); world and abilities skip rooted or stunned units (D-ARCH-014) |
| 26 | Controller | A `movement` action 'displaced' (displacement cancels channels) | A | `displaced` action; abilities ends the hero's channel on it |
| 27 | Controller | Teleport `face: 'target'` is undone when core re-latches yaw | A | `MovementEvent.yaw` with a `teleport` action; the app adopts it for the human (done), ai for bots |
| 28 | Controller | ARCHITECTURE §4.6 "one world.step() per tick" contradicts D-CTRL-001 | A | ARCHITECTURE §4.6 now states D-CTRL-001 |

Counts: 28 decisions (rows 19, 21 and 22 each merge the same request from two roles): 22 accepted, 6 accepted
modified, none rejected. Every request named a real gap, and each fitted as an optional field or a TSDoc change.

Also landed in this round, from QA's review of wave 1 (no request needed): commands are sanitised (NaN or
out-of-range look and axes, bad upgrade slots, pings at non-finite points) and latched without per-tick allocation
(D-ARCH-011); seeds use all 53 bits (D-ARCH-012); the spatial hash reuses its arrays; the store rebuilds only the
changed kind's list; telemetry counts beak shots among gun hits on heroes only, so beak-shot % is a true ratio.

## 12. Wave 3 requests and the M2 contract freeze (19/11/2026)

The W3 integration log establishes what shipped. Each numbered row records a W3 request or gate follow-up. A means accepted, M means accepted with a different implementation, S means satisfied on the baseline. Owner handoffs and verification routes are in [W4 contract follow-ups](briefs/W4-contract-followups.md).

| # | Producer → consumer | Request and disposition |
|---|---|---|
| 1 | Hero data → UI/Art | A. Use `heroSwatch(id)` from the registry, reading kit colour or the four existing model colours. |
| 2 | App → Input | S. Local respawn look adopted in 7bd3ace. Keep teleport yaw and verify after death. |
| 3 | Input/App → core and UI | M. 7bd3ace wired ground taps. App now resolves contextual visible entities, ground and max range. Map/wheel use the same normal ping command. |
| 4 | Core → Camera/Input | A. Aiming flag and effective HeroView.aimZoom, including Owl. |
| 5 | Camera/Render → player | M. Renderer already receives CameraPose with each frame. Measure distance to the interpolated local hero for sub-metre fade. |
| 6 | Abilities → core → VFX | A. AreaInfo.dimensions contains exact numeric collision geometry; owner/ability are projected with it. |
| 7 | Economy → core → VFX | A. EntityView.expiresAt copies the actual pickup expiry, including after fast-forward. |
| 8 | Combat → core → VFX | A. EntityView.projectile copies owner, source, ability and expiry. |
| 9 | Combat → core → VFX | A. EntityView.statuses for units, plus the existing hero status list. |
| 10 | Combat → VFX/audio | A. Gun event carries hitscan. New weapon.traces carries the real endpoint of each instantaneous pellet including misses. |
| 11 | Kit data → Physics | A. DashEffect.maxPitchUpDeg expresses Plunge's upward cap and flat aim dashes. |
| 12 | Combat → Economy | S. Real pod radius 0.25 m and camera convergence landed b24bce7, always-on pod suite. |
| 13 | Abilities → Physics/Hero A | S. Target equal to caster resolves to cast point; Tempest Dive fallback removed in 5bbeac2. |
| 14 | Hero A → Physics | S. Pitched aim dashes, and Wing Slam/Spear Bill flat arcs, already merged. Row 11 supplies author control. |
| 15 | Physics → Hero A | S. Displacement now stops after 6 m, verified in controller tests and updated Shrike assertion. |
| 16 | Hero A → Abilities | S. Gale Shield hook updates position/yaw and zones.endSummon reads current facing. Wall/end, pin and vanish duplicate fallbacks removed in 5bbeac2. |
| 17 | Combat → Art/UI | M. Timed charge, light, heavy and parry poses plus Meleeing flag. A single bit could not distinguish heavy preparation from impact. |
| 18 | World → Rendering/Art | A. Existing team/Invisible and world visibility bits distinguish hidden enemies and allied ghosts. |
| 19 | World/core → Art/Rendering | A. Structure model and phase/ward/weak-point snapshot, standard model dispatch for other kinds. |
| 20 | Settings/Input → UI | S. d522c02 applied all saved controls and swapped conflicts. New shared binding route and safe default migration below. |
| 21 | UI → settings | A. UI can expose aim sensitivity, invert Y and crouch toggle through existing Settings. |
| 22 | Combat/kit → World | A. trueSightRadius stat in metres; set strongest radius with op max alongside the condition. |
| 23 | World → UI/AI/Render | A. World writes extra mapOnlySeenBy bits. Core projects mapSeenBy as the union. Use canSeeOnMap for map, canSee for world. |
| 24 | Physics → World | M. Optional caller-owned out argument to existing moveCharacter. Return the same result/position when supplied. |
| 25 | Rendering/VFX → each other | A. Public app/palette, app/render-host, app/drawn. Both ends migrate together; no render ↔ vfx imports. |
| 26 | Input/UI → settings | A. Public app/bindings owns default codes and conflict swap; options and input share it. |
| 27 | App/registry → client | A. app/loop exposes entityById/interpolate, sim/heroes/registry exposes immutable kit definitions, app/settings imports shared bindings. World may read immutable movement constants for unit motion. |
| 28 | Input → app and UI | A. Single pause edge per intentional press/lost lock, including shop and inspect return. Baseline 100 ms dedupe needs browser verification. |
| 29 | Rendering/UI/Abilities/Economy/Input → QA | A. Baseline lint counts 57/24/34/2/1. Move coefficients to owner constants; classify ability fixtures as test data. No global suppression. |
| 30 | Economy/QA → player | A. Verify manual pod secure/deny with 0.25 m pods, 1.4 s ripe window and a real loaded lane. |
| 31 | World/Physics/Combat → QA | A. Profile warm spawn spikes separately (W3 worst 5.9 ms, mean 0.234 ms); serial elapsed-time checks already landed D-EP-022. |
| 32 | Hero A → QA | A. Runtime Echo Double T2/T3 and Gale Shield blocking should use actual casts after merge. |
| 33 | QA → EP | A. Browser proof for measured dash displacement, menu pick/lane and Updraft. |
| 34 | Rendering/Build/QA → EP | A. Reproducible representative draw-call ceiling and worst-tick recording with warmup separated, see W3 gate scenarios. |
| 35 | QA → Objectives/Economy | A. Gated structures, levels/AP and shop suites before implementation, always-on at integration. |
| 36 | EP → player | S. Stage 2 PLAYABLE.md and status handoff landed before baseline 6df745e. Revise both for Stage 3 at gate. |
| 37 | Combat → Abilities/Hero A | S. Combat already calls magnitude on targetHpBelow, missingHpPct and executeBelow; frozen declarations now accept Magnitude (D-ARCH-015). |
| 38 | Core/Input → UI/audio | A. Menu/pause/end and live settings continue through app. Actual synth, reset and user-gesture evidence land with Audio. |

38 grouped dispositions: 25 accepted, 4 modified, 9 satisfied, 0 rejected. W3's superseded pod-suite helper and duplicate swaps were fixed in e9617a8 and d522c02. Unimplemented later-stage LODs, hitstop, post-processing and the remainder of the roster stay on the existing milestone plan.

### 12.1 Play, Practice Hub and UI commands

Play and `?scene=lane` run one chosen Dawn hero on main, three-lane waves, structures on, neutral objectives off and the normal level-6 ultimate. Sandbox remains free-cast on the arena. Standard headless main matches may spawn both bases; isolated wave fixtures opt in to structures. World reads resolved structures, spawns anchors on match.started, and emits match.ended exactly once on phase-two death. Combat emits patron.depleted on phase-one lethal damage and keeps the entity alive. World gates the transition immediately, restores the phase-two health bar via Combat and publishes the weak-point sphere.

UI calls actions.play('practice') for the Hub and actions.startMatch after selecting a hero. The app builds two stationary hero targets with controller dummy, one wounded ally and one full-health enemy. HeroInfo.training identifies each target's reset position and health. Combat resets targets after use; ordinary guns, melee, allied healing, ability targeting and HP snapshots work through the same systems. Practice starts with four available slots and 32 AP. Quitting discards the entire session.

Shop, upgrade inspect and ping-wheel activations release pointer capture while simulation continues. UI submits buy/sell/upgrade/ping through actions.submit; the app consumes one per tick in order. Escape closes the active panel. UI can call actions.capturePointer(false) after its own close button. Input distinguishes a tap of upgradeModifier (inspect) from a modifier chord (upgrade only). AbilityDef and AbilityUpgrade already carry descriptions; HeroView slots publish nextUpgradeCost, null at maximum. ScreenContext includes catalogue, mode and seed. Map pings and world damage labels use actions.project with the actual displayed camera. Audio and VFX get reset on session change.

Human commands may carry the finite, copied centre ray of the displayed player camera. Combat and Ability Systems call heroAimRay so interpolation, shoulder blend, crouch and pull-in agree with the last frame; bots/headless retain deterministic rig reconstruction. Hits originate at the physical muzzle with ordinary cover/occlusion. See [W4 contract follow-ups](briefs/W4-contract-followups.md) for the regression cases.

## 13. Wave 4 requests (W4.5, 19/11/2026)

Every "Interface requests" item in the W4 STATUS entries, plus the W3 carry-overs the W4.5 brief names. A = accepted,
M = accepted with a different shape, S = already satisfied by landed work (named), R = rejected. Landed contract
changes are additive and optional; what each owner implements is in
[briefs/W5-contract-followups.md](briefs/W5-contract-followups.md).

| # | From | Request | Decision | Landed as / why |
|---|---|---|---|---|
| 1 | EP, Gate fixes | Node and Edge hash the siege replay differently from tick 3 | A | Root cause: engine `Math` transcendental functions. `core/dmath.ts`, every sim call switched, `e2e/determinism.spec.ts` compares per-tick hashes (D-ARCH-021) |
| 2 | Technical Artist (animation) | `EntityView.castSlot` from `AbilityState.casting` | A | `EntityView.castSlot`, filled by core while casting or channelling |
| 3 | Audio | Occlusion data: a line-of-sight flag per entity or a ray query on the view | M | No per-entity flag or client ray: the client has no physics, and GDD §6.11's rule is per interior volume. Audio compares the listener's and the source's `MapData.rooms` (−6 dB and a 2 kHz low-pass across volumes) and treats enemy heroes outside `seenBy` as occluded |
| 4 | Audio | A hero-select hook on `AudioOut` | A | `AudioOut.onScreen?(screen)` on every screen change and `AudioOut.previewHero?(hero)`, routed from the new `AppActions.previewHero?(hero)`; the app already calls both |
| 5 | Audio | A mute setting | A | `Settings.mute` (top level, so the three volume sliders keep their shape); sanitised, default false |
| 6 | Hero B | A rooted hero can't cast Scatter, which removes roots | S | D-ABIL-012: a cast whose own effects cleanse the root is allowed |
| 7 | Hero B | End a movement mode on landing or an event; an `endMode` service | M | Data, not a service: `MovementModeEffect.endOn?: ('land' \| 'jump')[]`. Without it, physics keeps its per-mode rule (glide, D-CTRL-009) |
| 8 | Hero B, Hero A | Combat honours `weaponMod.gunDamage`, `reloadFraction` | S | Landed on w4/movement (D-COMBAT-009) |
| 9 | Hero B | `applyStatus` with duration 0 still applies one tick | A | TSDoc: a resolved duration ≤ 0 applies nothing; Combat implements |
| 10 | Hero A | Abilities: `extraCount`, `preferHeroes`, `maxCarry`, `onWall`, one `onEnter` per entry | S | D-ABIL-010, D-ABIL-011 |
| 11 | Hero A | Physics: end a toboggan on Jump; honour `maxPitchUpDeg` | S | w4/movement |
| 12 | Economy | World spawns structures; Combat's `closeGunDamage`, once-per-volley `beakShotFlat`, clamps after a sale | S | Objectives W4 and w4/movement |
| 13 | Objectives | Draw calls of placeholder structures; a ride modifier for the siege Updraft test | S | D-ART-003 (lane/low 17 calls); INTEG-SIM's invulnerable rider |
| 14 | Movement | App: `defaultBindings()` defaults, v2→v3 migration, `exitFullscreen` on menus; UI capture of mouseup/auxclick; VFX traces; Penguin hook; QA crouch key | S | INTEG-WEB items 1, 2 and 4; INTEG-SIM item 4 |
| 15 | QA (M1 preview) | Test hook `flags`, `tick`, `meleePose`, `lastMelee`, `lastParry`; `weapon.traces` | S | `window.__perch.hero` (app.ts); §12 row 10 |
| 16 | Browser QA | Accessible names for the upgrade dialog, abilities and dummy HP bars | S | UI W4; D-EP-038 moves them to the HUD icons in wave 5 |
| 17 | Game Director (W4) | Default migration, dash timing and stamina, practice setup, inspect inputs | S | W4 implementation and INTEG-WEB |
| 18 | QA gate | A read-only `window.__perch.state` | S | D-ARCH-020 |
| 19 | Docs & Wiki | Regenerate the wiki at each gate | S | An EP process (D-EP-031); no contract |
| 20 | Objectives (W3, named in the brief) | A true-sight radius | S | §12 row 22: `trueSightRadius` stat, per holder (Objectives W4) |
| 21 | Objectives (W3, named) | A minimap-only visibility bit | S | §12 row 23: `mapOnlySeenBy`, `EntityView.mapSeenBy` |
| 22 | Objectives (W3, named) | An out-parameter `moveCharacter` | S | §12 row 24, landed on w4/movement |
| 23 | VFX (W3, named) | View fields for areas, pickups, projectiles, unit statuses | S | §12 rows 6–9 |
| 24 | Production (W3.5) | Confirm item effect coverage and UI command routing | S | W3.5 round, §12.1 |

Counts: 24 rows; 6 accepted, 2 modified, 16 satisfied, none rejected.

## 14. Stage 4 contracts (W4.5)

All optional and additive: today's code compiles unchanged and today's map loads. Field-level TSDoc is the source of
truth; this section says who does what. Reconciled with the Director's W4.5 GDD (§§6.5–6.12, §§7.8–7.15) and D-EP-039.

### 14.1 Bots and learned builds (D-EP-036, D-EP-037)

- **Command path (confirmed, unchanged).** Bots write `HeroEntity.command` in the `ai` phase; core latches and
  sanitises it exactly like the human's. Purchases are `command.buy` / `command.sell` (validated by Items at
  execution), upgrades `command.upgrade`, movement and aim the ordinary axes, look and buttons. No sim shortcuts
  (GDD §11.1). A bot mounts an Updraft by holding Jump while `motor.updraftInReach` is set (D-EP-039).
- **Scores.** `ItemScores` per hero: `base`, sparse pairwise `synergy[owned][candidate]` (owning a component counts,
  so upgrade chains score through it) and `phase[item] = [early, mid, late]`. Score = base + Σ synergy + phase
  offset; sim/ai samples softmax(score / temperature) over affordable, buyable items from the stream
  `'ai/<heroId>/shop'`, so shopping never shifts another stream. Temperature comes from the difficulty (data/ai).
- **Builds.** `RecommendedBuild`: early, mid and late cores in buying order plus situational picks with a short
  reason (and a `condition` id bots evaluate). `BuildData` = { round, matches, phases { midFromS 600, lateFromS
  1320 }, scores, builds }, exported as `BUILDS` from `src/sim/data/builds.ts`. Round 0 is GDD §11.4's designer
  prior (scores from the §11.5 list order, component synergy and the §11.8 archetype cores; builds = the §11.8 rows),
  so bots, the shop's Recommended strip and the wiki work before the Build Lab. Readers: sim/ai, the Magpie's Hoard
  (client/ui may import `src/sim/data/builds.ts`, ARCHITECTURE §5) and tools/wiki.
- **Build Lab.** `SimOptions.botShopping` per flock: replacement `scores`, a `temperature`, or `random` buying, so one
  seeded match plays round N against round N−1 or against random (D-EP-037's held-out test). Outcomes come from
  `sim.telemetry()` (`itemsBought` has each purchase's second). Headless results equal the browser's (D-ARCH-021).

### 14.2 Objectives (GDD §§7.8–7.15)

| Piece | Components | Events | View |
|---|---|---|---|
| Thickets | Units of type beetle, weasel, rat, toad, badger, cub; `UnitInfo.camp`, `asleep` (dormant); `ObjectiveState.campAt` | `objective` campSpawned / campCleared (`camp`); `unit.attack` telegraphs; `unit.state` awake / asleep | `EntityView.camp`, `ViewFlag.Asleep` |
| Nests | Structure `'nest'`, `variant` twig / woven / keepsake, `anchor`, `breakable.by` (woven: heavyMelee), `solid: false` for twig and keepsake; `ObjectiveState.nestAt` | `entity.died` (victimType 'nest'); drops are pickups | `EntityView.variant` |
| Drops | Pickups `sprig` (value), `crumb` (variant), `keepsake`; collected by walking within 1.5 m | crumbs are statuses | type, variant |
| Keepsakes | `HeroEntity.keepsakes` { count, totals }, stat source `'world:keepsakes'` | `objective` keepsakeGained (`value`, `variant`) | `HeroView.keepsakes` |
| Bell Feeders | Structure `'nest'` with variant `'feeder'`, `breakable` { by: 'melee', light: 60, heavy: 120 }, `lit`; `MapData.interactables` kind 'feeder' (`camp` for the Granary hybrid); `ObjectiveState.interactableAt` | swing-back is world damage; `entity.died`; keepsakeGained | `ViewFlag.Lit` |
| Feather runes | Pickup `rune`, `melee: 'heavy'`; `ObjectiveState.runeAt` per spot | `objective` runeSpawned / runeTaken (`variant`) | type, variant |
| Golden Egg | Pickup `egg`, `melee: 'any'`, `claimableAt` (lowering; 1 s after a drop); `ObjectiveState.egg` { pickup, perch, rollsAt, coolsAt, value }. The carrier's own Melee sets it down; entering the Stone delivers it | `objective` eggSpawned / eggTaken / eggDropped / eggRolling / eggSpoiled / eggDelivered (`value`; economy hatches the golden pods) | `ViewFlag.Carried`, `EggCarrier` |
| Roc | Unit `roc`, `asleep`, `enraged`; `ObjectiveState.rocAt` | `objective` rocSpawned; `unit.attack` rake / flap / shriek; `unit.state` enraged | `ViewFlag.Asleep`, `Enraged` |
| Embers and Rekindle | Three pickups `ember`, `melee: 'heavy'`, `claimableAt`; `TeamState.rekindle` { until, charges } | `objective` emberDropped / emberClaimed; `entity.died.revives`; `hero.respawned.revived` | `TeamView.rekindle` |
| Berries | Pickup `berry`, eaten within 1.2 m; anchors in `MapData.interactables` | `objective` berryEaten | type |
| Hides, Lookouts, ivy, Cellar Run, Springs | `Room.tag` 'hide' / 'tunnel', interactable 'lookout', `Opening.curtain` plus a `blocks: 'sight'` prim, `MapData.springs` | none new (hidden and lookout are statuses) | statuses |

Writers: sim/world for all of the above except Seeds and their pickups (economy: pods, the Egg's golden pods and Nest
seed sprigs, plus every Seed payout from camps, Feeders, the Roc and Embers) and the revive itself (combat sets
`entity.died.revives` and revives; world spends the charge on that event). Combat honours `breakable`, drops damage
from heroes outside a unit's `damageFrom` (the Roc's Hollow, a dormant camp's 35 m) and includes `melee` pickups in
its melee hit test (they take no damage). Physics builds no collider for a structure with `solid: false`. A Bell Feeder is a `'nest'` variant so the tower tables keyed on
`Exclude<StructureType, 'nest'>` stay valid (D-ARCH-023).

### 14.3 The detailed map (D-EP-033, GDD §§6.5–6.12)

New optional `MapData` fields: `buildings` (id, archetype, footprint, storeys, roof, zone), `rooms` (one interior
volume per storey, cellar or tunnel; `tag` hide or tunnel), `openings` (door, shot window, leap window, hatch,
skylight, arch, balcony, grate; the two rooms it joins; `passable`, `curtain`, `blocksEggCarrier`), `jungle` (zone
outlines and paths), `interactables` (berry, feeder, lookout), `springs` (pad, radius, landing, apex). Also:
`PrimBase.blocks` ('movement' for shot-window fillers, 'sight' for ivy), ladders as `Climb.kind 'ladder'` with vine
nav links, `NestAnchor.variant`/`building`/`storey`, `ThicketAnchor.family`/`building`/`storey`,
`ShopAnchor.neutral` (the Magpie Den), `NavLink.spring` (GDD §6.7's spring link, as a field so `NavLinkKind` stays
closed) and `NavGraph.nodeRoom`. Geometry stays in `prims`; these records say what it means. Stairs are ramp prims
and walk links; no stair record is needed.

### 14.4 No Interact key (D-EP-039, D-ARCH-022)

- `Button.Interact` and the `'interact'` binding are **deprecated, not deleted**: Physics, Input, the UI labels and two
  tests still read them, and deleting now breaks the build. `RETIRED_BIND_ACTIONS` (app/bindings) lists `'interact'`
  so Input maps no key to it and Options hides it in wave 5. The W5.5 round deletes the bit, the action and its
  default. Bit 0x20000 is never reused.
- **Updrafts:** `PhysicsService.updraftInReach(pos)` (optional until Physics lands it) gives the nearest cable point
  in reach anywhere along the cable; physics writes `Motor.updraftInReach` each tick and mounts on held Jump;
  `HeroView.updraftInReach` drives the HUD prompt.
- **Updraft latch and dismount (GDD §3.7):** no new input. Physics reads `held & Button.Jump` for the 0.2 s latch and
  a fresh `pressed` Jump (released since latching) to jump off; Crouch drops off. Hold time, reach and lockouts are
  physics data.
- **Egg, runes, Embers:** `PickupInfo.melee` ('any' for the Egg, 'heavy' for runes and Embers); combat reports the
  pickup as `melee.target`; world claims it. The carrier's own Melee sets the Egg down 1 m ahead; delivery happens
  the moment the carrier enters the Stone's circle.
- **Saved settings:** until W5.5 a saved `interact` code is kept but inert. Once `'interact'` leaves `BindAction`,
  `sanitizeSettings` keeps only known actions, so the saved code is dropped on the next load and every other binding
  is untouched; no storage-key bump. `app.test.ts` covers the drop.

### 14.5 The Director's W4.5 requests (GDD §§3, 6, 7, 10)

| # | Request | Decision | Landed as |
|---|---|---|---|
| 1 | Map schema: storeys, openings (door, shot window, leap window), ladders, hatches, interior volume ids, ivy curtains, Hides, Lookouts, Bough Springs with an arc, Berries, Bell Feeders, Magpie Dens, the Cellar Run speed volume | A | §14.3: `Storey`, `Opening` kinds and `curtain`, `Climb.kind 'ladder'`, `Room` (+ `tag` hide / tunnel), `NavGraph.nodeRoom`, `InteractableAnchor` (berry, feeder, lookout), `Spring` (pad, landing, apex), `ShopAnchor.neutral` |
| 2 | A `spring` nav link | M | `NavLink.spring` on a 'walk' link: a new `NavLinkKind` would break the exhaustive tables keyed on it |
| 3 | Pickups for seed sprigs, crumbs and keepsakes | A | `PickupType` 'sprig', 'crumb', 'keepsake' (and 'berry') |
| 4 | Keepsake stats as one source per type | A | World sets one source, `'world:keepsakes'`, holding one summed modifier per stat (= per keepsake type), so each type stacks once in §5.3 and the CDR stack; `HeroEntity.keepsakes.totals` |
| 5 | `statMod` stats `meleeDamage` and `meleeDamageTaken` | M | `meleeDamage` already exists (light melee damage): "+x% melee damage" is op 'pct' on it. New stat `meleeDamageTaken` (bonus, step 5). Every `sim.hash()` moves once because stat blocks hash all stats (D-ARCH-024) |
| 6 | `damage` by % of current HP | A | `DamageEffect.currentHpPct`; also `maxHpPct` (Rookery Dirge) and `triggerPct` (Burr Coat's 15% return) |
| 7 | A cast-granted trigger on the next N gun hits | A | `TriggerDef.uses` with the `trigger` effect's duration (Warbler's Trill 1 in 5 s, Skylark Cadence 3 in 6 s); also `via` and `withinM` filters |
| 8 | Ally `unit` targeting with a self fallback | A | `selfFallback` on AbilityDef and ItemActive; `ItemActive.affects` (Rescue Call, Stoop Dive) |
| 9 | The hidden state | A | Condition `'hidden'`: world sets it and folds it into `seenBy` (§7.15) |
| 10 | Remove the Interact command; a held-Jump latch input | M | Interact deprecated now, deleted in W5.5 (§14.4); the latch needs no new input: `held`/`pressed` Jump already carry it |
| 11 | (from §10, not listed) item auras | A | `ItemDef.aura` (Nestmother's Mantle, Rookery Dirge) |
