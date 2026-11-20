/**
 * The PERCH map (GDD §6): an old market town grown through by forest and built by and for birds. The Dawn half is
 * authored here (z < 0) and mirrored for Dusk by src/sim/world/map/build.ts; `centre` holds what sits on z = 0. Every
 * §6.3 coordinate is used as written.
 *
 * Plan of the Dawn half (x = east):
 *   x −130…−102  Hedgerow west terrace (four enterable houses, the Seed Exchange) and walled kitchen gardens
 *   x −102…−88   Hedgerow lane (14 m), balconies at 4 m, hedge chicanes; façades and a walkway on its first leg
 *   x −87…−76    Hedgerow east terrace (three enterable houses, a juke alcove on Back Lane)
 *   x −76…−9     the west jungle quarter (jungle.ts): Granary, Warehouse, Tavern, Hollow-tree House, Bell Tower,
 *                Market Hall, two Hides, Thicket yards, roost stands on the Riverbank edge
 *   x −9…9       Riverbank lane (18 m); river x 9…14; market square; the Cellar Run and Magpie Den below (cellar.ts)
 *   x 9…76       the east jungle quarter: the west one mirrored in x and rebuilt in timber (Water Mill)
 *   x 76…118     Pinewood: stilt houses on 6 m platforms, 10 m lookouts, rope walkway, sawmill
 */
import type { BlockoutPrim, MaterialTag, Opening } from '../../../core/contracts';
import type { MapSpec, SpecPart } from './kit';
import { at, block, column, flipPart, joinParts, part, ramp, renamePart, slab, tree, v } from './kit';
import { CELLAR_RUN, DEN_SHOP, GROUND_HALF } from './cellar';
import { JUNGLE_QUARTER } from './jungle';
import { DOVECOTES, LANES_HALF } from './lanes';

const PI = Math.PI;

// ---------------------------------------------------------------------------------------------------------------
// Ground, the Hollow, the outer band
// ---------------------------------------------------------------------------------------------------------------

/**
 * The Hollow is an octagon of apothem 22: a 44 m square hole whose corners are filled by 45° slabs, each laid along
 * the octagon's diagonal edge and reaching the square's corner (18.2 m along the edge, 9.12 m deep).
 */
const CHAMFER = { along: 18.2, deep: 9.12, centre: 18.78 } as const;

const groundHalf: BlockoutPrim[] = [
  ...GROUND_HALF,
  slab(-CHAMFER.centre, -CHAMFER.centre, CHAMFER.along, CHAMFER.deep, -10.5, 0, PI / 4, 'grass'),
  slab(CHAMFER.centre, -CHAMFER.centre, CHAMFER.along, CHAMFER.deep, -10.5, 0, -PI / 4, 'grass'),
  // Outer band: cliffs beyond the south edge, and the dead corners behind the side lanes.
  block(-150, 150, -170, -150, -10.5, 30, 'stone'),
  block(-130, -62, -150, -116, 0, 12, 'stone'),
  block(62, 130, -150, -116, 0, 12, 'stone'),
  column(-140, -110, 6, -10.5, 40, 'trunk'),
  column(140, -80, 7, -10.5, 40, 'trunk'),
  column(-100, -160, 6, -10.5, 40, 'trunk'),
  column(70, -160, 8, -10.5, 40, 'trunk'),
];

const groundCentre: BlockoutPrim[] = [
  block(-130, -22, -22, 22, -10.5, 0, 'grass'),
  block(22, 130, -22, 22, -10.5, 0, 'grass'),
  block(-150, -130, -170, 170, -10.5, 30, 'stone'),
  block(130, 150, -170, 170, -10.5, 30, 'stone'),
  // The Hollow: floor at −10, ramps up to the jungle east and west (4 m wide), the Old Mill Bridge across it.
  block(-22, 22, -22, 22, -11, -10, 'ground'),
  ramp(6, 22, -2, 2, -10, 0, 'e', 'stone'),
  ramp(-22, -6, -2, 2, -10, 0, 'w', 'stone'),
  block(-5, 5, -22, 22, -1, 0, 'wood'),
];

// ---------------------------------------------------------------------------------------------------------------
// Dawn base: walls, gates, Home Roost, Patron dais
// ---------------------------------------------------------------------------------------------------------------

const WALL = 8;

const base: BlockoutPrim[] = [
  block(-60, -46, -116, -114, 0, WALL, 'stone'),
  block(-34, -6, -116, -114, 0, WALL, 'stone'),
  block(6, 34, -116, -114, 0, WALL, 'stone'),
  block(46, 60, -116, -114, 0, WALL, 'stone'),
  block(-62, -60, -150, -114, 0, WALL, 'stone'),
  block(60, 62, -150, -114, 0, WALL, 'stone'),
  block(-60, 60, -150, -116, 0, 0.02, 'dawn', false),
  // Home Roost platform (2 m) with ramps down both sides of the Patron's dais.
  block(-16, 16, -150, -140, 0, 2, 'dawn'),
  ramp(-15, -10, -140, -133, 0, 2, 's', 'stone'),
  ramp(10, 15, -140, -133, 0, 2, 's', 'stone'),
  column(0, -136, 8, 0, 3, 'stone'),
  // Courtyard trees and planters.
  ...tree(-30, -130, 0.8, 9, 3, 4),
  ...tree(30, -130, 0.8, 9, 3, 4),
  block(-48, -44, -128, -124, 0, 1.2, 'stone'),
  block(44, 48, -128, -124, 0, 1.2, 'stone'),
];

// ---------------------------------------------------------------------------------------------------------------
// The jungle quarters and the Cellar Run
// ---------------------------------------------------------------------------------------------------------------

const TIMBER: Partial<Record<MaterialTag, MaterialTag>> = { brick: 'wood', stone: 'wood' };
const timber = (m: MaterialTag): MaterialTag => TIMBER[m] ?? m;
const STYLE_EAST: Record<string, string> = { 'jungle-brick': 'jungle-timber', 'market-stone': 'jungle-timber' };

const westQuarter = renamePart(JUNGLE_QUARTER, (id) => `${id}-west`);
const eastQuarter = ((p: SpecPart): SpecPart => ({
  ...p,
  buildings: (p.buildings ?? []).map((b) => (b.archetype === 'market-hall' ? { ...b, archetype: 'water-mill' } : b)),
  dress: (p.dress ?? []).map((d) => ({ ...d, style: (STYLE_EAST[d.style] ?? d.style) as typeof d.style })),
}))(flipPart(JUNGLE_QUARTER, timber, (id) => `${id}-east`));

/** Both quarters and the Cellar Run, with the Tavern cellars opened onto the tunnel. The Cellar Run comes first, so
 * its lane stair heads are the first Egg-carrier stops in the openings. */
function below(): SpecPart {
  const joined = joinParts(CELLAR_RUN, westQuarter, eastQuarter);
  const rooms = joined.rooms ?? [];
  const buildings = joined.buildings ?? [];
  const tunnel = rooms.findIndex((r) => r.tag === 'tunnel');
  const cellarOf = (id: string) => rooms.findIndex((r) => r.storey === -1 && buildings[r.building]?.id === id);
  const arch = (id: string, x: number): Opening => ({
    kind: 'arch', rooms: [cellarOf(id), tunnel], centre: v(x, -2.75, -64), width: 4, height: 3.5, yaw: x < 0 ? PI / 2 : -PI / 2, passable: true,
  });
  return { ...joined, openings: [...(joined.openings ?? []), arch('tavern-west', -41.5), arch('tavern-east', 41.5)] };
}

// ---------------------------------------------------------------------------------------------------------------
// The spec
// ---------------------------------------------------------------------------------------------------------------

const half: SpecPart = renamePart(joinParts(
  below(),
  LANES_HALF,
  part({
    prims: [...groundHalf, ...base],
    nav: [
      // Base courtyard and gate approaches.
      v(-40, 0, -122), v(0, 0, -122), v(40, 0, -122), v(-24, 0, -138), v(24, 0, -138),
      // Hollow floor.
      v(-14, -10, -14), v(14, -10, -14), v(0, -10, -16),
    ],
    // The Hollow's four Twig Nests (this half's two; Dusk mirrors them), spawning at 10:00 (GDD §7.9).
    nests: [{ ...at(-14, -10, -8), variant: 'twig' }, { ...at(14, -10, -8), variant: 'twig' }],
    botSpots: [
      // Safe: behind each tower, the gates and the Shrines (Dawn's).
      { kind: 'safe', pos: v(-93, 0, -46) }, { kind: 'safe', pos: v(-4, 0, -52) }, { kind: 'safe', pos: v(93, 0, -46) },
      { kind: 'safe', pos: v(-90, 0, -86) }, { kind: 'safe', pos: v(-4, 0, -90) }, { kind: 'safe', pos: v(90, 0, -86) },
      { kind: 'safe', pos: v(-40, 0, -120) }, { kind: 'safe', pos: v(0, 0, -120) }, { kind: 'safe', pos: v(40, 0, -120) },
      { kind: 'safe', pos: v(-16, 0, -132) }, { kind: 'safe', pos: v(16, 0, -132) },
      // Ambush: by each Thicket's entrance.
      { kind: 'ambush', pos: v(-49, 0, -72) }, { kind: 'ambush', pos: v(-40, 0, -44) },
      { kind: 'ambush', pos: v(-55, 0, -30) }, { kind: 'ambush', pos: v(-30, 0, -2) },
      { kind: 'ambush', pos: v(49, 0, -72) }, { kind: 'ambush', pos: v(40, 0, -44) },
      { kind: 'ambush', pos: v(55, 0, -30) }, { kind: 'ambush', pos: v(30, 0, -2) },
      { kind: 'ambush', pos: v(-21, 0, -96) }, { kind: 'ambush', pos: v(21, 0, -96) },
      { kind: 'ambush', pos: v(-23, 0, -46) }, { kind: 'ambush', pos: v(23, 0, -46) },
    ],
  }),
), (id) => `${id}-dawn`);

export const MAIN_SPEC: MapSpec = {
  id: 'main',
  name: 'Old Mossmarket',
  bounds: { min: v(-130, -20, -150), max: v(130, 80, 150) },
  killY: -20,
  half: {
    ...half,
    lanes: [
      { id: 'hedgerow', path: [v(-40, 0, -114), v(-95, 0, -80), v(-95, 0, 0)], halfWidth: 7 },
      { id: 'riverbank', path: [v(0, 0, -112), v(0, 0, 0)], halfWidth: 9 },
      { id: 'pinewood', path: [v(40, 0, -114), v(95, 0, -80), v(95, 0, 0)], halfWidth: 8 },
    ],
    spawns: [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5].map((x) => at(x, 2, -146)),
    shops: [
      { kind: 'roost', pos: v(0, 2, -146), yaw: 0, radius: 10 },
      { kind: 'stall', pos: v(-105, 0, -58), yaw: PI / 2, radius: 6 },
      { kind: 'stall', pos: v(10, 0, -60), yaw: -PI / 2, radius: 6 },
      { kind: 'stall', pos: v(105, 0, -58), yaw: -PI / 2, radius: 6 },
      // The Magpie Den: neutral, both flocks buy here (GDD §7.15).
      DEN_SHOP,
    ],
    structures: [
      { type: 'patron', lane: null, pos: v(0, 3, -136), yaw: 0 },
      { type: 'shrine', lane: null, pos: v(-16, 0, -126), yaw: 0 },
      { type: 'shrine', lane: null, pos: v(16, 0, -126), yaw: 0 },
      ...([['hedgerow', -40], ['riverbank', 0], ['pinewood', 40]] as const).flatMap(([lane, x]) => [
        { type: 'warden' as const, lane, pos: v(x - 6, 0, -110), yaw: 0 },
        { type: 'warden' as const, lane, pos: v(x + 6, 0, -110), yaw: 0 },
      ]),
      { type: 'heron', lane: 'hedgerow', pos: v(-95, 0, -75), yaw: 0 },
      { type: 'heron', lane: 'riverbank', pos: v(0, 0, -80), yaw: 0 },
      { type: 'heron', lane: 'pinewood', pos: v(95, 0, -75), yaw: 0 },
      { type: 'hawk', lane: 'hedgerow', pos: v(-95, 0, -35), yaw: 0 },
      { type: 'hawk', lane: 'riverbank', pos: v(0, 0, -40), yaw: 0 },
      { type: 'hawk', lane: 'pinewood', pos: v(95, 0, -35), yaw: 0 },
    ],
  },
  centre: {
    ...joinParts(DOVECOTES, part({
      prims: [
        ...groundCentre,
        // Egg Perch plazas (1 m) with a ramp on each side for the Egg carrier, who can't mantle.
        column(-50, 0, 6, 0, 1, 'stone'),
        ramp(-60.5, -55.5, -1.5, 1.5, 0, 1, 'e', 'stone'),
        ramp(-44.5, -39.5, -1.5, 1.5, 0, 1, 'w', 'stone'),
        column(50, 0, 6, 0, 1, 'stone'),
        ramp(39.5, 44.5, -1.5, 1.5, 0, 1, 'e', 'stone'),
        ramp(55.5, 60.5, -1.5, 1.5, 0, 1, 'w', 'stone'),
        // Feather rune footbridges, 6 m up across the side lanes.
        block(-106, -84, -1.5, 1.5, 5.5, 6, 'wood'),
        ramp(-116, -106, -1.5, 1.5, 0, 6, 'e', 'wood'),
        ramp(-84, -74, -1.5, 1.5, 0, 6, 'w', 'wood'),
        block(84, 106, -1.5, 1.5, 5.5, 6, 'wood'),
        ramp(106, 116, -1.5, 1.5, 0, 6, 'w', 'wood'),
        ramp(74, 84, -1.5, 1.5, 0, 6, 'e', 'wood'),
      ],
      nav: [v(-50, 1, 0), v(50, 1, 0), v(0, -10, 0), v(-30, 0, 0), v(30, 0, 0)],
      props: [
        { kind: 'fountain', pos: v(-50, 1, 0), yaw: 0, size: v(2.4, 1.2, 2.4), zone: 'oldsquare', solid: false },
        { kind: 'fountain', pos: v(50, 1, 0), yaw: 0, size: v(2.4, 1.2, 2.4), zone: 'oldsquare', solid: false },
        { kind: 'roots', pos: v(0, -10, 0), yaw: 0, size: v(40, 3, 40), zone: 'hollow', solid: false },
        { kind: 'feather-banner', pos: v(-95, 6, 0), yaw: PI / 2, size: v(0.1, 3, 1.6), zone: 'hedgerow', solid: false },
        { kind: 'feather-banner', pos: v(95, 6, 0), yaw: -PI / 2, size: v(0.1, 3, 1.6), zone: 'pinewood', solid: false },
      ],
    })),
    // Anchors on z = 0 face east or west so they are their own mirror image.
    runeSpots: [at(-95, 6, 0, PI / 2), at(95, 6, 0, -PI / 2)],
    eggPerches: [at(-50, 1, 0, PI / 2), at(50, 1, 0, -PI / 2)],
    hollow: { centre: v(0, -10, 0), radius: 22, floorY: -10 },
  },
};
