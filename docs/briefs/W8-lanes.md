# Stage 4 · lanes rework · Level Designer · tag LEVEL

Read W5-common.md first, then D-LEVEL-005 to 009, then `docs/reference/feel-reference.md`, especially the lane and
street rows. You own `src/sim/world/map/**`, including `MapData.dressing` for anything you add.

**The user, after playing Release 1:** "the lanes are too flat look back at the video references each lane should have a
bridge on it, and its too open the lanes should be more isolated".

**Look at the reference first.** The frames are in `C:\Users\AlexNortham\Documents\game\out\reference\<video id>\`
(read-only, never commit them). Find every frame that shows a lane:
- how bridges and overpasses cross it;
- how high the second level is;
- how the lane is walled in by buildings;
- what you can and can't see of the next lane;
- how the ground rises and falls.

Write down what you take from it in your STATUS entry. Copy no layout (D-EP-002); take the principles.

**Then rework the three lanes, mirrored for both flocks:**

1. **A bridge on every lane.** At least one real bridge or overpass crosses each lane: walkable on top, reached by stairs
   or ramps from both sides, with the lane running underneath, usable as high ground and as a crossing.
   - If the existing rune bridges already sit over the lanes, make them read clearly as bridges. If they don't, add
     bridges that do.
   - Two per lane is better than one if the budget allows.
2. **Not flat.** Lanes rise and fall:
   - ramps, raised and sunken stretches, terraces and steps, height changes of 2–6 m along each lane;
   - the bridge and the existing walkways forming a real second level.

   Updraft cables must stay clear (D-LEVEL-009, style guide §1.1).
3. **More isolated.** From any point on a lane you shouldn't see or shoot into another lane, except at designated
   crossings.
   - Close the gaps with continuous building frontage and walls.
   - Make the jungle and blocks between lanes denser and enclosed.
   - Link lanes only through jungle paths, alleys, building interiors and named crossings.
   - Fewer wide-open plazas.

**Keep everything else working:**
- symmetry;
- the prim budgets (2,178 of 3,000 used; a quarter is at 584 of 600, so trim or merge prims to make room);
- every objective and interactable anchor valid;
- the nav graph through every new level;
- the D-LEVEL-009 rules (cover, raised routes, stairs, walkable roofs);
- hitbox and camera clearance at spawns (D-ENV-006);
- bots still lane and siege: the 20 release matches must still all end with a winner.

**Prove it:**
- New measured tests:
  - every lane has a bridge crossing it, walkable and reachable;
  - lane height varies by at least 2 m along each lane;
  - a sightline test from points along each lane shows no line of sight into another lane outside the designated
    crossings.
- Top-down and lane-level screenshots of each lane, looked at beside the reference frames.
- `npm run release-matches` and `npm run check -- --release`.
- STATUS entry and D-LEVEL decisions.
- A reply in at most 200 words.

**In parallel:**
- The Architect is adding lane assignment and a zipline start. Your Updraft stations and cables are its inputs, so keep
  their anchors stable or tell it.
- The Environment Artist has paused lane-area dressing until your layout lands, and will dress your new bridges and
  walls from `MapData.dressing`.
- Bird and structure artists don't touch the map.
