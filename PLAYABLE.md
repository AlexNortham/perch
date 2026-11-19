# What you can do in PERCH, stage by stage

Each stage below is written when its milestone gate passes, after the Executive Producer has launched that build and
checked it. The newest stage is at the top.

**How to launch (every stage):** in this folder, run `npm install` once, then `npm start`. It builds the game, serves it
at <http://localhost:4173> and opens your browser on the main menu. Stop it with Ctrl+C in the terminal.

---

## Stage 1 (M0 — Foundations) · reached 19/11/2026

**What you see:** the main menu, floating over the real map, "Old Mossmarket": a city built inside an old forest, lit
by a low sun with soft shadows, distance fog and a sky that warms toward the Dawn base and cools toward the Dusk base.

**What you can do:**
- Look at the whole map from above. With `npm start` running, open these in the browser:
  - <http://localhost:4173/?scene=blockout&cam=overview> — the map from behind the Dawn base.
  - <http://localhost:4173/?scene=blockout&cam=top> — straight down, like a minimap.
  - Add `&quality=low` or `&quality=high` to any address to compare the graphics presets.
- Pick out the layout: the Dawn base (gold) in front and the Dusk base (violet) at the far end; the three lanes,
  Hedgerow, Riverbank and Pinewood; the Updraft cables strung above each lane; Chimneys and Vines on the buildings;
  shops; and placeholder markers where the Sentinel Hawks, Stilt Herons, Nest Wardens and Roost Shrines will stand.

**Not in yet:**
- Nothing to play. **Play** leads to an unfinished match screen with the camera parked inside your base, and there is
  no hero to control. Birds, controls and the HUD arrive in Stage 2.
- Behind the scenes the systems exist but have nothing to drive them: movement with real physics (run, dash, slide,
  mantle, Updrafts, climbing), guns with beak shots and the full damage pipeline, melee and parry, status effects, and
  the ability framework. They are proven by about 300 automated tests and a deterministic headless simulation
  (`npm run sim -- --seed 1 --minutes 3 --bots 12`), not yet by anything you can steer.

**Next, Stage 2 (M1 — One bird in a lane):** pick Shrike, Albatross, Kingfisher or Lyrebird, drop into a lane, run,
dash, slide, mantle and ride Updrafts, shoot with beak shots, use four abilities, watch fledgling waves march and fight,
and secure or deny seed pods.
