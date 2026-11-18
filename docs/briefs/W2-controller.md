# Wave 2 — Character Controller Engineer (#5), tag CTRL

Read [W2-common.md](W2-common.md) first; its rules apply.

**Read as well:** INTERFACES.md §2 (context services), §3 (the `motor` and `pos` rows), §4 (physics-owned effects), §5
(the `movement` and `hero.respawned` events); ARCHITECTURE.md (tick phases, determinism rules);
`src/sim/core/contracts/physics.ts`, `map.ts`, `heroes.ts` (`BodyPlan` includes crouch height), `entity.ts`,
`effects.ts`; GDD §3 (every movement number) and §9.25 (effect primitives).

Your geometry for testing is the 'arena' map plus small fixture `MapData`s you write yourself. After the merge you must
work on the Level Designer's real 'main' map with no change on your side.

## Your job
You own `src/sim/physics/**` and `src/sim/data/movement.ts`. Replace the stub in `src/sim/physics/index.ts`:

1. **The Rapier world.** `@dimforge/rapier3d-compat`, awaiting `RAPIER.init()` inside `createPhysics` (that's why
   `createSim` is async). Static colliders from the map's primitives; colliders added on `entity.spawned` and removed on
   despawn; collision layers per the `Layer` contract. Deterministic: fixed step, fixed creation order, no wall clock.
2. **The `PhysicsService`:** `raycast`, `shapeCast`, `overlap`, `moveCharacter` (collide and slide, step-up, slope
   limit, ground snap) and `groundHeight`. Combat, abilities, world and AI depend on these, so make them exact and
   cheap. World will move ~150 fledglings through `moveCharacter` too, so give units a cheap path (for example a
   simpler controller or ground-snap).
3. **The hero character controller**, in the movement phase, driven by each hero's latched `command`: walk, any sprint
   behaviour, jump, air control, crouch, slide (crouch while moving), dash (Shift, costs stamina), dash-jump, mantle onto
   ledges, stamina pips and regen, Updrafts (mount, ride along the spline, boost, dismount), Chimneys and Vines (climb),
   knockback. Every number from GDD §3, stored in `src/sim/data/movement.ts`. Speed changes from slows and buffs come
   through `ctx.stats` (stats and conditions such as rooted or stunned), never by reaching into combat.
4. **Physics-owned effect kinds**, registered with `ctx.effects.handle(kind, 'physics', handler)`: `displace` (push,
   pull, up, along), `dash`, `teleport`, `movementMode` (glide, flight, hover, cling, toboggan, burrow), `attach`.
5. **Outputs:** write the `motor` component and the view flags (grounded, sliding, dashing, mantling, on Updraft,
   climbing, gliding …); emit `movement` events (jump, dashJump, dash, land, slide, mantle, updraftOn/Off/Boost,
   climbOn/Off); reseat the controller on `hero.respawned`.

## Prove it
- Co-located tests on the arena plus fixtures, each asserting a GDD §3 number within a stated tolerance: walk speed
  reached; jump apex height; dash distance and stamina cost; stamina regen; dash-jump distance; slide trigger and
  duration; mantle succeeds at reach height and fails above it; an Updraft ride station to station with boost and
  dismount; Chimney and Vine climbs; displace, dash, teleport and each movement mode; no tunnelling through thin walls
  at max speed; two identical runs give identical positions.
- Performance: ms per tick for 12 heroes moving plus 150 units moving through `moveCharacter` on a fixture map. Your
  share of the ≤ 1 ms budget is about 0.3 ms.
- `npm run check` passes on your branch.

Extra for your report: ms per tick.
