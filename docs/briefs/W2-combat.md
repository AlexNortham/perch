# Wave 2 — Combat Engineer (#7), tag COMBAT

Read [W2-common.md](W2-common.md) first; its rules apply.

**Read as well:** INTERFACES.md §3 (component writers), §4 (combat-owned effects), §5 (combat's events), §6 (the damage
pipeline) and the combat rows of §9; `src/sim/core/aim.ts` (the aim model); `src/sim/core/contracts/statuses.ts`,
`effects.ts`, `heroes.ts` (`BodyPlan`, `WeaponDef`), `entity.ts`, `physics.ts`; GDD §4 (aim), all of §5 (combat), §8
(respawn formula, heal on level-up) and §9 (the weapon specs your code must support).

On your branch `ctx.physics` is still the stub (every query misses), so your tests use a small fake `PhysicsService` in
your own test files. QA is writing independent test-first suites for your damage pipeline from the GDD
(`tests/contracts/damage.test.ts`, gated by `PERCH_PENDING=1`). You'll meet them at the merge and they must pass there,
so follow GDD §5.2 and INTERFACES §6 exactly.

## Your job
You own `src/sim/combat/**` and `src/sim/data/combat.ts`. Replace the stub:

1. **Guns:** fire rate, spread (from your own `ctx.rng.stream('combat')`), pellets, hitscan and projectile weapons,
   falloff, range, ammo, reload, reload-cancel, driven by the hero's latched `command`. Aim: use `core/aim.ts` to rebuild
   the camera ray, find the aim point (physics raycast against the world plus your own hitbox test), and fire from the
   muzzle toward it. Projectiles are pooled entities you move and collide each tick.
2. **Hitboxes:** head sphere and body capsule per hero from `BodyPlan`, unit bodies, structure bodies, and the Patron's
   weak point. Beak shots land on the head only: heroes yes, units and structures never (GDD §5).
3. **The full damage pipeline**, exactly in the order of INTERFACES §6 and GDD §5.2: requests queued and resolved in the
   damage phase (base, falloff, beak shot, outgoing bonuses, incoming amplification, resists and shred, structure
   rules, shields, health); lifesteal; `damage.applied` and `heal.applied`; kill credit and assists (12 s window);
   `entity.died`; hero death, the respawn timer per GDD §8 (respecting `TeamState.emberUntil`) and `hero.respawned` at
   the Home Roost; the 4 s combat state; the heal on `hero.level`.
4. **Melee:** light and charged heavy melee, and parry (window, success, whiff punishment), with `melee` and `parry`
   events. Heavy melee is how the Phoenix Ember gets claimed (world's rule; you only emit the event).
5. **Statuses:** all of GDD §5.9 with its stacking rules, plus DoTs, cleanse and regeneration; their stat effects go
   through `ctx.stats` with source keys `'status:<n>'`.
6. **Combat-owned effect kinds**, registered with `ctx.effects.handle(kind, 'combat', handler)`: `damage`, `heal`,
   `applyStatus`, `statMod`, `cleanse`, `shield`, `weaponMod`, `projectile`.
7. **Pods:** seed pods (economy's pickups, next wave) must be hittable; shots that hit a pickup report it as the
   `projectile.impact` target.

The 24 hero data files hold placeholders until the Hero Engineers fill them. Test with your own fixture `HeroDef`s that
use real GDD §9 weapon numbers for at least three contrasting guns (a pellet spread gun, a fast hitscan gun, a slow
projectile).

## Prove it
- Co-located tests, one per item above, with a fake physics service using an AABB world for occlusion: beak shot vs
  body shot on a hero and no beak shot on a unit; falloff at start, mid and end; pellet count and spread distribution
  with a fixed seed; magazine, reload and reload-cancel timing; each pipeline step in order (resist stacking and clamp,
  shield order, lifesteal, kill credit and assists, respawn time at three match times); light melee, heavy melee and
  parry outcomes; each status's stacking; each effect kind.
- Performance: ms per tick with 12 heroes firing continuously plus 150 units in the spatial hash. Your share of the
  ≤ 1 ms budget is about 0.3 ms. Pooled projectiles; no per-shot allocation.
- `npm run check` passes on your branch.

Extra for your report: ms per tick.
