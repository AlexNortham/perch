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

## Added by the EP from wave 5a reports
These are framework gaps that finished hero and item branches are waiting on. Their stand-ins are marked
`TODO(framework)` on those branches, and the EP merges them before you start or alongside you.
- **Woodpecker's Drumroll** (Combat): an instant full spin-up and no spin-down while active (D-HEROB-008).
- **Wall and tree targeting** (Ability Systems and Physics): Branch Swing and Tree Cling must land on the wall or tree
  surface under the crosshair, not on the floor below it. Tree Cling ends on Jump or a stun.
- **Rampage steering** (Physics): the charge follows the caster's aim while it runs.
- **Bristle's thorns** and **Gape's heal** (Combat): implement the contract features they need, so the hooks can come
  off.
- **The second Song hit** from Crescendo and Echo Chamber (Combat): the target's resists currently apply twice. Add
  the combat-side handling so a repeated hit is resisted once.
List in your report which of these landed and the data shape for each, so the hero and item owners can drop their
stand-ins.
