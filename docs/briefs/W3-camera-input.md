# Wave 3 — Camera & Input Engineer (#6), tag CAM

Read [W3-common.md](W3-common.md) first; its rules apply.

**You own** `src/client/camera/**` and `src/client/input/**`.
**Read as well:** GDD §3 (every action and default key), §4 (camera and aim), §12 (settings); `src/client/app/contracts.ts`
(`InputController`, `CameraRig`, `Settings`), `src/client/app/loop.ts`, `src/sim/core/aim.ts` (the aim model the sim
uses), `src/sim/core/contracts/command.ts` and `view.ts`.

## Your job
**Input** (`createInput(target, settings, onUiAction)`):
- Pointer lock on click; Esc releases it and raises pause through `onUiAction`.
- Mouse look with the sensitivity setting; WASD axes; every action in GDD §3 mapped to its `Button` bit (jump, crouch,
  dash, fire, reload, light/heavy melee, parry, abilities 1–4, upgrade intents, item actives Z/X/C/V, ping on middle
  mouse, shoulder swap) plus UI actions (B shop, Tab scoreboard, Esc pause).
- `sample()` once per sim step builds the `PlayerCommand`. A key pressed and released between two sim steps must still
  register as pressed exactly once; held state is exact.
- Default bindings exported for the settings store; rebinding of every key (the settings screen comes later, the API
  now).

**Camera** (`createCamera(settings)` → `update(frame, hero, look, preset)` → `CameraPose`):
- The `player` preset is the over-the-shoulder camera built from the **same constants and maths as `core/aim.ts`**, so
  the centred crosshair points exactly where the sim's aim ray goes. Prove this with a test.
- Collision pull-in against the map's primitives (pure maths on `MapData`; the sim's Rapier world isn't available
  client-side), visual only.
- Shoulder-swap blend, the FOV setting and the dash FOV kick (from motor flags or `movement` events), light smoothing
  without lag in the aim.
- A death/respawn camera; keep the `overview` and `top` presets working.

## Prove it
- Unit tests: the press latch across frames and steps; the bindings and rebinding; camera pose equals the aim ray at
  rest for both shoulders; pull-in against a wall in a fixture map.
- A playtest by hand (`e2e/` is QA's, so don't add tests there): a one-off Playwright script run with `npx tsx` from
  `out/` that opens `?scene=lane&hero=shrike`, click to lock (or use the router's test path), hold W for a second,
  press Shift, and confirm the hero moved (read `window.__perch` or the view if exposed); take a screenshot from the
  player camera and look at it. Describe in your report exactly how the playtest was driven so QA can turn it into an
  e2e test.
- `npm run check` passes.
