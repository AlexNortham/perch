# Wave 3 — Systems follow-up engineer (acting for #5 Controller, #7 Combat, #8 Ability Systems), tag SYS

Read [W3-common.md](W3-common.md) first; its rules apply.

**You own, for this wave:** `src/sim/physics/**`, `src/sim/combat/**`, `src/sim/abilities/**` and
`src/sim/data/{movement,combat,abilities}.ts`. Nothing else.
**Read as well:** the wave 2 Log entries and decisions of the Character Controller, Combat and Ability Systems
(D-CTRL-*, D-COMBAT-*, D-ABIL-*), the QA gate entry and the integration entry; INTERFACES.md "Wave 2 requests";
**docs/briefs/W3-contract-followups.md** (your main input); GDD §3, §5 and §9.

## Your job
1. Implement every follow-up in W3-contract-followups.md assigned to Combat, Ability Systems or Character Controller.
   **Do first** the ones Hero Engineer A's heroes need (Shrike, Albatross, Kingfisher, Lyrebird), e.g. stuns on hitting
   a wall during displacement, bullet radius, missing-HP and execute magnitudes, summon end effects. Hero Engineer A is
   writing hooks meanwhile and will switch to your features after the merge, so make each feature's data shape clear
   in your report.
2. Fix the defect from the wave 2 review:
   - **Heroes never rest:** an idle hero on flat ground drifts about 1e-4 m in height every tick under Rapier. Idle
     heroes must be exactly still (and the state hash stable while idle). QA rated this medium: idle and standing-still
     rules depend on it.
   - (Not a defect: a bullet that passes through head and body counts as a beak shot. That is GDD §5.4's deliberate
     rule, D-EP-020. Leave it.)
3. Fix anything else in the follow-ups for these three systems, in priority order, as far as time allows; list what's
   left.

## Prove it
- A co-located test for each implemented follow-up and for the idle-drift fix.
- QA's damage suite still passes (`npx vitest run tests/contracts/damage.test.ts`).
- `npm run sim -- --seed 1 --minutes 3 --bots 12` twice gives the same hash; report ms per tick.
- `npm run check` passes.

Extra for your report: the data shape of each new feature (for Hero Engineer A), and the follow-ups left undone.
