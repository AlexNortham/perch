# Wave 2 — Rendering & VFX Engineer (#16), tag RENDER

Read [W2-common.md](W2-common.md) first; its rules apply.

**Read as well:** INTERFACES.md §8 (client contracts), `src/client/app/contracts.ts`, `src/sim/core/contracts/map.ts`
and `view.ts`, and GDD §14 (visual direction), §6 (the map's look) and §12 (graphics settings).

## Your job
You own `src/client/render/**` except `models/` and `rigs/` (the Technical Artist's, next wave), plus
`src/client/vfx/**`. This wave is the **render core**. VFX (tracers, impacts, ability effects) comes next wave, so leave
the vfx stub as it is unless something in it blocks you. Never edit `src/client/camera/**` (Camera & Input, next wave).

Goal: the M0 gate needs "`npm start` opens a lit 3D blockout of the map". Make the `Renderer` contract
(`createRenderer(container, map, quality)`, `render(frame, pose)`, `setMap`, `setQuality`, `resize`) produce a
good-looking, fast, lit 3D scene from any `MapData`.

**Map geometry**
- Build the blockout from the map's primitives (boxes, ramps, cylinders), merged by material into a handful of draw
  calls.
- Flat-shaded procedural materials per material tag; no textures or external assets.
- Make the map's features readable: Updraft splines as cables, Chimneys and Vines, shops, structure anchors as
  placeholder markers, lanes readable from above.

**Lighting and atmosphere**
- A sun with shadows, plus hemisphere or ambient light.
- Distance fog and a sky gradient, matching the GDD §14 palette.
- Export Dawn and Dusk team colours as named constants that others can import.

**Entities**
- A loop over `frame.curr` entities that asks the `ModelKit` (`client/render/models`, currently a stub) to create and
  pose models; pool them and remove them when despawned.
- Interpolate with `interpolate(frame, entityView)` from `src/client/app/loop.ts`.
- Leave room for the Technical Artist to use instancing for ~150 fledglings next wave, and say in your report how they
  should plug in.

**Quality presets:** `low`, `medium` and `high` — pixel ratio, shadows and shadow-map size, antialiasing, fog distance —
switchable live through `setQuality`.

**Performance:** the target is 60 FPS at 1080p on a laptop iGPU with 12 heroes, ~150 fledglings and all structures.
Report draw calls and triangle counts for the blockout (`renderer.info`).

The Level Designer is building the real 'main' map in parallel, so test against a richer fixture `MapData` you write in
your own area (a few buildings with rooftops, ramps, cylinders, an Updraft spline, a Chimney, structure anchors) as
well as the current placeholder. After the merge the real map must render with no change on your side, so build only to
the contract.

## Prove it
- `npm run shots -- --scene blockout --cam overview` and `--cam top` (presets live in `src/client/app/contracts.ts`),
  plus `--quality low` and `--quality high`, on your fixture map and on the placeholder. Look at every PNG with the Read
  tool and iterate until the scene is clearly lit, fogged and readable, with lanes visible. If the scene router can't
  show your fixture map, use a small fixture path inside your own area or a unit test, and say what you did.
- No console errors (`npm run e2e`).
- `npm run check` passes on your branch.

Extra for your report: draw calls and triangles, and the screenshots you looked at.
