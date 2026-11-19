# Wave 5b · Rendering & VFX Engineer (#16) · the look foundation · tag RENDER

Read W5-common.md, then **docs/art/style-guide.md** (the visual bar for Stage 4, D-EP-047 and D-EP-048), and the
feel-gap sections G16 and G18 in `docs/reference/feel-reference.md`. You own `src/client/render/**` except `models/`,
`rigs/` and `environment/`, plus `src/client/vfx/**`. The Technical Artist (birds) and, soon, the Environment Artist
(buildings, props, foliage) build on what you deliver, so land the shared pieces first and commit early.

1. **Shared procedural material library** to the style guide: brick, stone, plaster, timber, roof tile, foliage,
   feather, metal and the rest it names. Use generated textures (canvas or data textures, deterministic seeds), normal
   and roughness treatment, baked ambient-occlusion support, atlasing, and quality tiers. Give it a small,
   well-documented API the artists import. No external files.
2. **Lighting and atmosphere** to the style guide: the golden-hour sun angle, lavender haze, sky, warm interior and
   window light, and rim light so birds stay the brightest thing on screen. Tune each quality preset.
3. **The instancing and level-of-detail framework** the artists use to stay within the new budgets (450k triangles,
   at most 240 draw calls per frame on medium). Update QA's draw-budget ceilings to the style guide's numbers, acting
   for QA in `e2e/` for that only.
4. **Scoreboard portraits (D-EP-041):** implement the portrait provider the UI defined, rendering each bird's
   portrait from its own model at match start, so the offline single-file build works.
5. **G16 Updraft ride and boost visuals:** fix the opaque white slabs seen while riding, and give the ride and boost
   a proper look.
6. **G18 team identification** to the reference standard.
7. Convert today's blockout renderer to use the material library, so the existing map no longer reads as flat
   cuboids even before the Environment Artist dresses it.

Prove it with before and after 1080p screenshots (menu, lane, an Updraft ride, a fight) that you look at against the
style guide's checklist and the reference frames it names. Report triangles and draw calls in the budget scenes.
`npm run check` must pass all six steps.
