# W5 contract follow-ups · 19/11/2026

From the W4.5 contract round (Technical Architect). Read INTERFACES §13 (wave 4 dispositions) and §14 (Stage 4
contracts), and D-ARCH-021 to D-ARCH-024. Field names refer to `src/sim/core/contracts` or `src/client/app/contracts.ts`;
their TSDoc is the rule. Everything new is optional, so each owner can land their side in any order. GDD sections are
the Director's W4.5 text on `integrate/w5`. Waves: **W5** unless marked **W6**.

## Everyone in `src/sim`

- Never call `Math.sin`, `cos`, `tan`, `atan2`, `asin`, `acos`, `hypot`, `exp`, `log`, `pow` or `**` (except `x ** 2`)
  in the sim. Use `import * as dmath from '<…>/core/dmath'`. `src/sim/core/dmath.test.ts` fails on a banned call.
  Need `exp`, `log` or `pow`? Ask the Architect to port it into dmath first (D-ARCH-021).
- Results must match between Node and the browser: `e2e/determinism.spec.ts` compares every tick.

## Character Controller (sim/physics, data/movement)

- **No Interact (§3.7, D-EP-039).** Implement `PhysicsService.updraftInReach(pos)`: nearest cable point with the feet
  within 2.5 m horizontally of the cable's ground line and the cable 0.5–14 m above them (1.5 m when airborne).
  Write `Motor.updraftInReach` every tick (null while riding). Latch on Jump held for 0.2 s: from the ground a normal
  jump then a 30 m/s pull-up; in the air attach in 0.15 s; a tap never latches. Lockouts: 3 s after enemy-hero
  damage, 1 s after leaving. Direction: toward the end the camera faces. Dismount on a fresh Jump press (released
  since latching): +4 m/s up and 70 % of ride velocity; Crouch drops with 70 %. Casting dismounts. Stop reading
  `Button.Interact` (`tryUpdraft`, controller tests).
- Ladders: `Climb.kind 'ladder'` behaves as a Vine (move into it holding forward; Jump dismounts).
- `PrimBase.blocks`: 'movement' prims block heroes and units only (shot-window fillers); 'sight' prims (ivy) are left
  out of movement and shot queries and given to vision through a layer or mask world can query. Absent = as today.
- `StructureInfo.solid === false`: build no collider (Twig and Keepsake Nests).
- `Opening.blocksEggCarrier`: stop the Egg carrier at those openings (the Cellar Run stair heads). `Room.tag 'tunnel'`:
  +30 % run speed inside (sprint, dashes, slides unchanged).
- Bough Springs (`MapData.springs`, §7.15): stepping onto the pad launches along the authored arc to `land` (apex
  `apexY`), at most once per hero per 1.0 s; 30 % air control after the apex; enemy-hero damage in the first 0.6 s
  clips it (vertical speed 0, 30 % slow 1.5 s); not while grounded or carrying the Egg.
- `MovementModeEffect.endOn` ('land', 'jump'); keep glide's own rule when absent. Kite Lift uses it.

## Camera & Input (client/input)

- Skip every action in `RETIRED_BIND_ACTIONS` (app/bindings) when mapping keys, so E sends nothing; drop the
  `KeyE → Button.Interact` row from `input.test.ts`. Never set `Button.Interact`.
- Holding Jump is already in `held`; the latch needs nothing new from input.

## Combat (sim/combat, data/combat)

- Melee hit test: include pickups with `PickupInfo.melee` as spheres of their `radius` ('any': light or heavy;
  'heavy': heavy only), report the pickup as `melee.target`, apply no damage, and don't stop the swing reaching a
  hero behind it.
- `StructureInfo.breakable`: drop damage `by` excludes ('melee', 'heavyMelee'); a melee hit deals `light`/`heavy`
  when set (Bell Feeders 60 / 120 whatever the hero's stats).
- `UnitInfo.damageFrom`: drop damage whose credited hero stands outside the region (the Roc's Hollow, dormant camps).
- Stats: `meleeDamageTaken` in step 5 for light and heavy melee; items give "+x % melee damage" as 'pct' on
  `meleeDamage`.
- `DamageEffect.currentHpPct`, `maxHpPct`, `triggerPct` (the triggering hit's amount before the holder's resists).
- `applyStatus` with a resolved duration ≤ 0 applies nothing.
- Rekindle (§7.12): when a hero dies while `TeamState.rekindle` has a charge, `until` is ahead and the hero hasn't
  revived under this buff, set `entity.died.revives`, revive in place 3 s later at full HP, and emit
  `hero.respawned` with `revived: true`. World spends the charge on the death event.

## Ability Systems (sim/abilities)

- `AbilityDef.selfFallback` for ally `unit` casts.
- `point` placement clamps to the floor under the crosshair, never through a ceiling; cylinder areas default to 3 m
  tall so a ground area stays on its storey (§6.11).
- `unit` targeting skips enemies the caster's flock can't see (the `'hidden'` condition reaches you through `seenBy`).
- Casting on an Updraft dismounts first (with Physics, §3.7).

## Economy & Items (two engineers: sim/economy, sim/items, data/economy, data/items)

- **Items:** the 16 ★ items of GDD §10 (64 in all, 15 actives, a 4-active cap). New fields: `ItemActive.affects` and
  `selfFallback` (Stoop Dive, Rescue Call), `ItemDef.aura` (Nestmother's Mantle, Rookery Dirge: apply on buy and
  respawn through `ctx.effects`, end on sale or death), `TriggerDef.uses`, `via` and `withinM` (Warbler's Trill,
  Skylark Cadence, Burr Coat), `DamageEffect.currentHpPct`/`maxHpPct`/`triggerPct`, 'pct' `meleeDamage` and
  `meleeDamageTaken`.
- **Neutral shop:** a `ShopAnchor` with `neutral: true` (the Magpie Den) serves both flocks; `inventory.shopZone`
  as usual.
- **Seeds (economy):** Thicket payouts split between the killer and allies who hit the creature in the last 5 s
  (replaces last-hitting, §7.8); Nest seed sprigs as economy pickups (spawn on a Nest's `entity.died`, collected
  within 1.5 m by any hero); Bell Feeder seeds per hit and on the break (§7.14, from `damage.applied` and
  `entity.died`); the Egg's six golden pods from `objective` eggDelivered `value` with the courier split (§7.11); the
  Roc kill reward and Ember claim seeds (§7.12); no bounty and no kill for a death with `revives`.

## Objectives (sim/world, data/world)

- Thickets (§7.8): families from `ThicketAnchor.family`, units 'rat' and 'toad' new; `UnitInfo.camp`, `asleep`
  (dormant until a hero is within 30 m; no per-tick work while asleep), `damageFrom` (35 m while asleep); aggro,
  leash 18 m (indoor camps stop at their room's openings), respawn; `ObjectiveState.campAt`; `unit.attack` at each
  wind-up and `unit.state` awake / asleep; `objective` campSpawned / campCleared. Fledglings and creatures ignore
  each other.
- Nests (§7.9): structures 'nest' with `variant`, `anchor`, `breakable` (woven: heavyMelee), `solid: false` for twig
  and keepsake; break a twig or keepsake Nest when a hero passes through at ≥ 8.5 m/s; crumb and keepsake drops as
  pickups (economy drops the sprig); `ObjectiveState.nestAt`.
- Bell Feeders (§7.14): 'nest' with variant 'feeder' and `breakable` { by: 'melee', light: 60, heavy: 120 };
  swing-back damage, chime with `lit`, keepsakes on a lit break; the Granary hybrid camp (`InteractableAnchor.camp`);
  `ObjectiveState.interactableAt`.
- Feather runes (§7.10): pickups with `melee: 'heavy'`, claimed from the `melee` event; `ObjectiveState.runeAt`.
- Golden Egg (§7.11): `melee: 'any'`, `claimableAt` while lowering and 1 s after a drop; the carrier's own Melee sets
  it down 1 m ahead; drops on death, stun, displacement or an enemy hero's melee hit; rolling, cooling and
  auto-delivery on entering the Stone; `ObjectiveState.egg`; `objective` eggRolling / eggSpoiled / eggDelivered
  (`value`); keepsakes to the courier and escorts. Never read `Button.Interact`.
- The Roc, Embers and Rekindle (§7.12): `asleep` until 20:00, `damageFrom` the Hollow below y −2, `enraged`; three
  Ember pickups with `melee: 'heavy'` and `claimableAt`; `TeamState.rekindle` (grant on claims, spend one charge on
  each `entity.died` with `revives`, expiry).
- Keepsakes (§7.13): `HeroEntity.keepsakes`, the weighted draw with halving, caps, one stat source
  `'world:keepsakes'` with one summed modifier per stat; `objective` keepsakeGained.
- Berries (pickups within 1.2 m), Hides (`Room.tag 'hide'`: the `'hidden'` condition folded into `seenBy`, regen,
  reveal rules), Lookouts (60 m sight within 3 m), ivy curtains (`blocks: 'sight'` prims, ignored within 3 m).
- Budget: all Stage 4 objectives together ≤ 0.1 ms per tick (§6.12).

## Level Designer (sim/world/map)

- Rebuild Old Mossmarket to §6.5 and §6.8–6.12 with the new `MapData` fields: `buildings`, `rooms`, `openings`,
  `jungle`, `interactables`, `springs`; `NestAnchor.variant` (the 100 Nests), `ThicketAnchor.family`/`building`/
  `storey`, `ShopAnchor.neutral` for the two Magpie Dens, `Climb.kind 'ladder'`.
- Shot windows get a `blocks: 'movement'` filler prim; ivy curtains a `blocks: 'sight'` prim plus `Opening.curtain`.
- Nav (§6.7): every storey, cellar and roof; ladders are 'vine' links, hatches and skylights 'drop', leap windows
  'mantle', Bough Springs 'walk' links with `spring`; `nodeRoom` per node.
- `mapSvg` draws building outlines. Prim budget ≤ 3,000 solid (§6.12).

## Bot AI (sim/ai, data/ai)

- Create `src/sim/data/builds.ts` exporting `BUILDS: BuildData`, round 0 = the GDD §11.4 prior and §11.8 rows (ownership
  passes to Balance & Data in W6).
- Scored buying (§11.4): softmax(score / T) from stream `'ai/<heroId>/shop'`, T 1.0 / 0.5 / 0.2 by difficulty,
  components and the 4-active cap, selling the lowest-scoring item; honour `options.botShopping` per flock
  (`scores`, `temperature`, `random`). Situational `condition` ids live in data/ai.
- §11.7 in the detailed map: Updrafts by holding Jump while `motor.updraftInReach`; the Egg by melee and set down by
  Melee; claims by heavy melee; nav `nodeRoom` and spring links.

## UI/HUD (client/ui)

- Options: hide the actions in `RETIRED_BIND_ACTIONS` (Interact); add a Mute toggle for `Settings.mute`.
- Hero select: call `actions.previewHero?.(id)` when a card is focused or picked.
- HUD: the hold-Jump prompt from `HeroView.updraftInReach`; keepsake count beside the level with totals on hover
  (`HeroView.keepsakes`); Rekindle charges and time with the 30 s warning (`TeamView.rekindle`); Egg, camp, rune and
  Roc timers (`ObjectiveState`); the Recommended strip from `BUILDS.builds[hero]` (§12.6); the neutral Den shop.
- Minimap: building outlines and ▲/▼ for heroes above or below ground, from `MapData.rooms` (§6.11).
- **W5.5:** the Architect deletes `'interact'`; the label line in `ui/bindings.ts` goes in the same change.

## Audio (client/audio)

- Honour `Settings.mute`; `onScreen` (menu and hero-select music) and `previewHero` (the hero's call).
- Occlusion (INTERFACES §13 row 3): −6 dB and a 2 kHz low-pass when the listener and the source are in different
  `MapData.rooms` volumes, or the source is an enemy hero outside `seenBy`.
- Cues: `unit.attack` and `unit.state` (the Roc's roar and enrage), Bell Feeder rings (70 m; the Bell Tower 120 m), the
  Egg's spawn jingle, keepsakes, Berries.

## Rendering & VFX (client/render, client/vfx)

- Interiors to the §6.12 budget (merged static cells, 45 m interior culling, no new dynamic lights); ivy curtains.
- `ViewFlag.Lit` (Feeder lamp), `Asleep`/`Enraged` (Roc), `unit.attack` telegraphs (the badger's 0.6 s slam ring,
  toad puddles), the Egg's lowering and golden beam, falling Embers.

## Technical Artist (client/render/models, rigs)

- Play the per-slot cast pose from `EntityView.castSlot` (INTERFACES §13 row 2).
- Models within §6.12: rats, toads, the Roc's sleep and enrage poses, Nest variants and the Feeder (`EntityView.variant`),
  Berries and the sprig, crumb and keepsake pickups, instanced per kind and variant.

## Docs & Wiki (tools/wiki, wiki)

- Controls: no Interact key; how each object is used (GDD §3.1 table). New objectives, the 16 items and the
  recommended builds (`BUILDS`), keepsakes and the buildings.

## QA (tests, e2e)

- `e2e/play.spec.ts` mounts the Riverbank Updraft by holding Space, not E; `tests/rules/siege.test.ts` rides with Jump
  held instead of `Button.Interact`.
- Raise the `main.test.ts` prim ceiling from 1,500 to 3,000 with the W5 map (Director's request).
- Keep `e2e/determinism.spec.ts` (yours from now on); it uses `e2e/hash-trace.ts` from both sides. Consider a Firefox
  project for it before anyone relies on Firefox replays.
- Tests-first suites for §§7.8–7.15 and the §3.7 latch.

## Build & Tooling

- Optional: an ESLint `no-restricted-properties` rule for the banned `Math` functions under `src/sim` (the dmath test
  guards it today). If the parallel e2e gets flaky under load, add `determinism` to the serial project's pattern.

## Balance & Data (W6)

- The Build Lab (`tools/balance`): rounds of headless matches with `options.botShopping`, writing `BUILDS` (round,
  matches, scores, builds) to `src/sim/data/builds.ts`, which you own from W6; method and convergence in BALANCE.md.

## Technical Architect (W5.5)

- Done 20/11/2026: `Button.Interact` deleted (the binding, default and label went with UI's W5a work); saved codes drop
  on load; `PhysicsService.updraftInReach` and `Motor.updraftInReach` required. See the W5.5 section below.

---

## W5.5 · 20/11/2026 · from the wave 5a requests

From the W5.5 contract round (INTERFACES §15, D-ARCH-025 to D-ARCH-028). Everything new is optional unless marked,
so each side lands in any order. **W5** means the integration round may take it now, acting for the owner; **W6**
otherwise.

### Character Controller (sim/physics, data/movement)

- **W5:** `MovementModeEffect.endOn` may hold `'stun'`: end the mode on the tick the hero has the `'stunned'`
  condition, and run `onEnd` as for the other ends. Physics' own `Mode.endOn` type now follows the contract (a
  one-line type change made by the Architect; the rule is still to write).
- **W5:** a 'target' dash reads `target.surface` instead of `cause.values[SURFACE_VALUE]`, and an 'aim' dash reads
  `DashEffect.steerDeg` (`effects.magnitude`) instead of `STEER_VALUE`; delete both value-name constants once the hero
  data has moved (below).
- **W6:** point `PHYSICS_LAYERS` at `Layer.Sight`, `Layer.Movement` and `Layer.EggCarrier` (or replace it); the test
  in `src/sim/index.test.ts` pins them equal until then.
- `updraftInReach` is now required on `PhysicsService` and `Motor`. Any new fake physics returns `null`; any new hero
  literal sets `updraftInReach: null`.

### Ability Systems (sim/abilities)

- **W5:** 'point' targeting reads `AbilityDef.surface` instead of `values[SURFACE_VALUE]`, and sets `surface: true` on
  the target when it took the surface under the crosshair (not on the floor fallback beyond range).
- **W6, with the Architect:** `TetherEffect.breakDistance` becomes a `Magnitude`; `zones.ts` and `kit.ts` resolve it
  with `ctx.effects.magnitude` in the same commit (INTERFACES §15 row 11).

### Combat (sim/combat)

- **W5:** `HealEffect.triggerPct`: add that share of the hit being reported (its `amount`, after the target's resists)
  to the heal, the way `DamageEffect.triggerPct` finds the hit (D-SYS-014); nothing without a hit.
- **W5:** `ShieldEffect.id`: a shield with an id the holder already has replaces it; a `cleanse` whose list holds the
  id removes it. Anonymous shields behave as today.

### Economy & Items (sim/items, data/items, sim/economy)

- **W5 (integration item 5):** Kestrel's Eye as data: a `'weaponHit'` trigger with `beyondM: 25` holding
  `damage { amount: 0, triggerPct: 0.2, type: 'talon' }` plus the 3 s reveal; the trigger engine honours `beyondM` as
  it does `withinM`. Delete the rider.
- **W5:** item shields carry `id: 'item:<itemId>'`; sale cleanses that id; an upgrade re-applies with the same id at the
  new amount (the "difference" bookkeeping goes).
- Boundless Song keeps its refund helper (INTERFACES §15 row 16).
- **W6 (Economy):** read neutral Seed values from `data/world.ts` (`CREATURES`, `FEEDERS`, `NESTS`, `ROC`, `EMBERS`)
  and delete the copies in economy data.

### Heroes A and B (data/heroes, heroes)

- **W5:** Branch Swing and Tree Cling: `surface: true` on the AbilityDef instead of `values.surface`; Rampage:
  `steerDeg: 30` on its dash instead of `values.steerDeg` (switch together with the physics and abilities readers).
- **W5:** Tree Cling `endOn: ['jump', 'stun']` with `onEnd: [{ kind: 'cleanse', remove: [CLING_BUFF_ID] }]`, then
  delete the hook's stun and Jump handling (keep the T3 heal).
- **W5:** Gape: replace the 0.1 s `songLifesteal` status with a 0.1 s `'abilityHit'` trigger on the caster
  (`target: 'self'`, no `uses`, so every enemy bitten counts) holding `heal { amount: 0, triggerPct: 0.3 }`.
- **W6:** Swift's Slipstream T3 pass-through damage and similar "a tier adds a hit" cases can be data: the hit in the
  base `onHit` with a value at 0 that the tier raises. Peacock's Strut can listen to the `ability` event (stage
  `'land'`) and drop `hook: true` from Dazzle and Full Display.

### Environment Artist (client/render/environment)

- Read the descriptor from `loadMap(id).dressing` (types from `src/sim/core/contracts`). `loadDressing` is deprecated and
  goes in W6.

### Level Designer (sim/world/map)

- The dressing types now live in `contracts/map.ts`; `world/map/dressing.ts` only re-exports them. New fields are
  interface requests. `buildWorld` sets `map.dressing`.

### UI and app

- Swap bird uses `practiceConfig(seed, hero, start)` (`SimOptions.practiceStart`); nothing in the client touches
  `sim.ctx`.

### QA (tests, e2e)

- `RETIRED_BUTTONS.Interact` replaces `Button.Interact` in the no-Interact suite; core clears the bit, so "holding it
  does nothing" now holds by construction. The suite's last red test waits on bots riding Updrafts (Bot AI).

### Bot AI

- Nothing requested this round. `motor.updraftInReach` is never `undefined` now: `!== null` is enough.

---

## W6 · 21/11/2026 · from the wave 6 contract round

From INTERFACES §16 and D-ARCH-029 to D-ARCH-032. Already done for the owner, in this round: combat's heal, shield and
status events carry `ability` and `item` (D-ARCH-030); abilities folds `AbilityUpgrade.channelS`, and Cockatoo and Kiwi
use it (D-ARCH-032). The W5.5 line "`TetherEffect.breakDistance` becomes a `Magnitude`" is dropped.

### Rendering & VFX (client/render, client/vfx)

- Move generation onto `deferWork(label, job)` (`src/client/app/stages.ts`) so `createRenderer` itself is cheap: the
  material library's texture generation (about 1.8 s in a dev-server load profile) and the blockout batching (about
  1.4 s) are the two biggest parts. Split long jobs into several, or hand them to a Web Worker (inline it with
  `?worker&inline` so `build:single` runs from file://); a job that holds the main thread also holds the menu's clicks.
- When `createRenderer` is cheap, tell the Architect: the app creates it at boot again (one line in `app.ts`), so the
  menu gets its 3D backdrop at once, and only the queued jobs wait for `'world'`.
- Portraits: the menu and hero select can open before the renderer exists; they show the placeholder portraits until
  `setPortraitProvider` runs.

### Environment Artist (client/render/environment)

- The layer's generation (about 2.2 s in the browser, mostly `mesher.ts`) is the largest single job: queue it with
  `deferWork`, ideally in a worker, and add it to the scene when it resolves.

### Objectives (sim/world)

- With the spatial rebuild fixed, world's vision pass is the largest objectives cost: in a profile of the objectives
  benchmark, `world/vision.ts` self time is about 3.3× the objectives-off match. The 108 Nests and Feeders go through
  the eye loop every tick; they never move, so their visibility could be cached or refreshed every few ticks.

### Balance & Data (tools/buildlab)

- Credit healing, shielding and crowd control per ability and item: `heal.applied.ability/item`, the new
  `shield.applied` (amount as granted, with `absorbs`) and `status.applied.ability/item`.

### QA and Build & Tooling (e2e, playwright.config.ts)

- `__perch.ready` still means the full world (`'world'` stage), so no spec needs changing. A spec that needs only the
  menu can wait on `__perch.stage` being `'menu'` or `'world'`, but until Rendering's jobs are chunked or in a worker the
  main thread is busy right after `'menu'`, so clicks wait for the world anyway.
- `preview-regressions` "binds side buttons" can leave the serial project once the time to `'world'` drops (D-BUILD-011);
  it hasn't yet (8.9 s median here, under load).
- `pickHero` (e2e/game.ts) waits 60 s for `__perch.hero`, but Play with `?t=600` or `?t=900` first fast-forwards the
  12-bot match (36,000 or 54,000 ticks; 20–45 s here before D-ARCH-033's frame pause, 26–30 s after for `t=900`). The
  hero is null only until that session replaces the menu's (D-ARCH-033). Scale the wait with `t` (for example wait on
  `__perch.state.screen === 'match'` with a longer timeout first), or fast-forward less.
- A page-load check worth adding: the `perch:menu` mark (performance marks `perch:boot`, `perch:sim`, `perch:menu`,
  `perch:world`, and a `perch:job:<label>` measure per deferred job) within a few seconds of navigation on a production
  build.
