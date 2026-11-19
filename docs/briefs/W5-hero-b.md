# Wave 5a · Hero Engineer B (#10) · batch B2 · tag HEROB

Read W5-common.md first. You own `src/sim/heroes/{cassowary,toucan,woodpecker,nightjar}/**` and their data files.

Before you start, read:
- GDD §9 for those four birds, plus §9.0.1 and §9.25;
- the existing birds, as patterns;
- tests/README.md;
- your section of W5-contract-followups.md.

Ship **Cassowary, Toucan, Woodpecker and Nightjar** to the same bar as Hero A's brief:
- data, with hooks only where data can't express the effect;
- descriptions for every ability and tier;
- a gun test and an ability smoke test for every ability;
- the kit validator passing;
- `implemented: true`.

Woodpecker's spin-up uses the `WeaponDef` `spinUp` field. `npm run check` must pass all six steps.
