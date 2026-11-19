# W4.5 · Game Director (#2) · design pass for Stage 4 · tag DIR

Read W5-common.md first. You own **docs/GDD.md** (and your STATUS/DECISIONS entries). You design; others build.

## Reference
The user asked that building features follow the reference game, using **https://deadlock.wiki/** as the reference.
Read the relevant pages (map and buildings, jungle camps and neutrals, breakables/crates and what they drop, statues
or permanent buffs, shops, runes or powerups, ziplines and vertical routes, items and actives). Use it for **how
mechanics work**, never for names, text, layout or art: PERCH's versions are original (D-EP-002). Record, in a D-DIR
decision, which mechanics you adopted and how PERCH's version differs. Don't copy wiki text into the GDD.

## Deliver (as GDD updates, with numbers)
1. **A far more detailed Old Mossmarket (§6, D-EP-033).**
   - Building archetypes for a city in a forest for birds (for example a market hall, bell tower, granary, mill,
     tavern, warehouse, hollow-tree house): footprint, floors, doors, stairs or ladders, windows you can shoot
     through, balconies, roof access, and interior routes that link lanes, jungle and rooftops.
   - Where they stand: per lane, in the jungle, near bases, mirrored for both flocks.
   - **What there is to do inside and around them:** breakable **Nests** (the boxes: variants, contents, Seeds,
     occasional buffs, respawn); **Thicket** camps (tiers, creatures, attacks, payouts, respawn, which ones sit
     indoors); any interactable the reference has that suits PERCH (for example statues or shrines that grant small
     permanent stat boons, interior shop counters, vantage points, vents and chimney routes); Feather rune spots.
   - The jungle as a place: zones, paths, cover, sightlines, flank routes.
   - Guidance the Level Designer can build from: coordinates or anchors on the existing grid, sizes in metres, and a
     primitive or performance budget (the game must stay at 60 FPS with 12 birds and about 150 fledglings).
2. **Objectives still to build (§7):** the Golden Egg, the Roc and Phoenix Ember, Thickets, Nests and Feather runes,
   with every number. Revise the existing specs if the reference behaves differently, and mark each deliberate
   deviation.
3. **64 items (§10, D-EP-034):** review the 48 for gaps, then design **16 new items** (original names and effects),
   bringing the actives to about 14. Give full specs, component chains and tiers, and keep the three categories
   balanced in count.
4. **Bots and builds (§11):** how bots use interiors, the jungle, Nests and runes. What a good recommended build
   looks like per archetype, as guidance for the Build Lab (D-EP-036): early, mid and late cores and situational
   picks.

## Done means
GDD sections updated with every number; no TBD; the coverage of the M3 gate items is obvious from the GDD; one or more
D-DIR decisions (reference mechanics adopted and deviations); STATUS entry `### W4.5 · Game Director · <date>`; reply
in at most 200 words with your branch, last commit and a one-line summary per deliverable.
