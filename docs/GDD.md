# PERCH — Game Design Document

Owner: Game Director (#2). Canonical design intent for every role. Once `src/sim/data/` exists, the data is the
source of truth for numbers and Balance & Data tunes it; this document keeps the intent, the rules and the
starting values. Every number here is a starting value unless it is called a rule.

Conventions: distances in metres (m), times in seconds (s), speeds in m/s, angles in degrees. Coordinates use
x = east, y = up, z = north; the map centre is (0, 0, 0). "SP" is Song power. Percentages that add are written
"+N%"; percentages that multiply are written "×N". **(assumed)** marks a rule where the live behaviour of the
reference game was uncertain and the conventional MOBA answer was chosen.

Contents: [1 Vision](#1-vision-and-pillars) · [2 Glossary](#2-glossary) · [3 Controls](#3-controls-and-movement) ·
[4 Camera](#4-camera-and-aim) · [5 Combat](#5-combat) · [6 Map](#6-map) · [7 Units](#7-units-and-structures) ·
[8 Economy](#8-economy) · [9 Heroes](#9-heroes) · [10 Items](#10-items) · [11 Bots](#11-bots) · [12 UI](#12-ui-and-ux) ·
[13 Audio](#13-audio-direction) · [14 Visuals](#14-visual-direction) · [15 Match flow](#15-match-flow) ·
[16 Feel checklists](#16-feel-checklists) · [Appendix A](#appendix-a-concept-mapping)

---

## 1. Vision and pillars

PERCH is a third-person 6v6 lane shooter for the browser: one human and eleven bots, two flocks of birds fighting
through a city built inside an old forest. Its loop follows Valve's Deadlock as closely as we can make it; every
name, creature, sound and shape is ours.

**Pillars**

1. **Aim is king, kits are the crown.** Every hero has a real gun with real beak shots. Abilities set up, finish
   or survive gunfights; they never replace them.
2. **Every seed is a decision.** Last hits, pod timing, denies, Thickets, the Egg, the Roc: seeds come from many
   places, and where you spend the next 30 seconds is the core strategic choice.
3. **The city is a climbing frame.** Rooftops, balconies, Chimneys, Vines and Updrafts make height a weapon. Good
   movement (dash-jump, slide, mantle) beats a better gun.
4. **Readable at a glance.** Low-poly birds with bold silhouettes, warm Dawn against cool Dusk, a crisp sound for
   every important event. A player who has never seen PERCH should name a hero's role from 40 m.
5. **A match is a story in three acts.** Laning, roaming, sieging. 25–40 minutes, comebacks are possible, the
   Patron always falls in the end.

**Target experience:** a 30-minute match on a mid-range laptop at 60 FPS that feels tight in the hands within
the first minute and still has decisions to make at minute 35.

---

## 2. Glossary

| Term | Definition |
|---|---|
| **Dawn Flock** | The south team (base at z = −150). Warm amber colours. Patron: the Elder Raven. |
| **Dusk Flock** | The north team (base at z = +150). Cool violet-blue colours. Patron: the Great Owl. |
| **Flock** | A team of six heroes. |
| **Patron** | Each flock's giant guardian bird in the heart of its base. Kill the enemy Patron to win. Two phases. |
| **Elder Raven** | Dawn Flock's Patron. |
| **Great Owl** | Dusk Flock's Patron. |
| **Home Roost** | A flock's spawn platform behind its Patron. Heals allies, hurts enemies, contains a Magpie's Hoard. |
| **Lane** | One of three authored paths between the bases that fledglings march along. |
| **Hedgerow** | The west lane: walled gardens, hedges, terraced houses with balconies. Short sightlines. |
| **Riverbank** | The middle lane: a river with boardwalks, mills and the Old Mill Bridge over the Hollow. Long sightlines. |
| **Pinewood** | The east lane: tall pines, timber houses on stilts, rope walkways. Strong high ground. |
| **Jungle** | The city blocks and woods between lanes, holding Thickets, Nests, Chimneys and Vines. |
| **Fledglings** | Lane units that spawn in waves and march down every lane. Melee **Scrappers** and ranged **Slingers**. |
| **Seeds** | The single resource. Earned seeds raise your level; unspent seeds buy items. |
| **Net worth** | Total seeds a hero has earned in the match (spent or not). Sets level and bounties. |
| **Seed pod** | The glowing pod that pops out of a fledgling when it dies. Shoot it at the right moment to secure or deny it. |
| **Last hit** | The killing blow on a fledgling or neutral. A hero's last hit pays the instant share. |
| **Secure** | Shooting a pod from a fledgling your side killed: pays you the pod share. |
| **Deny** | Shooting a pod from your own side's dead fledgling before the enemy secures it. |
| **Sentinel Hawk** | First lane tower (one per lane per flock). Punishes heroes who attack heroes under it. |
| **Stilt Heron** | Second, larger lane tower: stomp and beam. Its first kill unlocks a flex slot for the killers. |
| **Nest Warden** | Base gate towers, two per lane per flock. |
| **Roost Shrine** | Two per flock inside the base. Both must fall before the Patron can be damaged. |
| **Brood Ward** | Backdoor protection: structures take −65% damage while no enemy fledgling is within 30 m. |
| **Thicket** | A jungle camp of neutral creatures (tier 1, 2 or 3) that pays seeds and respawns. |
| **Nest** | A breakable woven nest (crate) in the jungle and on rooftops. Small seed payout, sometimes a crumb buff. |
| **Crumb buff** | A 60 s minor buff that sometimes drops from a Nest. |
| **Feather rune** | A timed pickup on the two rune bridges that gives a 90 s buff (Swift, Fierce, Sage or Stout). |
| **Golden Egg** | Objective from 10:00. Carry it to the Hatching Stone to pay your flock. The carrier can't shoot or cast and is revealed. |
| **Egg Perch / Hatching Stone** | The two stone circles on the centre line. The Egg spawns on one perch; the other is the Hatching Stone. |
| **The Hollow** | The sunken pit under the Old Mill Bridge in the map centre where the Roc lives. |
| **The Roc** | Neutral giant bird boss in the Hollow, from 20:00. Drops the Phoenix Ember. |
| **Phoenix Ember** | Dropped by the Roc. Claimed by landing a charged heavy melee on it. Gives the claiming flock a 180 s buff. |
| **Ember buff** | The flock-wide buff from the Ember: faster respawns, stronger fledglings, +15% damage. |
| **The Magpie's Hoard** | The shop. Three columns (Talon, Plumage, Song) by four tiers. At the Home Roost and at lane Magpie stalls. |
| **Magpie stall** | A lane shop: one per lane per flock, between the Hawk and the Heron. |
| **Talon** | (1) Item category for gun power. (2) Damage type of guns and melee. |
| **Plumage** | Item category for health, resists, regeneration and movement. |
| **Song** | (1) Item category for ability power. (2) Damage type of abilities and most item effects. |
| **Song power (SP)** | Stat that scales ability effects: each effect lists "+k × SP". |
| **Talon resist / Song resist** | Percentage reduction of incoming Talon / Song damage. |
| **Level** | 1–30, set by net worth. Each level-up is a Molt. |
| **Molt** | A level-up: base stat growth (health, gun damage, SP, melee) and usually Ability Points. |
| **AP** | Ability Points. Spent on ability upgrade tiers costing 1, 2 and 5 AP. |
| **Upgrade tier** | One of three improvements per ability (T1 = 1 AP, T2 = 2 AP, T3 = 5 AP), bought in order. |
| **Ultimate** | Ability slot 4. Unlocks at level 6. |
| **Kit** | A hero's gun plus four abilities. |
| **Item slot** | Holds one item. 12 base slots. |
| **Flex slot** | An extra item slot unlocked for the whole flock by objectives (4 in total). |
| **Active** | An item with a castable effect, bound to Z / X / N / V. |
| **Stamina pip** | One charge of stamina. Traversal can spend whole or half pips; stamina regenerates over time. |
| **Dash** | Short burst of speed on Shift; costs one pip. |
| **Dash-jump** | Jumping during the ground dash timing window for a long, low leap at the cost of a second pip. |
| **Slide** | Crouching while running: a fast, low slide that carries momentum. |
| **Mantle** | Pull-up onto a ledge within reach while holding Jump. |
| **Updraft** | A rideable wind current strung above each lane, base to base (zipline). Boost and dismount at will. |
| **Updraft station** | A marked mount point on an Updraft (gates, near Herons and Hawks, and centre). |
| **Chimney** | A vertical warm-air shaft that lifts you to a rooftop. |
| **Vine** | A climbable vine or rope on a wall or tree. |
| **Beak shot** | A gun hit on a hero's head hitbox. Deals critical damage (×1.65 by default). |
| **Falloff** | Gun damage reduction with distance, between a start and end range. |
| **Parry** | A short block window (F) that stuns an enemy whose melee lands in it. |
| **Heavy melee** | Charged melee (hold Q): slower, stronger, lunges, can be parried. Claims the Phoenix Ember. |
| **Bounty** | Seeds paid for killing a hero, raised for shut-downs and for comeback kills. |
| **Comeback bonus** | Bounty and Egg multiplier paid to the flock with the lower total net worth. |
| **Ping** | A map marker placed with middle mouse (tap: contextual; hold: wheel). |
| **Status** | A timed condition such as stun or slow. Full list in §5.9. |
| **Effect primitive** | One of the small set of building blocks every ability and item active is made from (§9.25). |

---

## 3. Controls and movement

### 3.1 Default bindings (every action is rebindable in Settings → Controls)

| Action | Default | Notes |
|---|---|---|
| Move | W A S D | Full speed in every direction. |
| Look | Mouse | Pointer lock while playing. |
| Fire | LMB | Hold for automatic fire. |
| Aim (zoom) | RMB (hold) | FOV ×0.8 (Owl ×0.5), spread ×0.75; drops sprint and preserves base run speed. Cancels a `point` ability's placement. |
| Reload | R | §5.6. |
| Jump | Space | Also dismounts an Updraft or Vine. |
| Crouch / slide | C (hold) | Slides when moving fast enough or downhill (§3.5). Double-tap in the air to down-dash. Toggle option in settings. |
| Dash | Left Shift | Costs one stamina pip on the ground or in the air. Boosts on an Updraft. |
| Melee | Q | Release before 0.35 s for light. At 0.35 s of continuous hold, commits heavy. |
| Parry | F | §5.8. |
| Abilities 1–4 | 1, 2, 3, 4 | Slot 4 is the ultimate. |
| Upgrade ability 1–4 | Alt + 1–4 | Spends AP on the next tier. |
| Inspect / upgrade abilities | Left Alt (tap) | Frees the pointer for the ability panel. Esc or Close returns to aiming (§12.4). |
| Item actives | Z, X, N, V | Bound to the first four active items in slot order (rebindable per slot). |
| Interact | E | Pick up the Golden Egg, deliver, mount an Updraft at a station. |
| Shoulder swap | G | §4.2. |
| Shop (Magpie's Hoard) | B | Opens only in a shop zone; elsewhere shows the read-only shop. |
| Scoreboard | Tab (hold) | §12. |
| Ping | Middle mouse | Tap: contextual ping. Hold: ping wheel. |
| Big map | M (hold) | Full-screen minimap. |
| Pause / menu | Esc | Single-player: pauses the simulation. |

In a normal browser tab, W + C and W + Left Shift + C are safe default chords for forward crouch/slide and
dash-slide. Left Ctrl with W can close the tab. See §12.9 for legacy saves, binding conflicts and mouse buttons.

### 3.2 Ground movement

| Parameter | Value |
|---|---|
| Run speed | 7.0 m/s (per hero 6.6–7.6, §9) in every direction |
| Sprint | After 5 s without aiming or a combat action (§5.13): +2.0 m/s, ramping in over 0.5 s while running. Aim or a combat action drops the bonus immediately and restarts eligibility; the 5 s count starts again on releasing aim. |
| Ground acceleration | 50 m/s² (full speed in ~0.14 s) |
| Ground deceleration | 40 m/s² with no input |
| Step-up height | 0.45 m (stairs and kerbs need no jump) |
| Max walkable slope | 45° |
| Crouch walk | 3.5 m/s; capsule and head height ×0.65 |
| Fall damage | None |

### 3.3 Jump and air control

| Parameter | Value |
|---|---|
| Gravity | 25 m/s² (heroes); falling speed capped at 30 m/s |
| Jump | Apex 1.6 m (launch speed 8.94 m/s, 0.36 s to apex) |
| Coyote time | 0.1 s after leaving a ledge |
| Jump buffer | 0.1 s before landing |
| Air control | Acceleration 15 m/s² (30% of ground) toward the input direction; horizontal speed above run speed is kept, never added to by air control |
| Air jump | Press Jump again while airborne: 1 pip, once per airtime. Set vertical velocity to +8.94 m/s and keep horizontal velocity. |
| Wall jump | Press Jump while airborne in contact with a near-vertical solid wall or within 0.1 s of leaving it. Push away at 6 m/s and carry the along-wall component of horizontal velocity. First push is free; later pushes in the same airtime cost 0.5 pip each. A heavy lunge can bring the hero into wall-jump range before landing. |
| Wall fatigue | At full strength, a wall jump sets vertical velocity to +7 m/s. Each wall jump and each airborne heavy-melee commitment starts 1.25 s of fatigue. While fatigued, the next wall jump launches between +3.5 and +7 m/s, recovering linearly over that interval. |
| Jump priority | A ledge pull-up or traversal dismount takes precedence in its context. Otherwise resolve dash-jump, ground/coyote jump, wall jump, then air jump. A wall jump with insufficient stamina leaves the air jump available under its own cost. Buffer a fresh Jump press for landing only when no jump can start immediately. |

### 3.4 Stamina, dash and dash-jump

| Parameter | Value |
|---|---|
| Stamina pips | 3 (Secretarybird, Swift, Hummingbird: 4; items can add more) |
| Pip regeneration | Refill 1 pip per 5.0 s of missing stamina, including in the air; display whole and half pips. Spending during a refill preserves its progress. |
| Dash input | Press Dash in the camera-yaw direction of the movement keys at that moment (forward with no movement input). |
| Ground dash | 5.5 m over 0.2 s (27.5 m/s), exits at run speed + 1 m/s; costs 1 pip |
| Air dash | 4.5 m over 0.2 s, clears vertical velocity on start. Costs 1 pip, once per airtime. |
| Dash lockout | 0.4 s from the start of the last ground or air dash. |
| Dash-jump | Press Jump 0.10–0.30 s after starting a ground dash, while still grounded or in ground coyote time. Costs 1 more pip (2 total). Launch at 13 m/s in the dash direction and +7 m/s up (~1.0 m apex, ~7.3 m airborne on level ground). A jump outside the window or with insufficient stamina uses normal jump rules. |
| Down-dash | Two fresh crouch presses at most 0.25 s apart during the same airtime set vertical velocity to −18 m/s and carry horizontal momentum to landing. Costs 0.5 pip, once per airtime. |
| Resets | Landing resets air jump, air dash, down-dash, wall-jump count and wall fatigue. Per-airtime limits and pending jump/crouch inputs also reset on respawn. Dash lockout still applies on landing. |
| Casts | Check normal cast conditions during a dash. A permitted cast closes dash-jump eligibility; the ability's movement rules govern any interruption. |
| Feedback | Dash FOV kick (§4.3) and wing whoosh. Show the dash-jump window at the crosshair while eligible and able to pay, with a distinct launch cue on success. Air and wall jumps show a flap or push pose; a down-dash shows a tuck and a landing cue. |
| Status | Root, Grounded or Stun blocks dashes and jumps. The Egg carrier can dash. |

Traversal reference: [Deadlock Wiki movement guide](https://deadlock.wiki/Movement).

### 3.5 Slide

| Parameter | Value |
|---|---|
| Trigger | Hold crouch, or enable it in toggle mode, at ≥ 5.0 m/s on the ground or moving downhill on a walkable slope steeper than 8°. Also checks on landing and mantle exit. |
| Start | Carry entry momentum in its current direction, including a dash landing. The +2.0 m/s start boost applies up to 10 m/s without reducing an already-faster entry; sliding costs no stamina. |
| Decay | Friction slows the slide to crouch-walk speed over 1.0 s on flat ground |
| Slopes | Downhill slopes steeper than 8° add gravity along the slope; the slide lasts while on that slope (max 16 m/s) |
| Steering and exit | Mouse steers up to ±45° per second. Releasing crouch (or toggling it off) ends the slide and returns to normal ground acceleration; walls clip the blocked velocity component. |
| Boost cooldown | The +2.0 m/s start boost is available again 1.0 s after a slide ends |
| Slide-jump | Jumping during a slide keeps its horizontal speed. Holding crouch through landing can chain the slide, subject to the boost cooldown. |
| Shooting | Allowed; spread unchanged |

### 3.6 Mantle

- Hold Jump while approaching and facing a ledge within 0.8 m ahead, with room for the standing capsule on top.
  Measure the 0.6–2.4 m rise from the ground at approach. Lower rises use the step-up or a jump.
- Duration 0.35 s. Stand on top with 50% of entry horizontal speed, or slide on top with entry momentum if
  crouch is active and slide conditions are met. The usual slide boost cooldown applies.
- No shooting, abilities or reload progress during a mantle; it can't be cancelled.
- Mantling is blocked while rooted, grounded, stunned or carrying the Egg.

### 3.7 Updrafts (lane ziplines)

| Parameter | Value |
|---|---|
| Layout | One per lane, gate to gate, 12 m above the lane path at the rider's feet. Stations at both gates and the midpoint, and 6 m along the lane toward each owning gate from its Heron and Hawk (§6.3). |
| Mount | E within 2 m of a station, or jump into the line while airborne within 1.5 m of it. Mounting takes 0.3 s. |
| Direction | Toward the end the camera faces when mounting |
| Ride speed | 11 m/s |
| Boost | Dash while riding: 18 m/s for 3 s; 12 s cooldown per hero; costs no stamina; can't boost for 3 s after taking hero damage |
| While riding | Gun, reload, melee and item actives allowed. Casting an ability dismounts (and then casts). Parry is disabled. |
| Dismount | Space: jump off with +4 m/s up and 70% of ride velocity. Crouch: drop off with 70% of ride velocity. Reaching the end of the line drops you at the station. |
| Forced dismount | Stun, knockback, knock-up, pull, root or grounded |
| Not allowed | Egg carrier |

### 3.8 Chimneys and Vines

| | Chimney | Vine |
|---|---|---|
| What | Vertical warm-air shaft inside or beside a building, 1.5 m radius | Climbable vine or rope on a wall or tree |
| Use | Walk or jump into the shaft base | Move into the vine holding W |
| Motion | Lifted at 9 m/s; exit at the top with +6 m/s up, onto the roof or balcony | Climb at 4.5 m/s up (S climbs down at 4.5 m/s); A/D shimmy 2 m/s |
| Allowed | Gun and reload while rising | Nothing but climbing; Space jumps off backwards at 5 m/s |
| Heights | 8–14 m | 5–12 m |
| Blocked by | Grounded, Egg carrier | Grounded, Egg carrier |

### 3.9 Knockback and displacement handling

- Displacements add an impulse to the hero's velocity (they do not teleport). Knockback distance in this
  document is the distance travelled on flat ground; the controller converts it to an impulse.
- During a knockback or pull the hero has 20% air control until landing; a knock-up gives 0% control until
  landing (max 1.5 s).
- A displaced hero that hits a wall stops; "wall slam" effects trigger if the hero still had ≥ 4 m/s of
  displacement speed toward the wall.
- Unstoppable heroes ignore displacement. There is no mass or knockback resistance stat.
- Displacement cancels channels, mantles and Updraft rides.

### 3.10 Hedgerow traversal run

Start at the Dawn Hedgerow gate. Follow the lane past the Heron, taking the side of the lane around its column.
Enter the middle of the lane between the Heron and the Hawk, dash forward, then press Jump as the timing cue
appears. Hold crouch before landing to carry speed into a slide. Turn toward the east 1.2 m hedge at
x = −92…−88, z = −49…−47.5, then hold Jump into its face to mantle. Keep crouch held to carry a fast
approach onto the top. Continue to the station 6 m gateward of the Hawk, face the bridge, press Interact to
mount, press Dash to boost over the Hawk and press Jump to dismount. Observe the stamina spent on the
dash-jump, the retained landing speed and the unobstructed pass above the tower.

---

## 4. Camera and aim

### 4.1 Rig

| Parameter | Value |
|---|---|
| Pivot | The hero's eye point: head centre height (§9) − 0.05 m |
| Boom | 3.2 m behind the pivot along the view direction |
| Shoulder offset | 0.75 m to the right (left after a swap), +0.35 m up, applied at the pivot |
| Scale with hero size | Boom length × (hero height / 1.8 m), clamped to 2.6–4.0 m, so tall heroes don't fill the screen |
| Pitch limits | −80° (looking down) to +80° |
| Hero opacity | Fades to 30% opacity when the camera is closer than 1.0 m to the hero's capsule |
| Crouch | Pivot lowers with the head, eased over 0.12 s |

### 4.2 Shoulder swap

- G swaps the shoulder offset to the other side over 0.15 s (ease in-out). The setting persists until swapped
  again.
- Auto-swap is off by default; an option swaps automatically when the current shoulder is blocked by a wall
  within 0.5 m.

### 4.3 FOV

| Parameter | Value |
|---|---|
| Default | 90° horizontal (setting range 75–110°); the renderer converts to vertical FOV from the aspect ratio |
| Dash kick | +6° over 0.08 s, back over 0.25 s |
| Sprint | +3° while sprinting, eased over 0.3 s |
| Updraft boost | +5° while boosting |
| Aim (RMB) | ×0.8 of current FOV (Owl ×0.5) over 0.12 s; mouse sensitivity scales by the same factor |

### 4.4 Collision pull-in

- Each frame a sphere of radius 0.25 m is cast from the pivot to the desired camera position against world
  geometry only (not heroes, units or pods).
- On a hit, the camera sits at the hit distance − 0.1 m, snapping in immediately.
- When the obstruction clears, the camera eases back out at 6 m/s.
- Minimum boom 0.6 m; at that point the hero is faded (§4.1).

### 4.5 Aim model (rule; bots use it too)

1. Cast a ray from the camera position through the crosshair (screen centre), max 300 m (Owl 400 m).
2. Ignore hits closer to the camera than the camera-to-pivot distance + 0.3 m (so nothing between the camera and
   the hero, including the hero itself, can be the aim point).
3. The first hit (world geometry or any hitbox except the shooter's) is the **aim point**; with no hit, the aim
   point is the end of the ray.
4. The shot leaves the gun's muzzle (a socket on the hero model; the sim uses a fixed muzzle offset per hero:
   0.35 m forward, 0.25 m right, at chest height) and travels toward the aim point. Spread is applied around that
   direction.
5. The muzzle-to-aim-point path is honest: if world geometry blocks it, the shot hits the geometry.
6. **Bots** build the same camera from their own pivot and boom, aim the camera at their chosen target point
   plus their aim error (§11), and fire through the same steps. The sim never lets a bot fire along a path a
   player couldn't.
7. Directional abilities use the same aim point for their direction; `point` abilities use the aim point
   projected to the ground below it, clamped to range.

### 4.6 Crosshair

- Centred dot (2 px) plus four ticks whose gap shows the current spread cone at 10 m.
- Hit marker: white X for a hit, gold X for a beak shot, red larger X for a kill; 0.15 s, 0.3 s for kills.
- Colour option: white (default), green, yellow, cyan; outline always on.
- Reload progress shows as a thin ring around the dot; an ability's `point` placement shows its ground marker
  instead of moving the crosshair.
- A blue arc marks the affordable dash-jump window (§3.4). A filled sweep shows melee charge to commitment,
  followed by a heavy swing and recovery cue. Parry shows its active window and then its success or whiff (§5.8).

### 4.7 Mouse

- Sensitivity 1.0 = 0.06° per mouse count; slider 0.1–5.0. Separate aim (RMB) multiplier, default 1.0.
- Raw pointer-lock deltas; no acceleration or smoothing. Invert-Y option.
- Melee and parry accept standard and side mouse buttons through Settings → Controls (§12.9). While playing
  under lock, a bound side button acts on press and release without navigating the browser. LMB and RMB can be
  assigned with the same conflict handling as keyboard bindings.

---

## 5. Combat

### 5.1 Damage types

| Type | Sources | Mitigated by | Beak shot? |
|---|---|---|---|
| **Talon** | Gun bullets and pellets, light and heavy melee, fledgling and structure attacks marked Talon, Talon item procs | Talon resist, Talon shield, barrier | Gun bullets only |
| **Song** | Abilities, item actives and procs, Thicket creatures, Roc and Patron special attacks marked Song | Song resist, Song shield, barrier | Only effects flagged `beakShot` (Owl's Moonlit Mark) |

There is no third damage type. Every damage event carries `type`, `amount`, `source` (hero, unit, structure or
neutral), `isGun`, `isMelee`, `isAbility` and `beakShot` flags.

### 5.2 Damage pipeline (rule; the Architect's contract follows this order)

1. **Base**: gun per-pellet damage × (1 + gun growth × (level − 1)); ability base + k × SP; melee base + growth.
2. **Falloff** (gun only), by muzzle-to-hit distance (§5.5).
3. **Beak shot** (gun only, head hitbox): × (beak multiplier + attacker beak bonus). Flat beak bonuses from items
   are added after the multiplier.
4. **Outgoing modifiers**: attacker's gun damage % (gun), Song damage % (Song), conditional bonuses (range, target
   kind, HP threshold). Additive within the step, then applied once.
5. **Incoming amplification**: target's "damage taken" statuses (additive, cap +50%).
6. **Resist** of the matching type (§5.3).
7. **Structure rules**: Brood Ward (×0.35), Patron invulnerability gates (§7).
8. **Shields**: matching-type shield first, then barrier, then health (§5.10).
9. **Health.** Lifesteal heals the attacker for its % of the post-step-7 damage (heroes 100%, non-heroes 50%).

Damage numbers are kept as floats in the sim and shown rounded. A hit is applied in the tick it is resolved.

### 5.3 Resists and stacking

- Positive resist sources of one type stack multiplicatively: `R = 1 − Π(1 − rᵢ)`. Two 20% sources give 36%.
- Resist reductions ("shred") of one type add up and are subtracted after stacking: `Rfinal = R − Σ shred`.
- Clamp `Rfinal` to [−50%, +85%]. Negative resist amplifies damage.
- Damage taken = damage × (1 − Rfinal).
- All heroes start with 0% Talon and 0% Song resist. Fledglings have 0%. Structures: see §7.

### 5.4 Beak shots

- Every hero model has a real head hitbox: a sphere centred on the head bone (radius per hero, §9). The body is
  one capsule (radius and height per hero). Head is tested before body; a bullet that hits both counts as a beak
  shot.
- Default beak multiplier ×1.65 (`combat.beakShotMult`). Owl's gun uses ×2.0.
- Shotgun pellets each roll their own beak shot.
- **Cannot be beak-shot:** fledglings, structures, Thicket creatures, the Roc, the Patron (its phase-2 weak point
  is a separate rule, §7.7), Nests. Lyrebird's decoys **can** be beak-shot (they must look and sound like the real
  hero). Melee and abilities never beak-shot unless flagged.
- Feedback: gold hit-marker cross, the beak-shot tick sound, gold damage number.

### 5.5 Falloff

Gun damage is 100% up to `falloffStart`, falls linearly to 25% at `falloffEnd`, and stays at 25% beyond it, up to
the gun's max range (120 m; Owl 200 m), after which the bullet does nothing. Hitscan and projectile guns both use
the distance from the muzzle to the hit point. Items that extend falloff scale both ranges.

### 5.6 Guns

Each hero has one gun (§9 lists every value). Common rules:

| Property | Rule |
|---|---|
| Fire | Hold LMB to fire at `fireRate` shots/s. One shot fires `pellets` pellets. Every gun is fully automatic. |
| Spread | `spread` is the cone half-angle in degrees. Each pellet's direction is sampled uniformly over the cone with the seeded RNG. Airborne ×1.3; aiming (RMB) ×0.75. |
| Aim | The shot leaves the muzzle toward the aim point found by the camera ray (§4.5). |
| Hitscan | Instant ray from the muzzle; stops at the first world geometry or hitbox. |
| Projectile | Moves at `projectileSpeed` m/s, no gravity, collision radius 0.06 m, despawns at max range. Uses the same hitboxes. |
| Magazine | Each shot uses one round. At 0 rounds the gun auto-reloads. |
| Reload | Full-magazine reload of `reload` s, or per-round for shell-loaders (Albatross). Movement, dashing and sliding do not interrupt a reload. |
| Reload-cancel | Firing (if rounds > 0), melee, parry or casting an ability cancels a reload. A full-magazine reload loses its progress; a per-round reload keeps rounds already loaded. Pressing R with a full magazine does nothing. |
| Pierce | Bullets do not pierce unless an item or ability says so. Seed pods are hit by bullets but never stop them. |
| Friendly fire | None. Shots pass through allies. |

### 5.7 Melee

| | Light melee | Heavy melee |
|---|---|---|
| Input | Press Melee and release before 0.35 s | Hold Melee for 0.35 s. The attack commits at the threshold and finishes if released after commitment. |
| Timing | Hit 0.25 s after release, finish 0.55 s after release | Windup starts on press; lunge starts on commitment, hit at 0.60 s from press, then 0.40 s recovery |
| Reach | Sweep 2.8 m ahead, 1.2 m radius | Lunges up to 3.5 m in the aim direction, clipped by solid geometry, then sweeps 2.8 m |
| Damage (Talon) | 50 + 3 per level | 115 + 6 per level |
| Extra | Can be parried. | Knockback 3 m. Can be parried. Claims the Phoenix Ember. |
| Feedback | Quick sweep pose and air swish, with hit feedback on contact. | Draw-back pose and crosshair charge, distinct lunge and swing cue, hit or miss followed by a visible recovery. |
| Notes | Cancels reload. Can't beak-shot. Gun damage % does not apply to melee. Both hit Nests, fledglings and structures (structures take 50% melee damage). |

### 5.8 Parry

- **Input:** press Parry (F by default). The parry window opens 0.05 s after the press and lasts 0.6 s.
- **Success:** an enemy hero's light or heavy melee that lands in the window from within the parrier's front 180°
  deals no damage; the attacker is stunned for 2.0 s; the parrier's parry cooldown resets to 0. Parry does not
  block bullets or abilities. Parrying neutrals' attacks does nothing.
- **Whiff:** if nothing is parried, the parrier can't fire or melee for 0.4 s after the window closes, and parry
  goes on a 5 s cooldown.
- Feedback: show the guarding pose and active window. On success, play a bright "clink" and a white radial
  flash. On whiff, play a dull whoosh and show the recovery and 5 s cooldown.

### 5.9 Statuses

A status has a `kind`, a `source`, a `duration` and, for graded statuses, a `magnitude`. Negative statuses'
durations are reduced by the target's **status resist** (stacks multiplicatively, cap 60%).

**Stacking rules (rule):**
- **On/off statuses** (stun, silence, disarm, root, grounded, reveal, invisibility, true sight, unstoppable,
  intangible): one instance per kind; a new application sets remaining = max(remaining, new).
- **Graded statuses** (slow, fire-rate slow, heal reduction, damage amp, resist shred): every application is kept
  as its own instance. Slow, fire-rate slow and heal reduction use only the **strongest** active instance. Damage
  amp and resist shred **add** across instances (caps below).
- **Damage over time** (bleed, burn): each source's instance is separate; reapplying from the same source
  refreshes duration and does not stack. Ticks every 0.5 s.
- **Displacements** (knockback, knock-up, pull) are impulses, not timed statuses; knock-up also applies an
  `airborne` state until landing.

| Status | Effect | Typical duration | Notes |
|---|---|---|---|
| **Stun** | No movement, gun, melee, parry, abilities or items. Interrupts channels and reloads. | 0.5–2.0 s | Unstoppable blocks it. |
| **Silence** | No abilities and no item actives. | 1.0–3.0 s | Gun and melee still work. |
| **Disarm** | No gun fire. | 1.0–2.5 s | Melee, abilities and items still work. |
| **Root** | No walking, jumping, dashing or movement abilities. | 0.75–2.0 s | Can shoot and cast non-movement abilities. |
| **Grounded** | No dash, jump, Updraft, Chimney, Vine or movement abilities. | 1.0–3.0 s | Can still walk. |
| **Slow** | −X% movement speed. | 1.0–3.0 s | Strongest only. Speed never drops below 1.5 m/s. |
| **Fire-rate slow** | −X% fire rate. | 2.0–4.0 s | Strongest only. |
| **Knockback** | Impulse away from a point or along a direction. | — | 80% less air control until landing. |
| **Knock-up** | Vertical impulse; `airborne`, no control until landing. | 0.5–1.25 s airborne | Max 1.5 s. |
| **Pull** | Impulse toward a point. | — | Same handling as knockback. |
| **Reveal** | Shown on the enemy minimap and outlined through walls for the enemy flock. | 3–8 s | Does not remove invisibility (minimap only while invisible). |
| **True sight** | The holder (and, for area true sight, allies in it) sees invisible enemies within its radius. | 5–9 s | Positive status. |
| **Invisibility** | Unseen by enemies beyond 8 m; a faint shimmer within 8 m. Firing, melee or casting ends it unless the source says otherwise (`breaksOnAttack`, default true). Taking damage shows a 0.5 s shimmer. True sight shows the hero fully. | 2–8 s | Positive status. |
| **Heal reduction** | −X% healing received from every source, including regeneration. | 3–8 s | Strongest only. |
| **Damage amp** | +X% damage taken (Talon, Song or both). | 3–6 s | Adds; cap +50%. |
| **Resist shred** | −X% Talon or Song resist. | 4–8 s | Adds (§5.3). |
| **Bleed / burn** | Damage per second of a given type. | 2–6 s | Per source; refresh, no stack. |
| **Unstoppable** | Immune to stun, silence, disarm, root, grounded, slow and displacement; removes them on gain. | 1–3 s | Positive status. |
| **Intangible** | Takes no damage and no statuses; can't be targeted; projectiles and hitscan pass through. | 0.5–4 s | Positive status. |
| **Undying** | Health can't fall below 1; damage that would go lower is ignored. | 1.5–5 s | Positive status. |
| **Marked** | A tag from a named source (e.g. Marked Prey); no effect alone; other effects key off it. | 5–14 s | One per source. |
| **Carried** | Attached to another unit's socket (Pelican's Gulp); also stunned and intangible. | ≤ 1.25 s | Released on carrier stun or death. |
| **Egg carrier** | Can't fire, cast, use items, parry or ride Updrafts/Chimneys/Vines; −15% move speed; revealed. | while carrying | §7.11. |

### 5.10 Shields and barriers

- **Talon shield** absorbs only Talon damage; **Song shield** only Song damage; **barrier** absorbs both.
- Order after resists: matching typed shield → barrier → health. Several instances of one kind are drained
  oldest first.
- Each instance has an amount and an optional duration. Item shields that "recharge" refill to full after the
  stated time without taking damage.
- Shields do not count as health for heal effects and can't be healed.

### 5.11 Healing and regeneration

- Heal applied = amount × (1 + heal amplification) × (1 − strongest heal reduction). Healing never exceeds
  max health.
- Base regeneration: 2 HP/s for every hero, always on.
- Home Roost: allies inside heal 20% max HP per second; enemies inside take 300 Song damage per second (pure
  deterrent; resists apply).
- Lifesteal: see §5.2 step 9. Talon lifesteal counts gun and melee damage; Song lifesteal counts Song damage.

### 5.12 Damage over time and areas

- DoTs and area effects tick every 0.5 s (`combat.tickInterval`) and deal duration-weighted damage per tick.
- An area effect hits each target at most once per tick, even if several of the same area overlap.
- Areas never hit allies unless stated, and never hit structures unless stated.

### 5.13 Combat state

A hero is **in combat** for 4 s after dealing or taking hero damage, firing a gun, or casting a damaging ability.
Sprint uses the same combat actions with the 5 s delay in §3.2. "Out of combat" item effects use the 8 s
rule where stated.

---

## 6. Map

This is the Level Designer's brief. The layout is an original PERCH design: an old market town grown through by
forest, built for birds — gardens and terraces in the west, a mill river in the middle, timber stilt-houses in the
pines to the east.

### 6.1 Footprint and symmetry

- Playable area: x −130 to +130 (260 m), z −150 to +150 (300 m). A 20 m band of giant trunks and cliffs outside
  it is solid and unclimbable; an invisible wall at the edge stops anything that gets over it.
- Ground level y = 0 along lanes. Jungle buildings are 6–14 m tall; the tallest tree platforms reach 18 m.
  Lowest point: the floor of the Hollow at y = −10.
- **Mirror rule:** gameplay geometry is authored for the Dawn half (z ≤ 0) and mirrored by z → −z for Dusk.
  Anything on z = 0 must be its own mirror image. Lane *art* differs west to east (Hedgerow, Riverbank,
  Pinewood) but the two flocks' halves of each lane are mirror images, so every lane is fair.
- Structure, camp and shop positions are also mirrored east–west (x → −x) so both side lanes have the same
  distances; terrain and cover inside each side lane differ.

### 6.2 Top-down sketch

North is up (Dusk), south is down (Dawn). One character = 5 m east–west; one row = 10 m north–south. Positions are
rounded to the grid; §6.3 has the exact coordinates.

```
       x: -130                   0                    +130
      +-----------------------------------------------------+
  150 |              ############R############              |   Dusk base
  140 |              #           P           #              |
  130 |              #        S     S        #              |
  120 |              #                       #              |
  110 |              ####W#######W#######W####              |   Dusk gates
  100 |            ....          .          ....            |
   90 |         ....             .             ....         |
   80 |       H..    2           H           2    ..H       |   Herons
   70 |       .                  .                  .       |
   60 |     $ .                  . $                . $     |   Magpie stalls
   50 |       .            1     .     1            .       |
   40 |       h                  h                  h       |   Hawks
   30 |       .                  .                  .       |
   20 |       .     1           O:O           1     .       |
   10 |       .          3    OOO:OOO    3          .       |
    0 |       r        E     OOOO:OOOO     E        r       |   centre line
  -10 |       .          3    OOO:OOO    3          .       |
  -20 |       .     1           O:O           1     .       |
  -30 |       .                  .                  .       |
  -40 |       h                  h                  h       |   Hawks
  -50 |       .            1     .     1            .       |
  -60 |     $ .                  . $                . $     |   Magpie stalls
  -70 |       .                  .                  .       |
  -80 |       H..    2           H           2    ..H       |   Herons
  -90 |         ....             .             ....         |
 -100 |            ....          .          ....            |
 -110 |              ####W#######W#######W####              |   Dawn gates
 -120 |              #                       #              |
 -130 |              #        S     S        #              |
 -140 |              #           P           #              |
 -150 |              ############R############              |   Dawn base
      +-----------------------------------------------------+
        Hedgerow (west)        Riverbank (mid)        Pinewood (east)

 Legend:  . lane path (an Updraft runs 12 m above every lane)   # base wall   R Home Roost (spawn + shop)
          P Patron   S Roost Shrine   W Nest Warden pair (lane gate)   H Stilt Heron   h Sentinel Hawk
          $ Magpie stall   O the Hollow (Roc pit)   : Old Mill Bridge   E Egg Perch / Hatching Stone
          r Feather rune bridge   1 2 3 Thicket tier   (the blank jungle is city blocks, alleys and woods)
```

Lane lengths along the path: Hedgerow and Pinewood 289 m gate to gate; Riverbank 224 m.

### 6.3 Coordinates (Dawn half; Dusk = same x, z negated)

| Object | Position (x, z) | Notes |
|---|---|---|
| Home Roost (spawn) | (0, −146) | Platform 2 m up, 10 m radius zone; Magpie's Hoard inside; ramps down both sides of the Patron |
| Patron (Elder Raven; Dusk: Great Owl) | (0, −136) | On a 3 m dais; body footprint 8 m radius |
| Roost Shrines | (−16, −126), (16, −126) | 4 m footprint each |
| Base | x −60…60, z −150…−114 | Walled; three gates in the north wall |
| Gates (fledgling spawn points) | Hedgerow (−40, −114), Riverbank (0, −112), Pinewood (40, −114) | Each gate 12 m wide |
| Nest Wardens (pairs) | 6 m either side of each gate, 4 m in front of the wall | Two per lane |
| Stilt Herons | Hedgerow (−95, −75), Riverbank (0, −80), Pinewood (95, −75) | |
| Sentinel Hawks | Hedgerow (−95, −35), Riverbank (0, −40), Pinewood (95, −35) | |
| Magpie stalls | (−105, −58), (10, −60), (105, −58) | 6 m shop zone; own flock only |
| Lane paths | Hedgerow (−40, −114) → (−95, −80) → (−95, 80) → (−40, 114); Riverbank (0, −112) → (0, 112); Pinewood mirrors Hedgerow in x | Fledglings follow these polylines |
| The Hollow | centre (0, 0), radius 22 m, floor y −10 | Ramps up to the jungle at east and west (4 m wide), drops from the bridge |
| Old Mill Bridge | x −5…5, z −22…22, deck y 0 | Riverbank lane crosses the Hollow on it |
| Egg Perches / Hatching Stones | (−50, 0), (50, 0) | Raised plazas 1 m high; 3 m delivery circle |
| Feather rune bridges | over Hedgerow at (−95, 0) and over Pinewood at (95, 0) | Footbridges 6 m up spanning the lane; rune sits mid-span |
| Thickets tier 1 | (−65, −22), (−30, −52), (30, −52), (65, −22) | 4 per half |
| Thickets tier 2 | (−60, −80), (60, −80) | 2 per half |
| Thickets tier 3 | (−40, −12), (40, −12) | 2 per half, next to the Egg Perches |
| Updraft stations | each gate, z = 0, and 6 m along the lane toward each owning gate from its Heron and Hawk | 12 m above the lane path |

Hawks and Herons stay grounded at their listed x/z anchors. Their collision and visible geometry, including
animated poses, stay at or below 10 m above the lane to leave at least 2 m below the Updraft rider's feet.
Attack targeting and stomp measurements use the original ground anchor and the ranges in §§7.2–7.3. The
visible shot and beam can originate at the eyes and bill.

### 6.4 The lanes

| Lane | Width | Character | Sightlines | Verticality |
|---|---|---|---|---|
| **Hedgerow** (west) | 14 m | Walled kitchen gardens, clipped hedges (1.2 m and 2.5 m), stone terraces of narrow houses with balconies over the lane, a dovecote tower at the rune bridge | Short: max 35 m along the lane, broken by hedge chicanes every ~30 m | Balconies at 4 m on both sides of the lane between Hawk and Heron; hedges are mantle-height cover |
| **Riverbank** (mid) | 18 m | A slow river (decorative, shallow, no slow) along the east edge of the lane, boardwalks, water mills, a market square at each Hawk, the Old Mill Bridge over the Hollow | Long: the Hawks see each other (80 m); the bridge's arched railings are the only cover in the centre | Mill roofs at 8 m beside each Hawk; the Hollow below the bridge |
| **Pinewood** (east) | 16 m | Tall pines, timber houses on stilts, a sawmill yard, rope walkways between platforms | Medium: 50 m at ground level, 70 m from platforms | Platforms at 6 m and 10 m above the lane, linked by rope walkways; best high ground on the map |

Each side lane bends toward its base after its Heron (§6.2), creating a "corner" fight space at each Heron.

### 6.5 Jungle

- Between the lanes on each half: city blocks of 2–4 buildings separated by 5–8 m alleys, small squares and
  wooded yards. Two jungle zones per half (west and east of Riverbank).
- **Rooftops and balconies:** at least 40% of jungle buildings have walkable roofs reached by Chimney, Vine or
  balcony stairs. Rooftops connect with rope bridges or gaps ≤ 6 m (a level dash-jump travels about 7.3 m in the air).
- **Chimneys:** 6 per half, at least one within 25 m of every tier-2 and tier-3 Thicket and of each Hawk. Rise
  8–14 m.
- **Vines:** 10 per half on walls and big trees, 5–12 m tall, at least one on every lane's Hawk-side building
  and one at each Egg Perch plaza.
- **Thickets** at the coordinates in §6.3, each in a yard of 12–16 m with two entrances.
- **Nests:** 16 per half: 8 in alleys, 4 on rooftops, 4 at lane edges between Hawk and Heron. They respawn
  (§7.9).
- **Cover rule:** no open ground wider than 25 m without hard cover (wall, crate stack, tree) except the lanes'
  market squares and the Hollow floor.

### 6.6 Bases

- Walled square x −60…60; the wall is 8 m tall and not climbable from outside. Inside: the three gates, the
  Wardens just outside each gate, the two Shrines, the Patron on its dais and the Home Roost behind it.
- From the Home Roost, ramps lead to each gate (≤ 45 m to any gate). An Updraft station at each gate starts that
  lane's Updraft.
- Enemies inside the Home Roost zone take 300 Song damage per second (§5.11); the zone only exists to stop
  spawn camping.

### 6.7 Navigation data the Level Designer delivers

- Lane polylines (above) for fledglings; a nav graph covering lanes, jungle, rooftops, Chimneys, Vines and
  Updraft stations, with link types (walk, jump, dash-jump, mantle, chimney, vine, updraft, drop) for bots.
- Named points: every object in §6.3, plus bot "safe spots" behind each tower and "ambush spots" near each
  Thicket.

---

## 7. Units and structures

General rules for all non-hero units and structures:
- None of them can be beak-shot (§5.4).
- Structures take full Talon damage (melee 50%), 50% Song damage from direct ability hits, and no damage from
  areas or damage over time.
- Structures don't regenerate and don't respawn. Damage "per player" bounties go to every hero of the flock.

### 7.1 Fledglings

| | Scrapper (melee) | Slinger (ranged) |
|---|---|---|
| Model | 0.9 m round chick with stubby wings, team-coloured head down | 0.8 m chick with a sling, team-coloured cap |
| HP | 260 | 200 |
| Attack | 20 Talon per hit, every 1.0 s, 2.5 m reach | 14 Talon per shot, every 1.2 s, 18 m range, projectile 30 m/s |
| Vs structures | ×1.5 damage | ×1.5 damage |
| March speed | 5.0 m/s | 5.0 m/s |
| Scaling | HP and damage +1.5% per minute of match time, fixed at spawn | same |
| Seed value | 40 at 0:00 (§8.2) | 50 at 0:00 |

**Waves:** first wave at 0:30, then every 30 s, from each gate of both bases, down every lane.

| Match time | Per lane per flock | Map-wide per wave |
|---|---|---|
| 0:30–9:59 | 3 Scrappers + 1 Slinger | 24 |
| 10:00–19:59 | 3 Scrappers + 2 Slingers | 30 |
| 20:00+ | 4 Scrappers + 2 Slingers | 36 |

Waves march in a column two wide, 1.5 m apart, Scrappers in front. They reach the map centre line ~22 s
(Riverbank) or ~29 s (side lanes) after spawning, so waves meet near z = 0 when lanes are even.

**Targeting (rule).** Every 0.5 s a fledgling picks, in order:
1. the nearest enemy fledgling within 14 m;
2. an enemy hero within 14 m who damaged an allied hero in the last 2 s;
3. the nearest enemy structure within attack range;
4. the nearest enemy hero within 10 m;
5. otherwise it marches on along its lane.

It keeps its target until the target dies, leaves 18 m, or a higher-priority target appears. A fledgling pulled
more than 18 m from its lane path drops its target and returns to the path. Fledglings ignore Thicket creatures,
Nests, the Roc and the Egg.

### 7.2 Sentinel Hawk (one per lane per flock)

| Parameter | Value |
|---|---|
| HP | 4500 |
| Attack | Homing bolt (60 m/s, can't be dodged), 1 per second, 22 m range. 70 Talon to heroes, +15% for each consecutive shot on the same hero (max +75%); 50 Talon to fledglings |
| Targeting | 1) an enemy hero who damaged an allied hero within 22 m in the last 2 s; 2) the nearest enemy fledgling; 3) the nearest enemy hero. Sticky until the target dies, leaves range, or a rule-1 target appears |
| Gate | None: vulnerable from the start |
| Bounty | 300 seeds per player to the destroying flock |
| Unlocks | The flock's first Hawk kill unlocks flex slot 1; its second unlocks flex slot 2 (§8.7) |
| Look | A hawk statue on an 8 m stone column, wings half-open, with the whole tower at most 10 m tall; eyes glow in team colour while it has a target |

### 7.3 Stilt Heron (one per lane per flock)

| Parameter | Value |
|---|---|
| HP | 9000 |
| Gate | Vulnerable only after its lane's Hawk has fallen **(assumed)** |
| Beam | 30 m range, locked on one target: 100 Talon per second to heroes (ticks every 0.25 s), +10% per second on the same hero (max +50%); 50 per second to fledglings. Same targeting rules as the Hawk |
| Stomp | Every 4 s while any enemy is within 7 m: 0.5 s telegraph (leg raised, ground ring), then 120 Song damage and 5 m knockback in a 7 m radius |
| Bounty | 600 seeds per player |
| Unlocks | The flock's first Heron kill unlocks flex slot 3 |
| Look | A wading heron on stilt legs inside a timber frame, all at or below 10 m, including its raised-leg pose; steps in place, beam from the bill |

### 7.4 Nest Wardens (two per lane per flock)

| Parameter | Value |
|---|---|
| HP | 4000 each |
| Gate | Vulnerable only after their lane's Heron has fallen |
| Attack | Homing bolt, 1 per second, 24 m range: 80 Talon to heroes (same ramp as the Hawk), 60 to fledglings. Same targeting rules |
| Bounty | 250 seeds per player each |
| Look | Paired 7 m owl-faced gate posts woven from branches |

### 7.5 Roost Shrines (two per flock)

| Parameter | Value |
|---|---|
| HP | 8000 each |
| Gate | Vulnerable once both Wardens of any one lane have fallen |
| Pulse | Every 3 s: 120 Song damage to enemy heroes within 12 m |
| Bounty | 500 seeds per player |
| Unlocks | The flock's first Shrine kill unlocks flex slot 4 |

### 7.6 Brood Ward (backdoor protection)

- Hawks, Herons, Wardens, Shrines and the Patron take ×0.35 damage while no fledgling of the attacking flock is
  within 30 m of the structure.
- Shown as a pale eggshell dome over the structure while active; the dome cracks away when an attacking
  fledgling enters the 30 m radius.
- It applies at pipeline step 7 (§5.2), after resists.

### 7.7 The Patron (Elder Raven for Dawn, Great Owl for Dusk)

| | Phase 1 | Transition | Phase 2 |
|---|---|---|---|
| Gate | Invulnerable until both of its flock's Shrines have fallen | | |
| HP | 15000 | 3 s, invulnerable | 20000 (fresh bar) |
| Attacks | **Feather Volley:** every 3 s, 6 homing feathers split across up to 3 enemy heroes within 35 m, 50 Song each. **Screech:** every 10 s if an enemy hero is within 14 m: 100 Song damage and 8 m knockback in 14 m | Sheds feathers; a 20 m blast knocks enemies back 8 m (no damage) | Feather Volley every 2 s. **Talon Rain:** every 6 s, 3 m circles under up to 4 enemy heroes, 1.0 s warning, 180 Song each. **Wing Gale:** every 12 s, a 30 m cone (90°) that pushes 10 m and deals 60 Song |
| Weak point | — | — | A glowing heart-feather on the chest (1.0 m sphere, 6 m up). Gun hits on it deal ×1.5 (not a beak shot: orange hit marker) |

The Patron doesn't move or regenerate. Phase 2 is permanent once reached. Destroying it in phase 2 ends the match:
its flock loses.

### 7.8 Thickets (neutral camps)

| Tier | Camp | Creatures | Attack | Seeds (whole camp) | First spawn | Respawn after clear |
|---|---|---|---|---|---|---|
| 1 | Beetle Thicket | 2 stag beetles, 350 HP each | 15 Talon per hit, 1/s, melee | 140 | 2:00 | 3:00 |
| 2 | Weasel Thicket | 3 weasels, 650 HP each | 25 Talon per hit, 1/s, melee with 4 m dash-bites | 360 | 6:00 | 4:00 |
| 3 | Badger Sett | 1 badger 3000 HP + 2 cubs 600 HP | Badger 60 Talon per hit 1/s; every 6 s a slam: 6 m, 120 Song, knockback 4 m | 900 | 10:00 | 5:00 |

- Seed values grow +2% per minute after the camp's first spawn time. Each creature pays its share to the hero
  who lands its killing blow **(assumed)**; no pods drop from neutrals.
- Creatures attack whoever damaged them most in the last 3 s. A creature pulled more than 20 m from its camp,
  or not damaged for 6 s, walks home and heals to full.
- 8 camps per half, 16 total (§6.3).

### 7.9 Nests (breakables)

- 80 HP; any damage breaks them (melee breaks one in two light hits).
- Pay 30 seeds (+3% per minute of match time) to the breaker.
- 25% chance (seeded) to drop a crumb buff for 60 s: **Quick crumb** +15% fire rate, **Light crumb** +1 m/s move
  speed, or **Sweet crumb** +15 SP (equal chances). A new crumb replaces an older one.
- Respawn 4:00 after breaking. 32 on the map (§6.5).

### 7.10 Feather runes

| Rune | Buff (90 s, lost on death) |
|---|---|
| **Swift feather** | +2 m/s move speed, stamina regenerates twice as fast |
| **Fierce feather** | +25% gun damage, +15% fire rate |
| **Sage feather** | +25 SP, +15% cooldown reduction |
| **Stout feather** | +300 max HP, +15 HP/s regeneration |

- Spawn on both rune bridges at 6:00, then 4:00 after that bridge's rune is picked up.
- Type chosen by seeded RNG; the two bridges never offer the same type at the same time.
- Picked up by walking through (1.5 m). A hero can hold one rune; a new one replaces the old.

### 7.11 The Golden Egg

| Rule | Value |
|---|---|
| First spawn | 10:00, on an Egg Perch chosen by seeded RNG; the other perch is the Hatching Stone |
| Next spawn | 5:00 after a delivery, on the perch it was delivered to (perch and stone swap) |
| Pick up | Interact (E) within 2 m for 0.5 s; hero damage interrupts |
| Carrier | Egg carrier status (§5.9): −15% move speed; can walk, jump, dash and slide; can't fire, cast, use items, parry, mantle or ride Updrafts, Chimneys or Vines; revealed to enemies; a golden light beam above the carrier is visible map-wide |
| Drop | On the carrier's death or stun, or by pressing E. Anyone can pick it up 1.0 s after a drop. Untouched for 30 s, it returns to its spawn perch |
| Deliver | Stand in the Hatching Stone circle (3 m) and channel 2.0 s; any hero damage interrupts |
| Payout | Every hero of the delivering flock: 500 + 50 per full minute after 10:00 (max 1500). The carrier gets +250. Comeback: ×1.25 if the delivering flock's total net worth is lower |

### 7.12 The Roc and the Phoenix Ember

| Rule | Value |
|---|---|
| Spawn | 20:00 **(assumed)**; respawns 7:00 after it dies |
| Model | A 9 m tall giant raptor with flame-tipped wings, asleep in the Hollow until damaged |
| HP and resists | 30000 + 1000 per minute after 20:00 (fixed at spawn); 20% Talon and 20% Song resist |
| Aggro | The hero that dealt it the most damage in the last 5 s; sticky for 3 s. It targets heroes inside the Hollow or on the bridge (within 25 m) |
| Talon Rake | Every 2.5 s: 8 m cone (90°) at its target: 140 Talon |
| Gale Flap | Every 10 s: 15 m radius, 80 Song, 10 m knockback outward |
| Enrage | Below 30% HP: +30% attack speed; every 8 s a Sky Shriek silences heroes within 20 m for 1.5 s |
| Reset | With no hero in the Hollow or on the bridge for 8 s, it heals to full and sleeps |
| Bounty | 250 seeds per hero of the flock that lands the killing blow |
| Ember drop | Floats 1.5 m above the spot where the Roc died; claimable after 1.0 s; the first **heavy melee** that connects with it (1.0 m sphere) claims it for that hero's flock. Unclaimed after 60 s, it goes to the flock that killed the Roc |
| Ember buff | 180 s for the claiming flock; survives death. Heroes: respawn time −50%, +15% Talon and Song damage, +8 HP/s regeneration. Fledglings spawned during it: +50% HP, +40% damage, and +30% more vs structures |

---

## 8. Economy

### 8.1 Seeds

- Seeds are the only resource. Every seed earned adds to **net worth** (never decreases) and to the unspent
  wallet. Net worth sets level (§8.5); the wallet buys items.
- Heroes never lose seeds on death.
- All payouts are rounded down to whole seeds at the moment of payment.

### 8.2 Fledglings, seed pods, last hits and denies

Fledgling value at death: **V = base × min(2.4, 1 + 0.035 × minutes)** where base is 40 (Scrapper) or 50
(Slinger) and minutes is the match time. Each fledgling's V is split into two halves:

| Half | Who gets it |
|---|---|
| **Instant share (50% V)** | The enemy hero who landed the killing blow (a **last hit**). If no hero landed it (a fledgling, structure or neutral did), the half is split evenly among enemy heroes within 25 m; if there are none, it is lost |
| **Pod share (50% V)** | Whoever resolves the **seed pod** (below) |

**Seed pod timing (rule):**
1. On death a pod appears at the fledgling's chest and rises 1.6 m over 0.6 s. It can't be hit while rising.
2. It then hangs **ripe** for 1.4 s, pulsing. A gun bullet or melee hit from any hero resolves it (abilities
   don't).
3. **Secure:** a hero of the killing side (the fledgling's enemies) hits it → that hero gets 50% V, with a bright
   "pop" and a rising chime.
4. **Deny:** a hero of the fledgling's own side hits it → that hero gets 25% V and the pod share is gone, with a
   dull crunch and a grey puff.
5. Not hit in the window, it withers (lost).
6. Pods glow gold for the side that can secure them and grey-blue for the side that can deny them. Bullets pass
   through pods (a pod never blocks a shot).

A perfect solo laner (every last hit and every pod) earns 100% V; letting fledglings trade earns 50% if near.

### 8.3 Hero kills and bounties

**Bounty B = (120 + 0.03 × victim net worth + streak bonus) × comeback multiplier**

- **Streak bonus** (shut-down): 60 × max(0, victim's kills since last death − 2), max 360.
- **Comeback multiplier:** 1 + min(0.5, 2 × max(0, (victim flock net worth − killer flock net worth) / victim
  flock net worth)). Killing into a flock 10% richer pays ×1.2; 25% or more pays ×1.5.
- **Split:** B is shared equally by the killer and every assister. An assister is an allied hero who damaged the
  victim in the last 12 s, or who healed, shielded or buffed a hero who did, within the last 12 s.
- **Death to a non-hero** (fledgling, structure, neutral): B is shared equally by enemy heroes within 40 m; if
  there are none, nobody is paid.
- Example: victim net worth 10,000, no streak, even flocks → 420 seeds.

### 8.4 Other seed sources

| Source | Amount | Who is paid |
|---|---|---|
| Passive income | 1 seed per second from 0:30 **(assumed)** | Every hero |
| Sentinel Hawk | 300 | Every hero of the destroying flock |
| Stilt Heron | 600 | Every hero of the destroying flock |
| Nest Warden | 250 each | Every hero of the destroying flock |
| Roost Shrine | 500 each | Every hero of the destroying flock |
| Patron | none (the match ends) | — |
| Thicket camp | 140 / 360 / 900 per tier, +2% per minute after first spawn | Per creature, to its killer (§7.8) |
| Nest | 30, +3% per minute | The breaker |
| Golden Egg | 500 + 50 per minute after 10:00 (max 1500), carrier +250, ×1.25 comeback | Every hero of the delivering flock (§7.11) |
| The Roc | 250 | Every hero of the flock that lands the killing blow |
| Feather runes, crumbs, the Ember | No seeds (buffs only) | — |

### 8.5 Levels, AP and the ultimate

**Seeds to reach level L: 400 × (L − 1) + 50 × (L − 1) × (L − 2).** Max level 30.

| Level | Net worth | AP gained | Total AP | Notes |
|---|---|---|---|---|
| 1 | 0 | 0 | 0 | Abilities 1–3 usable at base rank |
| 2 | 400 | 1 | 1 | |
| 3 | 900 | 1 | 2 | |
| 4 | 1,500 | 1 | 3 | |
| 5 | 2,200 | 1 | 4 | |
| 6 | 3,000 | 1 | 5 | **Ultimate unlocks** (base rank, no AP) |
| 7 | 3,900 | 1 | 6 | |
| 8 | 4,900 | 1 | 7 | |
| 9 | 6,000 | 1 | 8 | |
| 10 | 7,200 | 2 | 10 | |
| 11 | 8,500 | 1 | 11 | |
| 12 | 9,900 | 1 | 12 | |
| 13 | 11,400 | 1 | 13 | |
| 14 | 13,000 | 1 | 14 | |
| 15 | 14,700 | 1 | 15 | |
| 16 | 16,500 | 1 | 16 | |
| 17 | 18,400 | 1 | 17 | |
| 18 | 20,400 | 1 | 18 | |
| 19 | 22,500 | 1 | 19 | |
| 20 | 24,700 | 2 | 21 | |
| 21 | 27,000 | 1 | 22 | |
| 22 | 29,400 | 1 | 23 | |
| 23 | 31,900 | 1 | 24 | |
| 24 | 34,500 | 1 | 25 | |
| 25 | 37,200 | 1 | 26 | |
| 26 | 40,000 | 1 | 27 | |
| 27 | 42,900 | 1 | 28 | |
| 28 | 45,900 | 1 | 29 | |
| 29 | 49,000 | 1 | 30 | |
| 30 | 52,200 | 2 | 32 | Every ability fully upgraded |

- Upgrade tiers cost 1, 2 and 5 AP (8 per ability, 32 for all four). Tiers are bought in order, any time,
  anywhere (Alt + 1–4 or the HUD), even while dead. Ultimate tiers can be bought once it unlocks.
- Unspent AP carries over.

### 8.6 Molts (base stat growth per level)

Every level above 1 is a Molt and adds, per level:

| Stat | Growth |
|---|---|
| Max HP | Hero-specific (+28 to +46, §9) |
| Gun damage | +3% of the gun's base damage (gun carries +4%) |
| Song power | +1 SP |
| Light / heavy melee | +3 / +6 Talon damage |

A level-up also heals the hero by the max-HP increase. Molts shed a few feathers as a small VFX and play a soft
chime.

### 8.7 Item slots and flex slots

- 12 base slots; any item category in any slot. Each item can be owned once.
- 4 flex slots, unlocked for the whole flock: slot 1 at its first enemy Hawk destroyed, slot 2 at its second,
  slot 3 at its first enemy Heron, slot 4 at its first enemy Shrine. Unlocks are permanent.
- The first four **active** items, in slot order, are bound to Z, X, N, V.

### 8.8 Shop rules (the Magpie's Hoard)

- Buy and sell only inside a shop zone: the Home Roost or one of your flock's three Magpie stalls. The shop can
  be browsed anywhere (read-only).
- Buying an item whose component you own costs (item cost − component cost) and replaces the component in its
  slot. Without the component it costs the full price and needs a free slot.
- Sell refund: 50% of the item's full cost; 100% if sold within 20 s of buying it during the same shop visit.
- Item stats in §10 are the upgraded item's full stats; they replace the component's.

### 8.9 Respawn

**Respawn time = min(55, 8 + 1.2 × minutes) seconds**, rounded to 0.1 s: 8 s at 0:00, 20 s at 10:00, 32 s at
20:00, 44 s at 30:00, 55 s from 39:10. The Ember buff halves it. Heroes respawn at the Home Roost with full HP
and full magazine; cooldowns keep running while dead.

### 8.10 Income targets (for Balance)

| Match time | Average hero net worth | Average level |
|---|---|---|
| 10:00 | 6,000 | 9 |
| 20:00 | 18,000 | 17 |
| 30:00 | 33,000 | 23 |
| 40:00 | 48,000 | 28 |

The flock net-worth gap should rarely exceed 25% for more than 5 minutes; comeback multipliers (§8.3, §7.11) are
the levers.

---

## 9. Heroes

### 9.0 Roster

| id | Display name | Archetype | Gun | 1 | 2 | 3 | 4 (ultimate) |
|---|---|---|---|---|---|---|---|
| `shrike` | Shrike | Area control | Barb Rifle (projectile) | **Thorn Larder**: hidden ground trap, roots and reveals | **Briar Patch**: damaging, slowing zone | **Impaling Bolt**: knockback skillshot; stuns on wall pin | **Butcher's Ring**: thorn ring that roots and damages heroes who cross it |
| `albatross` | Albatross | Tank / initiator | Gale Blunderbuss (hitscan shotgun) | **Gale Shield**: moving wind wall that blocks shots | **Wing Slam**: dash that knocks enemies up | **Salt Hide**: resists and healing | **Tempest Dive**: leap and slam that stuns and pulls |
| `kingfisher` | Kingfisher | Assassin | Dart Pistol (hitscan) | **Plunge**: diving dash strike | **Glint**: invisibility with an ambush bonus | **Spear Bill**: lunging stab, execute and bleed | **Riverstrike**: teleport behind a marked hero and strike |
| `lyrebird` | Lyrebird | Support | Echo Lute (projectile) | **Mended Song**: targeted heal | **Echo Double**: running decoy that shoots | **Discord**: area disarm | **Grand Chorus**: channelled heal-and-resist aura |
| `owl` | Owl | Long-range poke | Hush Rifle (hitscan) | **Hush**: silencing projectile | **Night Eyes**: true sight and team reveal | **Silent Wing**: leap and glide | **Moonlit Mark**: channelled long shot that silences and reveals |
| `pelican` | Pelican | Gun carry | Gullet Gatling (hitscan) | **Gulp**: swallow a hero and spit them out | **Feeding Frenzy**: fire rate, reload and lifesteal | **Belly Flop**: leap and knockback landing | **Bottomless Pouch**: no ammo use, bonus and splash damage |
| `secretarybird` | Secretarybird | Mobility skirmisher | Quill Pair (hitscan) | **Stomp Kick**: knockback kick; wall stun; spends Footwork | **Long Stride**: two-charge dash | **Snake Stamp**: leap and stamp | **Viper Dance**: locked kick chain, unstoppable |
| `starling` | Starling | Spirit burst | Chatter Pistol (projectile) | **Murmuration**: piercing swarm line | **Mob**: swarm cloud that reveals and slows | **Scatter**: become an intangible swarm and move | **Black Sun**: huge swarm aura of heavy Song damage |
| `hornbill` | Hornbill | Gun carry | Casque Rifle (hitscan) | **Heavy Rounds**: empowered, slowing shots | **Mud Seal**: barrier and fire rate | **Bounding Hop**: hop and half reload | **Marked Prey**: bonus gun damage to one marked hero |
| `flamingo` | Flamingo | Support | Wader Repeater (hitscan) | **Pink Pool**: healing pool | **Poise**: ally barrier and status resist | **Flock Dance**: knockback ring, ally speed | **Tide Turn**: one ally becomes unstoppable, heals and hits harder |
| `penguin` | Penguin | Tank / initiator | Ice Chipper (projectile) | **Toboggan**: belly slide that bowls enemies over | **Huddle**: group barrier | **Ice Floe**: slowing ice patch | **Emperor's March**: unstoppable rush, knock-ups and slam |
| `puffin` | Puffin | Area control | Eel Sling (projectile) | **Burrow Colony**: puffling turrets | **Sea Spray**: knockback cone that slows | **Fog Bank**: hiding fog for allies | **Rogue Wave**: wave that sweeps enemies along |
| `peacock` | Peacock | Spirit burst | Plume Darts (projectile) | **Hundred Eyes**: fan of eye darts | **Dazzle**: disarming cone | **Strut**: speed and next-ability bonus | **Full Display**: huge frontal burst after a short channel |
| `vulture` | Vulture | Area control | Bone Shot (hitscan) | **Carrion Circle**: damage and heal-reduction zone | **Pick the Bones**: shredding, draining cone | **Thermal**: lifting column for allies | **Death Spiral**: pulling, grounding vortex |
| `swift` | Swift | Mobility skirmisher | Sickle SMG (hitscan) | **Slipstream**: two-charge air dash | **Screaming Party**: damaging aura and speed | **Wing Scythe**: returning blade | **Sky Stitch**: free flight with a gun bonus |
| `hummingbird` | Hummingbird | Mobility skirmisher | Nectar Needler (hitscan) | **Dart**: three-charge omnidirectional dash | **Nectar Sip**: draining tether | **Blur**: speed and resists | **Thousand Beats**: damaging, self-refilling darts |
| `cassowary` | Cassowary | Tank / initiator | Wattle Blaster (hitscan) | **Rampage**: unstoppable charge | **Dagger Kick**: shredding knockback kick | **Bristle**: Talon shield and thorns | **Boom Call**: pull everyone in, then stand unstoppable |
| `toucan` | Toucan | Long-range poke | Bill Rifle (hitscan) | **Fruit Lob**: arcing mortar | **Seed Spit**: revealing, shredding shot | **Branch Swing**: grapple leap | **Fruit Barrage**: long-range mortar rain |
| `woodpecker` | Woodpecker | Gun carry | Drum Drill (hitscan, spins up) | **Drumroll**: instant spin-up and fire rate | **Bore Hole**: Talon-shredding drill shot | **Tree Cling**: cling to a wall and shoot | **Hammerhead**: stacking detonations from gun hits |
| `nightjar` | Nightjar | Assassin | Moth Pistol (hitscan) | **Gape**: lunging, silencing bite | **Nightfall**: invisibility with an ambush hit | **Churring Call**: reveal and damage amp cone | **Night Swallow**: dash strike that executes |
| `frigatebird` | Frigatebird | Long-range poke | Kite Rifle (hitscan) | **Plunder Shot**: strips buffs, grants a shield | **High Pass**: leap and longer gun range | **Balloon Boom**: self-peel burst and barrier | **Harpoon Line**: long hook that pulls and stuns |
| `cockatoo` | Cockatoo | Spirit burst | Screech Horn (projectile) | **Screech**: silencing cone | **Crest Flare**: SP, Song damage and cooldown refund | **Seed Crack**: delayed knock-up blast | **Sulphur Shriek**: channelled pulses that stun |
| `swan` | Swan | Support | Lake Lance (hitscan) | **Grace Link**: healing tether to an ally | **Hiss**: knockback cone | **Lake Glide**: group speed and slow cleanse | **Swan Song**: allies can't die, then heal |
| `kiwi` | Kiwi | Assassin | Burrow Blunderbuss (hitscan shotgun) | **Burrow**: move underground, erupt | **Probe**: shredding stab | **Night Sense**: true sight and low-HP reveal | **Ambush Pit**: tunnel to a point and erupt |

Archetype coverage: gun carry — pelican, hornbill, woodpecker · spirit burst — starling, peacock, cockatoo ·
tank/initiator — albatross, penguin, cassowary · support — lyrebird, flamingo, swan · assassin — kingfisher,
nightjar, kiwi · area control — shrike, puffin, vulture · long-range poke — owl, toucan, frigatebird · mobility
skirmisher — secretarybird, swift, hummingbird.

**Roster rules.** 24 heroes, each of the 8 archetypes exactly three times (D-EP-015). A match uses 12 distinct
heroes: no hero appears twice, on either flock.

### 9.0.1 Common hero rules

- **Shared base values** (unless a hero says otherwise): base regeneration 2 HP/s, sprint +2.0 m/s, 3 stamina
  pips, 0% resists, 0 SP at level 1 and +1 SP per level, gun damage growth +3% of base per level, beak multiplier
  ×1.65, melee per §5.7, status resist 0%.
- **Targeting types:** `self` (casts on press), `direction` (fires along the camera aim on press), `unit` (locks the
  enemy or ally nearest the crosshair inside a 6° cone and within range; fails with a click sound if none),
  `point` (press shows a ground marker under the crosshair clamped to range; LMB or a second press casts, RMB
  cancels; the "quick cast" setting casts on press). `channel` abilities can be ended early by pressing the key
  again.
- **Charges:** an ability with charges regains one charge every cooldown; charges refill one at a time.
  Abilities without charges have 1 use and the listed cooldown. 0.4 s lockout between uses of the same charged
  ability.
- **Upgrade tiers** are bought in order: T1 (1 AP), T2 (2 AP), T3 (5 AP). A tier's text is added to the base
  effect; "−N s CD" lowers the cooldown, "+N" raises the named value.
- **Casting** is allowed while moving unless the ability says "rooted". Casting cancels a reload. Silence blocks
  every ability; stun interrupts casts and channels (the cooldown is still spent if the cast had completed).
- **SP scaling** is written "base + k×SP" and applies to the number it follows.
- **Body plan** gives total height (standing), the head hitbox sphere (radius and centre height above the feet)
  and the body capsule radius. Body capsule height = head centre height − head radius. Crouching scales the
  capsule height and head height by 0.65.
- **Silhouette** notes are for the Technical Artist: proportions and shapes that must read at 40 m. Team colour
  appears as a trim (wing bars, crest or bands) on top of the hero's natural colours, plus the team outline (§14).

### 9.1 Shrike — `shrike` · Area control

**Silhouette and colour:** compact, upright songbird with a heavy hooked beak and a black bandit mask; long tail
held straight out behind like a blade; a row of thorns along the rifle's barrel. Grey back, white chest, black
mask and wings. Reads at 40 m as "small bird, horizontal tail, hook beak".
**Body plan:** height 1.75 m · head r 0.17 m at 1.55 m · capsule r 0.32 m.
**Base stats:** HP 580 (+34/level) · move 7.0 m/s · stamina 3.
**Gun — Barb Rifle:** projectile 180 m/s · 14 Talon × 1 · spread 0.6° · falloff 20–45 m · 6.0 shots/s ·
magazine 24 · reload 2.2 s (84 DPS at level 1).

| # | Ability | Targeting | CD | Charges | Range | Effect | T1 (1 AP) | T2 (2 AP) | T3 (5 AP) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Thorn Larder | point | 14 s | 2 | 20 m | Places a thorn trap (arms after 0.75 s, lasts 60 s, max 4; enemies see it only within 8 m). The first enemy hero within 1.5 m triggers it: 80 + 0.9×SP Song damage, root 1.0 s, reveal 4 s. | +1 charge | Root 1.5 s | Trigger bursts in a 4 m radius and hits every enemy hero in it |
| 2 | Briar Patch | point | 18 s | — | 25 m | 5 m radius zone for 6 s: enemies inside take 25 + 0.3×SP Song damage per second and are slowed 30%. | +1.5 m radius | −4 s CD | Enemies inside are also grounded and take +15% Song damage (damage amp) |
| 3 | Impaling Bolt | direction | 16 s | — | 35 m | Projectile 70 m/s, radius 0.4 m. First enemy hero hit: 70 + 0.8×SP Song damage and knockback 6 m along the bolt. If the target hits a wall during the knockback: pinned, stun 1.25 s and 40 + 0.4×SP more damage. | +30 damage | −4 s CD | Pierces all heroes; pin stun 2.0 s |
| 4 | Butcher's Ring | point | 110 s | — | 25 m | After 0.8 s, a ring of thorns (radius 9 m, 1.5 m tall) stands for 6 s. An enemy hero crossing the ring line in either direction takes 150 + 1.4×SP Song damage and is rooted 1.25 s (once per hero per 1.5 s). Enemies inside have 40% heal reduction. Does not block shots. | +2 s duration | −25 s CD | Enemies inside also take 30 + 0.3×SP Song damage per second |

### 9.2 Albatross — `albatross` · Tank / initiator

**Silhouette and colour:** the widest hero. Huge folded wings worn like a long cloak whose tips touch the
ground; thick neck; long hooked pale-pink bill; walks with a rolling sailor's gait. White head and body, dark
grey-brown wings. Reads as "tall wide triangle with a long bill".
**Body plan:** height 2.3 m · head r 0.20 m at 2.05 m · capsule r 0.50 m.
**Base stats:** HP 720 (+46/level) · move 6.7 m/s · stamina 3.
**Gun — Gale Blunderbuss:** hitscan shotgun · 6 Talon × 8 pellets · spread 5.0° · falloff 8–22 m · 1.4 shots/s ·
magazine 6 · reload per shell 0.45 s after a 0.3 s start (67 DPS at level 1).

| # | Ability | Targeting | CD | Charges | Range | Effect | T1 | T2 | T3 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Gale Shield | self | 20 s | — | — | A wind wall 6 m wide × 3 m tall stands 2 m in front of you for 4 s, turning with your aim. It blocks enemy bullets, projectiles and hitscan from the front and absorbs up to 400 + 3×SP damage before breaking. Allies' shots pass through. You move at 85% speed while it stands. | +200 wall HP | −5 s CD | When it expires or breaks, the wall bursts forward 8 m: enemies hit take 60 + 0.6×SP Song damage and are knocked back 6 m |
| 2 | Wing Slam | direction | 15 s | — | 12 m | Dash 12 m over 0.35 s (horizontal). Enemies within 1.5 m of the path take 75 + 0.7×SP Song damage and are knocked up for 0.6 s. | +25 damage | −3 s CD | 2 charges |
| 3 | Salt Hide | self | 30 s | — | — | For 6 s: +30% Talon resist and +30% Song resist; heals 10% of max HP over the duration. | +10% to both resists | −8 s CD | Unstoppable for the first 2 s; allies within 8 m get half the resists |
| 4 | Tempest Dive | point | 120 s | — | 30 m | Leap in a 0.9 s arc (8 m apex) to the point, steering up to 3 m. On landing, 8 m radius: 180 + 1.5×SP Song damage, stun 1.25 s, pull 3 m toward the centre. Unstoppable while airborne. | +2 m radius | Stun +0.5 s | −35 s CD |

### 9.3 Kingfisher — `kingfisher` · Assassin

**Silhouette and colour:** small, forward-leaning, with a dagger bill as long as its head is wide; stubby tail;
crouched sprinter stance. Electric-blue back with a white throat and orange chest. Reads as "small, low, giant
straight bill".
**Body plan:** height 1.6 m · head r 0.16 m at 1.42 m · capsule r 0.28 m.
**Base stats:** HP 520 (+30/level) · move 7.3 m/s · stamina 3.
**Gun — Dart Pistol:** hitscan · 22 Talon × 1 · spread 0.4° · falloff 18–40 m · 4.0 shots/s · magazine 12 ·
reload 1.6 s (88 DPS at level 1).

| # | Ability | Targeting | CD | Charges | Range | Effect | T1 | T2 | T3 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Plunge | direction | 12 s | 2 | 14 m | Dash 14 m over 0.3 s along the camera aim (pitch clamped to 30° up, any angle down). Stops on the first enemy hero: 80 + 0.8×SP Song damage. Then +25% fire rate for 3 s. | +30 damage | −3 s CD | A hero hit is slowed 40% for 2 s and a charge is refunded |
| 2 | Glint | self | 28 s | — | — | Invisible for 5 s with +25% move speed. Leaving invisibility (by attacking, casting or timeout) starts Ambush: +40% damage on all hits for 1.5 s. | +3 s duration | −6 s CD | Ambush's first hit on a hero also silences it for 2 s |
| 3 | Spear Bill | direction | 10 s | — | 5 m | Lunge 5 m and stab (1 m radius at the tip): 110 + 1.0×SP Song damage, +50% if the target is below 40% HP; bleed 15 + 0.15×SP Song damage per second for 4 s. | Bleed +2 s | Execute threshold 50% | Killing a hero resets Spear Bill and Plunge |
| 4 | Riverstrike | unit (enemy hero, needs line of sight) | 100 s | — | 30 m | 0.5 s cast (you hover; a stun cancels it and refunds 50%), then teleport 1.5 m behind the target and strike: 220 + 1.6×SP Song damage + 12% of the target's missing HP. If the target dies within 3 s, 50% of the cooldown is refunded. | +10 m range | Missing-HP part 18% | The target is silenced 1.5 s and you turn invisible for 1.5 s after the strike |

### 9.4 Lyrebird — `lyrebird` · Support

**Silhouette and colour:** slim brown body under an enormous tail: two curved outer plumes form a lyre arching
above the head, filled with fine silver filaments that shimmer when it sings. Reads as "small body, huge lyre
shape above it".
**Body plan:** height 1.8 m (tail arch to 2.6 m, no hitbox) · head r 0.15 m at 1.62 m · capsule r 0.30 m.
**Base stats:** HP 560 (+32/level) · move 7.0 m/s · stamina 3.
**Gun — Echo Lute:** projectile 90 m/s (radius 0.25 m) · 16 Talon × 1 · spread 0.8° · falloff 15–35 m ·
4.5 shots/s · magazine 20 · reload 2.0 s (72 DPS at level 1).

| # | Ability | Targeting | CD | Charges | Range | Effect | T1 | T2 | T3 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Mended Song | unit (ally; self if none) | 13 s | 2 | 30 m | Heal 100 + 1.0×SP instantly, then 50 + 0.4×SP over 4 s. | +40 instant heal | Also +15% Talon resist for 4 s | Also cleanses negative statuses |
| 2 | Echo Double | self | 22 s | — | — | Summons a decoy of you that runs along your aim direction at your move speed for 6 s, shooting the nearest enemy within 25 m for 30% of your gun damage. Decoy HP 150 + 1.0×SP. You turn invisible for 2 s. Enemies see the decoy as the real hero (same name plate and health bar). | Decoy HP +150 | 2 decoys (±15° apart) | Decoys burst on death or expiry: 4 m radius, 80 + 0.8×SP Song damage, disarm 1.5 s |
| 3 | Discord | point | 18 s | — | 25 m | Burst at the point, 6 m radius: 70 + 0.7×SP Song damage, disarm 1.5 s. | +1.5 m radius | Disarm +0.75 s | Enemies hit take +20% damage from all sources for 4 s |
| 4 | Grand Chorus | channel | 120 s | — | 14 m radius | Channel up to 5 s (60% move speed, no gun). Allies within 14 m, including you, heal 45 + 0.4×SP per second and have +20% Talon and Song resist; enemies within 14 m are slowed 20%. | +4 m radius | Allies also get +15% fire rate | You can shoot and move at full speed while channelling |

### 9.5 Owl — `owl` · Long-range poke

**Silhouette and colour:** round barrel body with no visible neck, a big flat facial disc and two upright ear
tufts; huge orange eyes; a long rifle as tall as itself. Mottled tawny and cream. Reads as "round head with
horns, long gun".
**Body plan:** height 1.7 m · head r 0.24 m at 1.45 m (largest head: the price of range) · capsule r 0.36 m.
**Base stats:** HP 520 (+30/level) · move 7.0 m/s · stamina 3 · beak multiplier ×2.0.
**Gun — Hush Rifle:** hitscan · 52 Talon × 1 · spread 0.1° · falloff 40–90 m · max range 200 m · 1.25 shots/s ·
magazine 6 · reload 2.6 s (65 DPS at level 1). Aiming (RMB) zooms to FOV ×0.5 instead of ×0.8.

| # | Ability | Targeting | CD | Charges | Range | Effect | T1 | T2 | T3 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Hush | direction | 16 s | — | 45 m | Projectile 55 m/s; bursts on impact or at max range, 3 m radius: 85 + 0.8×SP Song damage, silence 1.5 s. | +1 m radius | Silence +0.75 s | 2 charges |
| 2 | Night Eyes | self | 24 s | — | 35 m | For 6 s: you have true sight within 30 m; every enemy hero within 35 m of you is revealed to your flock; your beak shots deal +20% damage. | +10 m to both radii | +3 s duration | Revealed enemies take +10% damage from your flock |
| 3 | Silent Wing | self | 18 s | — | — | Leap 6 m up, then glide for up to 4 s (fall 2 m/s, horizontal 9 m/s, steer with WASD). Gun usable while gliding. Silent footsteps for the duration. Ends on landing or pressing Space. | Glide +2 s | −5 s CD | +25% gun damage while gliding |
| 4 | Moonlit Mark | channel (rooted) | 90 s | — | 120 m | Channel 1.2 s, then fire a projectile at 220 m/s (radius 0.3 m) that pierces fledglings and neutrals and stops at the first hero: 260 + 1.8×SP Song damage, can beak-shot (×1.5), silence 2.5 s, reveal 8 s. | +80 damage | −20 s CD | Also pierces heroes (full damage to each) |

### 9.6 Pelican — `pelican` · Gun carry

**Silhouette and colour:** bottom-heavy pear shape; a long bill with a huge sagging throat pouch that swings as
it walks; short legs; a gatling slung at the hip. White body, grey wing edges, yellow-orange pouch. Reads as
"pear with a hanging bag under the bill".
**Body plan:** height 2.1 m · head r 0.19 m at 1.85 m · capsule r 0.48 m.
**Base stats:** HP 640 (+38/level) · move 6.8 m/s · stamina 3 · gun growth +4% per level.
**Gun — Gullet Gatling:** hitscan · 8 Talon × 1 · spread 1.6° · falloff 18–40 m · 11.0 shots/s · magazine 50 ·
reload 2.8 s (88 DPS at level 1).

| # | Ability | Targeting | CD | Charges | Range | Effect | T1 | T2 | T3 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Gulp | direction | 20 s | — | 4 m cone (40°) | Grabs the first enemy hero or fledgling in the cone. A fledgling is killed (counts as your last hit; its pod spawns at your feet) and you heal 60. A hero is carried in the pouch for 1.0 s (stunned, intangible), then spat 10 m along your aim and takes 70 + 0.7×SP Song damage. You move at 80% speed while carrying. | +30 damage | −5 s CD | The spat hero is stunned 0.75 s on landing |
| 2 | Feeding Frenzy | self | 24 s | — | — | Instantly reload; for 6 s +35% fire rate and 15% Talon lifesteal. | +2 s duration | +15% fire rate | Each gun hit on a hero shreds 2% Talon resist for 6 s (max 5 stacks) |
| 3 | Belly Flop | point | 14 s | — | 10 m | Leap in a 0.5 s arc to the point. Landing, 5 m radius: 70 + 0.7×SP Song damage, knockback 4 m, slow 30% for 2 s. | +1.5 m radius | −4 s CD | 2 charges |
| 4 | Bottomless Pouch | self | 100 s | — | — | For 8 s: shots use no ammo, +30% gun damage, and every bullet splashes 1.5 m for 35% of its damage (splash can't beak-shot). | +3 s duration | +15% gun damage | 20% Talon lifesteal for the duration |

### 9.7 Secretarybird — `secretarybird` · Mobility skirmisher

**Silhouette and colour:** the tallest, thinnest hero; legs are 60% of its height, with black "breeches" on the
thighs; a crest of long black quills fanned behind the head; bare orange face. Pale grey body. Reads as "stilts
with a quill crown".
**Body plan:** height 2.2 m · head r 0.15 m at 2.0 m · capsule r 0.30 m.
**Base stats:** HP 600 (+36/level) · move 7.4 m/s · stamina 4.
**Passive rule — Footwork:** each ability hit on an enemy hero gives 1 Footwork stack (max 3, each lasts 5 s).
Stomp Kick spends all stacks for +20% damage each.
**Gun — Quill Pair:** hitscan, two pistols alternating · 11 Talon × 1 · spread 1.0° · falloff 14–32 m ·
8.0 shots/s · magazine 28 · reload 1.8 s (88 DPS at level 1).

| # | Ability | Targeting | CD | Charges | Range | Effect | T1 | T2 | T3 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Stomp Kick | direction | 9 s | — | 3.5 m cone (60°) | 80 + 0.8×SP Song damage (+20% per Footwork stack spent) and knockback 7 m. A target that hits a wall during the knockback is stunned 1.0 s. | +25 damage | −2 s CD | 2 charges |
| 2 | Long Stride | direction (movement keys; forward if none) | 10 s | 2 | 10 m | Dash 10 m over 0.25 s along the ground, passing through units. Enemy heroes passed through are slowed 25% for 1.5 s and give 1 Footwork. | +1 charge | −3 s CD | Each dash gives +30% fire rate for 3 s |
| 3 | Snake Stamp | point | 13 s | — | 15 m | Leap in a 0.45 s arc to the point. Landing, 4 m radius: 100 + 0.9×SP Song damage, slow 40% for 1.5 s. | +1 m radius | −3 s CD | Stun 0.6 s instead of the slow |
| 4 | Viper Dance | unit (enemy hero) | 95 s | — | 6 m | Lock onto the target for 2.0 s: 6 kicks, 40 + 0.35×SP Song damage each, each stunning 0.35 s; the last kick knocks back 10 m. You are unstoppable throughout and stay attached to the target. Ends early if the target dies or turns intangible. | +2 kicks (same 2.0 s) | −20 s CD | The last kick resets Long Stride and gives 3 Footwork |

### 9.8 Starling — `starling` · Spirit burst

**Silhouette and colour:** small and spiky (ruffled shoulder feathers), always circled by a halo of 8 tiny
starlings orbiting at head height; short square tail. Iridescent black with green-purple sheen and white
speckles. Reads as "small bird inside a ring of specks".
**Body plan:** height 1.5 m · head r 0.15 m at 1.35 m · capsule r 0.30 m.
**Base stats:** HP 540 (+32/level) · move 7.0 m/s · stamina 3.
**Gun — Chatter Pistol:** projectile 70 m/s · 9 Talon × 2 pellets · spread 2.0° · falloff 12–30 m · 4.0 shots/s ·
magazine 16 · reload 2.0 s (72 DPS at level 1).

| # | Ability | Targeting | CD | Charges | Range | Effect | T1 | T2 | T3 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Murmuration | direction | 11 s | — | 30 m | A swarm flies 30 m at 40 m/s, 2 m wide, piercing everything: 110 + 1.1×SP Song damage to each enemy it passes. | +40 damage | −3 s CD | 2 charges |
| 2 | Mob | point | 18 s | — | 25 m | Swarm cloud, 5 m radius, 4 s: enemies inside take 35 + 0.35×SP Song damage per second, are slowed 20% and revealed. | +2 s duration | +1.5 m radius | Enemies inside also get 50% heal reduction |
| 3 | Scatter | direction (movement keys) | 20 s | — | 12 m | Become a swarm for 1.0 s: intangible, travel 12 m, then reform. Removes slows and roots on cast. | −4 s CD | +6 m distance | Reforming deals 80 + 0.8×SP Song damage in 4 m |
| 4 | Black Sun | self | 110 s | — | 10 m radius | 0.75 s windup (rooted), then a swarm sphere of radius 10 m follows you for 3 s: enemies inside take 100 + 0.9×SP Song damage per second and +15% Song damage from all sources. | +3 m radius | +1 s duration | The windup ends with a burst: 150 + 1.2×SP Song damage and silence 1.0 s to enemies in the radius |

### 9.9 Hornbill — `hornbill` · Gun carry

**Silhouette and colour:** upright and heavy-chested, with a huge down-curved yellow-red bill topped by a tall
helmet-like casque that doubles the head's apparent height; long tail. Black body, white belly and tail bands.
Reads as "bird wearing a helmet on its bill".
**Body plan:** height 1.95 m · head r 0.20 m at 1.72 m · capsule r 0.38 m.
**Base stats:** HP 620 (+36/level) · move 6.9 m/s · stamina 3 · gun growth +4% per level.
**Gun — Casque Rifle:** hitscan · 30 Talon × 1 · spread 0.5° · falloff 22–50 m · 3.0 shots/s · magazine 15 ·
reload 2.4 s (90 DPS at level 1).

| # | Ability | Targeting | CD | Charges | Range | Effect | T1 | T2 | T3 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Heavy Rounds | self | 14 s | — | — | Your next 6 shots (within 8 s) deal +40% gun damage and slow heroes hit by 15% for 1.5 s. | +2 rounds | −3 s CD | Heavy rounds pierce one extra target |
| 2 | Mud Seal | self | 22 s | — | — | Barrier 200 + 2.0×SP for 5 s; while it holds you have +20% fire rate. | +100 barrier | −5 s CD | While it holds you are immune to slows |
| 3 | Bounding Hop | direction (movement keys) | 12 s | — | 8 m | Hop 8 m (0.4 s arc, 2 m apex) and reload half your magazine. | −2 s CD | 2 charges | Leaves a 4 m slick where you took off: enemies on it slowed 30% for 3 s |
| 4 | Marked Prey | unit (enemy hero) | 90 s | — | 40 m | Marks the target for 10 s: it is revealed, your gun deals +40% damage to it and ignores falloff against it. If it dies while marked, 50% of the cooldown is refunded. | +4 s duration | +20% damage (60% total) | The mark also has −20% Talon resist |

### 9.10 Flamingo — `flamingo` · Support

**Silhouette and colour:** tall and stick-thin: very long legs and a long S-curved neck, small oval body, sharply
bent black-tipped bill. Idles on one leg. All pink, deeper coral on the wings. Reads as "pink stick figure with
a question-mark neck".
**Body plan:** height 2.3 m · head r 0.14 m at 2.15 m · capsule r 0.26 m.
**Base stats:** HP 560 (+32/level) · move 7.0 m/s · stamina 3.
**Gun — Wader Repeater:** hitscan · 12 Talon × 1 · spread 0.9° · falloff 16–36 m · 6.0 shots/s · magazine 30 ·
reload 2.0 s (72 DPS at level 1).

| # | Ability | Targeting | CD | Charges | Range | Effect | T1 | T2 | T3 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Pink Pool | point | 18 s | — | 20 m | A shallow pool, 5 m radius, for 6 s: allies inside heal 30 + 0.3×SP per second. | +1.5 m radius | +2 s duration | Allies inside also get +15% move speed; entering removes slows |
| 2 | Poise | unit (ally; self if none) | 16 s | — | 30 m | Barrier 150 + 1.2×SP and +40% status resist for 5 s. | +75 barrier | −4 s CD | +1 charge |
| 3 | Flock Dance | self | 15 s | — | 8 m radius | Enemies within 8 m take 60 + 0.6×SP Song damage and are knocked back 5 m from you; allies within 8 m get +20% move speed for 3 s. | +2 m radius | −3 s CD | Enemies hit are also disarmed 1.0 s |
| 4 | Tide Turn | unit (ally; self if none) | 100 s | — | 40 m | For 6 s the target is unstoppable, heals 30% of max HP over the first 3 s, and deals +30% damage. | +20 m range | Also applies to allies within 6 m of the target | −30 s CD |

### 9.11 Penguin — `penguin` · Tank / initiator

**Silhouette and colour:** upright torpedo or bowling-pin body; flipper arms held out from the sides; short
waddling legs; bright yellow-orange ear patches and throat. Black back, white front. Reads as "black-and-white
skittle with little arms".
**Body plan:** height 1.6 m · head r 0.18 m at 1.42 m · capsule r 0.42 m.
**Base stats:** HP 700 (+44/level) · move 6.6 m/s · stamina 3.
**Gun — Ice Chipper:** projectile 80 m/s · 10 Talon × 1 · spread 1.8° · falloff 10–25 m · 7.0 shots/s ·
magazine 35 · reload 2.5 s (70 DPS at level 1).

| # | Ability | Targeting | CD | Charges | Range | Effect | T1 | T2 | T3 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Toboggan | self | 16 s | — | — | Belly-slide for up to 3 s at 13 m/s, steering with the mouse (no gun). Enemies you hit take 60 + 0.6×SP Song damage and are knocked 4 m aside (once each). Space ends it with a 1.2 m hop; you keep the speed. | +25 damage | −4 s CD | Enemies hit are knocked up 0.5 s instead |
| 2 | Huddle | self | 22 s | — | 6 m radius | You and allies within 6 m get a barrier of 180 + 1.5×SP for 4 s. | +60 barrier | +4 m radius | Also +25% status resist for 4 s |
| 3 | Ice Floe | point | 18 s | — | 20 m | An ice patch, 6 m radius, for 5 s: enemies on it are slowed 35%; allies on it get +20% move speed. | +2 s duration | +2 m radius | Enemies on it are also grounded |
| 4 | Emperor's March | self | 110 s | — | — | For 3 s you are unstoppable with +40% move speed; enemy heroes you touch are knocked up 1.0 s and take 150 + 1.2×SP Song damage (once each). It ends with a 6 m slam: 100 + 0.8×SP Song damage, stun 0.75 s. | +1 s duration | Slam stun +0.5 s | −30 s CD |

### 9.12 Puffin — `puffin` · Area control

**Silhouette and colour:** short and chunky with a huge triangular bill striped orange, yellow and blue-grey,
with three silver fish dangling from it; white face with a dark eye streak; bright orange feet. Black back, white
belly. Reads as "squat bird with a giant striped triangle face".
**Body plan:** height 1.45 m · head r 0.19 m at 1.27 m · capsule r 0.36 m.
**Base stats:** HP 580 (+34/level) · move 6.9 m/s · stamina 3.
**Gun — Eel Sling:** projectile 100 m/s · 18 Talon × 1 · spread 0.6° · falloff 18–40 m · 4.0 shots/s ·
magazine 18 · reload 2.0 s (72 DPS at level 1).

| # | Ability | Targeting | CD | Charges | Range | Effect | T1 | T2 | T3 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Burrow Colony | point | 16 s | 2 | 15 m | Digs a burrow with a puffling turret (HP 200 + 1.5×SP, lasts 20 s, max 2). It shoots the nearest enemy within 18 m: 12 + 0.12×SP Song damage every 0.5 s. Prefers heroes. | +1 charge and +1 max turret | Turret hits slow 15% for 1 s | Turrets burst on death or expiry: 4 m radius, 80 + 0.6×SP Song damage |
| 2 | Sea Spray | direction | 12 s | — | 10 m cone (50°) | Enemies in the cone take 50 + 0.5×SP Song damage, are knocked back 6 m and slowed 25% for 2.5 s. | +3 m range | −3 s CD | Enemies hit also take +15% Song damage for 4 s |
| 3 | Fog Bank | point | 22 s | — | 25 m | Sea fog, 7 m radius, for 7 s: allies inside are invisible to enemies outside it (firing does not break it); enemies inside are revealed. | +2 m radius | +3 s duration | Enemies inside are also slowed 20% |
| 4 | Rogue Wave | direction | 110 s | — | 30 m | A wave 16 m wide travels 30 m over 1.5 s. Enemies it reaches take 160 + 1.3×SP Song damage and are carried with it (up to 12 m); an enemy carried into a wall is stunned 1.5 s. | +6 m width | +60 damage | Leaves wet ground along its path for 4 s: enemies on it slowed 30% |

### 9.13 Peacock — `peacock` · Spirit burst

**Silhouette and colour:** long blue neck with a crown of five spoon-tipped crest feathers; a long green train
that trails on the ground and fans up into a huge eye-spotted disc (3 m across) whenever it casts. Iridescent
blue and green with gold eyespots. Reads as "long train behind; giant fan when casting".
**Body plan:** height 1.9 m (crest to 2.05 m; the train and fan have no hitbox) · head r 0.15 m at 1.75 m ·
capsule r 0.32 m.
**Base stats:** HP 540 (+31/level) · move 7.0 m/s · stamina 3.
**Gun — Plume Darts:** projectile 85 m/s · 15 Talon × 1 · spread 0.7° · falloff 15–35 m · 4.5 shots/s ·
magazine 18 · reload 2.2 s (67 DPS at level 1).

| # | Ability | Targeting | CD | Charges | Range | Effect | T1 | T2 | T3 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Hundred Eyes | direction | 12 s | — | 35 m | Fires 5 eye-darts in a 30° fan at 60 m/s; each deals 45 + 0.45×SP Song damage; a hero can be hit by at most 3. | +1 dart | −3 s CD | Darts reveal for 4 s and shred 10% Song resist for 6 s |
| 2 | Dazzle | direction | 16 s | — | 10 m cone (70°) | The fan flashes: enemies in the cone take 70 + 0.7×SP Song damage and are disarmed 1.25 s. | +4 m range | Disarm +0.5 s | Also silences 1.0 s |
| 3 | Strut | self | 14 s | — | — | +30% move speed for 3 s; your next ability cast within 3 s deals +25% damage. | +1 s duration | −4 s CD | Also grants a Song shield of 100 + 1.0×SP for 3 s |
| 4 | Full Display | channel (rooted) | 100 s | — | 18 m | Channel 1.0 s while the fan opens, then every enemy within 18 m in your front 180° takes 300 + 2.0×SP Song damage and is revealed 6 s. | +5 m range | Also stuns 1.0 s | −30 s CD |

### 9.14 Vulture — `vulture` · Area control

**Silhouette and colour:** hunched, head held low and forward on a long bare neck; bald red-pink head; a white
fluffy ruff around the base of the neck like a collar; huge broad wings hanging like a ragged coat. Dark brown and
black. Reads as "hunchback in a coat with a bald head".
**Body plan:** height 2.0 m · head r 0.16 m at 1.70 m · capsule r 0.42 m.
**Base stats:** HP 600 (+36/level) · move 6.9 m/s · stamina 3.
**Gun — Bone Shot:** hitscan · 18 Talon × 1 · spread 0.8° · falloff 18–38 m · 4.2 shots/s · magazine 20 ·
reload 2.4 s (76 DPS at level 1).

| # | Ability | Targeting | CD | Charges | Range | Effect | T1 | T2 | T3 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Carrion Circle | point | 18 s | — | 25 m | After 1.0 s, vultures circle over a 6 m radius area for 7 s: enemies inside take 20 + 0.2×SP Song damage per second and have 30% heal reduction. | +2 m radius | Heal reduction 50% | Enemies below 50% HP inside take double damage |
| 2 | Pick the Bones | direction | 12 s | — | 8 m cone (60°) | Enemies in the cone take 50 + 0.5×SP Song damage and lose 12% Talon resist for 6 s; you heal for 50% of the damage dealt. | +25 damage | Shred 18% | 2 charges |
| 3 | Thermal | point | 24 s | — | 20 m | A rising column, 3 m radius, for 6 s. An allied hero who enters it is lifted 10 m and can glide for 3 s (as Silent Wing's glide). | +3 s duration | −6 s CD | Allies leaving it get +20% damage for 4 s |
| 4 | Death Spiral | point | 120 s | — | 30 m | A vortex, 12 m radius, for 5 s: enemies inside are pulled toward the centre at 3 m/s, grounded, and take 40 + 0.5×SP Song damage per second. | +2 s duration | Pull 5 m/s | When it ends, a 5 m burst at the centre: 150 + 1.2×SP Song damage |

### 9.15 Swift — `swift` · Mobility skirmisher

**Silhouette and colour:** a living boomerang: tiny body, very long sickle-shaped wings swept back past the
tail (3 m span, held half-open), deeply forked tail. Sooty brown-black with a pale throat. Reads as "crescent
blade" from every angle.
**Body plan:** height 1.5 m (the wings have no hitbox) · head r 0.15 m at 1.35 m · capsule r 0.26 m.
**Base stats:** HP 500 (+29/level) · move 7.6 m/s · stamina 4.
**Gun — Sickle SMG:** hitscan · 7 Talon × 1 · spread 2.0° · falloff 10–24 m · 12.0 shots/s · magazine 42 ·
reload 1.6 s (84 DPS at level 1).

| # | Ability | Targeting | CD | Charges | Range | Effect | T1 | T2 | T3 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Slipstream | direction | 9 s | 2 | 16 m | Dash 16 m over 0.35 s along your aim (up to 45° upward), on the ground or in the air. | +1 charge | −2 s CD | Enemies you pass through take 50 + 0.5×SP Song damage |
| 2 | Screaming Party | self | 16 s | — | 6 m radius | For 4 s: enemies within 6 m of you take 25 + 0.25×SP Song damage per second and are slowed 15%; you get +20% move speed. | +2 s duration | +3 m radius | Enemies inside also get 25% fire-rate slow |
| 3 | Wing Scythe | direction | 12 s | — | 25 m | Throws a blade that flies 25 m at 40 m/s and returns to you, piercing: 70 + 0.7×SP Song damage on each pass, slow 25% for 1.5 s. | +25 damage | −3 s CD | The return pass also stuns 0.5 s |
| 4 | Sky Stitch | self | 100 s | — | — | Free flight for 6 s (12 m/s in any direction, max 25 m above the ground, gun usable) with +20% gun damage. | +2 s duration | +20% fire rate during flight | When it ends, slam the ground below: 5 m radius, 120 + 1.0×SP Song damage |

### 9.16 Hummingbird — `hummingbird` · Mobility skirmisher

**Silhouette and colour:** the smallest hero. Needle bill as long as its body; wings shown as two translucent
blurred discs either side; legs tucked, it always hovers 0.3 m off the ground. Iridescent green, ruby throat.
Reads as "tiny dot with a needle and two shimmering discs".
**Body plan:** height 1.3 m · head r 0.13 m at 1.18 m · capsule r 0.24 m.
**Base stats:** HP 480 (+28/level) · move 7.4 m/s · stamina 4.
**Passive rule — Hover:** holding Space while airborne holds your height for up to 1.5 s (recharges on landing).
**Gun — Nectar Needler:** hitscan · 6 Talon × 1 · spread 1.5° · falloff 12–28 m · 13.0 shots/s · magazine 45 ·
reload 1.8 s (78 DPS at level 1).

| # | Ability | Targeting | CD | Charges | Range | Effect | T1 | T2 | T3 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Dart | direction (aim; movement keys if held) | 7 s | 3 | 8 m | Dash 8 m over 0.15 s in any direction, including straight up. | +1 charge | −2 s CD | Your next gun shot within 1 s of a Dart deals +60% damage |
| 2 | Nectar Sip | unit (enemy hero) | 16 s | — | 6 m (breaks at 12 m) | Tether for 2 s: the target takes 40 + 0.4×SP Song damage per second and you heal the same amount. | +1 s duration | +4 m range and break distance | The target is also slowed 30% |
| 3 | Blur | self | 15 s | — | — | For 2 s: +40% move speed and +40% Talon resist. | +1 s duration | Also +40% Song resist | −5 s CD |
| 4 | Thousand Beats | self | 90 s | — | — | For 5 s your wings are blades: every Dart damages enemies along its path for 100 + 0.9×SP Song damage, Dart has +2 maximum charges, and a Dart that hits a hero refunds a charge. | +2 s duration | +40 damage | Dart hits also silence 0.75 s |

### 9.17 Cassowary — `cassowary` · Tank / initiator

**Silhouette and colour:** the tallest hero and flightless: a mound of shaggy, hair-like black plumage on thick
scaly legs with a dagger claw; a tall bony blue-grey casque on the head; bright blue neck with two red wattles
hanging at the throat. Reads as "black haystack on legs with a blue neck and a helmet".
**Body plan:** height 2.4 m · head r 0.17 m at 2.25 m · capsule r 0.48 m.
**Base stats:** HP 740 (+46/level) · move 7.0 m/s · stamina 3.
**Gun — Wattle Blaster:** hitscan · 20 Talon × 1 · spread 1.2° · falloff 14–30 m · 3.5 shots/s · magazine 16 ·
reload 2.4 s (70 DPS at level 1).

| # | Ability | Targeting | CD | Charges | Range | Effect | T1 | T2 | T3 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Rampage | direction | 18 s | — | 20 m | Charge 20 m over 1.0 s (steer ±30°), unstoppable. The first enemy hero hit takes 90 + 0.8×SP Song damage and is knocked up 0.75 s; the charge stops there. | +30 damage | −4 s CD | Hits every hero along the path and does not stop |
| 2 | Dagger Kick | direction | 10 s | — | 4 m cone (60°) | 100 + 1.0×SP Song damage, knockback 5 m, −15% Talon resist for 5 s. | +30 damage | Shred 25% | 2 charges |
| 3 | Bristle | self | 24 s | — | 15 m | For 5 s: Talon shield 250 + 2.0×SP; enemy heroes within 15 m who damage you take 20% of that damage back as Song damage. | +100 shield | −6 s CD | Also a Song shield of the same amount |
| 4 | Boom Call | self | 110 s | — | 12 m radius | A deep boom pulls every enemy within 12 m 6 m toward you; they take 120 + 1.0×SP Song damage and are slowed 50% for 2 s. Then you are unstoppable with +40% Talon and Song resist for 4 s. | +4 m radius | Pulled enemies are also stunned 0.75 s | −30 s CD |

### 9.18 Toucan — `toucan` · Long-range poke

**Silhouette and colour:** compact black body with a white bib, and a gigantic banana-shaped bill as long as the
body, painted green, orange and red with a black tip; blue eye ring. Reads as "small bird behind an enormous
rainbow bill".
**Body plan:** height 1.7 m (the bill has no hitbox) · head r 0.17 m at 1.50 m · capsule r 0.32 m.
**Base stats:** HP 540 (+31/level) · move 7.0 m/s · stamina 3.
**Gun — Bill Rifle:** hitscan · 34 Talon × 1 · spread 0.25° · falloff 35–75 m · 2.2 shots/s · magazine 10 ·
reload 2.4 s (75 DPS at level 1).

| # | Ability | Targeting | CD | Charges | Range | Effect | T1 | T2 | T3 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Fruit Lob | point | 10 s | 2 | 50 m | An arcing mortar lands 1.2 s later: 4 m radius, 90 + 0.9×SP Song damage, slow 25% for 2 s. | +25 damage | +1 charge | Leaves sticky pulp for 4 s: enemies on it slowed 40% |
| 2 | Seed Spit | direction | 9 s | — | 60 m | Projectile 100 m/s: first enemy hit takes 60 + 0.6×SP Song damage, is revealed 6 s and loses 10% Song resist for 6 s. | +20 m range | −3 s CD | Pierces |
| 3 | Branch Swing | point (any surface) | 16 s | — | 25 m | Grapple and swing to the point in a 0.6 s arc. | −4 s CD | +10 m range | +25% gun damage for 4 s after landing |
| 4 | Fruit Barrage | point | 100 s | — | 80 m | After 1.0 s, 12 mortars fall over 3 s at random spots (seeded) in a 9 m radius: each 3 m radius, 50 + 0.4×SP Song damage. | +4 mortars | +3 m radius | −25 s CD |

### 9.19 Woodpecker — `woodpecker` · Gun carry

**Silhouette and colour:** vertical clinging posture leaning on a stiff, spiky prop tail; straight chisel bill;
bright red crown and nape crest. Black and white barred back, white face stripes. Reads as "upright bird with a
red cap and a tail it sits on".
**Body plan:** height 1.75 m · head r 0.16 m at 1.60 m · capsule r 0.30 m.
**Base stats:** HP 600 (+35/level) · move 6.9 m/s · stamina 3 · gun growth +4% per level.
**Gun — Drum Drill:** hitscan · 7 Talon × 1 · spread 1.4° · falloff 16–36 m · spins up from 6 to 14 shots/s
over 1.5 s of continuous fire (spins down 0.5 s after release) · magazine 60 · reload 3.0 s (42–98 DPS at
level 1).

| # | Ability | Targeting | CD | Charges | Range | Effect | T1 | T2 | T3 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Drumroll | self | 18 s | — | — | Instantly reach full spin; for 6 s +20% fire rate and no spin-down. | +2 s duration | +10% fire rate | Each gun hit on a hero shreds 3% Talon resist for 6 s (max 5 stacks) |
| 2 | Bore Hole | direction | 12 s | — | 25 m | A drill bit flies at 50 m/s: first enemy hero hit takes 60 + 0.6×SP Song damage and −15% Talon resist for 6 s. | Shred 20% | −3 s CD | 2 charges |
| 3 | Tree Cling | point (wall or tree) | 14 s | — | 12 m | Dash to the surface and cling for up to 6 s: you can shoot and gain +15% gun damage while clinging. Jump or a stun ends it. | +6 m range | −4 s CD | Heal 3% of max HP per second while clinging |
| 4 | Hammerhead | self | 90 s | — | — | For 6 s: +25% fire rate, and every 10 gun hits on the same hero detonate on it: 150 + 1.0×SP Song damage and stun 0.5 s. | +3 s duration | Detonates every 8 hits | Detonations also hit enemies within 4 m of the target |

### 9.20 Nightjar — `nightjar` · Assassin

**Silhouette and colour:** flat and horizontal, as if pressed to a branch; a wide flat head with enormous dark
eyes and a tiny bill that opens into a huge gape; long pointed wings and tail. Bark-mottled grey and brown, with
white wing spots that flash when it moves. Reads as "flat wedge with big eyes".
**Body plan:** height 1.55 m · head r 0.20 m at 1.35 m · capsule r 0.32 m.
**Base stats:** HP 520 (+30/level) · move 7.2 m/s · stamina 3.
**Gun — Moth Pistol:** hitscan · 26 Talon × 1 · spread 0.5° · falloff 18–38 m · 3.2 shots/s · magazine 10 ·
reload 1.8 s (83 DPS at level 1).

| # | Ability | Targeting | CD | Charges | Range | Effect | T1 | T2 | T3 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Gape | direction | 12 s | — | 6 m | Lunge 6 m and bite (1.2 m radius): 90 + 0.9×SP Song damage, silence 1.0 s; you heal 30% of the damage dealt. | +30 damage | −3 s CD | Silence 1.75 s |
| 2 | Nightfall | self | 26 s | — | — | Invisible and silent for 7 s. Your first hit out of it deals +60 + 0.6×SP Song damage and slows 30% for 1.5 s. | +3 s duration | −6 s CD | You stay invisible after the first hit (the second hit ends it) |
| 3 | Churring Call | direction | 14 s | — | 12 m cone (60°) | Enemies in the cone are revealed for 5 s and take +15% damage from all sources for 5 s. | +6 m range | −4 s CD | Damage amp +25% |
| 4 | Night Swallow | unit (enemy hero) | 90 s | — | 12 m | Dash to the target and swallow-strike: 200 + 1.5×SP Song damage; if its HP is then below 20% of max, it dies. | Execute threshold 25% | −20 s CD | An execute resets the cooldown and makes you invisible for 3 s |

### 9.21 Frigatebird — `frigatebird` · Long-range poke

**Silhouette and colour:** angular and black, with very long narrow wings always held half-open in a sharp "W"
(3.6 m span), a deeply forked scissor tail, a hooked bill and a big inflated red throat balloon on the chest.
Reads as "black W with a red balloon".
**Body plan:** height 1.8 m (the wings have no hitbox) · head r 0.15 m at 1.62 m · capsule r 0.30 m.
**Base stats:** HP 530 (+31/level) · move 7.0 m/s · stamina 3.
**Gun — Kite Rifle:** hitscan · 40 Talon × 1 · spread 0.2° · falloff 35–80 m · 1.8 shots/s · magazine 8 ·
reload 2.5 s (72 DPS at level 1).

| # | Ability | Targeting | CD | Charges | Range | Effect | T1 | T2 | T3 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Plunder Shot | direction | 14 s | — | 50 m | Projectile 80 m/s: the first enemy hero hit takes 70 + 0.7×SP Song damage and loses all its positive statuses; you get a Song shield of 100 + 1.0×SP for 5 s. | +25 damage | −3 s CD | 2 charges |
| 2 | High Pass | point | 16 s | — | 30 m | Leap in a 0.8 s arc (12 m apex) to the point; for 5 s your gun's falloff ranges are +40%. | −4 s CD | +10 m range | The bonus also gives +20% gun damage |
| 3 | Balloon Boom | self | 15 s | — | 5 m radius | The throat balloon bursts: enemies within 5 m take 50 + 0.5×SP Song damage and are knocked back 7 m; you get a barrier of 150 + 1.5×SP for 3 s. | +2 m radius | −4 s CD | Enemies hit are also slowed 40% for 2 s |
| 4 | Harpoon Line | direction | 90 s | — | 70 m | A hooked line flies at 120 m/s: the first enemy hero hit takes 200 + 1.5×SP Song damage, is pulled 15 m toward you over 0.5 s and is stunned 1.0 s. | +20 m range | Stun +0.5 s | −25 s CD |

### 9.22 Cockatoo — `cockatoo` · Spirit burst

**Silhouette and colour:** stocky white body and a thick hooked grey bill, crowned by a tall sulphur-yellow crest
that lies flat when idle and fans straight up (doubling the bird's height) when it casts or shrieks. Reads as
"white bird with a yellow flame on its head".
**Body plan:** height 1.75 m (raised crest to 2.1 m, no hitbox) · head r 0.18 m at 1.52 m · capsule r 0.34 m.
**Base stats:** HP 560 (+32/level) · move 7.0 m/s · stamina 3.
**Gun — Screech Horn:** projectile 75 m/s · 14 Talon × 1 · spread 1.0° · falloff 14–32 m · 4.5 shots/s ·
magazine 20 · reload 2.0 s (63 DPS at level 1).

| # | Ability | Targeting | CD | Charges | Range | Effect | T1 | T2 | T3 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Screech | direction | 11 s | — | 14 m cone (45°) | Enemies in the cone take 100 + 1.0×SP Song damage and are silenced 0.75 s. | +25 damage | −3 s CD | Silence 1.5 s |
| 2 | Crest Flare | self | 20 s | — | — | For 6 s: +25 SP and +15% Song damage. On cast, your other abilities' cooldowns drop by 3 s. | +2 s duration | +10 SP | Cooldown drop 6 s |
| 3 | Seed Crack | point | 13 s | — | 25 m | A nut lands and cracks 0.8 s later: 5 m radius, 120 + 1.1×SP Song damage, knock-up 0.5 s. | +1 m radius | −3 s CD | 2 charges |
| 4 | Sulphur Shriek | channel | 110 s | — | 15 m radius | Channel 2 s (50% move speed, no gun): 4 pulses, one every 0.5 s, each dealing 80 + 0.7×SP Song damage to enemies within 15 m. An enemy hit by 3 pulses is stunned 1.0 s. | +3 m radius | +1 pulse (2.5 s channel) | Enemies hit lose 20% Song resist for 6 s |

### 9.23 Swan — `swan` · Support

**Silhouette and colour:** a smooth white teardrop body sitting low on short legs, a long elegant S-neck, and
wings raised in an arch behind the back like a heart; orange bill with a black knob. Reads as "white heart shape
with a long neck". (The Flamingo is pink, thin and long-legged; the Swan is white, round and low.)
**Body plan:** height 2.0 m · head r 0.14 m at 1.88 m · capsule r 0.42 m.
**Base stats:** HP 600 (+35/level) · move 6.9 m/s · stamina 3.
**Gun — Lake Lance:** hitscan · 20 Talon × 1 · spread 0.5° · falloff 20–42 m · 3.6 shots/s · magazine 14 ·
reload 2.0 s (72 DPS at level 1).

| # | Ability | Targeting | CD | Charges | Range | Effect | T1 | T2 | T3 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Grace Link | unit (ally) | 18 s | — | 25 m (breaks at 35 m) | Tether for 8 s: you and the ally each heal 20 + 0.2×SP per second; the ally has +10% Talon and Song resist. | +4 s duration | Heal +10 per second | Link a second ally (cast again within the duration) |
| 2 | Hiss | direction | 12 s | — | 8 m cone (60°) | Enemies in the cone take 50 + 0.5×SP Song damage, are knocked back 6 m and slowed 30% for 2 s. | +25 damage | −3 s CD | Also disarms 1.0 s |
| 3 | Lake Glide | self | 16 s | — | 6 m radius | For 3 s: +40% move speed and slows removed; allies within 6 m get +20% move speed and their slows removed. | +1 s duration | −4 s CD | Allies get the full +40% |
| 4 | Swan Song | self | 140 s | — | 15 m radius | Allied heroes within 15 m (including you) are undying for 4 s; when it ends each heals 25% of max HP. | +5 m radius | +1 s duration | −40 s CD |

### 9.24 Kiwi — `kiwi` · Assassin

**Silhouette and colour:** a round, hairy brown ball on strong legs, with no visible wings or tail and a very
long thin down-curved bill that probes the ground ahead; whiskers at the bill's base. Reads as "furry ball with a
long curved needle" (the Hummingbird hovers and blurs; the Kiwi walks and is round).
**Body plan:** height 1.2 m · head r 0.15 m at 1.0 m · capsule r 0.40 m.
**Base stats:** HP 560 (+34/level) · move 7.2 m/s · stamina 3.
**Gun — Burrow Blunderbuss:** hitscan shotgun · 7 Talon × 6 pellets · spread 3.5° · falloff 8–18 m ·
1.6 shots/s · magazine 5 · reload 2.0 s (67 DPS at level 1).

| # | Ability | Targeting | CD | Charges | Range | Effect | T1 | T2 | T3 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Burrow | self | 18 s | — | — | Go underground for up to 4 s: intangible and invisible, 9 m/s, no attacks; a dirt trail is visible to enemies within 10 m. Resurfacing (press again or timeout) knocks up enemies within 3 m for 0.6 s and deals 80 + 0.8×SP Song damage. | +1 s duration | −4 s CD | Resurfacing heals you 15% of max HP |
| 2 | Probe | direction | 9 s | — | 3 m | Bill stab (0.8 m radius): 90 + 0.9×SP Song damage and −15% Talon resist for 5 s. | +25 damage | −2 s CD | Also roots 0.75 s |
| 3 | Night Sense | self | 22 s | — | 50 m | For 6 s: true sight within 20 m, and every enemy hero below 50% HP within 50 m is revealed to your flock. | +3 s duration | True sight 30 m | +20% move speed for the duration |
| 4 | Ambush Pit | point | 100 s | — | 20 m | Tunnel to the point over 1.0 s (intangible, invisible), then erupt: 6 m radius, 220 + 1.6×SP Song damage, knock-up 1.0 s, then slow 40% for 2 s. | +10 m range | +60 damage | −30 s CD |

### 9.24.1 Silhouette distinctness check (40 m)

| Size band | Heroes and the one shape that separates them |
|---|---|
| Very tall (≥ 2.2 m) | Cassowary (haystack + casque), Albatross (cloak-wide triangle), Secretarybird (stilts + quill crown), Flamingo (pink stick + bent neck) |
| Tall (1.9–2.1 m) | Pelican (pear + pouch), Swan (white heart + S-neck), Vulture (hunch + bald head), Hornbill (helmet bill), Peacock (train / fan) |
| Medium (1.7–1.8 m) | Shrike (horizontal blade tail), Lyrebird (lyre above head), Owl (round head + tufts), Toucan (rainbow bill), Woodpecker (red cap + prop tail), Frigatebird (black W + red balloon), Cockatoo (yellow crest flame) |
| Small (≤ 1.6 m) | Kingfisher (dagger bill, crouched), Penguin (skittle + flippers), Nightjar (flat wedge), Starling (orbiting specks), Swift (crescent), Puffin (striped triangle face), Hummingbird (hover discs), Kiwi (ball + curved needle) |

Within a band no two heroes share a primary shape. The Technical Artist checks this with the 40 m line-up
screenshot (§16, M3).

### 9.25 Effect primitives

Every ability, upgrade tier and item effect is a composition of these primitives (plus the ability-level
properties: targeting, cooldown, charges, cast time, channel, range). Names are the vocabulary for the contracts.

| Primitive | Parameters | Used for |
|---|---|---|
| `damage` | type (talon/song), base, spCoef, beakShot flag, bonus conditions (target HP below %, target kind, distance), % of target missing HP, executeBelow (kill if HP after the hit is below % of max) | every hit; Riverstrike, Night Swallow |
| `heal` | base, spCoef, overTime (duration) | Mended Song, Healing Dew, lifesteal procs |
| `applyStatus` | status kind (§5.9), duration, magnitude | stun, silence, slow, reveal, invisibility, … |
| `cleanse` | which: negative / positive / list of kinds | Mended Song T3, Preening Rite |
| `displace` | mode (push, pull, up, along direction), distance or speed, origin | knockbacks, pulls, knock-ups, spit |
| `dash` | distance, duration, direction source (aim, movement, to target), arc height, passThrough, stopOnHit, onHit effects | Plunge, Wing Slam, Long Stride, leaps |
| `teleport` | destination (point, behind target at d m), facing | Riverstrike |
| `projectile` | speed, radius, range, gravity (arc to a point), pierce (none, units, all), returns (flies back to the caster), max hits per target, onHit effects, onExpire effects | bolts, Hush, Murmuration, Wing Scythe, Fruit Lob |
| `area` | shape (sphere, cylinder, cone, ring, box), size, duration, tick effects, onEnter/onExit/onCross effects, attach (point, unit, or moving: speed and direction, optionally carrying units), filter (enemies, allies, heroes only) | zones, auras, ring walls, slams, Rogue Wave |
| `summon` | kind (trap, decoy, wall, turret), hp, lifetime, max count, behaviour id, trigger, effects | Thorn Larder, Echo Double, Gale Shield, Burrow Colony |
| `statMod` | stat, add or multiply, duration, stacks | resists, fire rate, damage %, move speed |
| `weaponMod` | ammoFree, instant reload, splash radius and %, bounce count, pierce count, ignore falloff, target filter (e.g. only vs a unit with a given mark), onBulletHit effects, every-Nth-shot effects | Bottomless Pouch, Skipping Stone, Heavy Rounds, Marked Prey |
| `shield` | kind (talon, song, barrier), amount, spCoef, duration, recharge delay | Covey Ward, Talon Bulwark |
| `movementMode` | mode (glide, flight, hover, cling, toboggan, burrow), duration, speeds, what is allowed (gun, abilities), onCollide effects, onEnd effects | Silent Wing, Sky Stitch, Hummingbird Hover, Tree Cling, Toboggan, Burrow |
| `attach` | target to caster socket, duration, onRelease effects | Gulp |
| `tether` | target (ally or enemy), duration, break distance, tick effects on caster and on target | Grace Link, Nectar Sip |
| `delay` | seconds, effects | telegraphs, echoes, ring arm time |
| `cooldownMod` | reset or refund (abilities, items, a slot), amount | Encore, Riverstrike refund |
| `trigger` | event (on gun hit, on beak shot, on ability hit, on damaged, on kill, on assist, on would-die, on cast), count (fire on every Nth event), internal cooldown, duration (when granted by an ability), effects | item passives, Footwork, Bristle, Hammerhead |

---

## 10. Items

48 items: 16 per category, 4 per tier. Tier costs: T1 800, T2 1,600, T3 3,200, T4 6,400 seeds. 11 actives.

**Stacking rules (rule):** gun damage %, Song damage %, fire rate %, move speed and flat stats add. Cooldown
reduction (CDR) and status resist stack multiplicatively (`1 − Π(1 − xᵢ)`), CDR capped at 50%, status resist at
60%. Lifesteal adds. Resists follow §5.3. "Gun damage" never applies to melee or abilities. Item Song damage
scales with SP where it says so. Active cooldowns are not reduced by CDR unless stated.

### 10.1 Talon (gun power)

| id | Name | Tier | Cost | Stats and passive | Active | Upgrades from |
|---|---|---|---|---|---|---|
| `quill-clip` | Quill Clip | 1 | 800 | +25% magazine size, +6% gun damage | — | — |
| `close-talons` | Close Talons | 1 | 800 | +20% gun damage to targets within 15 m | — | — |
| `beak-whetstone` | Beak Whetstone | 1 | 800 | Beak shots deal +35 Talon damage (once per shot) | — | — |
| `quick-preen` | Quick Preen | 1 | 800 | +10% fire rate, +15% reload speed | — | — |
| `foragers-talon` | Forager's Talon | 2 | 1,600 | +30% gun damage to non-heroes (fledglings, creatures, Nests, the Roc, structures), +8% gun damage to heroes, +100 HP | — | — |
| `long-fletching` | Long Fletching | 2 | 1,600 | +45% falloff start and end, +15% projectile speed, +8% gun damage | — | — |
| `bloodbeak` | Bloodbeak | 2 | 1,600 | 15% Talon lifesteal, +75 HP | — | — |
| `flurry-feathers` | Flurry Feathers | 2 | 1,600 | +12% fire rate, +15% reload speed | **Flurry:** instant reload and +40% fire rate for 5 s. CD 30 s | `quick-preen` |
| `hawkeye-lens` | Hawkeye Lens | 3 | 3,200 | +15% gun damage; beak shots deal +80 Talon damage (once per shot) and give +20% fire rate for 3 s | — | `beak-whetstone` |
| `pinion-shred` | Pinion Shred | 3 | 3,200 | +10% gun damage; each gun hit on a hero shreds 3% Talon resist for 6 s (max 5 stacks) | — | — |
| `skipping-stone` | Skipping Stone | 3 | 3,200 | +8% gun damage; each shot that hits bounces to one more enemy within 8 m for 45% damage (no beak shot on the bounce) | — | — |
| `tailwind-volley` | Tailwind Volley | 3 | 3,200 | +35% magazine size, +12% gun damage | **Volley:** instant reload; +35% gun damage and +25% projectile speed for 4 s. CD 25 s | `quill-clip` |
| `apex-talon` | Apex Talon | 4 | 6,400 | +40% gun damage, +10% fire rate, +15% magazine size | — | — |
| `carrion-feast` | Carrion Feast | 4 | 6,400 | 28% Talon lifesteal, +200 HP; a hero kill or assist heals 15% of max HP | — | `bloodbeak` |
| `thunderclap-quills` | Thunderclap Quills | 4 | 6,400 | +10% gun damage; every 6th shot that hits a target deals +150 Talon damage and slows 30% for 1.5 s | — | — |
| `talon-tempest` | Talon Tempest | 4 | 6,400 | +20% fire rate, +20% reload speed | **Tempest:** for 5 s, +60% fire rate and shots use no ammo. CD 45 s | `flurry-feathers` |

### 10.2 Plumage (health, resists, regeneration, movement)

| id | Name | Tier | Cost | Stats and passive | Active | Upgrades from |
|---|---|---|---|---|---|---|
| `down-padding` | Down Padding | 1 | 800 | +160 max HP | — | — |
| `thick-quills` | Thick Quills | 1 | 800 | +12% Talon resist, +50 HP | — | — |
| `dew-drinker` | Dew Drinker | 1 | 800 | +2.5 HP/s; +10 HP/s more after 8 s without taking damage | — | — |
| `featherlight` | Featherlight | 1 | 800 | +1.0 m/s sprint speed, +20% stamina regeneration | — | — |
| `shade-ward` | Shade Ward | 2 | 1,600 | +15% Song resist, +100 HP | — | — |
| `healing-dew` | Healing Dew | 2 | 1,600 | +3 HP/s; +12 HP/s more after 8 s without taking damage | **Dew:** heal 320 over 5 s. CD 40 s | `dew-drinker` |
| `talon-bulwark` | Talon Bulwark | 2 | 1,600 | Talon shield 250 that refills after 10 s without taking damage; +8% Talon resist | — | `thick-quills` |
| `second-wind` | Second Wind | 2 | 1,600 | +1 stamina pip, +0.5 m/s move speed, +1.0 m/s sprint speed | — | `featherlight` |
| `stout-breast` | Stout Breast | 3 | 3,200 | +450 HP, +6% Talon and Song resist | — | `down-padding` |
| `preening-rite` | Preening Rite | 3 | 3,200 | +12% status resist, +150 HP | **Preen:** remove all negative statuses and get +25% move speed for 3 s. Usable while silenced (not while stunned). CD 40 s | — |
| `covey-ward` | Covey Ward | 3 | 3,200 | +150 HP, +6% Song resist | **Covey:** you and allied heroes within 12 m get a barrier of 220 + 1.0×SP for 6 s. CD 55 s | — |
| `iron-crest` | Iron Crest | 3 | 3,200 | +25% status resist, +250 HP, +12% Song resist | — | `shade-ward` |
| `second-clutch` | Second Clutch | 4 | 6,400 | +300 HP; when you would die, instead heal to 25% of max HP and become intangible for 1.5 s (150 s internal cooldown) | — | — |
| `thunderbird-heart` | Thunderbird Heart | 4 | 6,400 | +750 HP, +8 HP/s, +10% healing received | — | `stout-breast` |
| `unbowed-crest` | Unbowed Crest | 4 | 6,400 | +30% status resist, +350 HP, +15% Song resist | **Unbowed:** unstoppable and +20% Talon and Song resist for 3 s. CD 60 s | `iron-crest` |
| `nestmother-mantle` | Nestmother's Mantle | 4 | 6,400 | +400 HP; aura 15 m: allied heroes (you included) get +10% Talon and Song resist and +4 HP/s | — | — |

### 10.3 Song (ability power)

| id | Name | Tier | Cost | Stats and passive | Active | Upgrades from |
|---|---|---|---|---|---|---|
| `lilt-seed` | Lilt Seed | 1 | 800 | +8 SP, +50 HP | — | — |
| `quick-refrain` | Quick Refrain | 1 | 800 | +8% CDR | — | — |
| `carrying-voice` | Carrying Voice | 1 | 800 | +15% ability range, +6 SP | — | — |
| `mocking-note` | Mocking Note | 1 | 800 | +4 SP; your ability damage shreds the hero's Song resist by 8% for 6 s | — | — |
| `second-verse` | Second Verse | 2 | 1,600 | +1 charge for every ability that has charges, +6% CDR, +4 SP | — | — |
| `crescendo` | Crescendo | 2 | 1,600 | +12 SP; ability hits dealing 100 or more Song damage deal +20% | — | — |
| `muting-whistle` | Muting Whistle | 2 | 1,600 | +8 SP | **Mute:** silence the enemy hero nearest the crosshair within 25 m (6° cone) for 2.25 s. CD 45 s | — |
| `long-chorus` | Long Chorus | 2 | 1,600 | +20% duration of your abilities' statuses, areas and buffs; +8 SP | — | — |
| `rising-song` | Rising Song | 3 | 3,200 | +24 SP, +150 HP | — | `lilt-seed` |
| `tempo-shift` | Tempo Shift | 3 | 3,200 | +18% CDR, +8 SP | — | `quick-refrain` |
| `song-siphon` | Song Siphon | 3 | 3,200 | 18% Song lifesteal, +10 SP | — | — |
| `whirlwind-knot` | Whirlwind Knot | 3 | 3,200 | +10 SP, +100 HP | **Whirl:** enemies within 6 m are knocked up 0.75 s and take 90 + 0.6×SP Song damage. CD 35 s | — |
| `encore` | Encore | 4 | 6,400 | +15 SP, +10% CDR | **Encore:** reset the cooldowns of abilities 1–4 (not items). CD 150 s | — |
| `gloom-curse` | Gloom Curse | 4 | 6,400 | +18 SP | **Curse:** the enemy hero nearest the crosshair within 25 m (6° cone) is silenced, disarmed and slowed 30% for 2.5 s. CD 60 s | `muting-whistle` |
| `boundless-song` | Boundless Song | 4 | 6,400 | +40 SP, +20% ability range, ultimate cooldown −20% | — | `carrying-voice` |
| `echo-chamber` | Echo Chamber | 4 | 6,400 | +20 SP; ability damage to heroes repeats 1.0 s later at 25% (damage only); ability damage shreds Song resist by 14% for 6 s | — | `mocking-note` |

**Actives (11):** Flurry Feathers, Tailwind Volley, Talon Tempest, Healing Dew, Preening Rite, Covey Ward,
Unbowed Crest, Muting Whistle, Whirlwind Knot, Encore, Gloom Curse. Every active uses the §9.25 primitives.

---

## 11. Bots

Bots are utility-AI heroes that play whole matches with the same rules, inputs and information as the player.

### 11.1 Fairness rules

- Bots act through the same input commands as the player (move, look, fire, abilities, items, buy) and the same
  aim model (§4.5). No sim shortcuts.
- **Vision (rule, also used by the player's minimap):** an enemy is visible to a flock when any allied hero has
  line of sight to it within 40 m, an allied fledgling within 20 m, an allied structure within 30 m, or it is
  revealed. Invisible enemies follow §5.9. Bots know only what their flock sees, plus the last-seen position and
  time of each enemy hero.
- All bot randomness uses the seeded RNG.

### 11.2 Difficulties

| Parameter | Chick (easy) | Hunter (normal) | Raptor (hard) |
|---|---|---|---|
| Reaction time (enemy first seen → first shot) | 600 ms | 350 ms | 200 ms (all ±25% seeded jitter) |
| Aim error, static target (std. dev. of angle) | 4.0° | 2.2° | 1.0° |
| Extra error per m/s of target lateral speed | 0.5° | 0.3° | 0.15° |
| Tracking smoothing (time constant) | 250 ms | 150 ms | 80 ms |
| Aims at the head | 0% of engagements | 25% | 60% |
| Last-hit attempt rate | 50% | 80% | 95% |
| Pod timing error | ±0.4 s | ±0.2 s | ±0.05 s |
| Deny attempts | never | 50% | 90% |
| Decision interval | 0.5 s | 0.33 s | 0.2 s |
| Ability use | Casts when a valid target is in range, no prediction | Casts when predicted hit chance ≥ 50%; uses disables on the nearest threat | Leads moving targets, chains disable then burst, holds ultimates for 2+ heroes or a confirmed kill |
| Parry | never | 20% vs a visible heavy melee | 60% |
| Movement | Walk, jump, Updrafts | + dash, slide, Chimneys, Vines | + dash-jump, mantle routes, Updraft boost, rooftops |
| Shopping | Only at the Home Roost | Any own shop | Any own shop; leaves lane to shop at 3,000+ unspent seeds |
| Retreat HP | 25% | 35% | 40% |
| Map awareness | What it sees | + minimap | + minimap and last-seen tracking |

The match setting picks one difficulty for all bots, or "Mixed" (allies Hunter, enemies chosen per slot).

### 11.3 Behaviour states (utility scored every decision interval)

| State | Scores high when | Does |
|---|---|---|
| **Lane** | Laning phase (before 10:00) or its lane's wave needs escort | Stays behind its own wave (within 25 m of its fledglings, never ahead of the front); last-hits when an enemy fledgling's HP ≤ its next shot's damage; shoots ripe pods (secure) and denies own pods; pokes the enemy hero when no last hit is due and its HP ≥ the enemy's; never stands in enemy tower range unless enemy fledglings are being hit by it |
| **Fight** | An enemy hero is visible within 35 m and the local fight score (allied vs enemy effective HP × DPS within 30 m) ≥ 0.9 | Targets the enemy with the lowest effective HP in range, preferring supports and carries; uses abilities per difficulty; strafes and dashes between shots (Hunter+) |
| **Retreat** | HP below the difficulty threshold, fight score < 0.6, or 2+ more enemies than allies in 30 m | Moves to the nearest allied tower, then the Home Roost if HP < 30%; uses escape abilities and Updrafts |
| **Shop** | Unspent seeds ≥ next build item's price and (in a shop zone, or HP < 50%, or the Raptor 3,000-seed rule) | Walks to the nearest own shop, buys down the build list, spends AP |
| **Farm** | Its lane is pushed past the centre or a Thicket within 60 m is up and no enemy hero is visible | Clears Thickets (tier matched to level: T3 from level 10), breaks Nests on the way |
| **Objective** | Egg spawns within 60 s, a rune spawns within 40 m and 20 s, Roc conditions (below) | Moves to the objective with nearby allies |
| **Push / siege** | After 20:00, or Ember active, or 2+ enemies dead, and an allied wave is near an enemy structure | Groups with 3+ allies and pushes with the wave; doesn't hit Brood-Warded structures unless no enemy heroes are visible |
| **Defend** | An enemy group of 2+ heroes is attacking an allied structure | The 3 nearest bots rotate to defend |

**Laning assignment:** two heroes per lane (2-2-2). The human picks first (hero select); bots fill lanes by
pairing archetypes: a frontline (tank, skirmisher, assassin) with a backline (carry, poke, support, burst,
control) where possible.

**Rotations:** a bot leaves its lane when its lane's enemy Hawk is down and its own Hawk is safe, when the Egg or
a rune is due, or after 10:00 when its lane partner can hold the wave alone (Hunter+).

**Golden Egg:** the 3 bots nearest the spawn go; the bot with the lowest net worth carries; the others escort
within 10 m. Enemy bots treat the carrier as their top target. A bot carrier drops the Egg (E) and fights if a
lone enemy reaches it and it is healthy.

**The Roc:** a flock's bots start the Roc when ≥ 4 allies are alive and within 40 m of the Hollow, and either 2+
enemies are dead or no enemy hero has been seen within 80 m for 10 s. The healthiest melee-range bot claims the
Ember with heavy melee. Bots contest an enemy Roc attempt they can see with all allies within 80 m.

**Sieging:** from 20:00 bots group in fives or sixes behind a wave, take Hawk → Heron → Wardens → Shrines →
Patron in order, focus the Patron's weak point in phase 2 (Hunter+), and fall back when 2+ allies die.

### 11.4 Buying and AP

- Bots buy the next item on their hero's build list that they can afford, respecting components (an upgrade is
  bought only after its component). When all slots are full, they sell the lowest-tier item that isn't a
  component of the next purchase.
- Bots spend AP as soon as they get it, following the hero's AP priority: the ultimate's tiers whenever
  affordable, otherwise T1s in priority order, then T2s, then T3s.

### 11.5 Build lists and AP priority (one per hero)

| Hero | Build list (in order) | AP priority (after the ultimate) |
|---|---|---|
| `shrike` | lilt-seed, quick-refrain, dew-drinker, carrying-voice, long-chorus, shade-ward, tempo-shift, rising-song, muting-whistle, iron-crest, boundless-song, gloom-curse, unbowed-crest, encore | 1 > 3 > 2 |
| `albatross` | thick-quills, down-padding, dew-drinker, lilt-seed, talon-bulwark, shade-ward, stout-breast, covey-ward, iron-crest, healing-dew, thunderbird-heart, unbowed-crest, nestmother-mantle | 2 > 1 > 3 |
| `kingfisher` | beak-whetstone, lilt-seed, featherlight, mocking-note, crescendo, second-wind, hawkeye-lens, rising-song, shade-ward, song-siphon, echo-chamber, second-clutch | 3 > 1 > 2 |
| `lyrebird` | lilt-seed, quick-refrain, dew-drinker, down-padding, healing-dew, second-verse, covey-ward, tempo-shift, shade-ward, rising-song, nestmother-mantle, iron-crest, encore | 1 > 3 > 2 |
| `owl` | beak-whetstone, quill-clip, long-fletching, lilt-seed, hawkeye-lens, featherlight, crescendo, tailwind-volley, shade-ward, apex-talon, rising-song, second-clutch | 1 > 2 > 3 |
| `pelican` | quick-preen, quill-clip, close-talons, dew-drinker, flurry-feathers, bloodbeak, foragers-talon, tailwind-volley, pinion-shred, shade-ward, carrion-feast, apex-talon, talon-tempest | 2 > 3 > 1 |
| `secretarybird` | featherlight, quick-preen, lilt-seed, close-talons, second-wind, flurry-feathers, crescendo, thick-quills, talon-bulwark, rising-song, skipping-stone, thunderclap-quills, second-clutch | 1 > 2 > 3 |
| `starling` | lilt-seed, mocking-note, carrying-voice, quick-refrain, crescendo, second-verse, rising-song, tempo-shift, shade-ward, echo-chamber, boundless-song, encore | 1 > 2 > 3 |
| `hornbill` | quick-preen, close-talons, quill-clip, down-padding, foragers-talon, flurry-feathers, long-fletching, pinion-shred, stout-breast, tailwind-volley, apex-talon, thunderclap-quills, talon-tempest | 1 > 2 > 3 |
| `flamingo` | lilt-seed, dew-drinker, quick-refrain, featherlight, healing-dew, long-chorus, covey-ward, tempo-shift, second-wind, preening-rite, nestmother-mantle, rising-song | 1 > 2 > 3 |
| `penguin` | thick-quills, down-padding, featherlight, lilt-seed, talon-bulwark, second-wind, shade-ward, stout-breast, iron-crest, whirlwind-knot, thunderbird-heart, unbowed-crest | 1 > 2 > 3 |
| `puffin` | lilt-seed, quick-refrain, dew-drinker, long-chorus, carrying-voice, second-verse, tempo-shift, shade-ward, rising-song, iron-crest, boundless-song, nestmother-mantle | 1 > 2 > 3 |
| `peacock` | lilt-seed, mocking-note, quick-refrain, crescendo, featherlight, rising-song, tempo-shift, song-siphon, second-wind, echo-chamber, encore, second-clutch | 1 > 2 > 3 |
| `vulture` | lilt-seed, dew-drinker, thick-quills, quick-refrain, long-chorus, song-siphon, talon-bulwark, tempo-shift, rising-song, down-padding, stout-breast, thunderbird-heart, nestmother-mantle | 1 > 2 > 3 |
| `swift` | featherlight, quick-preen, close-talons, quill-clip, second-wind, flurry-feathers, skipping-stone, bloodbeak, tailwind-volley, carrion-feast, apex-talon, talon-tempest | 3 > 1 > 2 |
| `hummingbird` | featherlight, close-talons, lilt-seed, dew-drinker, second-wind, bloodbeak, healing-dew, song-siphon, skipping-stone, preening-rite, carrion-feast, second-clutch | 1 > 2 > 3 |
| `cassowary` | thick-quills, down-padding, lilt-seed, featherlight, talon-bulwark, shade-ward, second-wind, stout-breast, iron-crest, whirlwind-knot, unbowed-crest, thunderbird-heart | 1 > 2 > 3 |
| `toucan` | lilt-seed, carrying-voice, quill-clip, quick-refrain, long-fletching, crescendo, tempo-shift, rising-song, shade-ward, boundless-song, tailwind-volley, encore | 1 > 2 > 3 |
| `woodpecker` | quick-preen, quill-clip, close-talons, thick-quills, flurry-feathers, pinion-shred, talon-bulwark, foragers-talon, tailwind-volley, apex-talon, thunderclap-quills, talon-tempest | 1 > 2 > 3 |
| `nightjar` | lilt-seed, mocking-note, beak-whetstone, featherlight, muting-whistle, crescendo, second-wind, rising-song, hawkeye-lens, gloom-curse, echo-chamber, second-clutch | 1 > 2 > 3 |
| `frigatebird` | quill-clip, beak-whetstone, long-fletching, featherlight, lilt-seed, hawkeye-lens, second-wind, tailwind-volley, pinion-shred, shade-ward, apex-talon, iron-crest | 1 > 3 > 2 |
| `cockatoo` | lilt-seed, quick-refrain, mocking-note, crescendo, dew-drinker, second-verse, rising-song, tempo-shift, whirlwind-knot, healing-dew, echo-chamber, encore | 1 > 3 > 2 |
| `swan` | lilt-seed, dew-drinker, down-padding, quick-refrain, healing-dew, covey-ward, long-chorus, preening-rite, stout-breast, tempo-shift, nestmother-mantle, thunderbird-heart | 1 > 2 > 3 |
| `kiwi` | close-talons, lilt-seed, featherlight, mocking-note, crescendo, second-wind, song-siphon, skipping-stone, rising-song, muting-whistle, gloom-curse, second-clutch | 1 > 2 > 3 |

Every one of the 48 items appears in at least one list.

### 11.6 Hero picks for bots

Bots pick after the player, one at a time, alternating flocks, choosing an archetype their flock lacks (order:
support, tank/initiator, gun carry, area control, then any), and a random hero (seeded) of that archetype that
isn't taken. A flock never has two heroes of the same archetype when another is free.

---

## 12. UI and UX

All UI is a DOM/CSS overlay. Style: dark translucent panels (rgba 12, 14, 18, 0.78) with 6 px radius, system
font stack, flock colours from §14, Talon orange / Plumage green / Song purple for item categories. Every screen
works with mouse and keyboard; Esc always backs out.

### 12.1 Screen flow

```
Boot → Main menu ─┬─ Play → Match setup → Hero select → Loading → Match (HUD) → End of match ─┬─ Play again
                  ├─ Heroes (gallery)                         │  ↑ Esc: Pause ─ Settings      └─ Main menu
                  ├─ Settings                                 └─ Tab scoreboard, B shop, M big map
                  ├─ Practice Hub → Hero select → Practice (HUD) → Main menu
                  └─ How to play
```

### 12.2 Main menu

- Background: a slow fly-through of the map at dusk with the 12 last-picked heroes perched on a rooftop.
- Title "PERCH" with a feather that drifts across it. Buttons: **Play**, **Practice Hub**, **Heroes**,
  **Settings**, **How to play**.
- **Match setup** (from Play): bot difficulty (Chick / Hunter / Raptor / Mixed), flock (Dawn / Dusk / Random),
  seed (blank = random, shown on the end screen for replays), Start.
- **Heroes:** the hero select grid without a timer; for learning kits.
- **Practice Hub:** choose an available hero and enter a solo practice session (§12.12).
- **How to play:** controls table (§3.1) and a one-page loop summary (lanes, seeds, pods, structures, Patron).

### 12.3 Hero select

- Left: a grid of 24 portraits, 8 columns (one per archetype, labelled) × 3 rows. Portraits are live renders of
  the procedural models. Taken heroes grey out with the taker's flock colour.
- Right: **rotating 3D preview** of the highlighted hero on a mossy plinth, turning at 20°/s (drag to rotate,
  wheel to zoom 0.8–1.4×); plays its call and a cast pose on selection.
- Under the preview: name, archetype, a 3-bar profile (Damage, Survival, Mobility), gun stats (damage, fire rate,
  magazine, range), and the four abilities (hover: full text with numbers at level 1).
- **Lock in** (Enter). Then bots pick (§11.6), one every 0.4 s, shown in two flock columns. No timer in
  single-player; Random button picks for you.

### 12.4 HUD

```
+-------------------------------------------------------------------------------------------+
|+-----------+   DAWN 41,250  ▮▮▮▯ ▮▮▯ ▮▮   [ 18:42 ]   ▮▮ ▮▮▯ ▮▮▮▯  38,900 DUSK  | kill feed   |
|| MINIMAP   |   (net worth)  (Hawks/Herons/Wardens alive per lane)               | (5 lines)   |
|| 220x254px |                                                                  +-------------|
|+-----------+  [Egg 0:45]  [Roc awake]  [Rune: Fierce 0:12]   (objective banners)            |
|                                                                                           |
|                                            ·                                              |
|                                        -   +   -        (crosshair + hit markers)         |
|                                            ·                                              |
|                                                                                           |
|  [buff][buff][debuff]                                       damage numbers float in world  |
|  +------+  HP ██████████████░░░░  642 / 820 (+120 shield)                                  |
|  | face |  Stamina ● ● ○     Lv 9 ▰▰▰▰▱ 6,000→7,200   AP 2     Seeds 1,250                 |
|  +------+  [ 1 ][ 2 ][ 3 ][ 4 ]   [ Z ][ X ][ N ][ V ]   18 / 24  ⟳                         |
+-------------------------------------------------------------------------------------------+
```

- **Bottom-left cluster:** portrait (flashes red on damage), health bar (shields shown as a white extension,
  barriers grey), stamina pips, level with progress to the next level, unspent AP (pulses; Alt+1–4 or the
  ability panel to spend),
  wallet. Ability icons with cooldown sweeps, charges as small numbers, AP tier pips (3 per ability), keybinds;
  item actives below their keys; ammo and reload ring at the right end.
- **Top centre:** flock net worth totals, match timer, and per-lane structure pips for both flocks.
- **Top right:** kill feed (§12.8). Below it: respawn timers of dead allies.
- **Objective banners** (top centre, under the timer): Egg spawn countdown from 60 s before, Egg carrier
  status, Roc spawn countdown and state, rune spawns.
- **Status icons** above the portrait: buffs (teal border) and debuffs (red border) with timers.
- **World-space:** health bars over heroes (allies green, enemies red; level number on the bar), fledglings
  (thin bars), structures (wide bars with Brood Ward shield icon), pods (gold or grey-blue glow), ping markers,
  ability telegraphs, offscreen damage direction arcs (red), low-HP vignette below 25% HP.
- **Death screen:** "Taken down by" with the killer's portrait and a damage breakdown (Talon / Song, top 3
  sources), respawn countdown, spectate allies (mouse buttons cycle). The shop and AP spending work while dead.

Tap Inspect / upgrade (Left Alt by default) to release pointer lock and open the ability panel. Hover or
keyboard-focus an ability to see its full current description, rank, tier effects and next tier cost or
lock reason. Click an eligible ability's upgrade button or activate it with the keyboard to buy one tier
using the normal AP rules (§8.5). Refresh the cost, rank and AP immediately. The panel consumes its clicks
and suppresses aiming, firing and casts while open. Close it with its action again, Close or Esc, then
resume pointer capture. Holding the configured upgrade modifier and pressing 1–4 keeps the quick upgrade
shortcut. Releasing the modifier after the shortcut keeps the panel closed.

### 12.5 Minimap and pings

- Top-left, 220 × 254 px (map aspect 260:300), always oriented with your base at the bottom.
- Shows: allied heroes (portrait dots ringed in flock colour), visible enemy heroes (red-ringed dots;
  last-seen ghosts fade over 6 s), fledgling waves (small flock-coloured dots), structures (icons with an HP
  ring), Thickets (icon when alive, grey when cleared), runes, Egg and carrier, Roc state, pings, your camera
  cone. Visibility follows §11.1.
- **Ping (middle mouse):** tap pings what is under the crosshair (or the minimap cursor): enemy → "Attack",
  objective → "Take", allied structure → "Defend", ground → "Go here". Hold opens a wheel: **Danger**,
  **On my way**, **Retreat**, **Need help**. Pings show in the world (icon and distance, 6 s), on the minimap
  (pulse) and as a short text line in the feed, with a distinct sound per type. Limit 3 pings per 4 s.
- Hunter and Raptor bots within 60 m raise the utility of a pinged target and reply with "On my way" if they
  follow it.
- **Big map (M):** the minimap at 70% of screen height, same rules.

### 12.6 The Magpie's Hoard (B)

- Full-screen overlay; the game keeps running behind it (mouse look is released).
- Three columns — **Talon** (orange), **Plumage** (green), **Song** (purple) — by four tier rows (800, 1,600,
  3,200, 6,400). Each card: icon, name, cost (red if unaffordable), a corner tag if owned, a link mark if you own
  its component (cost shows the discounted price).
- Hover: tooltip with every stat, the active (cooldown and effect), its component and what it upgrades into.
- Left click buys (in a shop zone); right click an owned item sells it (refund shown). Outside shop zones the
  shop is read-only with the banner "Visit a Magpie stall or your Home Roost to trade".
- Right panel: your 12 slots + 4 flex slots (locked ones show what unlocks them), wallet and net worth, and a
  "Suggested" strip from the hero's build list (§11.5). A search box filters by name or stat.

### 12.7 Scoreboard (Tab)

Two flock tables side by side: hero portrait, name (you highlighted), level, kills / deaths / assists, net worth,
last hits / denies, item icons (16), and a dead marker with respawn time. Footer per flock: total net worth,
structures destroyed, Eggs delivered, Ember claims. Header: match time and seed.

### 12.8 Kill feed and damage numbers

- **Kill feed:** top right, newest on top, 5 lines, each visible 6 s: killer portrait → victim portrait, a gold
  beak icon when the killing blow was a beak shot, small assist portraits. Objective lines (Hawk destroyed, Egg
  delivered, Roc slain, Ember claimed, Patron phase 2) have a gold border and stay 8 s.
- **Damage numbers:** spawn at the hit point and drift up 0.6 m over 0.8 s. White = Talon, violet = Song, gold
  and 1.3× size = beak shot, orange = weak point, grey = into a shield. Hits on the same target within 0.15 s merge
  into one number. Heals on yourself show green "+N" near the health bar. Toggle in settings.

### 12.9 Settings

| Tab | Options (defaults) |
|---|---|
| Gameplay | Quick cast (off), crosshair colour (white), damage numbers (on), auto shoulder swap (off), slide toggle vs hold (hold), show FPS (off) |
| Controls | Sensitivity (1.0), aim multiplier (1.0), invert Y (off), keybinds for every §3.1 action with conflict warnings, reset to defaults |
| Video | FOV (90°), quality preset Low / Medium / High (Medium), render scale 50–100% (100%), shadows (on Medium and High) |
| Audio | Master (80%), music (60%), effects (100%), hero calls (100%), UI (70%), mute when the tab is unfocused (on) |

Settings save to localStorage and apply immediately.

On first load of a legacy save, migrate its old default crouch (Left Ctrl) and slot-3 item key (C) to C and N.
Resolve those two defaults together so they cannot collide. Preserve explicitly customised bindings. If a
custom action occupies a destination key, keep it and assign the migrating action an unused browser-safe
key, shown in Controls. Warn when a custom binding can form a reserved browser chord. Capture mouse buttons
while the control is listening, including side buttons, with the same explicit swap handling and persistence.

### 12.10 Pause (Esc)

Resume · Settings · How to play · Concede (from 15:00, confirm) · Main menu (confirm). Pausing stops the
simulation (single-player).

### 12.11 End of match

- The losing Patron's collapse plays (4 s), then **Victory** or **Defeat** in the winning flock's colour.
- Tabs: **Summary** (match length, seed, MVP by hero damage + objective damage + healing), **Scoreboard** (§12.7
  plus hero damage, structure damage, healing, last hits, denies, pods secured, beak-shot %), **Graphs** (flock net
  worth over time, with markers for structures, Eggs, Roc and Ember), **Items** (each hero's purchase timeline).
- Buttons: **Play again** (same setup, new seed), **Main menu**.

### 12.12 Practice Hub

Open **Practice Hub** from the main menu and lock in an available hero. A fresh session unlocks all four
base abilities and grants 32 practice AP to try the usual tier costs. Choose a damaging hero to fire or cast
at the stationary enemy damage dummy. Choose a healer to use a normal ally-targeted heal on the stationary
wounded ally dummy. Each has a distinct label and health bar. Show damage or healing feedback and updated
health through normal play. Once the target settles, reset it to its starting state for another attempt.
The enemy starts at full health and the ally at 40%.

Practice uses the usual controls, aim, abilities and upgrade panel. Pause and choose Main menu to leave.
Play starts with fresh match progression and the usual ultimate unlock.

---

## 13. Audio direction

Everything is synthesised with WebAudio (oscillators, noise, filters, envelopes); no samples. The soundscape is
a woodland town: wind, leaves, water, distant birdsong in the menus, with weapons that sound like wood, bone,
reed and air rather than metal.

### 13.1 Mix and positional rules

- Heroes, units and structures within 60 m play through HRTF panners: inverse distance, reference 5 m, rolloff
  1.0, max 60 m. Line-of-sight blocked by world geometry → low-pass at 1.2 kHz and −4 dB.
- Priority (ducking, highest first): beak-shot tick and kill confirm, own low-HP heartbeat, enemy ultimate casts
  within 30 m, own gun, structure alarms, other combat, ambience, music. Music ducks −6 dB during fights.
- Voice limit: 48 concurrent sounds; the farthest, lowest-priority voices are stolen first.

### 13.2 Combat and movement sounds

| Event | Sound design |
|---|---|
| Body hit (you hit) | Short soft thud: 120 Hz sine blip + filtered noise click, 60 ms |
| **Beak-shot tick** | Bright high "tink": 2.8 kHz sine with fast decay (40 ms) over the thud; always audible, never panned |
| Kill confirm | Two-note rising chirp (A5 → E6) |
| Hit taken | Muffled thump + short breath of noise from the damage direction |
| Shield / barrier hit | Glassy shimmer (two detuned sines, 3 kHz, 80 ms) |
| Melee light / heavy | Air swish (band-passed noise sweep) / longer swish + wooden crack on hit |
| Parry success / whiff | Ringing "clink" (metal-like FM bell) / dull whoosh |
| Reload | Two or three wooden clicks timed to the reload; per-shell clicks for shell loaders |
| Dash / dash-jump | Wing whoosh (noise swept 400 → 2,000 Hz) + flap transient |
| Slide | Gritty scrape loop (low-passed brown noise) |
| Jump / land | Soft flap / thud scaled by fall speed |
| Updraft ride / boost | Wind loop, pitch follows speed / rising roar |
| Chimney / Vine | Warm-air rumble / leaf rustle loop |
| Pod secured / denied | Bright pop + rising three-note chime / dull crunch and a falling note |
| Seeds gained | Soft seed-shaker rattle, louder for bigger payouts |
| Level up (Molt) | Airy chord swell with feather flutter |
| Low HP (< 25%) | Slow heartbeat (55 Hz) under everything |
| Status applied to you | Stun: ringing tone; silence: muted "hush"; slow: low drag; root: creaking branches |

### 13.3 Guns and hero calls

Every gun is built from one of five base recipes and tuned per hero: **reed rifle** (sharp transient + short
resonant body, 1–2 kHz), **blunderbuss** (wide noise burst + low boom), **rattle** (rapid clicks with pitch
jitter, for automatic guns), **sling / dart** (whip + whoosh, for projectiles), **bone pistol** (snappy click +
hollow knock). Each hero's call plays on hero select, ultimate cast, respawn and kills (2 s cooldown).

| Hero | Gun sound | Call |
|---|---|---|
| Shrike | Sling/dart with a thorny rasp tail | Harsh scolding "chack-chack" |
| Albatross | Blunderbuss, deep and windy | Long braying groan rising at the end |
| Kingfisher | Reed rifle, short and crisp | Shrill rattling trill |
| Lyrebird | Sling/dart with a pitched musical "pew" (random note of a pentatonic scale) | A cascade imitating three other calls |
| Owl | Reed rifle, heavy and muffled with a long tail | Deep double hoot |
| Pelican | Rattle, low and fast | Throaty grunting croak |
| Secretarybird | Bone pistol, alternating left/right pitch | Low croaking growl |
| Starling | Sling/dart, chattery double pop | Burbling whistle with clicks |
| Hornbill | Reed rifle with a hollow casque knock | Loud honking "kok" |
| Flamingo | Rattle, light and reedy | Goose-like honking chatter |
| Penguin | Sling/dart, icy crack | Trumpeting bray |
| Puffin | Sling/dart, wet slap | Low purring growl |
| Peacock | Sling/dart, shimmering with a bell tail | Loud piercing "may-awe" |
| Vulture | Bone pistol, dry and cracked | Hissing grunt |
| Swift | Rattle, very high and fast | Thin screaming "sreee" |
| Hummingbird | Rattle, tiny and buzzy (wing hum underneath) | Rapid squeaky chips |
| Cassowary | Bone pistol, thick and booming | Very low rumbling boom (40–60 Hz) |
| Toucan | Reed rifle, woody "tok" | Croaking frog-like "grrrek" |
| Woodpecker | Rattle that literally drums (wood-block hits accelerating with spin-up) | Sharp laughing "kee-kee-kee" |
| Nightjar | Bone pistol, soft and muted | Long mechanical churring |
| Frigatebird | Reed rifle, long whip-crack | Rattling drum from the throat balloon |
| Cockatoo | Sling/dart, squawky | Ear-splitting screech |
| Swan | Reed rifle, clear and bell-like | Soft bugling whoop |
| Kiwi | Blunderbuss, short earthy thump | Shrill rising whistle |

Ability sounds follow the hero's palette: a cast cue (0.1–0.3 s) and an impact or loop per ability; ultimates get
a louder, longer cue audible to enemies within 40 m.

### 13.4 Structures, objectives and UI

| Event | Sound design |
|---|---|
| Hawk bolt | Hawk shriek blended with a zap (FM 900 Hz) |
| Heron beam / stomp | Rising hum while locked / deep thud with a 0.5 s creak telegraph |
| Warden bolt / Shrine pulse | Wooden knock + whoosh / low choir-like pad pulse |
| **Structure alarm** | Two-tone horn (D4–A4) every 4 s while an allied structure takes hero damage; heard map-wide by its flock, max one alarm at a time |
| Structure destroyed | Timber collapse + falling horn; allied loss a minor third, enemy loss a major third |
| Brood Ward | Faint shimmer loop near a warded structure; a crack when it drops |
| Patron attacks / phase 2 | Raven caw or owl screech on each attack; phase 2: a long layered cry and a drum hit |
| **Egg jingle** | Five-note rising glockenspiel motif (C6 E6 G6 C7 E7) on spawn, map-wide; a softer two-note version on pickup; a fanfare on delivery |
| **Roc roar** | Layered: low formant growl (80–200 Hz) + distorted screech (1.5 kHz) + noise rumble, 2.5 s; on spawn (map-wide, quiet), on aggro and on enrage |
| Ember claim | Whoosh + bright major choir chord |
| Rune spawn / pickup | Wind chime / chime with a whoosh up |
| Pings | Attack: sharp tick; Take: two rising notes; Defend: low bell; Go here: soft pop; Danger: double low beep; Help: three quick notes |
| UI | Hover tick, click knock, buy = seed rattle + chime, sell = falling rattle, error = muted buzz |

### 13.5 Adaptive music

Music is generated from stems (pad, bass, percussion, lead) on a 96 BPM grid; state changes cross-fade on the next
bar (max 2 s).

| State | Trigger | Stems |
|---|---|---|
| Menu | Main menu, settings | Pastoral pad + plucked lead, no percussion |
| Hero select | Hero select | Pad + light percussion + lead motif |
| Laning | 0:00–10:00 by default, no fight | Pad + soft bass |
| Roaming | After 10:00, no fight | Pad + bass + light percussion |
| Skirmish | You or an ally within 40 m are in hero combat | + full percussion |
| Objective | Egg carried, Roc fight, or a Heron under attack | + lead motif in minor |
| Siege | An enemy hero is inside either base | Full stems, double-time percussion |
| Victory / Defeat | End of match | Major fanfare / slow minor pad |

---

## 14. Visual direction

### 14.1 Look

A storybook market town swallowed by an ancient forest, seen in late-afternoon light. Low-poly, flat-shaded
(faceted normals), no image textures: colour comes from vertex colours, flat materials and procedural gradients.
Giant trunks (5–10 m wide) rise through the streets into a canopy at 25–40 m that throws dappled shadow; roofs
are mossy; lanterns hang in alleys; hedges, mills and stilt-houses give each lane its character.

### 14.2 Palette

| Use | Colours |
|---|---|
| Ground and stone | warm stone #B9A98A, path #9C8B6E, moss #5F7F4A |
| Foliage | canopy #3E6B3A, hedge #4F7D3B, pine #2E4F3A |
| Timber | #7A5236, dark #4E3424 |
| Water | #3F8C8A (Riverbank), foam #CDE7E0 |
| Sky | south (Dawn side) peach #F6C9A0 → zenith #9CC3D9; north (Dusk side) violet #8C86C9 → zenith #5E6FA8 |
| Lane accents | Hedgerow: brick #A4573F, flowers #E7A1B0 / #F2D46B · Riverbank: whitewash #E8E2D2, slate #6B7680 · Pinewood: red-brown #8A4B32, rope #C9AE7C |

Rule: environment colours near lanes stay below 50% saturation so heroes, team colours and VFX pop.

### 14.3 Team colours

| | Dawn Flock | Dusk Flock |
|---|---|---|
| Primary | amber #F5A623 | violet-blue #6B6BFF |
| Light | #FFD27A | #B0B0FF |
| Dark | #A86A0C | #3A3AA8 |
| Used on | hero trims (wing bars, crest bands), fledgling caps, structure banners and glow, minimap, UI flock labels | same |

The pair stays distinct under the common colour-vision deficiencies (warm vs cool, different lightness).

### 14.4 Friend-or-foe readability

- Independent of flock colour: **enemy** heroes get a red (#FF4A4A) 2 px outline when in sight and when revealed
  through walls; **allied** heroes get a teal (#3DDCB4) outline only when behind walls.
- Health bars: allies green, enemies red, you not shown in the world.
- Ability telegraphs and areas: enemy ones have a red rim and full saturation; allied ones a teal rim and 30% less
  saturation. Your own are drawn at 60% opacity so they never hide targets.
- Projectiles: enemy projectiles have a red-tinted core; allied ones white.
- Beak-shot flash: a small gold spark on the head.
- Silhouette first: no cosmetic may change a hero's outline at 40 m (§9.24.1).

### 14.5 Lighting and fog

| Element | Value |
|---|---|
| Sun | Directional, warm #FFE3B5, intensity 2.2, elevation 28°, azimuth from the south-west |
| Ambient | Hemisphere light: sky #9CB8D9, ground #5F6E4A, intensity 0.6 |
| Fog | Exponential squared, colour #B8C9BE, density 0.0055 (objects at 150 m are ~50% fogged) |
| Shadows | One shadow-casting light; map 2048 (High), 1024 (Medium), none (Low); soft PCF |
| Canopy | Dappled light from a scrolling procedural cookie on High only |
| Lanterns | Emissive only (no dynamic lights) on Low/Medium; 8 nearest as point lights on High |

### 14.6 Procedural low-poly birds (style rules for the Technical Artist)

- Build from primitives: ellipsoid body, sphere or ellipsoid head, cone or wedge bill, flattened boxes and fans
  for wings, tail and crests, cylinders for legs. Facet everything (no smooth normals).
- Budgets: hero LOD0 ≤ 1,500 triangles, LOD1 ≤ 600 (from 25 m), LOD2 ≤ 200 (from 60 m); fledglings ≤ 150,
  instanced; structures ≤ 4,000.
- Proportions follow §9's body plans exactly; the head hitbox sphere must sit inside the visible head.
- Eyes: two small spheres with a white highlight; every hero's eyes face the aim direction.
- Bills are oversized by ~20% compared with real birds for readability.
- Natural colours as in §9, plus flock-colour trims (§14.3) on 10–20% of the surface.
- Code-driven rigs and animation: idle (breathing bob, head tilts), run (body bob, wing tuck, leg cycle), sprint,
  dash (wings flare), slide (body flattens), jump and land, mantle, glide, shoot (recoil per gun), reload, cast
  (per-hero pose: fan opens, crest raises, pouch swings), hit flinch, stun (dizzy head circle), death (feather
  burst particle and collapse).
- Fledglings are round chicks with stubby wings; Patrons are 14 m tall; the Roc 9 m with flame-tipped wings.

### 14.7 VFX language

- Talon effects: sharp, white-gold tracers and sparks. Song effects: soft, glowing, curved shapes in the hero's
  signature colour (Shrike thorn green, Starling iridescent purple, Peacock blue-gold …).
- Seeds and pods: warm gold. Hits: small spark + feather puff on heroes; chips on structures.
- Juice (M4): hitstop 40 ms on heavy melee and kills, camera shake on nearby slams and Patron attacks (setting
  scales it), screen-edge flash on beak shots.

---

## 15. Match flow

### 15.1 Win condition

Destroy the enemy Patron (both phases). There are no draws and no time limit. The player can concede from 15:00
(Pause menu). Target match length: **25–40 minutes**, median ~32.

### 15.2 Timeline

| Time | Event |
|---|---|
| 0:00 | Heroes spawn at the Home Roost with 0 seeds and level 1; passive income starts at 0:30 |
| 0:30 | First fledgling wave; then a wave every 30 s on every lane |
| 2:00 | Tier-1 Thickets spawn (respawn 3:00 after clear) |
| 6:00 | Tier-2 Thickets spawn (respawn 4:00); Feather runes appear on both rune bridges (then 4:00 after each pickup) |
| 9:00 | HUD countdown for the Golden Egg (60 s) |
| 10:00 | **Golden Egg** spawns (then 5:00 after each delivery); tier-3 Thickets spawn (respawn 5:00); waves grow to 3 + 2 |
| 19:00 | HUD countdown for the Roc |
| 20:00 | **The Roc** wakes in the Hollow (respawn 7:00 after death); waves grow to 4 + 2 |
| 35:00 | Late-game pressure **(design lever)**: Brood Ward weakens from ×0.35 to ×0.6 damage taken, and fledglings get +25% damage vs structures |

Respawn time grows throughout (§8.9): 8 s at the start, 32 s at 20:00, 55 s from about 39:00.

### 15.3 Phases

**Laning (0:00–10:00).** Two heroes per lane (2-2-2). The game is last hits, pods and denies, poking with guns
and short ability trades, and shop trips to the Magpie stalls. Hawks punish heroes who attack heroes under them.
First Thickets at 2:00 and runes at 6:00 give the first reasons to leave the lane. Expected: 0–1 Hawks down,
heroes level 8–10, first T2 items.

**Mid game (10:00–22:00).** The first Egg forces a 3v3 or 4v4 fight in the jungle at 10:00. Hawks fall (first
flex slots), heroes rotate between lanes, take T2/T3 Thickets and runes, and push Herons (more flex slots).
Expected: 2–4 Hawks and 1–2 Herons down per flock by 22:00, heroes level 15–19, first T3 items.

**Late game (22:00–end).** Grouped 6v6 fights around the Roc and the Ember; the Ember's faster respawns and
stronger fledglings make sieges possible. Flocks break Wardens (Brood Ward makes waves essential), then the
Shrines, then the two-phase Patron. Expected: first Shrine around 28–32 min, match end 28–38 min.

### 15.4 Comeback and anti-snowball levers

- Bounties scale with the victim's net worth and pay up to ×1.5 to the poorer flock (§8.3).
- The Egg pays ×1.25 to the poorer flock (§7.11).
- Brood Ward and the structure gates force the winning flock to push with waves, buying time.
- Respawn times cap at 55 s; the 35:00 lever stops stalemates.

Balance targets (M4): match length 25–40 min in ≥ 85% of bot matches; every hero 40–60% win rate; every item
bought in ≥ 5% of matches; the flock ahead at 15:00 wins ≤ 70% of matches.

---

## 16. Feel checklists

The Game Director reviews each gate with Playwright screenshots, the playtest harness and headless telemetry.
An item fails if it can't be shown with a screenshot, a test or a telemetry number.

### M1 — One bird in a lane

- [ ] Walk 7.0 m/s reaches full speed in ≤ 0.15 s and stops in ≤ 0.2 s; strafing feels the same as forward.
- [ ] Jump apex 1.6 m ± 0.05; dash covers 5.5 m in 0.2 s with a visible +6° FOV kick; 3 pips regenerate at 5 s each.
- [ ] Dash-jump carries about 7.3 m while airborne; slide from a run reaches 9 m/s and decays in ~1 s; slopes
      extend slides.
- [ ] Hold Jump into a 2.2 m ledge to mantle in 0.35 s; a 2.6 m rise in the same approach never mantles.
- [ ] Updraft: mount at a station, ride at 11 m/s, boost to 18 m/s, shoot while riding, Space dismount arcs up.
- [ ] Chimney lifts to a roof; Vine climbs at 4.5 m/s.
- [ ] Camera: shoulder swap in 0.15 s; pull-in against a wall with no clipping; crosshair shots land where the
      crosshair is, including when standing behind cover (muzzle-blocked shots hit the cover).
- [ ] Beak shots: gold marker and tick sound; damage ×1.65 (Owl ×2.0) visible in damage numbers; never on
      fledglings.
- [ ] Falloff: a test gun deals 100% at falloff start and 25% at falloff end.
- [ ] Reload-cancel by firing with rounds left; per-shell reload keeps loaded shells.
- [ ] Light/heavy melee timings; parry stuns an attacker for 2.0 s; a whiffed parry locks fire for 0.4 s.
- [ ] Each Hero A batch-1 hero casts all four abilities in the sandbox with the documented numbers.
- [ ] Fledglings march, meet near z = 0, and target per §7.1 (screenshot of a wave fight).
- [ ] Pods rise for 0.6 s, can be secured/denied only in the 1.4 s window, with distinct pop and crunch.

### M2 — The loop

- [ ] Run §3.10 by hand and sustain normal-tab movement in Firefox with forward, crouch, dash, jump and
      item keys. Capture the cue at both dash-jump window edges, the two-pip total, retained slide entry
      speed and the slope and mantle transitions. Verify old defaults migrate and custom binds persist.
- [ ] Measure the air jump, air dash and down-dash costs and once-per-airtime resets, first and repeat wall
      jumps including fatigue and recovery, and sprint loss and return after aim or combat.
- [ ] Rebind Melee and Parry to ordinary and side mouse buttons under pointer lock. Show a light release,
      heavy commitment, lunge, impact and recovery, then parry success and whiff with their distinct cues.
- [ ] Seed payouts match §8 for last hit, secure, deny, hero kill (with an assist), structures and passive income.
- [ ] Level thresholds match §8.5; AP and the level-6 ultimate unlock work; upgrade tiers change numbers.
- [ ] Open Practice Hub from the menu with a damaging hero, damage the enemy dummy and observe its reset.
      Re-enter with a healer, restore the wounded ally's health and see it return to 40%. Verify four base
      abilities and 32 AP on entry and that Play starts with its normal progression.
- [ ] Tap the inspect action, hover and keyboard-focus an ability with the pointer free, then spend AP with
      a click. Verify cost, rank and AP update, blocked upgrades explain why, clicks do not shoot, Esc or
      Close restores aiming and the quick keyboard shortcut upgrades without opening the panel.
- [ ] Shop: buy, upgrade with component discount, sell 50% / 100% within 20 s, only in shop zones.
- [ ] Flex slots unlock on the right objectives for the whole flock.
- [ ] Hawk punishes a hero who shoots an allied hero under it (target switch within 0.5 s).
- [ ] Ride and boost across each Hawk and Heron from both directions. Show at least 2 m of clearance below
      the rider's feet across collision geometry and visible poses. Verify tower anchors and combat ranges.
- [ ] Brood Ward reduces damage to ×0.35 without attacking fledglings; the dome shows and breaks.
- [ ] Shrine gating; Patron phase 1 → transition → phase 2 with the weak point; a match can be won by hand.
- [ ] HUD shows every §12.4 element; minimap follows the vision rule; pings work in world, minimap and feed.
- [ ] Audio: beak-shot tick, structure alarm, a call per finished hero, positional falloff.

### M3 — Full roster

- [ ] All 24 heroes castable with documented numbers; the 40 m line-up screenshot shows 24 distinct silhouettes.
- [ ] All 48 items purchasable; all 11 actives work.
- [ ] Golden Egg: carrier restrictions, reveal beam, drop on stun/death, delivery channel and payout.
- [ ] The Roc: aggro, attacks, reset; Ember claimed only by heavy melee; Ember buff values.
- [ ] Thickets respawn on schedule; Nests pay and drop crumbs; runes alternate types.
- [ ] Bots: 20 seeded headless matches, 11 bots, zero crashes; telemetry shows last hits, denies, Egg and Roc
      attempts, and sieges.

### M4 — Balance and polish

- [ ] Telemetry over 100+ matches meets §15.4's balance targets.
- [ ] Juice: 40 ms hitstop on heavy melee and kills, shake on slams, hit markers, kill confirm sound.
- [ ] A Hunter bot lane opponent feels fair: it last-hits most fledglings, denies some, retreats when low.
- [ ] Menus, hero select preview, settings (all apply live), pause, end-of-match tabs and graphs.
- [ ] 60 FPS at 1080p on the target iGPU in a late-game screenshot scene with 12 heroes and ~150 fledglings.

### M5 — Release candidate

- [ ] A fresh player can finish a match against Chick bots using only How to play.
- [ ] No reference-game names anywhere in `src/` or player-facing text (`grep` check).
- [ ] Every GDD rule marked (assumed) has either been confirmed or logged as a deviation in DECISIONS.md.
- [ ] Final fidelity review: the loop of BRIEF §2 is present end to end (Appendix A checklist).

---

## Appendix A. Concept mapping

Design reference only. This is the one place the reference game (Valve's Deadlock) and its terms appear; they
never appear in `src/` or player-facing text (D-EP-002). Hero kits, items and the map layout are PERCH originals
and have no one-to-one counterpart.

| PERCH | Deadlock concept | Behaviour kept | Deliberate deviation |
|---|---|---|---|
| Dawn Flock / Dusk Flock | Amber Hand / Sapphire Flame teams | 6v6, two bases | — |
| Elder Raven / Great Owl (Patron) | Patron | Two phases, shrines gate it, phase-2 weak point | Attack set is ours |
| Hedgerow / Riverbank / Pinewood | The three lanes of the current map | 3 lanes, jungle between, mirror symmetry, central pit | Original layout and dimensions |
| Fledglings (Scrapper, Slinger) | Troopers | Waves every 30 s, melee and ranged, lane paths, trooper-first targeting | Exact stats ours |
| Seeds, net worth | Souls | One currency for items and levels | Passive trickle (assumed) |
| Seed pod, secure, deny | Soul orb, securing, denying | Pop-up, timed window, shoot to secure or deny | 25% deny share (assumed) |
| Sentinel Hawk | Guardian | Lane tower that punishes hero-on-hero aggression; team bounty | — |
| Stilt Heron | Walker | Stomp and beam; large team bounty; flex slot | Gated behind its lane's Hawk (assumed) |
| Nest Wardens | Base Guardians | Two per lane at the base | — |
| Roost Shrines | Shrines | Two; both must fall before the Patron | — |
| Brood Ward | Backdoor protection | Big damage reduction without attacking troopers nearby | ×0.35 value ours |
| Thickets | Neutral camps | Tiered, respawning | Seeds to the last hitter (assumed) |
| Nests | Breakable crates | Small payout, sometimes a small buff | — |
| Feather runes | Bridge power-ups | Timed buffs from fixed spots | 90 s, four types (ours) |
| Golden Egg, Hatching Stone | Soul Urn, drop-off | Carrier can't shoot or cast, revealed, team payout with a comeback bonus | 10:00 then 5:00 after delivery |
| The Roc | Mid-Boss | Central pit boss | Spawns at 20:00 (assumed) |
| Phoenix Ember | Rejuvenator | Claimed by melee; faster respawns, stronger troopers, team buff | Heavy melee only; 180 s |
| The Magpie's Hoard (Talon / Plumage / Song) | Curiosity Shop (Weapon / Vitality / Spirit) | 3 columns × 4 tiers, components consumed, sell refunds, base and lane shops | 50% / 100%-in-20-s refund (assumed) |
| Magpie stalls | Lane shops | Shopping outside base | — |
| Flex slots | Flex slots | Unlocked by objectives, team-wide | 12 base + 4 flex (ours) |
| Talon / Song damage, Talon / Song resist | Weapon / Spirit damage and resists | Two damage types with separate resists | Multiplicative resist stacking |
| Song power (SP) | Spirit Power | Ability scaling stat | — |
| Beak shot | Headshot | Real head hitbox, crit multiplier in data | ×1.65 default |
| Level, AP, upgrade tiers 1/2/5 | Levels, Ability Points, ability upgrades | 4 abilities, three tiers each | Ultimate unlocks at level 6 (assumed) |
| Molts | Boons | Per-level base stat growth | — |
| Updrafts | Ziplines | Lane ziplines with boost and dismount | — |
| Chimneys, Vines | Vent shafts, ropes | Vertical traversal | — |
| Dash, dash-jump, slide, mantle, stamina | Same movement set | Stamina-gated dash, dash-jump, slide, mantle | Values ours |
| Light / heavy melee, parry | Light / heavy melee, parry | Parry stuns a melee attacker; heavy melee claims the boss drop | — |
| Respawn scaling, comeback bounty | Same | Respawn grows with time; killing a richer hero pays extra | Formula ours |
| Late-game pressure at 35:00 | — | — | PERCH addition to hold the 25–40 min target |
| Hero roster (24) | Hero roster | Third-person hero shooter archetypes | Every kit is original |

**Fidelity checklist (M5):** every row's "Behaviour kept" must be demonstrable in the build.
