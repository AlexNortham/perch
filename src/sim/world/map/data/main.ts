/**
 * The PERCH map (GDD §6): an old market town grown through by forest. Dawn half authored here (z < 0), mirrored for
 * Dusk by src/sim/world/map/build.ts; `centre` holds what sits on z = 0. Every §6.3 coordinate is used as written.
 *
 * Plan of the Dawn half (x = east):
 *   x −130…−102  Hedgerow west terrace and walled kitchen gardens
 *   x −102…−88   Hedgerow lane (14 m), balconies at 4 m between Heron and Hawk, hedge chicanes
 *   x −87…−76    Hedgerow east terrace (vine on the Hawk-side house, chimney behind it)
 *   x −74…−16    west jungle: Thicket yards, blocks with walkable roofs, Egg Perch plaza at z = 0
 *   x −9…9       Riverbank lane (18 m); river x 9…14; market square and mills at the Hawk
 *   x 16…74      east jungle: the west jungle's block plan mirrored in x, built in timber
 *   x 76…118     Pinewood: stilt platforms at 6 m and 10 m both sides, rope walkway across the lane, sawmill
 */
import type { BlockoutPrim, MaterialTag } from '../../../core/contracts';
import type { ClimbSpec, MapSpec, SpecPart } from './kit';
import {
  at, block, chimney, column, flipClimb, flipV, flipX, house, ramp, slab, stilts, tree, v, vine, yard,
} from './kit';
import * as dmath from '../../../core/dmath';

const PI = Math.PI;

// ---------------------------------------------------------------------------------------------------------------
// Ground, the Hollow, the outer band
// ---------------------------------------------------------------------------------------------------------------

/** The Hollow is an octagon of apothem 22: a 44 m square hole with its corners filled by 45° boxes. */
const CHAMFER = 18.2;

const groundHalf: BlockoutPrim[] = [
  block(-130, 130, -150, -22, -10.5, 0, 'grass'),
  slab(-22, -22, CHAMFER, CHAMFER, -10.5, 0, PI / 4, 'grass'),
  slab(22, -22, CHAMFER, CHAMFER, -10.5, 0, PI / 4, 'grass'),
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
// Hedgerow (west): terraces, balconies at 4 m, hedges, walled gardens
// ---------------------------------------------------------------------------------------------------------------

/** Lane direction of the side lanes' first leg, (−55, 34) normalised, and the yaw that runs along it. */
const DIAG = { x: -0.8506, z: 0.5258 };
const DIAG_YAW = dmath.atan2(DIAG.x, DIAG.z);
/** Inward normal of the Hedgerow first leg (toward the jungle). */
const DIAG_IN = { x: 0.5258, z: 0.8506 };
const DIAG_MID = { x: -67.5, z: -97 };

const westTerrace: [number, number, number, 'flat' | 'gable'][] = [
  [-78, -70, 9, 'flat'], [-70, -62, 10, 'gable'], [-62, -54, 8, 'flat'], [-54, -46, 11, 'gable'],
  [-46, -38, 9, 'flat'], [-38, -30, 10, 'gable'], [-30, -22, 8, 'flat'], [-22, -14, 11, 'gable'], [-14, -6, 9, 'flat'],
];
const eastTerrace: [number, number, number, 'flat' | 'gable'][] = [
  [-74, -65.5, 8, 'flat'], [-65.5, -57, 10, 'gable'], [-57, -48.5, 9, 'flat'], [-48.5, -40, 11, 'gable'],
  [-40, -31.5, 8, 'flat'], [-31.5, -23, 10, 'gable'], [-23, -14.5, 9, 'flat'], [-14.5, -6, 8, 'gable'],
];

const hedgerow: BlockoutPrim[] = [
  // The house at z −62…−54 is set back so the Magpie stall (−105, −58) sits in its shopfront.
  ...westTerrace.flatMap(([z0, z1, h, roof]) => house(-116, z0 === -62 ? -109 : -103, z0, z1, 0, h, 'brick', roof)),
  ...eastTerrace.flatMap(([z0, z1, h, roof]) => house(-87, -76, z0, z1, 0, h, 'stone', roof)),
  // Balconies at 4 m over both sides of the lane between Heron and Hawk, each with a stair.
  block(-103, -100, -70, -42, 3.6, 4, 'wood'),
  ramp(-103, -101, -42, -34, 0, 4, 's', 'wood'),
  block(-90, -87, -70, -42, 3.6, 4, 'wood'),
  ramp(-89, -87, -80, -70, 0, 4, 'n', 'wood'),
  // Hedge chicanes, alternating sides; the middle 6 m stays open for fledglings.
  block(-102, -98, -63, -61.5, 0, 2.5, 'foliage'),
  block(-92, -88, -49, -47.5, 0, 1.2, 'foliage'),
  block(-102, -98, -25, -23.5, 0, 1.2, 'foliage'),
  block(-92, -88, -14, -12.5, 0, 2.5, 'foliage'),
  // Clipped hedge and garden wall along the first leg.
  slab(DIAG_MID.x + DIAG_IN.x * 9, DIAG_MID.z + DIAG_IN.z * 9, 1.5, 20, 0, 2.5, DIAG_YAW, 'foliage'),
  slab(DIAG_MID.x - DIAG_IN.x * 9, DIAG_MID.z - DIAG_IN.z * 9, 1, 24, 0, 1.2, DIAG_YAW, 'stone'),
  // Hedge at the outside of the Heron corner.
  block(-106, -100, -100, -98.5, 0, 2.5, 'foliage'),
  // Magpie stall counter.
  block(-108.5, -107.5, -60, -56, 0, 1.2, 'wood'),
  // Walled kitchen gardens behind the west terrace.
  block(-130, -116, -60.5, -59.5, 0, 1.2, 'stone'),
  block(-130, -116, -34.5, -33.5, 0, 1.2, 'stone'),
  block(-130, -116, -12.5, -11.5, 0, 1.2, 'stone'),
  block(-126, -121, -75, -73, 0, 2.5, 'foliage'),
  block(-126, -121, -48, -46, 0, 2.5, 'foliage'),
  block(-126, -121, -24, -22, 0, 1.2, 'foliage'),
  block(-120, -116, -96, -86, 0, 1.2, 'stone'),
];

const hedgerowClimbs: ClimbSpec[] = [
  vine(-87, -36, 8, 1, 0), // Hawk-side house, lane face
  chimney(-76, -36, 8, -1, 0), // behind it, alley face
  vine(-116, -26, 8, 1, 0), // west terrace, garden face
];

// ---------------------------------------------------------------------------------------------------------------
// Riverbank (middle): river, market square, stall, bridge rails
// ---------------------------------------------------------------------------------------------------------------

const riverbank: BlockoutPrim[] = [
  block(9, 14, -114, -22, 0, 0.05, 'water', false),
  block(8.5, 14.5, -92, -89, 0, 0.3, 'wood'),
  block(8.5, 14.5, -70, -67, 0, 0.3, 'wood'),
  // Market square at the Hawk.
  block(-14, 9, -54, -26, 0, 0.02, 'stone', false),
  block(-14, -11, -52, -49, 0, 1.5, 'wood'),
  block(-14, -11, -31, -28, 0, 1.5, 'wood'),
  block(6, 8.5, -33, -30, 0, 1.2, 'wood'),
  block(-8.5, -6, -50, -47, 0, 1.2, 'wood'),
  // Crates near the Heron.
  block(-8.5, -6, -95, -92, 0, 1.5, 'wood'),
  block(6, 8.5, -75, -72, 0, 1.5, 'wood'),
  // Magpie stall counter on the bank.
  block(12, 13.5, -62, -58, 0, 1.2, 'wood'),
  // Waterwheel of the east mill (decoration).
  block(14, 14.6, -42, -35, 0, 6, 'wood', false),
  // Old Mill Bridge rails (gaps let you drop into the Hollow) and piers.
  block(-5, -4.4, -20, -12, 0, 1.4, 'wood'),
  block(-5, -4.4, -8, -2, 0, 1.4, 'wood'),
  block(4.4, 5, -20, -12, 0, 1.4, 'wood'),
  block(4.4, 5, -8, -2, 0, 1.4, 'wood'),
  column(-3, -11, 1.2, -10, -1, 'stone'),
  column(3, -11, 1.2, -10, -1, 'stone'),
];

// ---------------------------------------------------------------------------------------------------------------
// Pinewood (east): stilt platforms at 6 m and 10 m, rope walkway, sawmill, pines
// ---------------------------------------------------------------------------------------------------------------

const pinewood: BlockoutPrim[] = [
  // East: stilt house over the Magpie stall, rope stair up to a 10 m lookout.
  block(104, 116, -72, -60, 5.6, 6, 'wood'),
  ...stilts(104, 116, -72, -60, 5.6),
  ...house(108, 116, -70, -63, 6, 10, 'wood', 'gable'),
  ramp(110, 112, -80, -72, 0, 6, 'n', 'wood'),
  block(106, 118, -46, -34, 9.6, 10, 'wood'),
  ...stilts(106, 118, -46, -34, 9.6),
  ramp(110, 112, -60, -46, 6, 10, 'n', 'wood'),
  block(107, 108.5, -60, -56, 0, 1.2, 'wood'),
  // Rope walkway across the lane at 6 m.
  block(86, 104, -67, -65, 5.7, 6, 'wood'),
  // West: platform at 6 m with a hut, ramp from the jungle, rope stair to a 10 m platform.
  block(76, 86, -72, -60, 5.6, 6, 'wood'),
  ...stilts(76, 86, -72, -60, 5.6),
  ...house(77, 81, -71, -66, 6, 10, 'wood', 'gable'),
  ramp(66, 76, -68, -66, 0, 6, 'e', 'wood'),
  block(76, 86, -46, -34, 9.6, 10, 'wood'),
  ...stilts(76, 86, -46, -34, 9.6),
  ramp(80, 82, -60, -46, 6, 10, 'n', 'wood'),
  // Sawmill yard: shed with a flat roof, log piles.
  ...house(76, 86, -30, -16, 0, 7, 'wood', 'flat'),
  block(78, 84, -12, -9, 0, 1.5, 'wood'),
  block(88, 92, -58, -56, 0, 1.2, 'wood'),
  block(98, 102, -22, -20, 0, 1.2, 'wood'),
  block(99, 103, -92, -89, 0, 1.5, 'wood'), // outside the Heron corner
  ...tree(112, -98, 0.7, 18, 2.6, 5),
  // Pines: lane edges, the east band and the first leg.
  ...tree(104.5, -26, 0.7, 18, 2.6, 5),
  ...tree(104.5, -10, 0.7, 18, 2.6, 5),
  ...tree(122, -84, 0.8, 20, 3, 6),
  ...tree(124, -64, 0.8, 20, 3, 6),
  ...tree(124, -44, 0.8, 20, 3, 6),
  ...tree(122, -24, 0.8, 20, 3, 6),
  ...tree(120, -8, 0.8, 20, 3, 6),
  ...tree(77, -101, 0.7, 18, 2.6, 5),
  ...tree(70, -106, 0.7, 18, 2.6, 5),
  ...tree(84, -96, 0.7, 18, 2.6, 5),
];

const pinewoodClimbs: ClimbSpec[] = [
  chimney(106, -40, 10, 1, 0), // the 10 m lookout, beside the Hawk
  vine(86, -24, 7, -1, 0), // sawmill, lane face (Hawk side)
];

// ---------------------------------------------------------------------------------------------------------------
// Jungle: the west block plan, mirrored in x and rebuilt in timber for the east
// ---------------------------------------------------------------------------------------------------------------

const jungleWest: BlockoutPrim[] = [
  ...house(-38, -26, -104, -94, 0, 7, 'brick', 'flat'),
  ...house(-21, -12, -104, -92, 0, 9, 'brick', 'gable'),
  ...yard(-60, -80, 12, ['s', 'e'], 'stone'),
  ...house(-46, -36, -88, -78, 0, 10, 'brick', 'flat'),
  ...house(-30, -14, -88, -78, 0, 8, 'brick', 'flat'),
  ...house(-46, -34, -72, -64, 0, 6, 'brick', 'gable'),
  ...house(-28, -16, -72, -64, 0, 7, 'brick', 'flat'),
  ...yard(-30, -52, 12, ['n', 'w'], 'stone'),
  ...house(-52, -42, -58, -48, 0, 9, 'brick', 'flat'),
  ...house(-70, -58, -62, -50, 0, 7, 'brick', 'gable'),
  ...house(-23, -14, -44, -32, 0, 8, 'stone', 'flat'),
  ...house(-32, -21.7, -32, -20, 0, 9, 'brick', 'flat'),
  ...house(-52, -40, -42, -30, 0, 11, 'brick', 'flat'),
  ramp(-40, -32, -32, -30, 9, 11, 'w', 'wood'),
  ...yard(-65, -22, 12, ['n', 'e'], 'stone'),
  ...house(-66, -58, -12, -5, 0, 7, 'brick', 'flat'),
  ...house(-30, -24, -16, -10, 0, 6, 'brick', 'flat'),
  ...yard(-40, -12, 12, ['n', 'e'], 'stone'),
  // Cover in the open courts.
  block(-53, -50, -26, -23, 0, 1.5, 'wood'),
  block(-48, -45, -100, -97, 0, 1.5, 'wood'),
  block(-36, -33, -42, -39, 0, 1.2, 'wood'),
  // A giant trunk with its canopy.
  column(-54, -66, 3, 0, 40, 'trunk'),
  column(-54, -66, 14, 28, 30, 'foliage', false),
];

const jungleWestClimbs: ClimbSpec[] = [
  chimney(-46, -83, 10, 1, 0), // beside the tier-2 Thicket
  chimney(-21.7, -26, 9, -1, 0), // between the tier-3 Thicket and the Riverbank Hawk
  vine(-22, -88, 8, 0, 1),
  vine(-14, -38, 8, -1, 0), // the mill beside the Riverbank Hawk, lane face
  vine(-52, -36, 11, 1, 0),
  vine(-58, -8, 7, -1, 0), // Egg Perch plaza
];

const TIMBER: Partial<Record<MaterialTag, MaterialTag>> = { brick: 'wood', stone: 'wood' };
const timber = (m: MaterialTag): MaterialTag => TIMBER[m] ?? m;

// ---------------------------------------------------------------------------------------------------------------
// The spec
// ---------------------------------------------------------------------------------------------------------------

const half: SpecPart = {
  prims: [
    ...groundHalf, ...base, ...hedgerow, ...riverbank, ...pinewood,
    ...jungleWest, ...jungleWest.map((p) => flipX(p, timber)),
  ],
  climbs: [...hedgerowClimbs, ...pinewoodClimbs, ...jungleWestClimbs, ...jungleWestClimbs.map(flipClimb)],
  nav: [
    // Base courtyard and gate approaches.
    v(-40, 0, -122), v(0, 0, -122), v(40, 0, -122), v(-24, 0, -138), v(24, 0, -138),
    // Hollow floor.
    v(-14, -10, -14), v(14, -10, -14), v(0, -10, -16),
    // Courts the building corners don't cover.
    v(-52, 0, -18), v(-50, 0, -92), ...[v(-52, 0, -18), v(-50, 0, -92)].map(flipV),
  ],
  nests: [
    // Alleys.
    at(-49, 0, -68), at(-33, 0, -61), at(-55, 0, -40), at(-33, 0, -91),
    at(49, 0, -68), at(33, 0, -61), at(55, 0, -40), at(33, 0, -91),
    // Rooftops.
    at(-22, 8, -83), at(-46, 11, -36), at(22, 8, -83), at(46, 11, -36),
    // Lane edges between Hawk and Heron.
    at(-89.5, 0, -56), at(-8.5, 0, -62), at(8.5, 0, -66), at(89.5, 0, -52),
  ],
  thickets: [
    { pos: v(-65, 0, -22), yaw: 0, tier: 1 }, { pos: v(-30, 0, -52), yaw: 0, tier: 1 },
    { pos: v(30, 0, -52), yaw: 0, tier: 1 }, { pos: v(65, 0, -22), yaw: 0, tier: 1 },
    { pos: v(-60, 0, -80), yaw: 0, tier: 2 }, { pos: v(60, 0, -80), yaw: 0, tier: 2 },
    { pos: v(-40, 0, -12), yaw: 0, tier: 3 }, { pos: v(40, 0, -12), yaw: 0, tier: 3 },
  ],
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
  ],
};

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
    prims: [
      ...groundCentre,
      // Egg Perch plazas (1 m) with a ramp on each side for the Egg carrier, who can't mantle.
      column(-50, 0, 6, 0, 1, 'stone'),
      ramp(-60.5, -55.5, -1.5, 1.5, 0, 1, 'e', 'stone'),
      ramp(-44.5, -39.5, -1.5, 1.5, 0, 1, 'w', 'stone'),
      column(50, 0, 6, 0, 1, 'stone'),
      ramp(39.5, 44.5, -1.5, 1.5, 0, 1, 'e', 'stone'),
      ramp(55.5, 60.5, -1.5, 1.5, 0, 1, 'w', 'stone'),
      // Feather rune footbridges, 6 m up across the side lanes; dovecote and lookout beside them.
      block(-106, -84, -1.5, 1.5, 5.5, 6, 'wood'),
      ramp(-116, -106, -1.5, 1.5, 0, 6, 'e', 'wood'),
      ramp(-84, -74, -1.5, 1.5, 0, 6, 'w', 'wood'),
      column(-121, 0, 3, 0, 12, 'stone'),
      block(84, 106, -1.5, 1.5, 5.5, 6, 'wood'),
      ramp(106, 116, -1.5, 1.5, 0, 6, 'w', 'wood'),
      ramp(74, 84, -1.5, 1.5, 0, 6, 'e', 'wood'),
      column(121, 0, 3, 0, 12, 'wood'),
    ],
    climbs: [vine(-118, 0, 12, -1, 0), vine(118, 0, 12, 1, 0)],
    nav: [v(-50, 1, 0), v(50, 1, 0), v(0, -10, 0), v(-30, 0, 0), v(30, 0, 0)],
    nests: [],
    thickets: [],
    botSpots: [],
    // Anchors on z = 0 face east or west so they are their own mirror image.
    runeSpots: [at(-95, 6, 0, PI / 2), at(95, 6, 0, -PI / 2)],
    eggPerches: [at(-50, 1, 0, PI / 2), at(50, 1, 0, -PI / 2)],
    hollow: { centre: v(0, -10, 0), radius: 22, floorY: -10 },
  },
};
