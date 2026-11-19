# Wave 3 — Objectives Engineer (#12), tag OBJ

Read [W3-common.md](W3-common.md) first; its rules apply.

**You own** `src/sim/world/**` except `src/sim/world/map/**` (the Level Designer's), and `src/sim/data/world.ts`.
**Read as well:** GDD §7 (fledglings; skim the structures for later), §11.1 (the vision rule), §15 (timeline);
INTERFACES.md §2 (the shared visibility service, which world owns), §3, §5, and the world rows of §9; the map contract
(lane paths, anchors) and the Level Designer's wave 2 Log entry (Wardens 0.25 m from the lane path; fledglings steer
round them); the Character Controller's note: move fledglings through `ctx.physics.moveCharacter`, which has a cheap
path for units; QA's test-first suite `tests/rules/fledglings.test.ts`.

## Your job (wave 3 scope)
1. **Fledgling waves:** timing, composition per lane and scaling over time, exactly per GDD §7; spawned at each base,
   `wave.spawned` events, the next-wave timer in `ObjectiveState`.
2. **Marching:** along the authored lane paths through physics, steering round obstacles and structures' footprints.
3. **Fighting:** target choice per GDD §7 (enemy fledglings, heroes, structures, with the priority rules), melee and
   ranged attacks applied as `damage` effects with `via: 'unit'`. Death is combat's; despawn and pods follow from
   `entity.died`.
4. **Vision:** the shared visibility service, writing `seenBy` every tick per GDD §11.1 (allied hero line of sight
   within 40 m, allied fledgling within 20 m, allied structure within 30 m, or revealed), honouring reveal,
   invisibility and true sight. Fledgling targeting uses `canSee`.
5. Until structures exist (wave 4), fledglings that reach the enemy base stop at the last structure anchor and hold.

Performance: ~150 fledglings marching and fighting cost at most 0.25 ms per tick in Node, vision included.

## Prove it
- `PERCH_PENDING=1 npx vitest run tests/rules/fledglings.test.ts` passes in full (quote it). If you believe an assertion
  is wrong against the GDD, say which and why; don't work around it.
- Your own co-located tests for steering, target priority, vision and the stop-at-base rule.
- A screenshot of `?scene=lane&hero=shrike&t=60` showing fledgling waves meeting in a lane (models may be placeholders).
- A 35-minute headless run (`npm run sim -- --seed 1 --minutes 35 --bots 12`) completes; report the fledgling count
  over time and ms per tick.
- `npm run check` passes.
