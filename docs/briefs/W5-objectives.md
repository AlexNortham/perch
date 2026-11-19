# Wave 5a · Objectives Engineer (#12) · tag OBJ

Read W5-common.md first. You own `src/sim/world/**` except `world/map/`, plus `src/sim/data/world.ts`.

Read GDD §7 (especially §7.8–7.15), INTERFACES §14 and your section of W5-contract-followups.md. Then implement the
following, using every GDD number:
- **The Golden Egg:** spawn, melee pickup (D-EP-039), carrier rules, drop, automatic delivery, payout.
- **The Roc:** spawn and attacks; the three Phoenix Embers with Rekindle revives; claim rules and buffs.
- **Thickets:** 24 camps, 8 of them indoors.
- **Nests:** 100, in three types.
- **Feather runes.**
- **Every interactable:** Keepsakes, Bell Feeders, Berries, Hides, Bough Springs, Lookouts, ivy curtains, the Cellar
  Run, the Magpie Den.

The Level Designer is placing the anchors in parallel. Read them from `MapData`; never hard-code positions.

Done means:
- QA's pending suites for your systems pass with `PERCH_PENDING=1`.
- The structure match and the Practice Hub still work.
- The world tick stays within budget with all the new neutrals live, and you measured it.
- `npm run check` passes all six steps.
