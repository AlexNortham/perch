# Wave 5a · Level Designer (#13) · tag LEVEL

Read W5-common.md first. You own `src/sim/world/map/**`.

Read before you start:
- GDD §6, especially §6.5 and §6.8–6.12: the building kit, the 12 building types, the jungle zones and paths, every
  anchor, and the budgets.
- INTERFACES §14: the interiors map schema.
- Your section of W5-contract-followups.md.
- D-EP-033.

Rebuild Old Mossmarket to the Director's design (D-EP-033):
- **Enterable buildings** from the building kit, with doors and openings, floors and storeys, stairs and ladders,
  windows you can see and shoot through, balconies and roof access. Place eight per jungle quarter plus the lane
  houses, mirrored for both flocks.
- **The jungle:** its three zones and five named paths, with cover and sightlines.
- **Every anchor:** Thickets (24, 8 indoors), Nests (100), runes, the Golden Egg, the Roc, and each interactable:
  Keepsakes, Bell Feeders, Berries, Hides, Bough Springs, Lookouts, ivy curtains, the Cellar Run and the Magpie Den.
- **The nav graph** through doors, stairs and interiors, for bots.
- **Everything the Stage 3 match relies on stays:** lanes, the structures and their Updraft clearance (D-DIR-008),
  shops, and the Home Roost.

Stay inside the Director's primitive, nav and performance budgets, and measure them:
- `loadMap` time
- primitive count
- draw calls in the budget scenes (the e2e draw-budget specs)
- sim ms per tick

Keep the map tests green: symmetry, anchors, connectivity and clearance. Add tests for interiors: every door connects,
every floor is reachable, and every indoor anchor is inside its building. Update `mapSvg` so the minimap shows interiors
legibly.

Prove it with screenshots you look at yourself: overview, top-down, one street-level shot per lane, two building
interiors, a rooftop route and a jungle path. `npm run check` must pass all six steps.

## Added by the EP: feel gaps from the video analysis (D-EP-046)
Read `docs/reference/feel-reference.md` G19 (lane framing and density) and G20 (verticality in fights). They are Stage
4 and yours. The reference's lanes are framed by dense, tall building fronts with no bare walls, and fights use height
constantly. Build the detailed map to that standard within the Director's budgets.
