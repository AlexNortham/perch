# Wave 5b · Environment Artist (#22, new role) · tag ENV

Read W5-common.md, then **docs/art/style-guide.md** (the bar: D-EP-047 no placeholder shapes, D-EP-048 a world built by
and for birds), and the reference frames it names in `C:\Users\AlexNortham\Documents\game\out\reference\`
(read-only). You own `src/client/render/environment/**` (new).

The Level Designer has rebuilt Old Mossmarket. Its collision primitives are the gameplay truth, and
`loadDressing('main')` plus the building descriptors (type, storeys, every door and window, roof style, balconies,
interior rooms, prop and foliage anchors, district style) tell you what to build on top. Build the visual layer:
- **Buildings.** Detailed facades for every type in the kit, with storey rhythm, trims, framed windows with sills and
  shutters, doors, roofs with tiles, ridges, gutters and chimneys, balconies, perch rails and landing boards, woven
  additions and nest-topped roofs. No blank wall over 3 × 3 m within 30 m of a lane or path. Furnish the interiors.
- **Bird street life** (style guide §1): feeders and seed stalls, baths and fountains, scattered seeds, berries and
  feathers, worm beds, hives, nesting material, bunting in faded flock colours.
- **The jungle:** a layered canopy, roots, hollows, branch nests, reed beds by the river, bramble thickets, ivy and
  moss.
- **Objective dressing:** Thicket camps, Nests (the breakable boxes), rune spots, the Roc's Hollow, the Egg perches,
  the Bell Feeders and the other interactables. Their gameplay bodies belong to Objectives and the models of creatures
  to the Technical Artist; you build the places around them.
- **Use the Rendering engineer's shared material library and LOD/instancing framework** (landing in parallel; start
  from its published API, or write against the API it describes and switch over when it lands). Ask Rendering, through
  your report or a message via the EP, for the renderer hook that adds your environment layer, if it isn't there yet.

**Budgets** (style guide): 450k triangles and at most 240 draw calls per frame on medium, 60 FPS on an iGPU at 1080p.
Use instancing and LOD heavily.

**Prove it:**
- A screenshot set you look at yourself, side by side with the matching reference frames from the style guide:
  overview, top-down, a street-level shot per lane, two interiors, a rooftop route, the jungle, the Roc's Hollow, a
  Thicket camp and a Nest cluster.
- Score each area against the style guide checklist, including A1 ("somewhere birds would be"), in your STATUS entry.
- Draw calls and triangles in QA's budget scenes.
- `npm run check` passes all six steps.
