# PERCH art style guide

Owner: Game Director (#2), written with the Technical Artist's view. It sets the look every model, building, prop,
material, light and effect is built to and judged against from wave 5b on (D-EP-042, D-EP-047, D-EP-048). It is the
art team's source of truth: the Environment Artist (#22), both Technical Artists (#15), Rendering & VFX (#16), the
Level Designer (#13) where looks meet collision, and QA (#20) at every art gate.

**Constraint (brief):** everything is built in code: geometry, procedurally generated textures and materials,
instancing and LOD. No external asset files, no image files in the repo, no generated-elsewhere textures.

**Precedence.** Where this guide and the GDD differ on looks or render budgets, this guide wins (D-DIR-015). It
replaces GDD §14.1 ("flat-shaded, no image textures"), the sun and fog values in §14.5, the triangle budgets in
§14.6 and the triangle rows of §6.12. GDD sizes, gameplay dimensions (the §6.8 kit), collision prims, nav and sim
budgets are unchanged. The Director folds this into the GDD in the next GDD pass.

Contents: [0 The look](#0-the-look-in-one-paragraph) · [1 Somewhere birds would be](#1-first-principle-somewhere-birds-would-be) ·
[2 Principles](#2-principles) · [3 Reference frames](#3-reference-frames-and-what-to-take-from-them) ·
[4 Shape language](#4-shape-language-and-silhouettes) · [5 Architecture kit](#5-architecture-kit) ·
[6 Nature](#6-nature-trees-roots-hedges-moss-ivy-ground-cover-and-the-jungle) ·
[7 Materials](#7-materials-and-procedural-textures) · [8 Birds](#8-birds) ·
[9 Structures and Patrons](#9-structures-and-patrons) · [10 Lighting](#10-lighting-and-atmosphere) ·
[11 LOD and performance](#11-level-of-detail-and-performance) · [12 Review checklist](#12-review-checklist-and-scoring-rubric) ·
[13 Who uses what](#13-who-uses-which-section)

---

## 0. The look in one paragraph

**Old Mossmarket at golden hour.** A storybook market town built by and for birds, grown through by an ancient
forest, seen in low, warm late-afternoon sun with cool lavender shade and haze. Forms are chunky, softly bevelled and
slightly hand-made. Surfaces look painted: soft gradients, crisp shapes, darkened crevices, worn light edges. Every
street is dressed and every wall has depth. Lit windows and lanterns make warm pools against the cool ambient. The
birds, their flock trims and their effects are the brightest, crispest and most saturated things on screen. The
target is the reference's density, richness and readability, rebuilt as PERCH's own world (D-EP-002): we take how
much detail there is, where it sits and how it reads, never what it depicts.

What PERCH has today, for contrast (`out/reference/perch/lane-1-firing.png`, `practice-0.png`, `map-overview.png`):
faceted primitives in flat colour, a saturated yellow lane floor, long plain walls, a black box rifle, overcast flat
light and no surface detail. Every rule below exists to close that gap.

---

## 1. First principle: somewhere birds would be

**"Every aspect of the map should make you think: yes, this is somewhere birds would be."** (D-EP-048, the user's
words.) Old Mossmarket is a world built by and for birds, not a human town with birds in it. Masons' stone and
carpenters' timber are the bones; on and in them, birds have built, woven, perched, nested and traded for
generations. Every area must show it at a glance, and stay tasteful and readable in combat.

### 1.1 Architecture

| Element | Rule | Example and numbers |
|---|---|---|
| Dovecotes and lofts | Every quarter has at least 2 dovecote features: free-standing towers, gable lofts or rooftop cupolas | Rows of arched pigeonholes 0.25 × 0.32 m, 0.40 m apart, 3–6 rows, each row with a 0.12 m landing ledge; a conical or domed cap with a finial perch. The two GDD Dovecotes (§6.8) are the showpieces |
| Belfries and bell towers | Bells are roosts. Every Bell Tower belfry has its bell, its frame, perch bars across the arches and a nest tucked on the beam | Bell 1.6 m wide in a timber frame; 2–3 perch bars 6–8 cm across each arch at 1.1 m; a woven nest 1.5 m on the frame |
| Birdhouse dwellings | Houses on stilts and inside trunks look like scaled-up bird boxes: a round or arched entry hole over a landing board, a pitched lid roof, a perch peg | Pinewood Stilt Houses and Hollow-tree Houses. The entry arch is the kit door (2.4 × 3.0 m) framed as a round hole in a 3.4 m disc of trim; a 0.8 m landing board under every upper opening |
| Woven twig and reed structures | Bird-built additions are woven, not carpentered: domes, bowls, screens, awnings and balcony panels | At least 25 % of jungle buildings carry a woven addition (a lean-to, a rooftop room, a balcony screen). Strands 3–6 cm thick; weave visible at under 15 m, carried by texture beyond |
| Nest-crowned roofs | Ridges, chimney tops, gable peaks and towers wear nests | At least 1 nest crown per 3 roofs, 1.5–4 m across, 0.6–1.2 m deep, with straggling twigs past the rim; some hold eggs or a sleeping ambient bird |
| Hollow-tree homes | Giant trunks are lived in | Each giant trunk within 30 m of a path shows at least one sign of life: a round door, a knot-hole window with a sill, a ladder of pegs, a lantern, a hanging nest |
| Perches and roosting rails | Facades are made to land on | Every facade bay (3–4 m) has at least one perch element per storey: a dowel rail (6–8 cm, 15–25 cm off the wall) on brackets, a row of pegs, a carved bracket or a sill board. Rails run along string courses and under eaves |
| Landing ledges | Upper openings have a place to land | Every upper door, leap window and balcony gets a landing board 0.6–1.0 m deep. A board deep enough to look standable (≥ 0.5 m) must match a collision ledge (§2.6) |
| Wires and poles | Lines are strung between buildings and poles, and birds use them | Timber poles 0.25 m thick with crossarms every 20–30 m along jungle streets; 2–4 lines per span, sagging 3–5 % of the span. Lines cross alleys and jungle streets, never a lane, and stay at least 3 m from every Updraft cable |

### 1.2 Street life

| Element | Rule | Example and numbers |
|---|---|---|
| Feeders and seed stalls | Food is everywhere and on display | A hanging feeder (tray, tube or seed-cake cage) every 10–15 m of jungle street; seed stalls at every market square and Magpie stall, heaped with sacks, scoops and scales |
| Bird baths and fountains | Water is a social place | At least 1 bird bath per quarter (a stone basin 1.2–2.0 m on a 0.9 m pedestal) and a fountain in every market square and Old Square; shallow water with ripples and a floating feather |
| Scattered seeds, berries and feathers | The ground shows who lives here | Ground decals: 1 seed scatter per 25 m² in markets, 1 dropped feather per 40 m² anywhere, berry clusters under every fruiting bush. Never more than 1 decal per 10 m² on a lane floor |
| Worm beds and insect hives | Birds farm what they eat | Raised soil beds with worm casts in the Hedgerow gardens; straw bee skeps, beetle logs and moth lanterns in gardens and yards (at least 3 per quarter) |
| Nesting material | Alleys hold building stock | Bundles of twigs, moss, wool, string and reed in alleys and yards, 1 pile per 15 m of alley, leaning on walls, never blocking a path |
| Feather banners and trims | Flock colours fly over their half | Bunting of feather-shaped pennants across jungle streets every 20–30 m, dyed faded amber on the Dawn half and faded violet on the Dusk half, undyed cream within 20 m of the centre line. Faded means saturation ≤ 45 % and value ≤ 60 %: the pure flock colours are reserved for birds, units, structures and UI (§7.6) |
| Ambient birds | The town is inhabited | Small background birds (0.15–0.25 m, muted brown and grey, no flock colour) perch on wires, rails and nest rims, and scatter within 1 s when a hero, shot or ability comes within 6 m. At most 8 within 20 m of the camera and 60 drawn in total; client-only cosmetics with no sim state |

### 1.3 Jungle

| Element | Rule | Example and numbers |
|---|---|---|
| Layered canopy | The forest has five layers and every height is used (§6.6) | Ground, understory, mid, upper and canopy, each present in every 20 × 20 m jungle cell |
| Roots and hollows | Trees are older than the town | Buttress roots flare to 1.5–3 × the trunk radius and run under paving; roots break walls and steps; hollows at root level hold nests, lanterns or a Hide |
| Nests in branches | Big boughs carry nests | Woven nests 2–4 m across in boughs at 8–20 m; at least 2 per quarter visible from each lane. Where the Level Designer makes one a platform, it carries a landing board |
| Reed beds by the river | Riverbank edges are wet and green | Reeds and cattails 1.2–2.0 m along both banks outside the lane's clear width, with woven reed huts and drying racks |
| Bramble thickets | Thorny cover with berries | Bramble clumps 1–2.5 m in yards and verges; their berries are dark red-purple and never confused with the Berry pickup (§6.5) |

### 1.4 Scale and verticality

- **Built for creatures that perch, hop and glide.** Every jungle building offers at least 2 landing spots reachable
  by a dash-jump (a landing board, a balcony, a flat roof or a perch beam that matches collision).
- **Rooftop routes read as routes:** linked roofs show worn boards, rope bridges, plank gangways and ladders of pegs,
  so the player can see the path before taking it.
- **Vantage points look like vantage points:** Lookouts, belfries, crowns and Dovecote tops are dressed as crows'
  nests with rails, a pennant and a perch bar.
- **One affordance language,** learned once and used everywhere:

| What it means | How it looks |
|---|---|
| You can land or stand here | A pale, worn timber landing board or a woven landing mat with a lighter top edge |
| You can climb here (Vine) | A thick, flowering vine (stems 8–12 cm, cream-white blossom) in a rope-wrapped frame. Decorative ivy is never this thick and never flowers |
| A Chimney lifts you | A soot-stained stack with warm shimmer and a feather or two drifting upward |
| An Updraft station | A tall timber mast with a feather pennant and a pulley wheel |
| Not reachable, decoration only | Ivy, moss, carved trim and ledges no deeper than 0.25 m |

- **Bird-scale furniture:** perch rails at 1.1 m, counters 1.2 m (cover), seed bins 1.0 m, nest beds 1.5–3 m across.
  Nothing human-only: no cars, road markings, traffic signals, steel girders, neon, printed signs or lettering.
- **Tasteful:** droppings are at most a faint pale speckle under perch rails (1 small decal per 3 m of rail), never on
  floors or near the crosshair line of a lane. No dead birds, no cages with birds in them.

**Gate question (§12.1, item A1):** for every area in the shot list, "Does this make you think: yes, this is
somewhere birds would be?" A "no" for any area blocks the gate.

---

## 2. Principles

1. **No plain box.** Every surface a player can see from a standable point has three scales of detail: primary form
   (the building, 4–20 m), secondary breakup (trims, openings, bays, props, 0.3–2 m) and tertiary surface (bricks,
   grain, tiles, cracks, 2–30 cm, from texture and normals). No unbroken wall area larger than 3 × 3 m within 30 m of
   any lane or path.
2. **Mid-dark world, bright birds.** Lit environment values sit at 25–60 % (§10.5), birds and effects above it. Large
   environment surfaces near lanes keep saturation ≤ 50 % (GDD §14.2 rule kept).
3. **Bevel everything.** No razor edges: every architectural edge is chamfered or rounded (§4.3).
4. **Hand-made, not noisy.** Lines sag, lean and vary slightly (§4.4); variation is seeded so screenshots are stable.
5. **Combat first.** The lane floor stays calm: low-contrast, no stripes or checkers, clutter under 1.2 m reads as
   cover, and no decoration crosses the 2 × 2 m box around the crosshair at a standard lane distance.
6. **What looks walkable is walkable.** A visual ledge, board or beam deeper than 0.5 m within jump reach matches a
   collision surface; anything that is not walkable is kept under 0.25 m deep or out of reach. The Environment
   Artist builds over the Level Designer's collision and never adds solids (D-EP-047).
7. **Translate, never copy (D-EP-002).** The reference teaches density, depth, light and readability. Its buildings,
   characters, props, motifs and wording stay out of PERCH.

---

## 3. Reference frames and what to take from them

The frames are in `C:\Users\AlexNortham\Documents\game\out\reference\` (read-only, git-ignored; never copy them into
the repo). Folders V1 `HP8-yBieQK8`, V2 `2M_Yf6EXdTs`, V3 `N77LqE8zTfQ`, V4 `IXU64ax4IAY`, V5 `7zjBAwpUeBU`, and PERCH
`perch`. Each video has a `board.jpg` contact sheet of the whole match. Of the 2,023 files there, 54 are reference
frames, boards and bursts (`.jpg`), 47 are PERCH captures (`.png`) and 12 are capture logs; the other 1,910 are the
capture browser's profile data (`.profile*`), not frames.

| Frame | What to take from it (our words) |
|---|---|
| `IXU64ax4IAY\t0030.jpg` | **The lighting and dressing target.** Low sun, lavender haze, distant blocks fading to pastel. A path edged by kerbs, small lawns, a clipped round tree, urns on plinths, steps with cheek walls, bay windows, pediments over windows, cables overhead. Every metre of the frame is dressed and nothing shouts |
| `IXU64ax4IAY\t2310.jpg` | Raking warm sun across big gridded shop windows; a lamp on a curled bracket; brick blocks in shade behind. A lane guardian with carved relief swirls on every surface: structures are sculpted, not boxed |
| `IXU64ax4IAY\t0570.jpg` | Backlit skyline at sunset: warm rim on upper storeys, cool blue shadow below; a parapet balustrade pierced with circles; a statue on the parapet. Rim light and skyline silhouettes |
| `IXU64ax4IAY\t1230.jpg` | A plaza: retaining walls with cap mouldings, a domed kiosk the size of a small room, boulders, a giant planter, a wall lamp, steps, poles with pulleys and cables. Prop scale and zipline hardware |
| `IXU64ax4IAY\t2010.jpg` | An alley at ground level: planked doors with iron straps, flagstones laid in offset courses, a drain grate, a pierced balustrade. Ground material scale and door hardware |
| `IXU64ax4IAY\t1440.jpg` | A tall interior hall: arches, a balustraded gallery over a void, urns on posts, pale stone. Gallery-and-void interiors (our Market Hall) |
| `IXU64ax4IAY\t2610.jpg` | A base interior flooded with the defending team's amber: columns, beams and floor all tinted. Base identity through light |
| `HP8-yBieQK8\t0060.jpg` | Facade composition: a heavy banded ground floor, arched windows with keystones, a cornice at the top; deep window reveals with warm interiors against a cool night street. Base, middle and top |
| `HP8-yBieQK8\t0020.jpg` | Depth layering from a raised crossing: near, middle and far planes separated by haze; lamps at an even rhythm; an overpass as a second level |
| `HP8-yBieQK8\t0390.jpg` | A rooftop yard in warm light: parapets, crate piles, carts and frames along the edges. Roofs are dressed places, not empty slabs |
| `HP8-yBieQK8\t0600.jpg` | Ivy draping over arches and posts, hedges below. Greenery clinging to masonry |
| `HP8-yBieQK8\t2010.jpg` | A hero close up (shop screen): crisp, simple planes; a dark costume carried by one saturated accent; soft painted gradients; light edge highlights. Our close-up bar for birds |
| `HP8-yBieQK8\t2450.jpg` | The final chamber from above: the boss glows in its team colour, architecture tinted around it. Patron lighting |
| `7zjBAwpUeBU\t0840.jpg` | A rooftop: carved lattice railings, a small roof garden, small story props (a pot on a stool), a grid of lit windows behind. Roofs as lived-in places |
| `7zjBAwpUeBU\t1050.jpg` | A lane guardian under its shield dome on a street lit by shopfronts: the structure is about two storeys tall and the dome reads as a rim with a light fill |
| `7zjBAwpUeBU\t1380.jpg` | A brick facade close up: a shop window with a mullion grid and warm interior; a dried shrub in a planter drawn as soft clumps |
| `7zjBAwpUeBU\t1770.jpg` | A wide avenue: stalls with umbrellas, barrier props, distant domes in blue haze; enemies at 30–40 m still readable. The hero's knitted sweater pattern: costume detail at close range |
| `7zjBAwpUeBU\t2280.jpg` | The final boss in its chamber: giant columns with banners, a caged sculpted form with glowing team-colour seams. Patron grandeur and phase-two glow |
| `N77LqE8zTfQ\t0420.jpg` | A corner shop: a curved balcony with balusters, columns with base and capital, double doors with a transom light, paired wall lamps, clipped plants in pots at the door; an ironwork pavilion behind. Storefront kit pieces |
| `N77LqE8zTfQ\t0900.jpg` | A guardian destroyed in the street, its sculpted body lying where it fell; chamfered kerbs; a barrel stack as cover. Destroyed-structure treatment and kerb edges |
| `N77LqE8zTfQ\t1050.jpg` | A shop interior: lattice screens, hanging lanterns, rugs, tall beams. Interiors are warm, furnished and layered in light |
| `N77LqE8zTfQ\t1800.jpg` | A base shrine: a tall ringed pillar with a glowing core, a team-colour wash, a large painted floor circle, arched windows with radiating glazing bars. Structure core glow and base floor decals |
| `N77LqE8zTfQ\t2100.jpg` | An attic interior: exposed trusses, patterned rugs, a lattice-fronted hearth. Exposed structure and rugs as floor detail |
| `N77LqE8zTfQ\t1140.jpg` | A hero close up: layered costume pieces, straps, a satchel, a chain; strong silhouette with a light hair mass against a dark coat. Gear on birds |
| `HP8-yBieQK8\t1020.jpg`, `HP8-yBieQK8\t1380.jpg` | Team fights: effects are the brightest and most saturated thing on screen, the environment stays mid-dark under them. Also what to avoid: full-screen washes (§10.7) |

PERCH before: `perch\lane-1-firing.png`, `perch\practice-0.png`, `perch\map-overview.png`, `perch\hud-spawn.png`.

---

## 4. Shape language and silhouettes

### 4.1 The vocabulary

| Family | Shapes | Where |
|---|---|---|
| Mason-built | Rectangles with heavy bases, arches, cornices, slight batter (walls taper 1–2° inward going up) | Stone and brick buildings, bridges, walls, structure plinths |
| Carpenter-built | Posts, beams, braces, overhangs, gables at 30° (kit), exposed rafter tails | Timber frames, stilt houses, mills, rooftop gangways |
| Bird-built | Bowls, domes, ovals, woven bands, drooping fringes | Nests, woven rooms, awnings, screens, banners |
| Grown | Flaring, tapering, branching, clumped | Trunks, roots, boughs, canopy, hedges, ivy |

- **Mix per building:** about 70 % mason or carpenter, 30 % bird-built or grown. A building with no bird-built or
  grown element fails §1.
- **Chunky storybook proportions:** roofs and cornices 15–25 % heavier than real; eaves overhang 0.4–0.8 m; doors and
  windows with thick frames (8–20 cm); bases visibly heavier than tops.
- **Scale ratio:** primary : secondary : tertiary detail ≈ 1 : 1/4 : 1/16. Primary forms read at 80 m, secondary at
  20–40 m, tertiary under 10 m.
- **Silhouette first:** every building has a readable roofline at 80 m: at least one break per 8 m of ridge (a
  chimney, dormer, nest crown, cupola, finial or step in height).

### 4.2 Shape by role

| Role | Language |
|---|---|
| Dawn Flock (structures, base dressing) | Rising and radiating: upswept wing tips, sun-ray fans, pointed crests, open arches |
| Dusk Flock | Hooded and crescent: drooping cowls, crescent moons, star points, rounded lancets |
| Neutral (Thickets, the Roc, the Magpie Den) | Round, nested, gathered: bowls, hoards, burrows |
| Cover props | Blocky, chunky, at a clear height (1.0–1.5 m) so they read as cover |
| Decorative props | Round and soft, smaller than 0.8 m or placed out of the way |
| Birds | One primary shape each (GDD §9.24.1); round masses with sharp accents only at bill, talons, crest and gun |

### 4.3 Bevels

- Architecture: chamfer 2–6 % of the piece's smallest dimension, at least 2 cm and at most 15 cm (a 0.5 m wall gets
  2.5 cm; a 0.3 m beam gets 1.5 cm, rounded up to 2 cm). One chamfer segment at LOD0; none at LOD1 (the edge is
  painted light in the texture).
- Props: 3–8 % of the smallest dimension.
- Birds and creatures: smooth normals everywhere except deliberate hard edges (bill cutting edge, talon tips, gun
  edges). The faceted flat-shaded look is retired.

### 4.4 Hand-made variation (seeded)

| Property | Range |
|---|---|
| Ridge and eaves sag | 2–6 cm per 10 m |
| Wall lean | 0–0.8° |
| Window and door placement jitter | ±3 cm, ±0.5° |
| Shutter angle | 5–30° open on 60 % of shutters |
| Per-instance colour | hue ±3°, value ±5 % |
| Plank, tile and brick | value ±6 %, 1 in 12 noticeably darker or lighter |

Variation never moves gameplay geometry: openings, ledges and stairs keep the §6.8 kit sizes exactly.

---

## 5. Architecture kit

The visual kit wraps the Level Designer's collision kit (GDD §6.8: 4.0 m storeys, 0.5 m walls, 2.4 × 3.0 m doors,
shot and leap windows, 26.6° stairs). Visual pieces may project up to 0.25 m beyond collision faces (trims,
sills, rails) and never narrow an opening.

### 5.1 Facades and storey rhythm

| Band | Size | Detail |
|---|---|---|
| Plinth | 0.6–1.0 m tall, projecting 5–10 cm | Darker stone or rough blocks; damp and moss at the foot |
| Ground floor | 4.0 m storey | Bigger openings (shopfronts, arches, loading doors); banded or rusticated stone on stone buildings |
| String course | at every floor line, 0.25–0.35 m tall, projecting 0.12–0.20 m | Carries the perch rail (§1.1) |
| Upper storeys | 4.0 m each | Window bays every 3.0–4.0 m; pilasters, timber posts or brick piers every 2–3 bays |
| Cornice or eaves | 0.4–0.8 m projection | Stone cornice with 2–3 steps, or timber eaves with rafter tails and fascia (0.2 m) |
| Top | | Parapet (0.8 m, coping overhanging 5 cm), gable or roof; a nest crown on 1 roof in 3 |

- **Corners:** stone quoins (blocks alternating 0.40 and 0.25 m long, 0.30 m tall), timber corner posts 0.25 m, or a
  rounded corner turret on landmark buildings.
- **Bays:** a projecting bay window (0.6–0.9 m deep) or oriel on at least 1 in 4 terrace houses.
- **Lane facades** (both sides of each lane, D-DIR-014 G19): a continuous frontage of 2–4 storeys with an opening,
  balcony, bay or recess at least every 6 m, and a prop or cover piece every 6–10 m along the lane edge.

### 5.2 Windows

| Part | Rule |
|---|---|
| Frame | 8–12 cm wide, set back in a reveal 20–35 cm deep from the wall face; the reveal is darker (AO) |
| Sill | Projects 8–12 cm, 8 cm thick, with a drip edge; a landing board replaces it on upper birdhouse openings |
| Head | Stone lintel or arch with keystone (stone), timber lintel 20–30 cm (timber), brick soldier course or arch (brick); a pediment on 1 in 4 Old Square windows |
| Shutters | On 50 % of residential windows; planked or louvred, hung on strap hinges |
| Glazing | Glazing bars 3–4 cm, panes 25–40 cm; glass is dark blue-grey and glossy, reflecting the sky gradient (§7.3) |
| Lit windows | 30–45 % of glazed windows glow warm (#FFB866, emissive 0.6–1.0) behind half-drawn curtains; seeded, stable |
| Window boxes | On 30 % of upper windows: flowers, herbs, a seed tray |

**Gameplay windows look different from decorative ones.** Shot windows (1.6 × 1.0 m, sill 1.2 m) and leap windows
(2.0 × 2.4 m, sill 0.9 m) are open: a frame, a sill or landing board, a visible interior, and no glass or glazing
bars. Every glazed window is decorative and solid. A player must tell them apart at 30 m.

### 5.3 Doors

- **Kit doors (2.4 × 3.0 m):** a frame 15–20 cm, a 10–15 cm threshold step, door leaves swung open 90–110° against
  the wall (planks 12–18 cm with iron strap hinges and a ring pull at bird height, 1.0 m), and a transom light
  0.6 m tall above.
- **Front doors:** a hood or canopy on 50 %, a boot-scraper-sized seed trough or a potted plant on 50 %.
- **Loading doors (4.0 × 3.6 m):** a timber lintel beam, a hoist beam with a pulley above, crates or sacks beside.
- **Arches:** voussoirs (wedge stones) 0.30–0.40 m, a keystone 20 % larger.
- **Ivy curtains** (gameplay) hang as dense ivy strands to the floor, darker than decorative ivy, swaying 0.3 Hz.

### 5.4 Roofs

| Part | Rule |
|---|---|
| Tiles | Courses 0.25–0.35 m; clay pantiles (Hedgerow), slate (Riverbank, Old Square), timber shingles (Pinewood, Lantern Row), woven reed or thatch on bird-built rooms |
| Ridge | Round cap tiles 0.25 m or a timber ridge board; sag per §4.4 |
| Eaves | Overhang 0.4–0.8 m with a 0.2 m fascia; exposed rafter tails every 0.6 m on timber buildings |
| Gutters | Half-round 12 cm with downpipes on 60 % of eaves; a rain barrel at the foot of 1 in 3 downpipes |
| Chimneys | Stacks 0.8–1.2 m square with a cap stone and 1–3 pots; soot on the top 0.5 m; a nest on 1 stack in 4 |
| Dormers | On gable roofs longer than 8 m |
| Gables | Bargeboards 0.2 m with a carved end (feather or wing curl) |
| Flat roofs | Kit parapet 0.8 m with coping; dressed per §5.7 |
| Moss | On north faces and the lower courses (see §7.5 masks) |

### 5.5 Balconies

Kit: 2.0 m deep with a 1.0 m rail. Rails are one of: turned balusters 8–12 cm at 15–20 cm spacing, a woven twig
panel, carved fretwork (feather and leaf motifs) or a rope-and-pole rail (Pinewood). Brackets under every balcony:
timber knee braces or stone corbels every 1.5–2.0 m. Flower or seed boxes on 30 %.

### 5.6 Storefronts (no signage)

- No lettering anywhere in the world. A shop's trade shows through its goods, its awning and a hanging carved emblem
  (a shape only: a seed, an egg, a feather, a worm, a berry, a key) on an iron bracket.
- Shop windows 2.5–3.5 m wide with a glazing grid, a stall riser panel 0.6 m below, and goods on display inside.
- Awnings: canvas 1.5–2.5 m deep, scalloped or feather-cut edge, stripes in muted district colours (never flock
  primaries), on iron arms.
- Goods out front: seed sacks, berry crates, worm jars, nesting-material bales, feather bundles, strings of dried
  fruit, a hand cart.

### 5.7 Rooftops

Walkable roofs are places: at least 3 dressing elements per 50 m² of walkable roof (a nest, a seed store, a water
butt, a perch frame, a small garden in a box, washing-line feathers, a lantern post), kept to the parapet edge so the
middle stays clear for fights. Roof hatches have a frame and a lid propped open.

### 5.8 Weathering

Weathering always has a cause.

| Cause | Treatment |
|---|---|
| Ground damp | Darken 15–25 % from 0 to 0.8 m, moss and grime at the foot |
| Rain | Streaks 0.6–1.5 m long under sills, cornices and gutters |
| Moss | On upward-facing ledges and north faces (normal-up and aspect masks), in mortar and between flags |
| Soot | Above chimneys, lanterns and hearth openings |
| Feet and wings | Worn, lighter edges on steps, sills, landing boards and perch rails |
| Sun | South and west faces bleached: value +5 %, saturation −10 % |
| Age | Chipped paint on timber, edge wear on stone bevels, the odd cracked or missing tile |

### 5.9 Interiors

Every interior has at least: a floor material (boards or flags) with a rug or worn path, skirting, a visible ceiling
structure (joists or beams every 1.0–1.5 m), one warm light source (lantern, hearth or window light pool), wall
dressing (shelves, pegs with hanging feathers, tools or bundles) and bird furniture (perch rails, nest-bed alcoves,
seed bins, water troughs). Cover pieces stay at the kit heights (counters 1.2 m, crates 1.5 and 3.0 m).

| Interior | What furnishes it |
|---|---|
| Market Hall | Counters with scales and scoops, seed bins, hanging produce, hooded lamps, a gallery rail hung with faded flock bunting |
| Water Mill | Gear wheels, a millstone pair, the wheel shaft through the wall, flour sacks, a dusty light haze |
| Bell Tower | The bell in its frame, bell ropes down the hatches, ladders, perch bars across the belfry arches |
| Granary | Sacks, loose grain in heaps, hay, staddle-stone undersides visible outside, a seed chute |
| Warehouse | Crate stacks, bales, a hoist with rope and hook, the catwalk with a rope rail, skylight light shafts |
| Tavern | A counter with perch stools, nectar kegs, a hearth with hanging pots, nest-booth alcoves, lanterns |
| Hollow-tree House | Carved wood walls showing growth rings, a spiral ramp with a root banister, nest alcoves, knot-hole light |
| Terrace House | A nest bed, a hearth, a table at perch height, a seed jar shelf, perch rails |
| Hide | A bench, the slit window band, a feather-down cushion, a spyglass |
| Magpie Den | A hoard: shiny trinkets, keys, rings, buttons and mirrors heaped round the counter, many small lamps |
| Cellar Run | Brick barrel vault, roots through the ceiling, puddles, wall niches with candles every 6 m |

### 5.10 Minimum detail per building type (LOD0)

| Type | Must have | LOD0 triangles |
|---|---|---|
| Terrace House | Plinth, string course per floor, cornice or eaves, ≥ 4 framed windows on the lane face with sills, the kit door with frame and step, roof with ridge, gutter and chimney, balcony with rail and brackets, ≥ 2 perch elements, a bird-built element, weathering | 5,000–9,000 |
| Seed Exchange | Terrace House rules plus a full storefront (§5.6) and a roof Lookout dressed as a crow's nest | 7,000–11,000 |
| Market Hall / Water Mill | Arcade of 4 arches with voussoirs, gallery windows, a roof with parapet and dressing, interior per §5.9; the waterwheel (Mill) with paddles and drips | 14,000–22,000 |
| Bell Tower | Four faces with distinct floor bands, belfry arches with perch bars, the bell, a spire with finial perch and nest | 8,000–14,000 |
| Granary | Staddle stones, timber frame, loading doors with hoist, gable with vine and leap windows, nest on the ridge | 7,000–12,000 |
| Warehouse | Brick bays with piers, loading doors, skylights with frames, roof dressing, catwalk interior | 10,000–16,000 |
| Tavern | Timber frame and plaster, a hanging emblem, balcony over the door, chimney with smoke, lit windows | 8,000–12,000 |
| Hollow-tree House | Trunk with bark, buttress roots, arches, knot-hole windows with sills, crown deck with rail and nest | 9,000–15,000 |
| Stilt House | Stilts with cross-bracing, platform with rope rail, birdhouse entry, lid roof with perch peg | 3,000–6,000 |
| Hide | Planked shed with a woven roof, the slit band, moss | 800–1,500 |
| Dovecote | Round tower with pigeonhole rows and ledges, conical cap and finial, a lantern at the door | 4,000–7,000 |
| Solid fill buildings (not enterable) | Same facade rules on every face seen from play; faces never seen may be plain | 3,000–8,000 |

---

## 6. Nature: trees, roots, hedges, moss, ivy, ground cover and the jungle

### 6.1 Giant trunks and trees

| Part | Rule |
|---|---|
| Giant trunks (5–10 m wide, GDD §14.1) | Bark of vertical fissured ridges (normal and albedo), 12–24 sided with seeded bulges; buttress roots flaring to 1.5–3 × the radius over the first 3 m |
| Boughs | 2–4 major boughs per giant from 12–25 m, tapering, carrying nests, platforms and rope bridges |
| Canopy (25–40 m) | 6–20 leaf clumps per tree, each 3–6 m, built from alpha-tested leaf cards; dark inside, light at the sun-facing tips (+15 % value) |
| Ordinary trees | Trunk 0.3–0.8 m, 3–6 clumps; pines (Pinewood) as stacked drooping tiers of needle cards |

### 6.2 Hedges, flowers, moss and ivy

- **Hedges** (1.2 m and 2.5 m, GDD §6.4): clipped boxes with a 0.2 m bevel, a leaf-noise normal, a 10–15 cm fringe of
  leaf cards along the top edges and a few bare twigs at the foot. Hedgerow flowers #E7A1B0 and #F2D46B in clumps on
  1 hedge face in 3.
- **Moss:** #5F7F4A, as 3–6 cm shells along tops of walls, roots and stones, and as texture masks elsewhere.
- **Decorative ivy:** on at least 30 % of jungle facades, as curtains from roof edges or climbs from the plinth up to
  6 m; leaves 10–15 cm, stems thin. It never looks like a Vine (§1.4).
- **Vines (gameplay):** per §1.4, 1 m wide, unmistakable at 40 m.

### 6.3 Ground cover

| Layer | Content | Where |
|---|---|---|
| Grass | Tufts of 20–40 cm cards | Verges, cracks between flags, gardens; never in the middle 70 % of a lane |
| Leaf litter | Decals and a few 3D leaves | Under canopy, in alley corners |
| Ferns | 0.6–1.2 m | Under canopy, at trunk bases, in the Hollow |
| Mushrooms and pebbles | 5–30 cm | Root bases, wall feet |
| Reeds | 1.2–2.0 m with cattails | River banks |

### 6.4 Jungle density and layering

Five layers, all present in every 20 × 20 m jungle cell that isn't a building or a yard:

| Layer | Height | Content | Minimum per 20 × 20 m cell |
|---|---|---|---|
| Ground | 0–0.5 m | Grass, leaves, roots, pebbles, decals | 30 tufts or decals |
| Understory | 0.5–3 m | Ferns, shrubs, bramble, crates, nesting bundles | 4 clumps |
| Mid | 3–12 m | Small trees, ivy, building-hugging growth, hanging feeders, nests in branches | 2 elements |
| Upper | 12–25 m | Boughs, rope bridges, platforms, big nests, lines between poles | 1 element |
| Canopy | 25–40 m | Leaf clumps throwing dappled shadow | coverage 60–80 % over the jungle, 30–50 % over lanes |

- **Sightlines are the Level Designer's** (GDD §6.5: ≤ 45 m in jungle streets). Foliage never blocks a sightline
  the Level Designer left open; soft foliage below 1.0 m and above 3.0 m is free, between them it needs the Level
  Designer's sign-off.
- **The Hollow:** dark earth, root walls, mossy rock shelves, old mill timbers, ember-scorched patches near the Roc.

---

## 7. Materials and procedural textures

### 7.1 Pipeline

- **Generated at load** from seeded code (canvas or shader passes), cached for the session, identical every run so
  screenshots compare. Generation runs behind the loading screen within the §11.5 budget.
- **Textures per material family:** albedo (sRGB) and a packed ORM texture (ambient occlusion in red, roughness in
  green, metalness in blue, which is how three.js reads `aoMap`, `roughnessMap` and `metalnessMap`); a normal map on
  High only.
- **Texel density:** 256 px/m for architecture and props at LOD0 (a 2 × 2 m brick tile in a 512² region), 384 px/m on
  birds, 128 px/m on terrain macro variation.
- **Anti-tiling:** every tiled material gets world-space macro variation (2 octaves, 2–8 m wavelength, value ±6 %)
  and a vertical gradient (10–20 % darker at the base of walls). No repeat may be visible from a lane.
- **Painted look:** albedo is built from flat colour blocks plus soft gradients and light edge wear; avoid
  photographic noise. Detail is in shape and shading, not grain.

### 7.2 Material recipes

| Material | Pattern and scale | Base colours | Roughness | Normal (High) |
|---|---|---|---|---|
| Brick | 32 × 10 cm bricks (stylised, about 1.5 × real), 1.5 cm mortar recessed 6 mm; stretcher bond; headers every 6th course on old walls | brick #A4573F, burnt #7E4634, mortar #B7AA8F | 0.85 brick, 0.95 mortar | medium, bevelled brick edges |
| Ashlar stone | Blocks 0.6–1.2 × 0.3–0.45 m, 1 cm joints, chisel-face noise | warm stone #B9A98A, cool #8C8579 | 0.8 | medium |
| Flagstones | 0.5–0.9 m slabs in offset courses, 1.5 cm joints with moss | #7D7262, joints #4D5A3C | 0.75 (0.35 where wet) | medium |
| Cobbles | 15–20 cm rounded stones | #6E6253 | 0.8 | strong |
| Plaster and limewash | Soft blotches 0.5–2 m, cracks, patches showing brick or lath | aged limewash #A9A294, ochre #A88C5E | 0.9 | weak |
| Timber | Planks 12–18 cm with grain along the length, end grain rings, nail dots | #7A5236, dark #4E3424, red-brown #8A4B32 | 0.7 | weak grain |
| Roof tiles | Pantile, slate or shingle courses 0.25–0.35 m with overlap shadow | clay #9A4E36, slate #5C6470, shingle #5C4433, reed #9C8A5E | 0.75 | strong overlap |
| Verdigris and copper | Streaked patina on domes and finials | #5E7D6B | 0.6 | weak |
| Iron | Hammered, flaked edges | #3A3836 | 0.5, metal 1 | weak |
| Brass | Rubbed bright on edges | #B5893A | 0.35, metal 1 | none |
| Glass | Dark, with a sky reflection gradient; opaque (no blending) | #2E3A46 | 0.1 | none |
| Canvas | Weave, stripes in muted district colours | per district | 0.9 | weak |
| Rope and woven twig | Twisted strands, woven over-under bands | rope #C9AE7C, twig #6B5236 | 0.85 | strong |
| Bark | Vertical fissured ridges 5–15 cm wide | #4E3424, moss in the fissures | 0.9 | strong |
| Foliage | Leaf cards with a darker centre, lighter edge, faint vein | canopy #3E6B3A, hedge #4F7D3B, pine #2E4F3A | 0.8 | none (alpha-tested) |
| Feathers | Rachis line, vane gradient, small edge notches; cards and shells | per bird | 0.6–0.75 | weak barbs on High |
| Water | Scrolling ripple normal, depth tint, foam at edges | #3F8C8A, foam #CDE7E0 (small areas) | 0.05 | animated |

### 7.3 Light response

- Lit surfaces use a physically based material (metalness 0 except metal) at Medium and High, and a Lambert-style
  material with the same albedo at Low.
- A small environment map is generated once from the sky gradient (prefiltered) at intensity 0.3–0.5, so metal and
  glass catch the sky instead of going black.
- Iridescent feathers (Starling, Peacock, and any bird whose GDD colours say so) shift hue with view angle by up to
  40° at Medium and High; Low uses a static gradient.

### 7.4 Ambient occlusion

- **Baked per vertex** on every merged static mesh: concave edges 25–35 % darker, under eaves 30–40 %, a 0.3 m
  ground-contact band 35 %, interiors 20 % darker overall. Kit pieces are baked in isolation once and cached; contact
  darkening comes from a ground occupancy grid. Plus the ORM texture's AO for surface-scale crevices (mortar, tile
  overlaps, grain).
- **Screen-space AO** only on High, at half resolution, within the §11.2 time budget.

### 7.5 Decals

| Decal | Use | Density cap |
|---|---|---|
| Grime, damp, rain streaks | Wall feet, under sills | 1 per bay |
| Moss and cracks | Walls, steps, flags | 1 per 10 m² |
| Seeds, feathers, berries, leaves | Ground (per §1.2) | 1 per 10 m² on a lane floor |
| Rugs and woven mats | Interiors and landing spots | per room |
| Base floor circles | A large painted circle with flock motifs at each Shrine and around the Patron dais | per structure |
| Light pools | Warm baked pools under lanterns and lit windows (no dynamic lights) | per light |

Decals are projected quads merged per material, drawn with a polygon offset; culled beyond 40 m; none at Low except
base circles and light pools.

### 7.6 Palettes

**Flock colours (GDD §14.3, unchanged):** Dawn amber #F5A623 (light #FFD27A, dark #A86A0C); Dusk violet-blue
#6B6BFF (light #B0B0FF, dark #3A3AA8). Supporting tones: Dawn cream #F3E3C3 and brass #B5893A; Dusk pewter
#8E93A6 and ink #2B2C55. Pure flock colours appear only on birds, fledglings, structures, the bases' glass and glow,
and UI. Environment dressing uses faded tints: Dawn #B48A4E, Dusk #6E6AA8, neutral #C9BC9C.

**Reserved hues:** the enemy outline red #FF4A4A and the ally teal #3DDCB4 (GDD §14.4) are never used saturated in
the environment; red and teal surfaces near lanes stay at saturation ≤ 35 %.

| District | Walls | Roofs | Ground | Accents |
|---|---|---|---|---|
| Hedgerow (west lane) | brick #A4573F, warm stone #B9A98A | clay #9A4E36 | flags #7D7262, gravel #8A7E68 | hedges #4F7D3B, flowers #E7A1B0 / #F2D46B, worm beds #4A3A2C |
| Riverbank (mid lane) | aged limewash #A9A294, timber #6E4A31 | slate #5C6470 | boardwalk #6E5038, flags #7D7262 | water #3F8C8A, reeds #7D8A4E, mill-wheel timber #4E3424 |
| Pinewood (east lane) | red-brown timber #8A4B32 | shingle #5C4433 | needle litter #5B4A36 | pine #2E4F3A, rope #C9AE7C |
| Gatefields | burnt brick #7E4634, granite #8C8579 | clay #8C4A34 | packed earth #6B5A45 | sacks #9C8A5E, hay #A89060 |
| Lantern Row | dark timber frame #4E3424 on ochre plaster #A88C5E | shingle #5C4433 | cobbles #6E6253 | lantern glow #FFB866, bunting (faded flock tint) |
| Old Square | stone #A39783, brick #8E4E3B | slate #5C6470, verdigris domes #5E7D6B | flags #7D7262 | fountain stone #9A9282, ivy #3E5E36 |
| The Hollow | root walls #5A4030, rock #55684A | — | dark earth #3B3127 | Roc embers #FF7A2E (emissive only) |
| Dawn base | sandstone #B08A5E | clay #9A4E36 with brass finials | warm flags #8A7558 | amber glass and glow #F5A623, banners #B48A4E |
| Dusk base | blue slate #5A6078 | slate #4C5262 with pewter finials | cool flags #6A6A72 | violet glass and glow #6B6BFF, banners #6E6AA8 |

**Value limits (albedo, HSV value):** large surfaces near lanes ≤ 0.65; lane floors 0.30–0.45; trims and small
props ≤ 0.80; nothing in the environment above 0.85 except emissive lights, foam and the faded cream bunting.

---

## 8. Birds

### 8.1 Proportions

- Body plans, heights and hitboxes follow GDD §9 exactly; the head hitbox sphere sits inside the visible head.
- **Stylised and chunky:** head 28–35 % of total height; eyes 18–25 % of head width; bills oversized about 20 % (GDD
  §14.6); feet and talons visible and planted (D-EP-035).
- **One primary shape per bird** (GDD §9.24.1), exaggerated: the shape that names the bird is 15–30 % bigger than
  life (the Hornbill's casque, the Pelican's pouch, the Lyrebird's lyre).
- **Colour blocking:** at most 3 natural colours, 1 accent and the flock trim. Somewhere on the bird the head and body
  differ by at least 15 % in value, so the form reads in flat light.

### 8.2 Feather structure

| Region | Construction |
|---|---|
| Body | A sculpted smooth base (lathed or swept profile, ≥ 24 radial segments at LOD0) with a feather-scale texture; 1–2 shell overlays at the neck, flanks and thighs whose scalloped edges break the silhouette |
| Wings | Layered cards: primaries 8–10, secondaries 6–8, 2–3 rows of covert shells; cards overlap 30–50 % and fan with the pose |
| Tail | 6–12 cards (species), fanned and layered |
| Crests, tufts, trains | Cards or swept shells; the Peacock's train and the Lyrebird's lyre are hero shapes with their own budget share |
| Down and fluff | Fringe cards at the throat, belly and legs where the species is fluffy (Owl, Penguin chicks, Kiwi) |

Feather cards are alpha-tested (cut-out at 0.5), double-sided, and carry the rachis line and a vane gradient. The
silhouette must show feather edges at 10 m.

### 8.3 Eyes, beaks, feet

- **Eyes:** a sclera or eye-ring, an iris in the species colour, a pupil 40–55 % of the iris, a glossy cornea with a
  bright catchlight (white, emissive 0.85) in the upper front, and an eyelid or orbital ring 1–2 cm thick. Eyes face
  the aim direction (GDD §14.6). Blinks every 3–6 s (0.12 s).
- **Beaks:** upper and lower mandibles as separate pieces; the lower opens 0–20° on shoot, cast, call and death; a
  nostril notch; a tip-to-base gradient; roughness 0.35 so it catches light. Hooked, serrated or casqued forms are
  modelled, not painted.
- **Feet and talons:** a scaled tarsus (ring pattern), 3 forward toes and 1 back (or the species' arrangement), each
  with 2–3 segments, dark glossy claws 4–8 cm. Feet plant on the ground in every grounded state (D-EP-035).

### 8.4 Gear and flock trim

- Birds wear gear that tells who they are: harness straps, bandoliers of shells or seeds, pouches, satchels,
  goggles, scarves, arm-wraps, a quiver of quills. At least 2 gear pieces per bird, each with stitching or buckles.
- **Flock trim covers 10–20 % of the visible surface** (GDD §14.6): carried by gear (a scarf, sash, armband or
  strap) and by one feather region (wing bars or a crest band). It must read from behind and from the front.
- Gear never changes the 40 m silhouette (GDD §14.4).

### 8.5 Guns

Every gun is held through the grip sockets in every state (D-EP-035) and is built from bird-world materials:
carved wood, brass, horn, bone, shell, woven reed, gourds and seed hoppers.

| Archetype | Gun silhouette | Signature detail | Length vs bird height |
|---|---|---|---|
| Gun carry (Pelican, Hornbill, Woodpecker) | Heavy and mechanical: drums, belts, spinning barrels | A visible feed (seed belt, drum, hopper) that moves when firing | 0.45–0.60 |
| Spirit burst (Starling, Peacock, Cockatoo) | Ornate and light, more instrument than weapon | A glowing chamber or reed in the signature colour | 0.30–0.45 |
| Tank / initiator (Albatross, Penguin, Cassowary) | Short and wide: bells, flared muzzles | A big flared muzzle and a heavy stock | 0.35–0.50 |
| Support (Lyrebird, Flamingo, Swan) | Graceful curves, a musical or flowing look | Strings, a bell or a lance tip that glows on heal | 0.35–0.55 |
| Assassin (Kingfisher, Nightjar, Kiwi) | Compact and sharp, one hand | A bladed or needle detail | 0.20–0.35 |
| Area control (Shrike, Puffin, Vulture) | Purposeful, odd: slings, barbed or bone-built | Barbs, a sling cup or bone plates | 0.35–0.50 |
| Long-range poke (Owl, Toucan, Frigatebird) | Long and slim with a sight | A scope or sight and a long barrel | 0.60–0.75 |
| Mobility skirmisher (Secretarybird, Swift, Hummingbird) | Light and paired or swept | Twin pieces or a crescent profile | 0.25–0.40 |

- Each gun has a lit muzzle element (a brass ring or glass bead) and an ammo read (a drum, a quiver, a cartridge row).
- **Size cap (D-DIR-014):** at the default camera the local bird covers at most 18 % of the screen and its gun at most
  4 %; the gun is held at the body and never runs to the screen edge.
- 1,200–2,500 triangles per gun at LOD0, inside the bird's budget.

### 8.6 Readability at distance

With the default 90° horizontal FOV at 1920 × 1080, a bird covers about 960 / d pixels per metre at d metres.

| Distance | A 1.8 m bird | What must read |
|---|---|---|
| 10 m | about 170 px tall | Everything: eyes and catchlight, beak parts, feather layers, gear, gun detail, trim |
| 40 m | about 43 px tall | Primary shape (§9.24.1), the main colour block, flock trim, the gun's silhouette, the enemy outline |
| 80 m | about 22 px tall | Size band and primary shape, the team outline or trim colour, the health bar |

### 8.7 Shading and pop

- A fresnel rim term on birds (rim colour #FFE6C0, strength 0.25 at Medium and High, 0.15 at Low), done in the
  material, with no extra light.
- Birds' lit values sit at least 20 % above the environment behind them on average (§10.5).
- Enemy and ally outlines follow GDD §14.4 unchanged.

### 8.8 Fledglings and Thicket creatures

- **Fledglings:** round chicks (GDD §7.1) with a down shell plus 6–10 fluff cards, big eyes with catchlights, a
  team-colour cap or head down that reads at 40 m, the Slinger's sling and the Scrapper's stubby wing-fists.
  Instanced per type and team.
- **Thicket creatures** (Beetles, Rats, Weasels, Toads, Badgers): the same finish as birds (bevelled forms, eyes with
  catchlights, painted gradients), neutral earthy palettes with no flock colour, and one glowing tell per family when
  aggroed (Beetles' wing-case seam, Toads' throat).

---

## 9. Structures and Patrons

### 9.1 Grandeur

Structures are monuments the town has built for its flock: sculpted statues on dressed plinths, never boxes.

| Structure | Height (GDD) | Treatment |
|---|---|---|
| Sentinel Hawk | ≤ 10 m (statue on an 8 m column) | A carved stone column with feather fluting, a capital of overlapping wing plates, the hawk in bronze with half-open wings; a stepped base with offerings (seed bowls, ribbons, candles) |
| Stilt Heron | ≤ 10 m in every pose | A timber frame of braced posts with rope lashings and brass caps; the heron sculpted in pale stone and timber, legs jointed, a lantern in the frame |
| Nest Wardens | 7 m | Paired owl-faced gate posts woven from living branches, with moss, leaves and glowing eyes; a woven arch fragment between them |
| Roost Shrines | (GDD §7.5) | A tall ringed pillar of stone and brass with a glowing core in the flock colour, rings that turn slowly, a painted floor circle 12 m across (the pulse radius) |
| Patron | 14 m | §9.3 |

- **Base dressing within 6 m of every structure:** steps or a plinth, offerings, banners or pennants, lanterns, and
  a ground decal in faded flock tint. A structure is the most detailed object in its 30 m radius.
- **Budget:** Hawk and Heron 12,000–18,000 triangles LOD0, Wardens 8,000–12,000 each, Shrines 8,000–12,000,
  Patron 30,000–45,000 (§11.3).

### 9.2 Team identity and states

| | Dawn | Dusk |
|---|---|---|
| Motifs | Sunrise disc, radiating rays, upswept wing tips | Crescent moon, stars, hooded cowl |
| Metals | Brass and gold leaf | Pewter and silver |
| Glass and glow | Amber #F5A623 | Violet-blue #6B6BFF |
| Banners | Feather-edged, faded amber, sun emblem | Feather-edged, faded violet, moon emblem |

| State | Look |
|---|---|
| Idle | Eyes and core at 30 % glow; banners sway 0.5 Hz |
| Targeting | Eyes at 100 % glow in the flock colour (GDD §7.2); the core brightens |
| Brood Ward | A pale eggshell dome: crackle pattern, a fresnel rim, fill at most 25 %; it cracks into shards that fade in 0.8 s when the ward drops (GDD §7.6) |
| Damaged | Crack decals at 66 % and 33 % HP; chips fall on heavy hits; a banner tears at 33 % |
| Destroyed | The statue topples or collapses into rubble that stays for the match (no box replaces it); dust and smoke for 10 s; the glow dies over 2 s |

### 9.3 Patrons (Elder Raven, Great Owl)

- **Phase 1:** a 14 m sculpted bird on its 3 m dais: the Elder Raven glossy black with amber-lit feather edges and a
  sun-crowned perch; the Great Owl in slate and silver with violet-lit eyes and a crescent-crowned perch. Feathers
  layered in large carved plates, eyes with catchlights 0.5 m across, talons gripping the perch.
- **Transition (3 s):** the Patron sheds feathers in a burst (cards, 2–3 s fall), the blast ring reads as a rim plus a
  light fill.
- **Phase 2:** darker body, glowing seams in the flock colour between feather plates, ragged feather fringes, eyes at
  full glow, and the **heart-feather weak point** (a 1.0 m sphere, 6 m up, GDD §7.7) as the brightest object on the
  Patron, pulsing at 1 Hz. The base light tint rises 30 % (§10.3). The weak point must read at 40 m.

---

## 10. Lighting and atmosphere

### 10.1 Time and sun

| Element | Value (replaces GDD §14.5 where different) |
|---|---|
| Time | Late golden hour |
| Sun | Directional, #FFD9A0, elevation 24°, azimuth from the south-west; one shadow caster (GDD) |
| Ambient | Hemisphere: sky #8FA6C9, ground #4A4A3A |
| Key to fill | About 3 : 1 outdoors: lit faces warm, shadow faces cool blue-violet at 25–35 % value |
| Canopy | Dappled sun under trees: the scrolling cookie on High; a baked dapple pattern on the ground at Medium; none at Low |

### 10.2 Sky, fog and depth

- **Sky:** the GDD gradient (south peach #F6C9A0 → zenith #9CC3D9; north violet #8C86C9 → zenith #5E6FA8), plus a soft
  sun glow and 3–5 thin procedural cloud bands, and the forest wall of giant trees as fogged silhouettes beyond the
  map edge.
- **Fog:** exponential squared, colour #A99BB0 (warm lavender haze) blending into the sky at the horizon; density
  0.0060 at Medium (about 30 % fogged at 100 m, 60 % at 160 m).
- **Aerial perspective:** buildings at 80–150 m lose 40–60 % of their contrast and shift toward the fog colour
  (`IXU64ax4IAY\t0030.jpg`).

### 10.3 Interiors and lights

- No new dynamic lights at Low and Medium (GDD §6.12). High allows the 4 nearest lanterns as point lights (down from
  8: every light costs every lit pixel on an iGPU).
- Lanterns, hearths and lit windows are emissive #FFB866 at 0.6–1.0 with a baked warm light pool on the floor and
  walls around them (vertex colour, radius 2–4 m).
- Interiors are about 40 % darker than outdoors in ambient (baked into vertex light), so the warm pools read.
- **Bases:** the flock colour washes the base: banners, glass, floor circles and a baked tint on walls within the
  base at 15–25 % strength (`IXU64ax4IAY\t2610.jpg`, `N77LqE8zTfQ\t1800.jpg`).

### 10.4 Post-processing

- Bloom on emissive only (threshold about 0.9, strength 0.3–0.4) at Medium (half resolution) and High.
- A gentle split tone (warm highlights, cool shadows) and a 10 % vignette at Medium and High.
- Tone mapping, exposure and the exact passes are Rendering's choice within §11.2; they must keep flock colours
  within ±5° of hue.

### 10.5 How characters pop

- **Value:** birds' lit faces at least 20 % brighter than the background region behind them; environment at 25–60 %
  lit value, birds 45–90 %.
- **Saturation:** environment near lanes ≤ 50 %; bird accents and flock trim ≥ 60 %.
- **Edges:** rim term on birds (§8.7); no rim on the environment.
- **Busy backgrounds:** surfaces seen at 20–60 m from a lane have no high-contrast patterns (stripes, checkers, strong
  grids); window grids and brick read as texture, not pattern, at that range.

### 10.6 Night is not in scope

One time of day. A dusk or night variant needs an EP decision.

### 10.7 Effects (Stage 5 owns the production pass)

Effects follow D-DIR-014's limits now: area rims 3 px in the owner's colour with at most 25 % fill, projectile cores
2–4 px, no opaque white larger than 5 % of the screen except an ultimate for at most 1 s, and ride effects only
outside the central 50 % of the screen. Effects are the brightest things on screen; the environment never competes.

---

## 11. Level of detail and performance

### 11.1 The reference machine

A mid-range laptop iGPU (Intel Iris Xe 96 EU or AMD Radeon 680M class) at 1920 × 1080, Medium preset, in Edge or
Chrome. **60 FPS = 16.7 ms**, with 12 birds and about 150 fledglings (GDD §6.12). Headless runs are not proof; the
gate needs a frame-time capture on a real iGPU or the closest machine QA has, labelled as such.

### 11.2 Frame budget at Medium

| Item | GPU ms |
|---|---|
| Opaque environment (architecture, props, ground) | 6.0 |
| Foliage (alpha-tested) | 2.0 |
| Birds, fledglings, creatures, structures | 2.5 |
| Shadow map | 2.0 |
| Effects | 1.5 |
| Post (bloom, grade) | 1.5 |
| UI | 0.5 |
| Headroom | 0.7 |

CPU render submission ≤ 4 ms per frame.

### 11.3 Triangles and draw calls (per frame, all passes counted as drawn)

| Category | Low | Medium | High |
|---|---|---|---|
| Map (architecture, props, foliage, decals) | ≤ 200k | ≤ 450k | ≤ 800k |
| Birds (all visible) | ≤ 40k | ≤ 80k | ≤ 110k |
| Fledglings and creatures | ≤ 50k | ≤ 90k | ≤ 120k |
| Structures and Patrons | ≤ 40k | ≤ 60k | ≤ 90k |
| Shadow pass | none | ≤ 50 % of the main pass | ≤ 60 % |

| Draw calls | Limit |
|---|---|
| Map | ≤ 70 at Medium (merged per material in 64 × 64 m cells; was 60) |
| Birds | ≤ 3 per bird (opaque body, cut-out feather cards, gun) |
| Fledglings and creatures | 1 per type and team (instanced) |
| Whole frame | ≤ 240, under the existing full-match ceiling of 248 (D-QA-BROWSER-002) |

These replace GDD §6.12's map triangle row (180k / 110k / 60k) and §14.6's per-model budgets. QA raises the matching
test ceilings when the Environment Artist and Technical Artists land the art.

**Per-model LOD0 budgets:**

| Model | LOD0 | LOD1 | LOD2 | LOD3 |
|---|---|---|---|---|
| Hero bird (gun included) | ≤ 9,000 (0–15 m) | ≤ 3,500 (15–40 m) | ≤ 1,200 (40–80 m) | ≤ 400 (80 m+) |
| Local player's bird | always LOD0 | | | |
| Fledgling | ≤ 700 (0–30 m) | ≤ 250 | | |
| Thicket creature | ≤ 1,200 (0–30 m) | ≤ 400 | | |
| Ambient bird | ≤ 120 | | | |
| Nest (breakable), Berry | ≤ 400 | ≤ 120 (from 30 m) | | |
| Feeder | ≤ 900 | ≤ 300 | | |
| Structures | §9.1 | 40 % of LOD0 from 40 m | 15 % from 90 m | |
| Buildings | §5.10 | trims baked to texture, 35 % of LOD0 from 30 m | a textured shell with painted windows, 10 % of LOD0 from 80 m | |

### 11.4 LOD and culling rules

- **Environment LOD0** within 30 m: all trims, chamfers, decals and small props. **LOD1** 30–80 m: trims merged into
  texture and normals, props under 0.5 m culled beyond 40 m, decals culled beyond 40 m. **LOD2** beyond 80 m: shells
  with painted windows, still never a plain box.
- **Trees:** LOD0 leaf cards; LOD1 fewer, larger clumps (40–90 m); LOD2 crossed billboards beyond 90 m.
- **Grass tufts:** drawn to 25 m at Medium, 40 m at High, 15 m at Low.
- **Interior props, Nests and Berries:** not drawn beyond 45 m (GDD §6.12); none at Low.
- **Hysteresis:** 10 % on every LOD switch; dithered cross-fade over 0.25 s at High.
- **Instancing:** any mesh repeated 8 or more times in a 64 m cell is an `InstancedMesh` (props, clumps, tufts,
  lanterns, nests, feeders, bunting pennants, ambient birds).
- **Merging:** static unique architecture merges per material per 64 × 64 m cell (GDD §6.12).
- **Shadows:** only geometry ≥ 0.5 m casts; foliage cards cast at High only; decals, small props and interior props
  never cast.
- **Overdraw:** no alpha blending in the environment except water and effects; foliage and feathers are alpha-tested
  (alpha-to-coverage when MSAA is on); glass is opaque.

### 11.5 Textures and load time

| Set | Low | Medium | High |
|---|---|---|---|
| Environment atlases (4 families: stone and brick, timber and roof, nature, props) | 1024² albedo | 2048² albedo + ORM | 2048² albedo + ORM + normal |
| Each hero bird | 512² | 1024² albedo + ORM | 1024² + normal |
| Patrons, Roc | 1024² | 2048² | 2048² + normal |
| Fledglings, creatures (shared per family) | 256² | 512² | 512² + normal |
| GPU texture memory | ≤ 32 MB | ≤ 80 MB | ≤ 160 MB |
| Generation time behind the loading screen | ≤ 0.8 s | ≤ 1.5 s | ≤ 2.5 s |

All maps mipmapped; anisotropic filtering 4× at Medium and 8× at High on ground and roofs.

### 11.6 Quality tiers

| Feature | Low | Medium | High |
|---|---|---|---|
| Material model | Lambert, albedo only | PBR, albedo + ORM | PBR + normal maps |
| Shadows | none | 1024, PCF | 2048, soft PCF |
| Bevels | texture only | geometry at LOD0 | geometry + normal |
| Decals | base circles and light pools | all, to 40 m | all, to 60 m |
| Canopy dapple | none | baked | animated cookie |
| Point lights | 0 | 0 | 4 nearest |
| SSAO | no | no | half resolution |
| Bloom and grade | no | half resolution | full |
| Ambient birds | 0 | 30 | 60 |

---

## 12. Review checklist and scoring rubric

### 12.1 Checklist (every art gate, every area in the shot list)

A "no" on any item marked **hard** blocks the gate.

| # | Question | Hard |
|---|---|---|
| A1 | **Does this area make you think: yes, this is somewhere birds would be?** (D-EP-048; asked of every area: each lane, each jungle zone, rooftops, interiors, the Hollow, both bases) | **hard** |
| A2 | Does every building in view have a bird-built or grown element and at least the §5.10 parts? | **hard** |
| A3 | Is any unbroken wall area over 3 × 3 m visible within 30 m of a lane or path? (must be no) | **hard** |
| A4 | Is any placeholder primitive (a plain box, cylinder or cone with flat colour) visible in normal play? (must be no; D-EP-047) | **hard** |
| A5 | Do gameplay windows, Vines, Chimneys, Updraft stations and landing spots read by the §1.4 language at 30 m? | **hard** |
| A6 | Does every visual ledge over 0.5 m deep in reach match collision? (§2.6) | **hard** |
| B1 | Do lit environment values stay within 25–60 %, saturation ≤ 50 % near lanes, with no saturated reserved red or teal? | **hard** |
| B2 | Are birds and effects the brightest things in a lane fight capture? | **hard** |
| B3 | Is the lane floor calm (no stripes, checkers or busy decals under the crosshair line)? | |
| B4 | Are flock primaries kept off environment dressing (faded tints only)? | |
| C1 | Does each bird pass §8.6 at 10, 40 and 80 m, and the §9.24.1 line-up (one primary shape per size band)? | **hard** |
| C2 | Does each bird have layered feathers, eyes with catchlights, two-part beaks, planted feet with talons and its gun held in the sockets in every state (D-EP-035)? | **hard** |
| C3 | Is the flock trim 10–20 % of the surface and readable from front and back? | |
| C4 | Is the local bird ≤ 18 % of the screen and its gun ≤ 4 %? | **hard** |
| D1 | Is each structure sculpted and dressed (§9.1), with idle, targeting, ward, damaged and destroyed states? | **hard** |
| D2 | Does the Patron's phase two read at 40 m, weak point brightest? | **hard** |
| E1 | Is the light golden hour with cool shade and lavender haze, interiors warm, bases tinted? | |
| E2 | Do materials show three scales of detail with no visible tiling from a lane? | |
| F1 | Do the §11.3 triangle and draw-call budgets hold on the budget scenes, and 60 FPS on the reference machine? | **hard** |
| F2 | Do LOD switches pop visibly at normal play speed? (must be no) | |
| G1 | Is anything copied from the reference (a building, character, motif, sign or wording)? (must be no; D-EP-002) | **hard** |

### 12.2 Scoring rubric

Each category is scored 0–4 by QA and the Director independently, side by side with the reference frames in §12.3.

| Score | Meaning |
|---|---|
| 0 | Placeholder: primitives in flat colour |
| 1 | Blockout dressed with colour and a few props |
| 2 | Detailed but generic: rules partly met, could be any game |
| 3 | Production: every rule in this guide met; clearly PERCH, clearly birds |
| 4 | Reference-level: density, depth and finish hold up next to the reference frame |

| Category | Weight |
|---|---|
| Birds in a world of birds (§1) | 2 |
| Architecture and interiors (§5) | 2 |
| Birds (§8) | 2 |
| Nature and jungle (§6) | 1 |
| Materials and texture (§7) | 1 |
| Structures and Patrons (§9) | 1 |
| Lighting and atmosphere (§10) | 1 |
| Readability in combat (§2, §10.5) | 2 |

**Pass:** every hard checklist item "yes" (or "no" where marked), no category below 3, and a weighted mean of at least
3.2. The Stage 4 gate (D-EP-047) applies this to the map, structures, Patrons, fledglings, creatures and all birds
delivered by then.

### 12.3 Gate shot list and reference frames per category

Captures at 1920 × 1080, Medium and High, using `npm run shots` scenes (`menu`, `lane`, `match`, `practice`,
`sandbox` with `modelLineup` / `modelStructure` / `modelWave`) and QA's capture scripts. Each "after" sits beside its
"before" and beside the listed reference frames (paths under `C:\Users\AlexNortham\Documents\game\out\reference\`).

| Category | PERCH captures | Reference frames |
|---|---|---|
| Lane facades and street dressing | Each lane at standing height, mid-lane and at its Hawk | `IXU64ax4IAY\t0030.jpg`, `HP8-yBieQK8\t0060.jpg`, `N77LqE8zTfQ\t0420.jpg`, `IXU64ax4IAY\t2310.jpg` |
| Jungle streets and alleys | Lantern Row, Bell Street, Back Lane | `IXU64ax4IAY\t2010.jpg`, `IXU64ax4IAY\t1230.jpg`, `HP8-yBieQK8\t0600.jpg` |
| Rooftops | The roof route (Warehouse → rope bridge → Hollow-tree crown) | `7zjBAwpUeBU\t0840.jpg`, `HP8-yBieQK8\t0390.jpg` |
| Interiors | Market Hall gallery, Tavern taproom, Cellar Run, Magpie Den | `N77LqE8zTfQ\t1050.jpg`, `N77LqE8zTfQ\t2100.jpg`, `IXU64ax4IAY\t1440.jpg` |
| Nature and the Hollow | Under a giant trunk, the Hollow floor, the river reeds | `HP8-yBieQK8\t0600.jpg`, `7zjBAwpUeBU\t1380.jpg`; jungle layering is judged against §6.4, as the reference has no forest |
| Depth and lighting | Down each lane from the gate; an overview from a Dovecote top | `IXU64ax4IAY\t0030.jpg`, `IXU64ax4IAY\t0570.jpg`, `HP8-yBieQK8\t0020.jpg` |
| Structures | Hawk, Heron, Wardens and Shrine at 15 m, in each state | `7zjBAwpUeBU\t1050.jpg`, `N77LqE8zTfQ\t0900.jpg`, `IXU64ax4IAY\t2310.jpg`, `N77LqE8zTfQ\t1800.jpg` |
| Patrons and bases | Each Patron in phase 1 and 2 from 20 m and 40 m; each base from the gate | `7zjBAwpUeBU\t2280.jpg`, `HP8-yBieQK8\t2450.jpg`, `IXU64ax4IAY\t2610.jpg` |
| Birds close up | Each bird at 3 m and 10 m, front and back, idle and aim | `HP8-yBieQK8\t2010.jpg`, `N77LqE8zTfQ\t1140.jpg`, `7zjBAwpUeBU\t1770.jpg` |
| Birds at distance | The 24-bird line-up at 40 m and 80 m; a 3v3 at 40 m (D-DIR-014 G18) | `7zjBAwpUeBU\t1770.jpg` |
| Combat readability | A lane fight with abilities | `HP8-yBieQK8\t1020.jpg`, `HP8-yBieQK8\t1380.jpg` |
| Performance | The budget scenes and a full 1 + 11 match: FPS, draw calls, triangles | none |

---

## 13. Who uses which section

| Role | Sections |
|---|---|
| Environment Artist (#22) | §1, §2, §4, §5, §6, §7, §10.3, §11 |
| Technical Artists (#15) | §4, §7, §8, §9, §11.3–§11.5 |
| Rendering & VFX (#16) | §7.1–§7.5 (material and texture infrastructure), §10, §11 |
| Level Designer (#13) | §1.4 (landing spots, affordances), §2.6, §5 intro, §6.4 sightlines |
| QA (#20) | §11 budgets and test ceilings, §12 |
| Game Director (#2) | §12 sign-off with QA; GDD §6.12, §14 updated to match |
