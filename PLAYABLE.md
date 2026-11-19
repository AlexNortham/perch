# What you can do in PERCH, stage by stage

Each stage below is written when its milestone gate passes, after the Executive Producer has launched that build and
checked it. The newest stage is at the top.

**How to launch (every stage):** in this folder, run `npm install` once, then `npm start`. It builds the game, serves it
at <http://localhost:4173> and opens your browser on the main menu. Stop it with Ctrl+C in the terminal.

---

## Stage 2 (M1 — One bird in a lane) · reached 19/11/2026

**How to get in:** run `npm start`, click **Play**, and pick one of the four birds whose cards say **Pick** (the other 20
say "Coming soon"). You start a **practice match**: you alone on the Dawn flock in the gold base, on the full map, with
fledgling waves on all three lanes and all four of your abilities unlocked. To skip the menus, open
<http://localhost:4173/?scene=lane&hero=shrike> (or `albatross`, `kingfisher`, `lyrebird`).

**The birds:**

| Bird | Role | Gun | Abilities (1, 2, 3, ultimate 4) |
|---|---|---|---|
| Shrike | Area control | Barb Rifle | Thorn Larder, Briar Patch, Impaling Bolt, Butcher's Ring |
| Albatross | Tank / initiator | Gale Blunderbuss | Gale Shield, Wing Slam, Salt Hide, Tempest Dive |
| Kingfisher | Assassin | Dart Pistol | Plunge, Glint, Spear Bill, Riverstrike |
| Lyrebird | Support | Echo Lute | Mended Song, Echo Double, Discord, Grand Chorus |

**Controls** (all rebindable in **Options**):

| Action | Key |
|---|---|
| Lock the mouse / shoot | click / left mouse |
| Move / look | WASD / mouse |
| Jump (also leaves an Updraft or Vine) | Space |
| Dash (uses a stamina pip) | Left Shift |
| Crouch; slide if you crouch while moving | Left Ctrl |
| Abilities | 1 2 3 4 |
| Reload / melee (hold for a heavy) / parry | R / Q / F |
| Mount an Updraft at a station | E |
| Swap shoulder | G |
| Ping | middle mouse |
| Pause (Options and Quit are in the pause menu) | Esc |

**What you can do:**
- **Move like the full game:** run, dash, dash-jump, slide, mantle onto ledges, climb Chimneys and Vines, and ride the
  Updraft cables strung above each lane (mount at a station with E, jump to drop off).
- **Shoot:** each bird's own gun, with spread, falloff, reloads and reload-cancel. Hits on the head are **beak shots**:
  more damage and a gold hit marker.
- **Use all four abilities** from the first second (levels arrive in Stage 3, so the practice match unlocks everything).
- **Fight fledglings:** waves leave both bases every 30 seconds on all three lanes. Dawn and Dusk fledglings march, meet
  and fight each other, and they fight you.
- **Seed pods:** when a fledgling dies, a seed pod pops up. Shoot an enemy fledgling's pod while it's ripe to
  **secure** its Seeds; shoot one of your own fledglings' pods to **deny** it to the other side. The HUD shows SECURED or
  DENIED, and your Seeds go up.
- **Options** (from the main menu or the pause menu): rebind any key (a key already in use swaps with it; Esc cancels;
  reset one or all), mouse sensitivity, field of view, graphics quality, volumes. **Settings survive closing the
  browser.**

**Not in yet:**
- **No enemy birds.** Bots arrive in Stage 4; until then the practice match is you against fledglings.
- **No towers or bases to attack.** Fledglings stop at the enemy base and wait; the Hawks, Herons, Wardens, Shrines and
  the Patron arrive in Stage 3.
- **Seeds don't buy anything yet:** levels, ability upgrades (Alt+1–4 needs ability points from levels) and the shop
  arrive in Stage 3.
- **No sound** (volumes are saved for when it arrives in Stage 3), no minimap, scoreboard or kill feed.
- **20 birds are still "coming soon"**; they arrive in batches of four through Stages 3 and 4.
- Rough edges: fledglings can clip through walls when they chase off the lane; Lyrebird's Echo Double upgrades (two
  decoys, the burst) are untested in play.

**Next, Stage 3 (M2 — The loop):** levels and ability points, the Magpie's Hoard shop, Sentinel Hawks, Stilt Herons,
Nest Wardens, Roost Shrines and the two-phase Patron, so a match can be won by hand; a full HUD with minimap, kill feed
and scoreboard; sound; and eight more birds.

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
