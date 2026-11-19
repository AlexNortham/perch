# PERCH feel reference: the reference game against the current build

Owner: Game Director (#2). Written for Stage 4 wave 5 and the Stage 5 style guide and balance work (D-EP-042,
D-EP-043, D-EP-045, D-EP-046). Mechanics, layout, pacing and feel only (D-EP-002): nothing here names or copies the
reference's heroes, items, places, art, wording or UI assets, and matching the map means its scale, density,
verticality and lane structure, never its streets.

## How this was gathered

- **Sources:** the five full-match videos the user supplied (listed in `docs/briefs/W5-feel-reference.md`), called
  V1 to V5 below in that order. V2 is a top-rank match; V5's hero is a small character, which is useful for camera
  scale.
- **Method:** installed Edge driven by Playwright, the consent dialog answered with "Reject all", ads skipped with the
  player's own skip button or waited out, and the page's `<video>` element seeked and screenshotted. No video file
  was downloaded. Frames are in `out/reference/<video id>/` (git-ignored); nothing from them is in the repo.
- **Limit found:** an automated browser only receives about 60 s of stream per page load. Each moment was therefore
  opened as a timestamped link and captured inside that window. One-second bursts are limited to about 25 s each.
  Whole-match overviews come from the player's own seek-bar previews, which update about every 6 s, so fight and
  siege lengths are coarse estimates.
- **PERCH side:** the build on this branch (`integrate/w5`, Stage 3 content). `out/perch-capture.ts` drives the
  `lane`, `practice` and `replay` scenes like a player at 1920 × 1080, and `npm run shots` gave the map overview. The
  frames are in `out/reference/perch/`. `out/perch-scan.ts` showed that in the `match` scene the bots stand at
  their spawn (0 hero damage in 40 minutes), so PERCH can't yet show a hero fight. The nearest substitutes are the
  Practice Hub dummies and the fledgling clash.
- **Frames looked at (all of them were opened and read):**
  - V1: whole-match preview board; frames at 0:20, 1:00, 1:40, 3:00, 6:30, 10:00, 17:00, 23:00, 26:00, 27:30, 33:30
    and 39:00; bursts at 0:02–0:46 (2 s steps), 1:30–1:53 (lane trade) and 9:48–10:11 (team fight, then a tower).
  - V2: board; frames at 3:00 (build browser), 5:20, 16:20 and 26:00; burst at 1:06–1:33 (first lane trade).
  - V3: board; frames at 15:00 (tower falls), 30:00 (shrine siege).
  - V4: board; frame at 20:30.
  - V5: board; frames at 14:00 and 17:30 (lane tower with its shield), 38:00 (final boss); burst at 13:32–13:55
    (movement through streets and a shop visit).
  - PERCH: `hud-spawn`, `shop`, `move-*` (1 frame/s), `updraft-*` (1 frame/s), `lane-*` (1 frame/s),
    `practice-*`, `replay-*`, `map-overview`, `map-top`.

## 1. HUD and UI

### Always on screen in the reference (positions at 1920 × 1080)

| Element | Where and how big | What it shows |
|---|---|---|
| Scoreboard strip | Top centre, 12 round portraits about 70 px across x 340–1580, own team left | Each hero's net worth under the portrait, an eye mark when visible to the enemy. Dead heroes go dark with a large respawn count over the face. A low-HP ally gets a red "critical" tag. |
| Clock and team totals | Between the two portrait groups | Small clock (about 14 px), two team-colour pills with each team's total net worth, the leader's lead in %, and the window of the next big objective (for example "2:00–4:00"). |
| Health gauge | Beside the hero, about x 420–580, y 665–930: a tall slanted gauge | Current HP in big numerals (about 40 px) with max HP beneath. Fresh damage shows as a red chunk that then drains. |
| Stat badges, level, wallet | Bottom left, y 780–920 | Three round badges (gun damage %, ability power, max HP), a level badge with a progress ring, and the wallet in about 34 px numerals with unsecured currency under it. |
| Item grid | Bottom left, 2 rows of 6 squares of about 55 px | Owned items as icons, locked extra slots marked with a padlock. |
| Ability row | Bottom centre, x 790–1130, round icons of about 70 px | Cooldown seconds inside each icon, key letter under it, upgrade pips. Item actives continue to the right with their keys. |
| Crosshair | Centre | Small arc segments, with the magazine count about 80 px below in about 16 px type. Hit markers, and your own debuff icons just under it. |
| Minimap | Bottom right, a circle of about 370 px | Lanes as coloured lines, own base at the bottom, objectives as diamonds, respawn timers on camps, and the zone name under the map. |

### What appears in context

- **Kill feed:** left side under the strip (y 20–37 %): killer → victim with portraits, names and the bounty, plus
  objective kills (towers, mid-boss, revives). Your own kill throws a large red "kill + bounty" badge next to the
  crosshair, and a kill-streak tag appears by your portrait.
- **Objective health bars:** the bar of a structure you are near or hitting appears under the strip. A paired
  structure shows two named bars side by side, and a boss gets a wide bar with its name.
- **Banners:** level-up (what you gained), tower destroyed (and the extra item slot it unlocked), each about 1.5 s,
  centred near the top third.
- **Buff and debuff ledger:** green and red tags on the left middle with value and source icon (for example −10 %,
  +15 %).
- **Feedback near the crosshair:** currency gained (+21), item procs by name, a big status word when you are hit by a
  strong effect, and contextual prompts only when they apply (for example "heavy melee to claim" next to a claimable
  pickup, "teleport" next to a usable object).
- **World space:** names and segmented health bars over heroes (red for enemies, white for allies), offscreen
  teammates as markers with name and distance, teammate pings as speech bubbles from their portrait, and a red
  vignette pulse at the screen edges when you are hit.
- **Shop:** full screen. A vertical tab strip picks one category at a time (plus a build browser). Each category is
  four tier boxes (800 / 1,600 / 3,200 / 6,400) of large icon cards with names, owned cards stamped. The hero model
  and a full stat sheet sit on the left, the owned-item grid is bottom left, and a "buy next" queue is top left.

### PERCH today (`hud-spawn`, `lane-*`, `practice-*`, `shop`)

- **Top centre:** a 640 × 140 px block of flock totals with structure pips, both Patron bars and three Hawk bars,
  always on.
- **Top left:** a square 220 × 254 px minimap. **Top right:** a text kill feed (a structure kill reads "The world →
  Shrike", and Brood Ward on/off lines flood it during a siege).
- **Bottom left:** a 460 × 197 px panel with a thin 432 × 22 px HP bar, stamina pips, level, Seeds, four
  text-labelled ability boxes, the ammo count in 40 px type and four item-active slots.
- **Beside the crosshair:** a melee hint box (144 × 72 px) that never goes away.
- **Shop:** three text-only columns (Talon, Plumage, Song) holding every item at once, each card giving tier, name and
  price. There are no icons, no stat sheet and no tabs; the inventory is a list of empty boxes on the right.

## 2. Camera

- **Reference:** a human-sized hero stands left of centre. Their middle is about 240–260 px (13 % of width) left of
  the crosshair, their head is level with the crosshair, and they fill about half the screen height down to the
  bottom edge. The crosshair sits just right of the head. V5's small hero takes only about 30 % of the height at the
  same offset, so the camera does not move in for small heroes. The apparent horizontal FOV is about 90°, and
  framing stays the same on ziplines and roofs.
- **PERCH:** the rig is boom 3.2 m (× height / 1.8, clamped 2.6–4.0), shoulder 0.75 m right and 0.35 m up, FOV 90°.
  Shrike sits about 230 px left of centre (the same as the reference) but the head is 70–100 px below the crosshair,
  because the 0.35 m lift puts the eye above the head. The bird's wide, opaque body and a long black rifle (about
  370 × 230 px, running from the bird to the lower-left screen edge) cover more of the lower-left quarter than the
  reference hero does.
- **Verdict:** the offset and FOV already match. Two small fixes would close the gap: head height (G13) and the size
  of the local bird and its gun (G15).

## 3. Combat readability

- **Reference:** the scene is dark, so effects are the brightest things on screen. Ability effects are saturated and
  colour-coded (purple, teal, green, orange), gun tracers are thin bright lines, and area effects are a crisp ring
  plus a soft fill. Hits give sparks and numbers, with big hits shown big (a 518 burst at about 40 px, chip damage at
  about 18 px). Enemy heroes carry red bars and names. Big team fights get very busy, but the HUD stays fixed and the
  crosshair stays clear.
- **PERCH:** on bright, flat ground the effects wash out into pale white and yellow blobs. Briar Patch reads as a
  glowing yellow slab and Butcher's Ring as a peach wall. While riding an Updraft with boost on, opaque white vertical
  slabs cover up to 40 % of the screen (`updraft-2`, `updraft-5`). In the fast-forwarded siege, damage numbers carpet
  the screen. Team outlines can't be judged yet because there are no enemy birds in Play.

## 4. Map

- **Reference:** a dense night-time city. Lanes are streets 15–25 m wide with building fronts of 3–8 storeys on both
  sides, and the frontage is broken by doors, lit windows, shops and stairs. Clutter appears every few metres
  (trucks, cars, kiosks, lamp posts, planters, crates, signs). Overpasses and bridges give a second level, and
  zipline cables cross overhead. Interiors are shops and halls, and the bases are large lit plazas. Lighting is dark
  blue ambient with warm windows, lamps and neon. Fights move across roofs, and players drop two or three storeys
  (8–12 m) into plazas (V1 9:48–9:56). There are three lanes, own base at the bottom, and jungle blocks between.
- **PERCH:** bright daylight and flat colour. Lanes are bounded by long plain sandy walls that are visible from the
  lane. The ground is open with few props, buildings are 1–2 storey boxes, and roofs can only be reached by Chimneys
  and Vines. The playfield is 260 × 300 m with three lanes (`map-overview`, `map-top`). D-EP-033's W5 rebuild is the
  vehicle for closing this gap.

## 5. Pacing (measured from the frames)

| Measure | Reference | PERCH |
|---|---|---|
| Purse at 0:00 | every hero shows the same starting net worth and buys the first item before about 1:00 | 0 Seeds; passive income from 0:30, about 1 Seed/s (11 Seeds at 0:40, 25 at 0:54 in `updraft-*`) |
| First hero contact | heroes in lane by 1:00, first trades by 1:20–1:40 | waves meet at 0:52 (Riverbank) to 0:59 (side lanes); bots don't fight yet |
| Lane trading | V1 1:30–1:53: about 12 HP/s chip plus one 118-HP ability (17 % of 714), with 24 % of max HP lost over 23 s and no kill. V2 1:18–1:30: 816 → 511 (37 %) over 12 s, about 25 HP/s. Out of combat +2 HP/s. | gun-only theoretical TTK at level 1, 100 % body hits: 5.3–11.7 s (median about 7.5 s); regen 2 HP/s |
| Team-fight kill | V1 10:00: a hero dies under a 518-damage burst plus focus within about 2 s of the dive. The fight then turns straight into a tower push: 9:54 to 10:11. | n/a (no bots); Practice Hub: Shrike gun takes 56 HP off a 560 dummy in 0.8 s (about 70 DPS) |
| Tower after a won fight | the group is on the tower within 1–2 s and it is under fire for the whole 10 s burst; V3's tier-2 tower falls at 14:48 | solo Owl replay: Hawk under fire from 1:00 and down before 3:10; Heron from 3:10 to between 9:00 and 11:10 (9,000 HP alone); match 19:26 |
| Net worth per hero | about 1.1k at 1:40, 1.8k at 3:00, 4.3k at 6:30, 7.6k at 10:00, 16k at 17:00, 22k at 23:00, 25k at 27:00, 43k at 40:00 (averages of the 12 shown) | GDD §8.10 targets 6.0k at 10:00, 18k at 20:00, 33k at 30:00, 48k at 40:00 |
| Max HP of one hero (items included) | ×1.08 at 1:40, ×1.44 at 6:30, ×2.0 at 10:00, ×2.7 at 17:00, ×3.2 at 27:00, ×4.0 at 40:00 of its 660 start (V1). V5's hero shows 3,420 max HP at 37:00. | Shrike base only: ×1.47 at level 9 (10:00 target), ×1.94 at level 17 (20:00), ×2.29 at level 23 (30:00), ×2.58 at level 28 (40:00) before Plumage |
| Level | 2 at 1:40, 9 at 6:30, 15 at 10:00, 22 at 17:00, 26 at 27:00, 33 at 40:00 | GDD targets 9 at 10:00, 17 at 20:00, 23 at 30:00, 28 at 40:00 |
| Respawn | counts seen on dead portraits: 31 s at 16:20, 39 s at 26:09, 52–59 s at 29:48, 41–66 s at 37:26 (so the full timer is at least as long) | min(55, 8 + 1.2 × min): 27.6 s at 16:20, 44 s at 30:00, 52.4 s at 37:00 |
| Match length | V1 about 41 min, V2 at least 28 (the video ends at the final push), V3 38.3, V5 38.5. V4 is edited, so its video time doesn't follow the match clock. | GDD: 25–40 min, typical end 28–38 |
| Movement | not measurable in metres from video; with no zipline ride caught in a 1 s window, the ride speed is unmeasured. Roof-to-street drops of 8–12 m happen in about 1 s, and streets are crossed in 2–3 s. | run 7.0 m/s (4.0 body heights/s for 1.75 m Shrike), dash 5.5 m (3.1 heights), dash-jump about 7 m in 0.43 s, Updraft 11.0 m/s ride (6.3 heights/s), 18 m/s boost (10 heights/s) measured in `updraft-*`; gate to mid-lane in about 7 s with boost |

## 6. Targets for PERCH

### Style guide (D-EP-042, W6.5)

- **Values:** the environment stays mid to dark (value at most 60 %, saturation at most 50 % near lanes, which is the
  existing rule). Heroes, team colour and effects are the brightest things on screen. Lit windows and lanterns give
  warm pools against a cool ambient.
- **Local hero footprint:** at the default camera the local bird covers at most 18 % of the screen area, and its gun
  at most 4 %. The gun is held at the body and never runs to the screen edge.
- **Effects:**
  - Areas: a 3 px rim in the owner's colour and at most 25 % fill.
  - Projectiles: a bright 2–4 px core and a short trail.
  - Hits: a spark plus a number.
  - Opacity: nothing white and opaque bigger than 5 % of the screen, except an ultimate for at most 1 s.
  - Speed and ride effects: only outside the central 50 % of the screen.
- **UI shapes:** round portraits with team rings, round ability icons, square item icons, big numerals for HP and
  wallet, small type everywhere else.

### Time-to-kill windows (D-EP-043, D-EP-045)

The windows below assume gun only, 100 % body hits, no falloff, equal net worth and no resist items. They are
Director targets set from the pacing above; the simulation track measures them with hard bots.

| Attacker → target | Lane (levels 1–8) | Mid (about 15:00) | Late (30:00+) |
|---|---|---|---|
| Gun carry → squishy (assassin, poke, burst, support) | 5–7 s | 3–4 s | 2–3 s |
| Gun carry → medium (control, skirmisher, carry) | 6–8 s | 3.5–5 s | 2.5–3.5 s |
| Gun carry → tank | 8–11 s | 5–7 s | 4–5 s |
| Any other archetype → squishy | 6–8 s | 4.5–6 s | 3.5–5 s |
| Any other archetype → tank | 10–13 s | 7–9 s | 6–8 s |

- **Combos:** an assassin's or spirit burst's full rotation on a squishy removes at most 60 % of max HP in lane (no
  one-combo kills between equals). Mid and late, it kills in 1.5–2.5 s. A tank always survives at least 4 s of it.
- **Lane trades:** a normal trade costs 15–35 % of max HP over 10–20 s (about 1.5–3 % of max HP per second while
  trading), as in both bursts. Kills need a committed all-in.
- **Team fights:** 12–25 s from first hero damage to last kill, then a push. A four-bird group with its wave takes a
  Hawk in 10–20 s and a Heron in 20–35 s at the time each usually falls.
- **Current fit:** PERCH's level-1 numbers already sit inside the lane column. For example, Hornbill on Kingfisher is
  5.8 s, Hornbill on Cassowary 8.2 s, Owl on Kingfisher 8.0 s and Cockatoo on Cassowary 11.7 s. Mid and late need
  telemetry with bots.

### GDD numbers that look wrong against the reference

- **§8.1 and §15.2:** a start of 0 Seeds delays the first item to several minutes (G23).
- **§9 per-level HP:** growth (about 6 % of base per level) and the Plumage HP values give a curve far flatter than
  the reference's ×2 by 10:00 and ×4 by 40:00 (G24).
- **§8.9 respawn:** too short from mid game on (G26).
- **§15.3 and the M4 targets:** a typical end of 28–38 min sits below the 38–41 min the clean videos show (G28).
- **§4.1:** the 0.35 m shoulder lift and the 2.6 m minimum boom (G13, G14).
- **§12.4, §12.5, §12.7 and §12.8:** these still describe the Tab scoreboard, a top-left minimap and a top-right kill
  feed, which D-EP-041 and this reference replace. The Director rewrites them in the next GDD pass.

## 7. Stage 4 flags (wave 5)

- **UI/HUD:**
  - Build the D-EP-041 top strip.
  - Show objective bars only in context.
  - Move HP to a gauge beside the bird, abilities to the bottom centre, the minimap to the bottom right and the ammo
    count under the crosshair.
  - Put the kill feed on the left with a kill badge.
  - Hide the melee hint unless it applies.
  - Add a "+Seeds" pop and a status word for hard effects.
  - Stop Brood Ward lines from reaching the feed (G01–G04, G06–G10, G30).
- **Rendering & VFX:** remove the opaque white slabs from the Updraft ride and boost (G16).
- **Camera & Input with the Architect:** lower the shoulder lift from 0.35 m to 0.15 m (G13).
- **Technical Artist:** cap held-gun size (G15).
- **Level Designer and Objectives:** in the W5 rebuild, frame lanes with façades, add a prop or cover piece every
  6–10 m and roof drops of 8–12 m (G19, G20).
- **Bot AI:** bots that fight (G22).
- **Economy & Items with the Director:** a 600-Seed starting purse (G23).
- **QA:** a gate capture of a 3v3 at 40 m to judge outlines, bars and names (G18).

## Gap list

Owners use the STATUS role names.

- **Severity:** **High** means it breaks the feel or hides the game. **Medium** means a player would notice it within
  a match. **Low** means polish or a tuning target.
- **Stage:** **S4** means wave 5 or its gate. **S5** means the style guide, model, VFX and balance work.

### G01 · HUD · Scoreboard strip · High · S4

- **Owner:** UI/HUD, with Rendering for the portraits.
- **Reference vs PERCH:** the reference has 12 portraits with per-hero net worth, team totals with a lead %, the
  next-objective window, respawn counts on dead portraits and a critical tag. PERCH has text totals, structure pips
  and five always-on objective bars.
- **Why it matters:** it is the whole match state at a glance, with no key to press.
- **Fix:** build D-EP-041.
  - Portraits 64–72 px, spread across x 18–82 % of the width.
  - A 16 px clock over two team-total pills, with the lead % under the leader.
  - The next Egg or Roc window as "mm:ss–mm:ss".

### G02 · HUD · Contextual objective bars · Medium · S4

- **Owner:** UI/HUD.
- **Reference vs PERCH:** in the reference a structure's bar appears only when you are near or hitting it, and a pair
  shows side by side. PERCH shows both Patrons and three Hawks all the time.
- **Why it matters:** it clears the top of the screen and makes the bar news when it appears.
- **Fix:** show a bar when the local bird is within 40 m of the structure or hit it in the last 5 s.
  - At most 2 bars, 380 × 10 px, with the name in 16 px capitals.
  - The Patron and the Roc get a 600 px named bar.

### G03 · HUD · Health gauge beside the bird · High · S4

- **Owner:** UI/HUD.
- **Reference vs PERCH:** the reference has a tall gauge next to the hero, 40 px HP numerals and a red chunk for
  recent damage. PERCH has a thin bar in the bottom-left corner.
- **Why it matters:** HP is read without leaving the fight, and damage taken is felt.
- **Fix:**
  - A vertical gauge of about 160 × 265 px at x 22–30 % and y 62–86 %.
  - Current and max HP in numerals.
  - The damage chunk holds 0.5 s, then drains over 0.4 s.
  - Shields and barrier as white and grey caps, stamina pips at the foot.

### G04 · HUD · Ability row at the bottom centre · Medium · S4

- **Owner:** UI/HUD.
- **Reference vs PERCH:** the reference has round icons with the cooldown inside and keys under, with actives to the
  right. PERCH has text boxes in the bottom-left panel.
- **Why it matters:** cooldowns are read in peripheral vision, and the left side stays free for the gauge.
- **Fix:**
  - 72 px round icons with 16 px gaps, centred.
  - Cooldown numbers in 28 px.
  - Tier pips under each icon, with 56 px item actives to the right.

### G05 · HUD · Stat badges and item grid · Low · S5

- **Owner:** UI/HUD.
- **Reference vs PERCH:** the reference shows three stat badges and a 2 × 6 item grid at the bottom left. PERCH shows
  level and Seeds only, plus the active slots.
- **Why it matters:** it shows build growth during play.
- **Fix:** add Talon %, SP and max-HP badges (64 px) and an owned-item grid of 12 + 4 flex slots (48 px, locks on
  unopened slots).

### G06 · HUD · Minimap · Medium · S4

- **Owner:** UI/HUD.
- **Reference vs PERCH:** the reference minimap is bottom right, about 370 px, round, with lane colours, camp timers
  and the zone name. PERCH's is top left, 220 × 254 px.
- **Why it matters:** it is the standard place in the genre, larger and readable mid-fight.
- **Fix:** move it to the bottom right at a 360 px diameter (the round mask keeps the 260:300 content), with the zone
  name under it and Thicket and rune timers on the map.

### G07 · HUD · Ammo under the crosshair · Medium · S4

- **Owner:** UI/HUD.
- **Reference vs PERCH:** the reference shows a 16 px magazine count about 80 px under the crosshair. PERCH shows
  40 px "24 / 24" in the corner panel.
- **Why it matters:** reload timing without looking away.
- **Fix:** add "rounds" in 16 px, 80 px below the crosshair, and keep the reload ring.

### G08 · HUD · Kill feed and kill badge · Medium · S4

- **Owner:** UI/HUD.
- **Reference vs PERCH:** the reference feed is on the left, with portraits and bounty, a red kill badge at the
  crosshair and a streak tag. PERCH's feed is top-right text, and structures are credited as "The world".
- **Why it matters:** kills are the payoff moment.
- **Fix:**
  - Follow D-EP-041.
  - Name structures and neutrals as killers ("Dusk Heron").
  - Show a 1.2 s, 140 px kill badge with the Seeds earned, up and right of the crosshair.

### G09 · HUD · Melee hint · Medium · S4

- **Owner:** UI/HUD.
- **Reference vs PERCH:** the reference shows prompts only when they apply. PERCH's "tap / hold" box sits beside the
  crosshair all the time.
- **Why it matters:** clutter in the most valuable pixels.
- **Fix:** show the hint only when a melee-claimable target (Ember, rune, Egg, Woven Nest, Feeder) is within 3.5 m,
  and during a player's first 2 minutes ever.

### G10 · HUD · Contextual feedback · Medium · S4 part, S5 rest

- **Owner:** UI/HUD.
- **Reference vs PERCH:** the reference has a currency pop, a big status word, proc names, a level-up banner, a
  tower-kill banner, a buff ledger, offscreen ally markers and a hit vignette. PERCH has the low-HP vignette, damage
  arcs and ping text.
- **Why it matters:** every gain and every hard effect is felt the moment it lands.
- **Fix in S4:**
  - A "+N Seeds" pop near the crosshair for any income of 10 or more (20 px gold, 0.8 s).
  - A status word (36 px, bottom centre) while stunned, silenced, rooted or disarmed.
  - A level-up and flex-slot banner (1.5 s).
- **Fix in S5:** a buff and debuff ledger, offscreen ally markers, and a hit pulse at the screen edge on every hit.

### G11 · UI · Shop flow · Medium · S5

- **Owner:** UI/HUD, with the Technical Artist for icons.
- **Reference vs PERCH:** the reference shop is one category per tab, four tier boxes of icon cards, a stat sheet and
  hero model, a buy queue and a build tab. PERCH has three text columns with everything at once.
- **Why it matters:** faster scanning and visible power growth when buying.
- **Fix:**
  - Tabs: Recommended, Talon, Plumage, Song.
  - 4 tier boxes per tab, with cards of 104 × 120 px (a 72 px icon plus the name) and the price on the tier header.
  - A left panel with portrait and 9 stats.
  - An owned overlay and a "buy next" strip.

### G12 · HUD · Damage numbers · Low · S5

- **Owner:** UI/HUD, with Rendering.
- **Reference vs PERCH:** in the reference big hits are big and chip damage small. PERCH's fast-forwarded siege
  carpets the screen with fledgling numbers.
- **Why it matters:** the important hits must stand out.
- **Fix:**
  - Merge hits per target within 0.3 s.
  - Scale the type from 18 to 40 px for 20 to 400 damage.
  - At most 8 numbers on screen; fledgling numbers at 70 % size.

### G13 · Camera · Head level with the crosshair · Low · S4

- **Owner:** Camera & Input, with the Architect (CAMERA) and the Director (§4.1).
- **Reference vs PERCH:** the reference crosshair is level with the hero's head. PERCH's head sits 70–100 px lower
  (0.35 m lift).
- **Why it matters:** the aim feels like it comes from the bird's eye.
- **Fix:** change `shoulderUp` from 0.35 m to 0.15 m.

### G14 · Camera · Small birds stay small · Low · S5

- **Owner:** Architect and Camera & Input.
- **Reference vs PERCH:** in the reference a small hero is simply smaller on screen (about 30 % of the height), at the
  same distance. PERCH shortens the boom to as little as 2.6 m.
- **Why it matters:** size reads as a trait, and small birds see more.
- **Fix:** change `boomMin` from 2.6 to 3.2. Tall birds still pull back to 4.0.

### G15 · Camera · Local bird and gun footprint · Medium · S4 (gun cap), S5 (style guide)

- **Owner:** Technical Artist.
- **Reference vs PERCH:** the reference hero is slim and the gun small at the hand. PERCH's bird is wide and its
  rifle a black bar to the screen edge.
- **Why it matters:** the lower-left quarter is where enemies come from.
- **Fix:** cap held-gun length at 0.45 × bird height and thickness at 0.08 m, and apply the style-guide footprint
  limits (bird at most 18 %, gun at most 4 % of the screen).

### G16 · VFX · Updraft ride and boost · High · S4

- **Owner:** Rendering & VFX.
- **Reference vs PERCH:** the reference ride keeps the view clear. PERCH shows opaque white vertical slabs over up to
  40 % of the screen.
- **Why it matters:** you can't see where you are going or who is shooting.
- **Fix:** streaks at most 3 px wide and 25 % alpha, only outside the central 50 % of the screen and at most 15 % of
  its height long. Keep the +5° FOV kick.

### G17 · VFX · Effect value and colour · Medium · S5

- **Owner:** Rendering & VFX, with the Technical Artist.
- **Reference vs PERCH:** reference effects are saturated, colour-coded rings and cores against a dark scene. PERCH's
  are pale white and yellow blobs and slabs on a bright scene.
- **Why it matters:** ability reads decide fights.
- **Fix:** areas get a 3 px rim and at most 25 % fill, tracers a core of at most 2 px, and no opaque white over 5 % of
  the screen (style guide).

### G18 · Readability · Team identification · Medium · S4

- **Owner:** QA, with UI/HUD and Rendering.
- **Reference vs PERCH:** the reference shows red enemy bars and names and white ally bars. PERCH has the §14.4 rules,
  but there are no enemy birds in Play to check them.
- **Why it matters:** it is the first read in every fight.
- **Fix:** a W5 gate capture of a 3v3 showing outlines, bars and names readable at 40 m.

### G19 · Map · Lane framing and density · High · S4

- **Owner:** Level Designer (D-EP-033).
- **Reference vs PERCH:** reference streets are lined with 3–8 storey fronts, with clutter every few metres and a
  second level. PERCH's lanes have plain walls, open ground and few props.
- **Why it matters:** cover, routes and a sense of place make up the moment-to-moment feel.
- **Fix:**
  - Lane edges are façades 8–16 m tall with doors and windows.
  - No plain wall run longer than 12 m is visible from a lane.
  - A prop or cover piece every 6–10 m along each lane.
  - One raised route (4–8 m) per 30 m of lane.
  - The perimeter is hidden behind façades or trunks.

### G20 · Map · Verticality in fights · Medium · S4

- **Owner:** Level Designer, with Objectives.
- **Reference vs PERCH:** in the reference, fights spill over roofs and players drop 8–12 m into plazas. PERCH's
  roofs are reachable only by Chimney or Vine.
- **Why it matters:** height is a weapon (pillar 3).
- **Fix:** at least 3 roof-to-street drops of 8–12 m beside lanes per quarter, and stairs to a balcony at least every
  40 m of lane.

### G21 · Map · Lighting mood · Medium · S5

- **Owner:** Rendering & VFX, with the Technical Artist.
- **Reference vs PERCH:** the reference has dark blue ambient with warm practical lights. PERCH has flat bright
  daylight.
- **Why it matters:** contrast is what makes heroes and effects pop.
- **Fix:** a late-dusk preset.
  - Ambient about 0.35, sun about 1.2 at 12–18° elevation.
  - Lit windows on about 30 % of façades, lantern pools.

### G22 · Pacing · Hero bots that fight · High · S4

- **Owner:** Bot AI.
- **Reference vs PERCH:** the reference has lane trades from 1:20 and 6v6 fights. PERCH's Play mode has no enemy
  birds, and the `match` scene's bots stand at spawn.
- **Why it matters:** nothing else in this list can be felt without them.
- **Fix:** the W5 bots. The gate shows a lane trade and a 6v6 fight.

### G23 · Economy · Starting purse · Medium · S4

- **Owner:** Economy & Items, with the Director (§8.1, §15.2).
- **Reference vs PERCH:** in the reference every hero starts with a purse and buys the first item around 1:00. PERCH
  starts at 0 Seeds, earning about 1 Seed/s passive from 0:30.
- **Why it matters:** the first decision lands in the first minute.
- **Fix:** start at 600 Seeds, so with lane income the first 800-Seed item lands by about 1:00.

### G24 · Balance · Max-HP growth · Medium · S5

- **Owner:** Balance & Data (D-EP-045).
- **Reference vs PERCH:** the reference grows ×2.0 by 10:00 and ×4 by 40:00, items included. PERCH's base reaches
  ×1.47 by 10:00 and ×2.58 by 40:00 before Plumage.
- **Why it matters:** fights stay meaningful as damage grows.
- **Fix:** target a balanced build at ×2.0 / 2.8 / 3.4 / 4.0 at 10:00 / 20:00 / 30:00 / 40:00. Levers: per-level HP
  of 8–9 % of base (Shrike +34 becomes about +50) and Plumage HP values.

### G25 · Balance · Level-up rhythm · Low · S5

- **Owner:** Balance & Data, with the Director.
- **Reference vs PERCH:** the reference is at level 15 by 10:00, about one banner every 40 s. PERCH's target is level
  9 at 10:00.
- **Why it matters:** frequent small power bumps.
- **Fix:** a steeper early curve (level 12 at 10:00), or a minor boon so that a power bump lands every 45–60 s to
  10:00. AP totals stay as they are.

### G26 · Balance · Respawn late · Low · S5

- **Owner:** Economy & Items, with Balance.
- **Reference vs PERCH:** the reference shows 31 s at 16:20 and up to 66 s at 37:00. PERCH has 27.6 s at 16:20 and
  52 s at 37:00, capped at 55.
- **Why it matters:** late deaths must decide the match.
- **Fix:** min(75, 6 + 1.75 × minutes), which gives 34 s at 16:00, 58.5 s at 30:00 and 70.8 s at 37:00.

### G27 · Balance · TTK windows · Medium · S5

- **Owner:** Balance & Data (D-EP-043, D-EP-045).
- **Reference vs PERCH:** the reference has slow lane trades and fast team-fight kills. PERCH fits the lane column at
  level 1; mid and late are unmeasured.
- **Why it matters:** this is the core of combat feel.
- **Fix:** adopt the §6 table and measure it with hard bots on the simulation track.

### G28 · Balance · Match length · Low · S5

- **Owner:** Balance & Data.
- **Reference vs PERCH:** the reference's clean videos end at about 38–41 min (one at least 28). PERCH's GDD target
  is 25–40, typically 28–38.
- **Why it matters:** the third act needs room.
- **Fix:** target 28–45 min with a median of 35–38.

### G29 · Animation · Updraft ride pose · Low · S5

- **Owner:** Technical Artist.
- **Reference vs PERCH:** the reference hero hangs under the cable. PERCH's bird stands upright on top of it.
- **Why it matters:** the ride reads as a ride.
- **Fix:** hang beneath the cable, gripping a hook, with the cable 0.3 m above the head and the camera unchanged.

### G30 · HUD · Feed noise · Low · S4

- **Owner:** UI/HUD.
- **Reference vs PERCH:** the reference feed carries only kills and objectives. PERCH's fills with Brood Ward
  raised/down lines during sieges.
- **Why it matters:** the feed must stay news.
- **Fix:** show Brood Ward state as an icon on the structure bar, never in the feed.

**Count:** 30 gaps: 5 High (G01, G03, G16, G19, G22), 16 Medium, 9 Low. **Stage 4 now:** G01, G02, G03, G04, G06,
G07, G08, G09, G10 (pop, status word, banner), G13, G15 (gun cap), G16, G18, G19, G20, G22, G23, G30. Everything
else is Stage 5.
