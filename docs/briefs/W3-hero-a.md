# Wave 3 — Hero Engineer A (#9), batch A1, tag HEROA

Read [W3-common.md](W3-common.md) first; its rules apply.

**You own** `src/sim/heroes/{shrike,albatross,kingfisher,lyrebird}/**` and `src/sim/data/heroes/{shrike,albatross,
kingfisher,lyrebird}.ts`. (Your later batches A2 and A3 come in waves 4 and 5.)
**Read as well:** GDD §9 for those four heroes plus §9.25 (effect primitives), §5 (combat), §8 (AP); the contracts
`heroes.ts`, `abilities.ts`, `effects.ts`, `statuses.ts`; Ability Systems' and Combat's wave 2 Log entries and decisions
(D-ABIL-*, D-COMBAT-*), especially the list of abilities that still need a hook; tests/README.md (the sandbox).

## Your job
Implement **Shrike, Albatross, Kingfisher and Lyrebird** completely, using only the frameworks:
1. **Data** (`src/sim/data/heroes/<id>.ts`): `HeroDef` with the GDD's `BodyPlan`, base stats, Molt growth, the gun
   (`WeaponDef`: pellets, spread, falloff, fire rate, magazine, reload, hitscan or projectile speed) and four
   `AbilityDef`s with all three upgrade tiers and their numbers. Data first; a hook only where data can't express it.
2. **Hooks** (`src/sim/heroes/<id>/index.ts`) for what data can't express. The Systems follow-up engineer is adding
   framework features in parallel (e.g. wall-stun on displacement); until they land, use a hook and mark it
   `// TODO(framework): switch to <feature> once merged`.
3. Mark each of the four heroes as implemented, using the flag the Architect defined for hero select (see INTERFACES.md
   and W3-contract-followups.md).

## Prove it
- The kit validator passes: `npx vitest run src/sim/abilities/kit.test.ts`.
- **Ability smoke tests** (brief requirement), co-located in each hero folder, using the sandbox: cast each of the four
  abilities, at a relevant tier, and assert its effect (damage dealt within tolerance of the GDD number, status applied
  with its duration, displacement distance, area or summon present, cooldown started). Include the ultimate being locked
  before level 6 and usable at 6.
- A gun test per hero: damage per bullet and per beak shot match the GDD at close range; magazine and reload time match.
- `npm run check` passes.

Extra for your report: any GDD numbers you had to interpret, and every hook you wrote with the framework feature that
would replace it.
