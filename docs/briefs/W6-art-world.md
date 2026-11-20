# Wave 6 · Technical Artists · tag ART

Read W5-common.md first, then:
- `docs/art/style-guide.md` §8, §9 and §11;
- D-ART-009, D-ART-010 (converting a bird) and D-ART-011 (pipeline v2.1 and the batch checklist).

The bar is the user's: "incredible attention to detail in model design… no placeholder cuboids etc it should all look
incredible" (D-EP-047). Every model is checked side by side with the reference frames the style guide names (in
`C:\Users\AlexNortham\Documents\game\out\reference\`, read-only, never committed), and scored honestly. 3 out of 4 means
a player would call it finished and professional.

There are two jobs. Each artist does only their own.

## Job 1 · the four B3 birds (tag ART-B3)

**Birds:** Frigatebird, Cockatoo, Swan and Kiwi, built straight on the v2.1 sculpt pipeline (D-ART-010/011) in a new
builder file, `birds-b3.ts`.
- Each bird's silhouette, gun and gear come from GDD §9.21–9.24 and the style guide's §8 table.
- Hero Engineer B is building their kits in parallel. The models need only the hero ids and the gun archetypes, which
  already exist in the data.

**Shared files:**
- In `bodies.ts`, add only your own functions and `BODIES` lines.
- Don't edit the shared pipeline files (`bird-material.ts`, `anatomy.ts`, `feathers.ts`, `sdf.ts`, `mesher.ts`,
  `skin.ts`); bird batch A owns them.
- Register your birds in the model kit with the smallest possible edit.

**Done means:**
- an honest 3 or better from the player camera, for each bird;
- triptychs and in-game views for each bird;
- the 10, 40 and 80 m line-up;
- attachment tests (D-EP-035);
- budgets: ≤ 9,000 / 3,500 / 1,200 / 400 triangles, ≤ 3 draw calls.

## Job 2 · structures, Patrons, fledglings and creatures (tag ART-W)

Today the Sentinel Hawk reads as a cream column, the Nest Wardens as owl-face plaques, and other structures and creatures
are still at the blockout bar. Build them to style guide §9 (grandeur, team identity and states, the Patrons) and §8.8
(fledglings and Thicket creatures):
- **Structures:** Sentinel Hawk, Stilt Heron, Wardens, Shrines, the Brood Ward, and the two Patrons (Elder Raven, Great
  Owl). Each needs readable team identity and visible damage states.
- **Units:** fledglings (lane units) for both flocks.
- **Neutral creatures:** every Thicket creature family, the Roc and its Embers.

**Budgets (§9.1, §11):** Hawk and Heron 12,000–18,000 triangles at LOD0; Wardens and Shrines 8,000–12,000 each; LODs
for everything; instancing for fledglings and creatures.
- Reuse the sculpt pipeline (SDF bodies, the feather surface) for every creature and bird-shaped statue. Add only what
  structures need: stone, timber, brass and banner materials from Rendering's material library.
- Your area is `structures.ts`, `fledgling.ts`, a new `creatures.ts` under `src/client/render/models/`, and their tests.
  Make the smallest registration edits in the model kit.

**Done means:**
- Images of every structure in every state at 15 m, every unit and creature at 10 m and 40 m, and an in-game lane shot
  and Roc shot. Look at each one beside the reference frames the style guide lists for structures.
- Scores in a STATUS table.
- Draw calls and triangles in QA's budget scenes.

## Both jobs

- Commit each model separately.
- `npm run check` passes. Known failures that are not yours: load-sensitive e2e and perf timeouts that pass alone, and
  the audio live-context test.
- Reply in at most 150 words.

Others working in parallel: three bird batches, Hero B3, the Architect, Bot AI and the Environment Artist. Don't edit
their files.
