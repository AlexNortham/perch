# Wave 3 — Rendering & VFX Engineer (#16), tag RENDER

Read [W3-common.md](W3-common.md) first; its rules apply.

**You own** `src/client/vfx/**` and `src/client/render/**` except `models/` and `rigs/`.
**Read as well:** GDD §5 (beak shots and hit feedback), §8 (seed pods, the "secured" pop), §9.25 (what ability effects
look like in play), §14 (visual direction); INTERFACES.md §5 (every event) and §8 (the `Vfx` contract);
`src/sim/core/contracts/view.ts` and `entity.ts` (projectiles, pickups, areas).

## Your job
Readable, cheap combat feedback driven by drained events and the view:
1. **Weapons:** pooled tracers for hitscan, visible projectiles for projectile guns, muzzle flash, world impacts, body
   impacts, a distinct beak-shot flash, and a hit flash on whatever got hit.
2. **Pickups and pods:** seed pods drawn as pickups (rising, ripe, withering) with a "secured" pop and a "denied"
   crunch on `pod.resolved`.
3. **Abilities:** areas drawn from the `area` component (sphere, cylinder, cone, ring, box; lasting areas visible for
   their lifetime), ability projectiles, tethers, summons as simple placeholder shapes until the Technical Artist models
   them, status markers (stun, slow, silence, root …).
4. **Movement:** dash streaks, landing dust, slide sparks, Updraft wind.
5. Fledgling attacks (melee swipes, ranged shots) so lane fights read at a glance.

Everything pooled; budget a few extra draw calls in a busy 6v6 fight, no per-frame allocation. Hitstop, screen shake
and post-processing are wave 7; don't start them.

## Prove it
- Unit tests for pooling (no growth under sustained fire) and event-to-effect mapping.
- A VFX self-test you can trigger from a URL parameter read inside your own module (for example `--param vfxdemo=1`),
  which emits synthetic events so every effect is on screen at once; screenshot it, and screenshot
  `?scene=lane&hero=shrike&t=60` where fledglings are fighting. Look at both and iterate.
- `npm run check` passes.

Extra for your report: draw calls with the self-test running.
