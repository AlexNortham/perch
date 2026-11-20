# What you can do in PERCH, stage by stage

Each stage below is written when its milestone gate passes, after the Executive Producer has launched that build and
checked it. The newest stage is at the top.

**How to launch (every stage):** in this folder, run `npm install` once, then `npm start`. It builds the game, serves it
at <http://localhost:4173> and opens your browser on the main menu. Stop it with Ctrl+C in the terminal.

---

## Stage 4 (M3 — Full 6v6) · Release 1, functionality · reached 21/11/2026

**How to get in:** run `npm start` as before. The menu has **Play**, **Practice Hub** and **Options**. **Play** is now
the full match: you, five allies and six enemies, every other bird a bot. The wiki (`wiki/index.html`) is rewritten for
this stage and lists every bird, item, objective and building.

**This is the first of two Stage 4 releases.** It is the whole game working; the visual upgrade comes in the second.
See "Known limits" below before you judge how it looks.

**Update 1.1 (21/11/2026):** Swap bird in the Practice Hub now shows the new bird's model; before, you kept the old
bird's look.

**Play: a 6v6 match.**
- Pick any of the **24 birds**. You start in the Dawn base with a **600-Seed** purse, enough to shop straight away at
  the Home Roost.
- The other eleven birds are **bots**. They lane with the fledglings, retreat and heal, shop for builds that fit their
  bird, farm Thickets, take the Egg, runes, Embers and the Roc, and group up to siege towers and then your Patron.
  They only react to what their flock can see.
- Matches now **end**: 20 seeded bot-only test matches all finished with a winner, between about 35 and 55 minutes.
  Concede is still in the pause menu from 15:00.

- **Buildings you can enter** (54 of the 110 buildings: terrace houses, taverns, granaries, warehouses, bell towers,
  mills, hides and more; the rest are not enterable). Each one has at least two ways in on the ground. Many have
  **stairs, upper floors, ladders and flat roofs**, reached from inside or by Chimney, Vine and ledge. Bots path
  through them too.
- **The Cellar Run:** a tunnel under the Riverbank lane in each half, reached from the Tavern cellars and lane stairs. Halfway along
  is a **Magpie Den**, a shop **both flocks** can use.
- **The jungle:** the blocks and woods between the lanes, with **24 Thicket camps** in three tiers: Beetles, then
  Weasels, Rats and Toads, then Badgers. Camps sleep until you come within 30 m, and are worth more Seeds as the match
  goes on.
- **100 breakable Nests** in streets, rooms, cellars and the Hollow. Twig Nests break to anything and may drop a Seed
  sprig or a crumb that boosts you for 60 s; **Woven Nests** are solid and need a heavy melee hit; Keepsake Nests give
  small permanent boosts.
- **Feather runes:** from 5:00, every 5:00, a rune appears on each rune bridge (Swift, Fierce, Sage or Stout). A heavy
  melee hit claims one for 150 s; it gets stronger later in the match.
- **The Golden Egg:** from 10:00, then every 5:00, an Egg is lowered onto one of two perches. **Hit it with melee to
  pick it up**, then carry it to the other perch, the Hatching Stone. The carrier can't shoot or cast and is revealed;
  delivery is automatic and hatches into Seed pods for the flock.
- **The Roc and its Embers:** at 20:00 the Roc wakes in the Hollow under the Old Mill Bridge. Only a bird down in the
  Hollow can hurt it, and it hits back hard. When it falls, three **Phoenix Embers** drop: a heavy melee hit claims
  one for a full heal, Seeds and a Rekindle charge (a revive) for that flock.
- **Bell Feeders** (from 8:00), **Berry bushes** that heal, **Hides** that hide you and speed stamina recovery,
  **Lookouts** that widen your sight, and **Bough Springs** that launch you.

**Controls that changed.**
- **Hold Left Alt to upgrade abilities.** Aiming pauses and a cursor appears; click an ability icon or press 1 to 4;
  hover for the next tier. Let go and you aim again at once. There is no separate panel.
- **No Interact key.** To ride an **Updraft**, hold **Jump** near the cable. The Egg is picked up by melee; runes,
  Embers and Woven Nests take a heavy melee hit.
- **The scoreboard is always on**, as the top bar: timer and Seeds in the middle, six birds a side with health bars,
  Seeds and respawn timers. There is no Tab scoreboard.
- **Practice Hub: Swap bird.** Use the pause menu or the on-screen button to pick another bird without leaving; you
  respawn as it with a fresh 32 AP.

**The 64 items.** The Magpie's Hoard stocks 64 items in three families (Talon 21, Plumage 21, Song 22) across four
tiers, 15 of them with actives.

**What to try.**
1. **Play** as any bird, check the top bar, and spend your 600 Seeds. Does the bot lane look sensible?
2. Walk into a building, climb to the roof, and drop down into a cellar. Follow the Cellar Run to the Magpie Den.
3. Clear a Beetle Thicket early. Break Nests as you go.
4. At 5:00 claim a rune with a heavy melee hit (Q held). At 10:00 try the Egg.
5. Hold Alt, upgrade an ability, then let go and keep shooting.
6. Hold Jump under a lane cable to ride it. Use the **Practice Hub** and **Swap bird** to try the new birds.
7. If a match reaches 20:00, take a team into the Hollow for the Roc.

**Known limits.**
- **The visual upgrade is still to come.** Release 2 covers the rest of the art.
- **Only 8 of the 24 birds are on the new sculpted models** (Peacock, Swift, Cassowary, Shrike, Kingfisher, Owl, Pelican
  and Penguin). 12 are on older models, and **Frigatebird, Cockatoo, Swan and Kiwi use a default bird**.
- **Towers, Patrons, fledglings and creatures are still simple shapes.**
- **The map art is on its second of three passes.**
- **Matches run long**, up to about 55 minutes.
- **Bot builds use the designer's starter scores** until the Build Lab has converged, so bots of one bird may build
  alike.
- **Balance has not been tuned yet:** some birds will be too strong or too weak.

---

## Stage 3 (M2 — The loop) · reached 19/11/2026

**How to get in:** run `npm start`. The menu now has **Play**, **Practice Hub** and **Options**. The game also has its
own wiki: open `wiki/index.html` (double-click it) for every bird, ability, item and mechanic, with pictures.

**Play: a full match you can win.** Pick one of **12 birds** and you start in the gold Dawn base on Old Mossmarket.
There are no enemy birds yet (bots arrive in Stage 4), but the whole Dusk base fights back.
- Push a lane with your fledglings and take down the Dusk **Sentinel Hawks**, then the **Stilt Herons** (watch for the
  stomp and the beam), the paired **Nest Wardens** and the **Roost Shrines**. Hawks switch to you if you hurt an
  allied bird near them.
- **Brood Ward:** towers take far less damage unless your fledglings are with you, so siege with your wave.
- Bring down the **Great Owl**, Dusk's Patron, in two phases: in phase 2 it gets new attacks and a weak point to hit.
  That ends the match on a **Victory** screen with stats.
- From 15:00 you can **Concede** in the pause menu, which goes to the **Defeat** screen.
- Your own base heals you (the Home Roost), and you respawn there if you die.

**The loop.**
- Earn **Seeds** from last hits, seed pods (shoot them to secure, or deny your own), towers and over time.
- Seeds raise your **level**; each level adds stats and **ability points**. Your ultimate unlocks at level 6.
- Spend ability points in the **Ability Upgrades** panel: tap **Left Alt**. The mouse is freed; hover a skill to see
  what its next tier does, then click to buy it.
- Shop at the **Magpie's Hoard** (press **B** in a shop zone): 16 items across Talon, Plumage and Song, with
  component upgrades and actives on Z / X / N / V. Selling refunds Seeds. Destroying objectives unlocks extra
  **flex slots** for your whole flock.

**The HUD.** Flock scores and the match timer; both Patrons' health and phase; tower health; a north-up minimap
(**M** for the big map); pings (middle mouse); the scoreboard (**Tab**); a kill feed; damage numbers; level, AP and
Seeds; item slots.

**Sound.** Every gun and hit, beak shots, pods, a call for each bird, tower and Patron alarms, and music that shifts
with the fight. The volume sliders in Options work.

**Movement and melee, deeper:** an air jump and an air dash, wall jumps, a crouch down-dash, a timed dash-jump (the
HUD shows the window), and sprint. **Q**: tap for a light swing, hold for a charged lunge. **F** parries. Melee and
parry can be bound to the side mouse buttons in Options.

**Ctrl to crouch while running (Chrome and Edge):** the game goes fullscreen with a keyboard lock when you click in,
so Ctrl works as crouch even while you hold W. Please check it yourself:
1. Play any bird; the game goes fullscreen.
2. In Options, set Crouch to **Left Ctrl** if it isn't already.
3. Hold **W** and press **Ctrl**: the bird slides and the tab stays open.
4. One **Esc** pauses; holding **Esc** leaves fullscreen.

In Firefox the keyboard lock doesn't exist, so crouch stays on **C** there.

**Practice Hub** (main menu): pick a bird, then shoot the **Enemy dummy** and heal the **Ally dummy**; both reset so
you can repeat. You get 32 ability points to try every upgrade.

**The 12 birds:**
- Gun carry: Pelican, Hornbill
- Tank / initiator: Albatross, Penguin
- Support: Lyrebird, Flamingo
- Area control: Shrike, Puffin
- Spirit burst: Starling
- Assassin: Kingfisher
- Long-range poke: Owl
- Mobility skirmisher: Secretarybird

Every bird now holds its gun properly in every animation. Each one's full kit is on its wiki page.

**Not in yet:**
- **Enemy birds** (bots): Stage 4.
- **The rest of the game:** the other 12 birds, the remaining 48 of 64 items, the Golden Egg, the Roc, jungle
  Thicket camps, Feather runes and breakable Nests all arrive in Stage 4, along with a far more detailed map with
  enterable buildings and a recommended build for every bird.
- **Balance, juice** (hitstop, shake) **and performance tuning**: Stage 5.
- **Known rough edges:**
  - Some art polish is still to come: Shrike's gun reads as a pole, the Albatross's gun blends into its wings, the
    Owl holds its rifle high, and the Albatross's tail looks like a spike.
  - Every ability cast uses one generic pose in play.

**Next, Stage 4 (M3 — Full 6v6):** 1 + 11 bots with all 24 birds and 64 items, the Golden Egg, the Roc and Phoenix
Ember, the jungle, Nests and runes, enterable buildings with things to do inside, and learned recommended builds.

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
