# Wave 5a · Economy & Items engineer A (#11) · Talon, Plumage and the engine · tag ECON

Read W5-common.md first. You share `src/sim/economy/**`, `src/sim/items/**` and `src/sim/data/{economy,items}.ts`
with engineer B, so this is how the files are split:
- **You own** the item engine, the shared registry, and the Talon and Plumage catalogues, each in its own file.
- **Engineer B owns only** the Song catalogue file. On day one, create it as an empty, typed module (for example
  `src/sim/data/items-song.ts`) and commit it, so B can fill it.

Read GDD §8 and §10 (the 64 items: 21 Talon, 21 Plumage, 22 Song; 15 actives; at most 4 active slots), INTERFACES
§14 and your section of W5-contract-followups.md.

Implement:
- **Engine changes:** the four-active cap, Keepsake boons if the GDD routes them through economy, and anything else
  the follow-ups assign to economy.
- **All new and remaining Talon and Plumage items,** each with its real effect wired into the existing systems and
  one test per item.
- **The item-score data shape** (D-EP-036, INTERFACES §14), plus a **starter score table** built from the GDD §11
  per-archetype cores, so bots can shop by score in Stage 4. The Build Lab replaces the table with learned scores
  when it is ready (D-EP-044).

Done means:
- QA's pending item suites for your items pass with `PERCH_PENDING=1`.
- `npm run check` passes all six steps.
