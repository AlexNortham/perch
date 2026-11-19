# Wave 5a · Systems engineer (acting for #5 Character Controller, #7 Combat, #8 Ability Systems) · tag SYS

Read W5-common.md first.

**Your paths for this wave:**
- `src/sim/physics/**`
- `src/sim/combat/**`
- `src/sim/abilities/**`
- `src/sim/data/{movement,combat,abilities}.ts`

**Implement:**
- Every item for these three owners in W5-contract-followups.md.
- **Updrafts mounted by holding Jump (D-EP-039, GDD §3).** The latch works within reach anywhere along the cable, and
  a fresh press dismounts. Remove every use of the deprecated Interact bit in your paths.
- **Interiors.** Character movement and every physics query (raycast, overlap, shape cast, `moveCharacter`) must work
  with the new building geometry: doors, stairs, ladders, floors and windows. Stairs and ladders climb as the GDD says.
- **Melee on pickups.** A melee hit on the Golden Egg is delivered as the pickup event the Objectives contract expects.
- **QA's pending suites** for your systems must pass when run with `PERCH_PENDING=1`.

**Constraints:**
- Use the determinism module (`src/sim/core/dmath.ts`, D-ARCH-021). No raw `Math` transcendental functions.
- Keep each system within its tick budget; measure it with `npm run perf`.
- `npm run check` must pass all six steps.
