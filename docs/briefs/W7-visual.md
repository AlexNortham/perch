# Stage 4 Release 2 · the visual upgrade · tag ART / ENV / REND

Read W5-common.md, then D-EP-047, D-EP-048, D-EP-050 and D-EP-051, then `docs/art/style-guide.md`. Release 1
(functionality) is on `main`. This release brings everything up to the user's bar: "incredible attention to detail in
model design, both map and characters… no placeholder cuboids etc it should all look incredible", and "look at every
aspect of the map and think yes this is somewhere birds would be".

**Stability still comes first.** Release 2 ships only when `npm run check -- --release` passes three times in a row, the
20 release matches and the 30-minute soak pass, and nothing that works today breaks. Art must not change sim behaviour:
hitboxes, collision prims and nav are frozen. If dressing needs a collision change, write it under Interface requests.

## Jobs

**Birds** follow `docs/briefs/W5-birds-batch.md`'s process: D-ART-010 to convert a bird, the D-ART-011 checklist,
D-ART-012 feather filtering and D-ART-013 registration. Each bird must reach an honest 3 or better from the player
camera, with its triptych, in-game golden-hour views, line-up, attachment tests and budgets.

| Batch | Birds | Builder files |
|---|---|---|
| D | Vulture, Hummingbird, Toucan, Woodpecker, Nightjar. **D also owns the shared pipeline files.** | `birds-a3.ts`, `birds-b2.ts` |
| E | Albatross, Lyrebird, Flamingo, Hornbill, plus a front-view touch-up of Shrike (2.5 from the front today) | `heroes.ts`, and `heroes-b.ts` for Flamingo and Hornbill |
| F | Puffin, Secretarybird, Starling, plus a player-camera touch-up of Penguin (2.5 today: its flippers are hidden) | `birds-c.ts`, plus `heroes-b.ts` for removing their old builders |
| G | Frigatebird, Cockatoo, Swan, Kiwi (on the default bird today), built new | new `birds-b3.ts` |

**Shared files.**
- Shared pipeline files (`bird-material.ts`, `anatomy.ts`, `feathers.ts`, `sdf.ts`, `mesher.ts`, `skin.ts`): Batch D
  only. Others send requests through their report.
- `bodies.ts`: each batch adds its own functions and its own `BODIES` lines, nothing else.

**Structures, Patrons, units and creatures (tag ART-W).** Follow W6-art-world.md Job 2:
- Sentinel Hawk, Stilt Heron, Wardens, Shrines, the Brood Ward, the Elder Raven and the Great Owl, with team identity
  and damage states;
- fledglings for both flocks;
- every Thicket creature family, the Roc and its Embers.

This job also owns `src/client/render/rigs/structure-rig.ts` (new) for damage states.

**Environment, third pass (tag ENV).**
- Lift Riverbank, Pinewood, interiors and the Thicket camps to at least 3. Overall at least 3.2, and no area below 3.
- Big bird-scale statements on Hedgerow that read as "somewhere birds would be" in the first second.
- Halve the environment's geometry memory (75.5 MB today).
- Move its 1.2–1.5 s of generation onto `__perch.stage`/`deferWork` (D-ARCH-031) or a worker, so first paint stays
  near 1.2 s.
- Keep the spawn camera clearance and fade working (D-ENV-006).

**Rendering (tag REND).** For 1–2 s after a scene opens, a frame draws up to 50% more triangles than it settles to
(lane/low 390k, then 257k). Find the cause and fix it. Support the jobs above with material and LOD requests.

## For every job

- Look at your own renders and score them honestly beside the reference frames.
- Commit each model or area separately.
- Run targeted tests while you work. Run `npm run check -- --release` once at the end.
- Write your STATUS entry, with a scores table and image paths.
- Reply in at most 150 words.
