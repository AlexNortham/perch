# Wave 2 — Level Designer (#13), tag LEVEL

Read [W2-common.md](W2-common.md) first; its rules apply.

## Your job
You own `src/sim/world/map/**`. Authored coordinates, sizes and splines go in `src/sim/world/map/data/**`, which is
exempt from the magic-number lint rule (D-BUILD-009); logic elsewhere in `map/` is not.

Goal: replace the placeholder 'main' map with the real PERCH map as data. It must conform to `MapData` in
`src/sim/core/contracts/map.ts`, load through `loadMap(id)`, and keep the 'arena' map working.

**Read:** GDD §6 (all of it; the §6.3 coordinates are binding), §3 (jump height, dash-jump, mantle reach, slope,
Updraft and climb numbers your geometry must suit), §7 (where every structure, Thicket, Nest and rune sits), §14 (the
look: a city built inside an old forest, for birds) and §15.

**Axes:** x = east, z = north, y = up. D-ARCH-008 warns that a north-up top-down view puts east on the **left**, so mind
that when you read the GDD's ASCII sketch. Dusk is the Dawn half mirrored as the GDD and the contract define it.

The map needs:
- Three lanes (Hedgerow, Riverbank, Pinewood) with streets, alleys and buildings, including rooftops and balconies you
  can reach.
- Chimneys and Vines (climbs), mantle ledges, and an Updraft spline above each lane with its stations.
- Shops, spawns and the Home Roost, and anchors for every structure, Thicket, Nest, rune spot, Egg perch and delivery
  point, and the Hollow (the Roc pit).
- Lane paths for fledglings, and a nav graph with link kinds for bots, plus bot spots.
- Everything else the contract has a field for.

Constraints:
- **Traversable:** every ledge meant to be mantled is within the GDD's mantle reach; ramps stay within the walkable
  slope; lane paths stay on walkable ground with no gap a fledgling can't follow; Updraft splines stay clear of
  geometry.
- **Cheap:** aim for at most about 1,500 primitives for the whole map, so the renderer can merge it into a few draw
  calls and physics can build colliders fast. `loadMap('main')` should take under 50 ms.
- **Original layout** (D-EP-002), built from the GDD's design.

## Prove it
- Co-located tests (`src/sim/world/map/*.test.ts`): symmetry (every Dawn object has its Dusk mirror); every GDD §6.3
  anchor exists; lane paths connect base to base and every point sits on walkable ground (not inside a solid prim, with
  consistent heights); the nav graph is connected from both spawns; Updraft splines are clear of geometry; structures
  don't overlap prims; mantle ledges are within reach.
- A visual check you look at yourself, because you can't see the renderer: write a pure function in your area that
  renders the map as a top-down SVG string (prims shaded by height, lanes, Updrafts, nav graph, labelled anchors). Write
  it to `out/` with a one-off `npx tsx` command, turn it into a PNG with Playwright (installed Edge,
  `channel: 'msedge'`), and look at the PNG with the Read tool. Make one full-map image and one close-up of a base;
  compare them against GDD §6 and fix what's wrong. The UI engineer may later reuse the SVG function for the minimap.
- `npm run check` passes on your branch.

Extra for your report: the primitive count and `loadMap('main')` time.
