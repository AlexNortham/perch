# Wave 3 — contract follow-ups (from the W2.5 contract round)

The Technical Architect settled the wave 2 interface requests (decisions: [INTERFACES.md §11](../INTERFACES.md#11-wave-2-requests),
D-ARCH-011…016). The contract changes are already on main: optional fields, a new event and TSDoc. This list says who
must now implement what, and why. `#n` is the row in INTERFACES §11. Every new field is optional, so data that uses
it compiles today; it does nothing until its owner implements it.

In wave 3 the **Systems follow-up engineer** acts for Combat, Ability Systems and Character Controller. Do the items
Hero Engineer A's heroes need first (marked **A1**: Shrike, Albatross, Kingfisher, Lyrebird).

## Combat (Systems follow-up engineer)
1. **`ProjectileImpactEvent.via`** (#1): set it on every impact to the cause's `via`: 'weapon' for gun bullets,
   hitscan included; 'ability' or 'item' for those projectiles. Economy secures and denies pods from gun bullets
   only (GDD §8.2).
2. **`WeaponDef.projectileRadius`** (#7, **A1** Lyrebird's Echo Lute 0.25 m) and **`perRoundStartS`** (#9, **A1**
   Albatross 0.3 s): use them when set, else today's combat constants.
3. **Wall hitboxes** (#19, **A1** Albatross's Gale Shield): a unit with `unit.size` is hit as a box of that size
   standing on `pos`, turned by `yaw`, instead of its capsule. Enemy shots stop on it; allies' never test it.
4. **Magnitudes ahead of the widening** (#16, **A1** Kingfisher): read `DamageBonus.targetHpBelow`,
   `DamageEffect.missingHpPct` and `executeBelow` through `ctx.effects.magnitude(value, cause)`. That compiles with
   today's `number` type, so the W3.5 round can widen them to `Magnitude` with no code change (D-ARCH-015).
5. **`WeaponDef.spinUp`** (#8, Woodpecker, wave 5): fire rate from `fromRate` to `fireRate` over `seconds` of
   continuous fire, starting over when firing stops.
6. **`DamageEffect.beakShotMult`** (#10, Owl, wave 4): overrides `COMBAT.abilityBeakShotMult` for that effect.
7. **`WeaponModEffect.shots`** (#11, Hornbill, wave 4): the mod ends after that many shots, or after `durationS`,
   whichever comes first.
8. **`Motor.modeAllowsGun`** (#22): no firing while it is `false` (absent means allowed).
9. **`EFFECT_TICK_SECONDS`** (#24): import it from `src/sim/data/core.ts` for the DoT tick and drop
   `COMBAT.tickIntervalS`, so combat and abilities can't drift apart.

## Ability Systems (Systems follow-up engineer)
1. **`selfEffects`** (#15, **A1** Kingfisher's Riverstrike T3): on `AbilityDef` and `AbilityUpgrade` (tiers append).
   Apply them to the caster when the cast lands, after `effects` and before `onCast`: target.entity = caster,
   point = its feet, dir = the cast direction. Keep `onCaster` working until no kit uses it.
2. **`SummonEffect.onEnd`** (#17, **A1** Echo Double T3, Gale Shield T3): apply when the summon dies, expires or is
   replaced past `maxCount`, with target = its last position (entity null) and the summon's cause.
3. **`SummonEffect.count` and `spreadDeg`** (#18, **A1** Echo Double T2): spawn `count` summons (a Magnitude, so a
   tier value adds one), their directions fanned evenly across `spreadDeg` around the target direction.
4. **`UnitInfo.size`** (#19, **A1** Gale Shield): copy `SummonEffect.size` onto the wall unit.
5. **`tether` events** (#20): emit `stage: 'start'` when a tether links and `'end'` when it expires, breaks beyond
   `breakDistance` or either end dies, so the client can draw it.
6. **`movement` 'displaced'** (#26): end the hero's channel when it arrives (GDD §3.9 "displacement cancels
   channels").
7. **`Motor.modeAllowsAbilities`** (#22): no new casts while it is `false`; re-pressing the slot that is channelling
   still ends that channel (Burrow-style modes, D-ARCH-016).
8. **`EFFECT_TICK_SECONDS`** (#24): use it instead of `AREA_TICK_S`.
9. **Rooted or stunned summons don't move** (#25): decoys stop while either holds (physics roots displaced units).

## Character Controller (Systems follow-up engineer)
1. **Wall slam** (#21, **A1** Shrike's Impaling Bolt): when an entity displaced by a `displace` effect hits a wall
   with at least 4 m/s of displacement speed toward it (a named constant in `src/sim/data/movement.ts`, GDD §3.9),
   apply `DisplaceEffect.onWall` to it with the displacement's cause; for heroes also emit `movement` 'wallSlam'.
2. **`movement` 'displaced'** (#26): emit it when a displacement starts on a hero.
3. **Teleport facing** (#27, **A1** Kingfisher's Riverstrike): when `face: 'target'` turns the hero, emit `movement`
   with action 'teleport' and the new `yaw`. The app already makes the human's input adopt it.
4. **Mode restrictions on Motor** (#22): while a movement mode is active set `motor.modeAllowsGun` and
   `motor.modeAllowsAbilities` from the effect; reset both to `true` when it ends.
5. **Displaced units** (#25, D-ARCH-014): displace, dash and attach move units too. While one acts on a unit, write
   its `pos` and `vel` and set `rooted` on it with `ctx.stats.set(id, 'physics:displaced', { conditions: ['rooted'] })`;
   clear it (`null`) when the displacement ends.

## Economy & Items
1. **Pods** (#1): secure or deny a pod only from `projectile.impact` events whose `via` is 'weapon' (treat a
   missing `via` as 'weapon' until Combat's change merges), and from `melee`. Ability and item projectiles passing
   through a pod don't count (GDD §8.2).

## Objectives
1. **Rooted or stunned units don't move** (#25): fledglings and neutrals stop steering while either holds. Statuses
   root and stun them, and physics roots a unit while it displaces it (writing its `pos` meanwhile, D-ARCH-014).

## Hero Engineer A (batch A1: Shrike, Albatross, Kingfisher, Lyrebird)
1. **`implemented: true`** (D-ARCH-013): set it on each hero module (`src/sim/heroes/<id>/index.ts`, the exported
   `HeroModule`) once the kit is complete: real data, hooks where needed, smoke tests passing. Hero select offers only
   implemented heroes.
2. **New data shapes** (they compile now and work once the Systems engineer's branch merges; until then keep a hook
   marked `// TODO(framework)` where a smoke test depends on one): Echo Lute `projectileRadius: 0.25`; Albatross
   `perRoundStartS: 0.3`; Riverstrike T3's invisibility as `selfEffects` instead of `onCaster`; Echo Double T2 as
   `count` (value +1) with `spreadDeg: 30`, T3 as `onEnd`; Gale Shield's `size` and T3 burst as `onEnd`; Impaling
   Bolt's pin as `DisplaceEffect.onWall`.
3. **Tier-raised thresholds** (#16, D-ARCH-015): Spear Bill T2 (execute 40% → 50%) and Riverstrike T2 (missing-HP
   12% → 18%) need a hook this wave; they become value names in wave 4, after the W3.5 round.

## UI/HUD
1. **Hero select** (D-ARCH-013): all 24 heroes from `HEROES` (`src/sim/heroes/registry.ts`); a hero is pickable only
   when `HEROES[id].implemented === true`, the others show "coming soon". Picking calls
   `actions.startMatch({ hero, team: 'dawn', difficulty: 'normal', seed })`; leave `bots` out for the practice match.

## Rendering & VFX
1. **Tethers** (#20): draw a link from each `tether` 'start' event to its 'end' (source and target positions from the
   view).
2. **Wall slams** (#21): optionally an impact burst on `movement` 'wallSlam'.

## Camera & Input
1. **Teleport facing** (#27): src/client/app calls `input.setLook({ yaw, pitch })` when a teleport turns the human's
   hero; the next `sample()` must carry that yaw.

## Later hero batches (wave 4 on)
1. Every finished hero sets `implemented: true`. Hero Engineer A: Heavy Rounds (Hornbill) uses
   `WeaponModEffect.shots`. Hero Engineer B: Moonlit Mark (Owl) uses `beakShotMult`, the Drum Drill (Woodpecker)
   `spinUp`, Burrow (Kiwi) a movement mode with `allowGun`/`allowAbilities` false.

## Bot AI (wave 5)
1. **Commands** (D-ARCH-011): assign each bot's command to `h.command` in the ai phase; reusing one object per bot is
   fine, but never mutate the object `h.command` holds (it is core's latch).
2. **Teleport facing** (#27): when a `movement` event carries `yaw` for a bot's hero, use it as that bot's look yaw.
3. Bot heroes join the Play match through `MatchSetup.bots` once bots can play.

## QA
1. `?scene=lane` is now the practice match (the human only, waves on); `e2e/scenes.spec.ts` covers it unchanged.
   Once UI's hero select lands, an e2e click-through Menu → Play → an implemented hero → match is the Stage 2 proof.
