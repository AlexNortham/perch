# Stage 4 · Art direction (Game Director #2, with the Technical Artist's view) · the style guide · tag DIR

Read W5-common.md first. You write `docs/art/style-guide.md` (new; you own it).

**The goal (D-EP-047, user's words):** "incredible attention to detail in model design, both map and characters...
no placeholder cuboids, it should all look incredible", using the reference gameplay videos as the visual guide.

**Visual references:**
- 2,023 frames captured from the user's five gameplay videos, in
  `C:\Users\AlexNortham\Documents\game\out\reference\` (read-only, git-ignored; never copy them into the repo).
- `docs/reference/feel-reference.md`.

Study a broad, deliberate sample: streets and building fronts, rooftops, interiors, jungle, structures, characters
close up and at distance, effects, and lighting at different times. Then look at PERCH as it is now (`npm run shots`:
menu, lane, Practice Hub, a hero up close).

## What the style guide must give the art team
The constraint is PERCH's: everything is built in code from geometry, procedural textures and materials, with no
external asset files. Within that, the target is a finished, detailed, cohesive look that matches the reference's
density, richness and readability, translated into PERCH's original city-in-a-forest-for-birds world. Never copy the
reference's buildings, characters or art.

1. **Shape language and silhouettes:** for buildings, props, structures and birds.
2. **Architecture kit rules:**
   - facades, storey rhythm and trims;
   - windows (frames, sills, shutters, glass);
   - doors, roofs (tiles, ridges, gutters, chimneys), balconies, signage-free storefront detail;
   - weathering, and how interiors are furnished.
   - Give minimum detail per building type, so a viewer at street level never sees a plain box.
3. **Nature:** trees, roots, hedges, moss, ivy, ground cover; the jungle's density and layering.
4. **Materials and procedural textures:** brick, stone, plaster, timber, roof tile, foliage, feathers, metal.
   Specify the colour palette per district and per flock, roughness and normal treatment, ambient occlusion, and
   decals.
5. **Birds:** proportions, feather structure (layered cards or shells), eyes, beaks, feet and talons, gun design per
   archetype, team trim, and readability at 10 m, 40 m and 80 m.
6. **Structures and Patrons:** grandeur, team identity, phase-two treatment.
7. **Lighting and atmosphere:** sun angle, fog, sky, interior light, rim light, and how characters pop against the
   background.
8. **Level-of-detail and performance rules:** detail tiers by distance, instancing, texture atlas sizes, triangle and
   draw-call budgets per category, so 60 FPS holds on an iGPU at 1080p.
9. **A review checklist and scoring rubric:** used at every art gate, with side-by-side comparison against reference
   frames chosen per category. List the frame paths.

Include small "reference frame → what to take from it" notes, written in your own words. Commit no images; pick
example frame paths for each category so the artists can open them.

## Done means
`docs/art/style-guide.md` is complete and concrete, with numbers wherever possible. STATUS entry
`### Stage 4 · Style guide · <date>`. Reply in at most 200 words with the five rules that will change PERCH's look the
most.
