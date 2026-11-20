# Wave 5c · Technical Artist · sculpt pipeline v2 · tag ART

Read W5-common.md, `docs/art/style-guide.md` §8 (Birds), §7 (Materials), §10.5 and §11, and D-ART-001…007 in
`docs/DECISIONS.md`. You own `src/client/render/models/**`, `src/client/render/rigs/**` and `tests/anim/**`.

## Why this round exists

The user's bar is "incredible attention to detail in model design… no placeholder cuboids etc it should all look
incredible" (D-EP-047), for every hero (D-EP-042). The current pipeline (`sculpt.ts`, `anatomy.ts`, `feathers.ts`,
`bird-material.ts`) builds each body as **one egg- or bottle-shaped loft**, with a head-and-neck loft on top. After two
passes, the Technical Artist and the EP both score the eight newest birds 2 out of 4 (Cassowary 1). The cause is
structural: there is no breast keel, no back or mantle plane, no scapular or shoulder masses, no wing roots that grow out
of the body, no thigh feathering and no cheek or brow. See `out/art/after/*.png` on branch
`worktree-agent-a92af01b0682191d3`, and the close-up reference `HP8-yBieQK8\t2010.jpg` in
`C:\Users\AlexNortham\Documents\game\out\reference\` (read-only, never committed).

## What to build

A sculpting pipeline that produces organic, anatomically structured bird bodies from code. The expected route is implicit
modelling, unless you find a better one and record why:
- Each bird is described as signed-distance primitives, such as ellipsoids, capsules, round cones and planes, combined by
  smooth union and smooth subtraction with a blend radius per operation. Masses include the breast keel, belly, mantle,
  scapulars, wing roots, thighs, nape, throat, cheeks, brow and bill base.
- Mesh extraction by surface nets or dual contouring, with normals from the field gradient.
- Colour and pattern from per-primitive regions blended softly across the joins, plus the existing procedural patterns.
- Skin weights from the primitive-to-bone binding, blended across joins, so the existing rig, sockets and animation keep
  working.
- LODs within the §11 budgets: a hero bird with its gun at most 9,000 / 3,500 / 1,200 / 400 triangles, at most 3 draw
  calls.
- Keep the D-ART-007 feather blades layered on top for wings, tails, crests and trains.

**Generation cost:** generate at build time with a deterministic bake script committed to the repo, or at runtime in a
worker. Either way, a match must load no more than about 1 s slower on the reference machine (§11.1). If you bake, a test
must prove the committed output matches the generator.

**Keep:** the rig and grip sockets, the attachment tests (guns held, never floating: D-EP-035), the pose sheets, every
budget, and the no-copying rule (D-EP-002).

## Scope of this round

1. Build the pipeline.
2. Convert **Peacock, Swift and Cassowary**. These are the EP-reviewed pair and the weakest bird.
3. Stop and report. The EP reviews before the other 21 birds are converted in parallel batches, so make the per-bird
   description quick to write and document how in D-ART decisions.

**Bar:** an honest 3 out of 4 for each of the three. That means a player would call it a finished, professional
character, from the front, from three-quarters and from the player camera behind.

## Prove it

- Before and after triptychs for each bird (three-quarter, front, back from the player camera), looked at by you beside
  the reference frame.
- The in-game line-up at 10, 40 and 80 m.
- Load-time and memory figures.
- Attachment tests and `npm run check`.

Report in your STATUS entry, then reply in at most 200 words with the branch, last commit, scores and the time to
convert one more bird.

**Others working in parallel:** Rendering (lighting and materials), the Environment Artist (`src/client/render/environment/**`),
Bot AI and an integration engineer. Don't edit their files.
