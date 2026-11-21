/**
 * The jungle quarter (GDD §6.5, §6.8–6.10): the west quarter of the Dawn half, authored here; the east quarter is its
 * x-mirror rebuilt in timber (main.ts), and Dusk mirrors both. Eight enterable buildings per quarter: Granary,
 * Warehouse, Tavern, Hollow-tree House, Bell Tower, Market Hall (east: Water Mill) and two Hides; the blockout houses
 * they don't overlap stay as solid fill. Every anchor of GDD §6.10 that belongs to the jungle is here; lane-side ones
 * (Hedgerow terraces, Pinewood stilts) are in lanes.ts.
 *
 * Old Mossmarket is built by and for birds (D-EP-048): roofs carry nest crowns, belfries and lofts are roosts, the
 * Hollow-tree House is a home in a trunk, and the streets are dressed with feeders, baths, worm beds and banners.
 */
import type { BlockoutPrim, InteractableAnchor, NestAnchor, ThicketAnchor, Vec3 } from '../../../core/contracts';
import type { PropAnchor, PropKind } from '../dressing';
import type { SpecPart } from './kit';
import { at, block, chimney, column, extend, joinParts, part, patchDress, ramp, slab, stilts, v, vine, yard } from './kit';
import type { Rect } from './interiors';
import { carve, fill, ladderClimb, rect, shell, slabOf, stairDress, stairPrim, volumeOf } from './interiors';
import * as dmath from '../../../core/dmath';

const PI = Math.PI;

// ---------------------------------------------------------------------------------------------------------------
// Props: solid ones are cover prims; the rest are dressing only (D-EP-047)
// ---------------------------------------------------------------------------------------------------------------

export interface PropSpec {
  readonly kind: PropKind;
  readonly x: number;
  readonly z: number;
  readonly w: number;
  readonly d: number;
  readonly h: number;
  readonly y?: number;
  readonly yaw?: number;
  readonly solid?: boolean;
}

const PROP_MATERIAL: Partial<Record<PropKind, BlockoutPrim['material']>> = {
  hedge: 'foliage', planter: 'stone', 'bird-bath': 'stone', fountain: 'stone', well: 'stone', bramble: 'foliage', logs: 'trunk',
};

/** Props in a zone: solid ones also become a collision box. */
export function props(zone: string, list: readonly PropSpec[]): SpecPart {
  const prims: BlockoutPrim[] = [];
  const out: PropAnchor[] = [];
  for (const p of list) {
    const y = p.y ?? 0;
    const yaw = p.yaw ?? 0;
    const solid = p.solid ?? false;
    if (solid) prims.push(slab(p.x, p.z, p.w, p.d, y, y + p.h, yaw, PROP_MATERIAL[p.kind] ?? 'wood'));
    out.push({ kind: p.kind, pos: v(p.x, y, p.z), yaw, size: v(p.w, p.h, p.d), zone, solid });
  }
  return part({ prims, props: out });
}

const crate = (x: number, z: number, h = 1.5, w = 2, d = 2): PropSpec => ({ kind: 'crate', x, z, w, d, h, solid: true });
const deco = (kind: PropKind, x: number, z: number, w: number, d: number, h: number, y = 0, yaw = 0): PropSpec =>
  ({ kind, x, z, w, d, h, y, yaw });

// ---------------------------------------------------------------------------------------------------------------
// Granary (GDD §6.8): staddle deck at 1.2, hall, loft at 5.2, 30° gable (ridge 10.5)
// ---------------------------------------------------------------------------------------------------------------

const GRANARY = { x0: -28, x1: -14, z0: -108, z1: -98, deck: 1.2, loft: 5.2, eaves: 7.6 } as const;

function granary(): SpecPart {
  const g = GRANARY;
  const building = shell({
    id: 'granary', archetype: 'granary', zone: 'gatefields', style: 'jungle-brick', nestCrown: true,
    x0: g.x0, x1: g.x1, z0: g.z0, z1: g.z1, floors: [g.deck, g.loft], top: g.eaves, roof: 'gable', material: 'brick',
    gaps: [
      { face: 'n', storey: 0, at: -21, kind: 'loading' },
      { face: 's', storey: 0, at: -21, kind: 'loading' },
      // Loft hatches on the gable ends: the 2.4 m loft under the eaves fits a 2.2 m leap window at a 0.2 m sill.
      // The west one is reached by its Vine, so it has no landing board in the Vine's way.
      { face: 'w', storey: 1, at: -103, kind: 'leap', sill: 0.2, h: 2.2, board: false },
      { face: 'e', storey: 1, at: -103, kind: 'leap', sill: 0.2, h: 2.2 },
    ],
    ladders: [{ storey: 0, x: -25.5, z: -99.5, in: 'e' }, { storey: 0, x: -16.5, z: -106.5, in: 'w' }],
    holes: [{ storey: 1, r: rect(-24, -22, -103, -101), kind: 'hatch' }, { storey: 1, r: rect(-20, -18, -105, -103), kind: 'hatch' }],
  });
  return joinParts(extend(building, {
    // The staddle deck: the hall floor, with a 2 m apron on the south face and ramps at both short ends.
    prims: [
      block(g.x0, g.x1, -110, g.z1, 0, g.deck, 'stone'),
      ramp(-30.4, g.x0, -110, -108, 0, g.deck, 'e', 'stone'),
      ramp(g.x1, -11.6, -110, -108, 0, g.deck, 'w', 'stone'),
    ],
    nav: [v(-21, g.deck, -109), v(-31.4, 0, -109), v(-10.6, 0, -109), v(-21, 0, -96.5)],
    climbs: [vine(g.x0, -103, g.loft + 0.2, 1, 0)],
  }), props('granary', [
    { kind: 'sacks', x: -16.25, z: -100.25, w: 1.5, d: 1.5, h: 1.2, y: g.deck, solid: true },
    { kind: 'sacks', x: -26.25, z: -105, w: 1.5, d: 2, h: 1.2, y: g.deck, solid: true },
    deco('nest-pile', -16, -104.5, 1.5, 1.5, 0.8, g.loft),
    deco('dovecote-boxes', -21, -98.2, 6, 0.4, 1.6, 6),
  ]));
}

// ---------------------------------------------------------------------------------------------------------------
// Warehouse (GDD §6.8): one 7.6 m storey, catwalk at 4 m on three walls, flat roof at 8 with skylights
// ---------------------------------------------------------------------------------------------------------------

const WH = { x0: -48, x1: -28, z0: -92, z1: -78, top: 8, deck: 4 } as const;
/** The interior Chimney's shaft centre: within 25 m of the Weasel yard and of the Granary's Rats (GDD §6.5). */
const WH_SHAFT = { x: -36.4, z: -84.6 } as const;

function warehouse(): SpecPart {
  const w = WH;
  const shaft = rect(WH_SHAFT.x - 1.5, WH_SHAFT.x + 1.5, WH_SHAFT.z - 1.5, WH_SHAFT.z + 1.5);
  const building = shell({
    id: 'warehouse', archetype: 'warehouse', zone: 'gatefields', style: 'jungle-brick',
    x0: w.x0, x1: w.x1, z0: w.z0, z1: w.z1, floors: [0], top: w.top, roof: 'flat', parapet: ['s'], material: 'brick',
    gaps: [
      { face: 'w', storey: 0, at: -85, kind: 'loading' },
      { face: 'e', storey: 0, at: -82.5, kind: 'loading' },
      { face: 'n', storey: 0, at: -38, kind: 'door', curtain: true },
      { face: 's', storey: 0, at: -38, kind: 'door', curtain: true },
    ],
    holes: [
      // In line with the Chimney opening, so the roof splits into whole strips.
      { storey: 'roof', r: rect(-44, -41, WH_SHAFT.z - 1.5, WH_SHAFT.z + 1.5), kind: 'skylight' },
      { storey: 'roof', r: rect(-34, -31, -84.4, -81.5), kind: 'skylight' },
      { storey: 'roof', r: shaft, kind: 'void' },
    ],
  });
  const deckY = w.deck;
  const stairs: [Rect, Vec3, Vec3][] = [
    [rect(-44.5, -38.5, -88.5, -86.5), v(-45.5, 0, -87.5), v(-38, deckY, -90)],
    [rect(-44.5, -38.5, -83.5, -81.5), v(-45.5, 0, -82.5), v(-38, deckY, -80)],
  ];
  const catwalks = [rect(-47.5, -28.5, -81.5, -78.5), rect(-47.5, -28.5, -91.5, -88.5), rect(-47.5, -44.5, -88.5, -81.5)];
  const fabric: BlockoutPrim[] = [
    // Catwalks: north, south and west walls, 3 m wide.
    ...catwalks.map((r) => slabOf(r, deckY - 0.4, deckY, 'wood')),
    ...stairs.map(([r]) => stairPrim(r, 'e', 0, deckY, 'wood')),
    // Juke alcove in the south-west corner, behind an ivy curtain.
    block(-44.5, -44, -91.5, -88.5, 0, deckY - 0.4, 'brick'),
    { shape: 'box', material: 'foliage', solid: true, blocks: 'sight', yaw: 0, centre: v(-46, 1.8, -88.75), size: v(3, 3.6, 0.5) },
  ];
  const withExtras = extend(building, {
    fabric,
    nav: [...stairs.flatMap(([, a, b]) => [a, b]), v(-46, deckY, -85), v(-30, deckY, -80), v(-46, 0, -90), v(-41, 8, -79)],
    // The interior Chimney rises through a 3 m roof opening.
    climbs: [chimney(WH_SHAFT.x + 1.6, WH_SHAFT.z, w.top, 1, 0)],
    openings: [{ kind: 'arch', rooms: [0, 0], centre: v(-46, 1.8, -88.75), width: 3, height: 3.6, yaw: 0, passable: true, curtain: true }],
  });
  return joinParts(patchDress(withExtras, (d) => ({
    ...d,
    stairs: [...d.stairs, ...stairs.map(([r]) => stairDress(r, 'e', 0, deckY))],
    balconies: [...d.balconies, ...catwalks.map((r) => volumeOf(r, deckY - 0.4, deckY + 1))],
  })), props('warehouse', [
    // The mantle chain to the north catwalk: 1.5 m, 3.0 m, then the 4 m deck.
    crate(-30, -84.5, 1.5, 2, 2), crate(-30, -82.5, 3.0, 2, 2),
    deco('shelf', -47, -84, 0.8, 4, 2.4, 0), deco('sacks', -33, -90.5, 3, 1.5, 1.0, deckY),
    deco('nest-pile', -45.5, -79.8, 2, 1.5, 0.8, deckY), deco('rope-walkway', -54, -72.5, 2, 19.1, 0.3, 10, dmath.atan2(-14, 13)),
  ]));
}

// ---------------------------------------------------------------------------------------------------------------
// Tavern (GDD §6.8): taproom, upper floor at 4 with a balcony over the front door, cellar at −4.5 into the Cellar Run
// ---------------------------------------------------------------------------------------------------------------

export const TAVERN = { x0: -51, x1: -41, z0: -70, z1: -58, cellar: -4.5 } as const;
/** The cellar stair: descends south from the taproom (top at z −60) to the cellar floor. */
export const CELLAR_STAIR = rect(-43.5, -41.5, -69, -60);

function tavern(): SpecPart {
  const t = TAVERN;
  const building = shell({
    id: 'tavern', archetype: 'tavern', zone: 'lanternrow', style: 'jungle-brick', nestCrown: true,
    x0: t.x0, x1: t.x1, z0: t.z0, z1: t.z1, floors: [0, 4], top: 7.1, roof: 'gable', material: 'brick',
    cellar: { floor: t.cellar, ceiling: -0.4 },
    gaps: [
      // Front on Lantern Row (south), back door with ivy (north), side door (west).
      { face: 's', storey: 0, at: -46, kind: 'door' },
      { face: 'n', storey: 0, at: -46, kind: 'door', curtain: true },
      { face: 'w', storey: 0, at: -59.7, kind: 'door' },
      { face: 's', storey: 1, at: -46, kind: 'balcony' },
      { face: 'e', storey: 0, at: -64, kind: 'window' },
      { face: 'e', storey: 1, at: -64, kind: 'window' },
      { face: 'w', storey: 1, at: -64, kind: 'window' },
    ],
    stairs: [{ r: rect(-50.5, -48.5, -68, -60.5), storey: 0, up: 'n' }],
    balconies: [{ face: 's', storey: 1, from: -49, to: -43 }],
  });
  const s = CELLAR_STAIR;
  const withExtras = extend(building, {
    fabric: [stairPrim(s, 'n', t.cellar, 0, 'wood'), block(s.x0 - 0.5, s.x0, s.z0, s.z1, 0, 1, 'wood')],
    nav: [v(-42.5, 0, -59.3), v(-42.5, -4.25, -68.5)],
    // The stair head blocks the Egg carrier (GDD §7.15). Rooms: 2 is the cellar, 0 the taproom.
    openings: [{ kind: 'door', rooms: [2, 0], centre: v(-42.5, 1.5, s.z1), width: 2, height: 3, yaw: 0, passable: true, blocksEggCarrier: true }],
  });
  return joinParts(patchDress(withExtras, (d) => ({ ...d, stairs: [...d.stairs, stairDress(s, 'n', t.cellar, 0)] })), props('tavern', [
    { kind: 'counter', x: -46.25, z: -62.75, w: 3.5, d: 0.5, h: 1.2, solid: true },
    deco('table', -48, -66, 1.4, 1.4, 0.8), deco('table', -45, -67.5, 1.4, 1.4, 0.8), deco('barrel', -50, -59.5, 1, 1, 1.2, t.cellar),
    deco('feather-banner', -46, -70.3, 1.2, 0.1, 2.5, 4.5), deco('seed-stall', -48.5, -72.5, 2.5, 1.5, 2.2),
  ]));
}

// ---------------------------------------------------------------------------------------------------------------
// Hollow-tree House (GDD §6.8): an octagonal trunk, a 1.5-turn spiral ramp to a crown deck at 12 m
// ---------------------------------------------------------------------------------------------------------------

const TREE = { x: -65, z: -62, rOut: 5, wallTop: 11.6, deck: 12, sides: 8, turns: 12, rRamp: 3.1, overlap: 0.4 } as const;

function hollowTree(): SpecPart {
  const t = TREE;
  const dir = (deg: number) => ({ x: dmath.sin((deg * PI) / 180), z: dmath.cos((deg * PI) / 180) });
  const fabric: BlockoutPrim[] = [];
  // Wall segments every 45° (0 = north); arches north and south, knot-holes east (ramp at 6) and south (ramp at 4).
  const gaps: Record<number, [number, number][]> = { 0: [[0, 3.6]], 2: [[6.9, 9.3]], 4: [[0, 3.6], [4.9, 7.3]] };
  const side = 2 * t.rOut * dmath.tan(PI / t.sides);
  for (let k = 0; k < t.sides; k++) {
    const d = dir(k * 45);
    let y = 0;
    for (const [a, b] of [...(gaps[k] ?? []), [t.wallTop, t.wallTop] as [number, number]]) {
      if (a - y > 0.05) fabric.push(slab(t.x + d.x * (t.rOut - 0.5), t.z + d.z * (t.rOut - 0.5), side, 1, y, a, (k * PI) / 4, 'trunk'));
      y = b;
    }
  }
  // Spiral: from the north arch, anticlockwise seen from above (north, west, south, east), 1 m per 45°.
  const nav: Vec3[] = [];
  const at3 = (k: number) => {
    const d = dir(-45 * k);
    return v(t.x + d.x * t.rRamp, k, t.z + d.z * t.rRamp);
  };
  for (let k = 0; k < t.turns; k++) {
    const a = at3(k);
    const b = at3(k + 1);
    const len = dmath.hypot(b.x - a.x, b.z - a.z);
    const rise = (len + t.overlap * 2) / len;
    fabric.push({
      shape: 'ramp', material: 'trunk', solid: true, yaw: dmath.atan2(b.x - a.x, b.z - a.z),
      centre: v((a.x + b.x) / 2, k + 0.5, (a.z + b.z) / 2), size: v(2, rise, len + t.overlap * 2),
    });
  }
  for (let k = 0; k <= t.turns; k++) nav.push(at3(k));
  // Crown deck, open over the top of the spiral.
  for (const r of carve(rect(t.x - 6, t.x + 6, t.z - 6, t.z + 6), [rect(t.x - 5, t.x + 0.4, t.z - 5, t.z + 1)])) {
    fabric.push(slabOf(r, t.wallTop, t.deck, 'wood'));
  }
  // Rope bridge from the crown's south-east edge down to the Warehouse roof (19 m).
  const from = v(-61, t.deck, -66);
  const to = v(-47, WH.top, -79);
  fabric.push({
    shape: 'ramp', material: 'wood', solid: true, yaw: dmath.atan2(from.x - to.x, from.z - to.z),
    centre: v((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2), size: v(2, from.y - to.y, dmath.hypot(from.x - to.x, from.z - to.z)),
  });
  nav.push(from, v((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2), to);
  nav.push(v(t.x + 3.5, t.deck, t.z + 3.5), v(t.x - 3.5, t.deck, t.z + 3.5), v(t.x + 3.5, t.deck, t.z - 3.5));
  for (const [deg, y] of [[0, 0], [180, 0], [90, 6], [180, 4]] as const) {
    const d = dir(deg);
    nav.push(v(t.x + d.x * 6.5, 0, t.z + d.z * 6.5));
    if (y === 0) nav.push(v(t.x + d.x * 2.5, 0, t.z + d.z * 2.5));
  }
  // Landing boards under the knot-holes, 0.8 m deep, top at the sill.
  const boards = ([[90, 6.9], [180, 4.9]] as const).map(([deg, sill]) => {
    const d = dir(deg);
    const board = slab(t.x + d.x * (t.rOut + 0.4), t.z + d.z * (t.rOut + 0.4), 2.8, 0.8, sill - 0.3, sill, (deg * PI) / 180, 'wood');
    fabric.push(board);
    return { centre: board.centre, size: board.size, yaw: board.yaw };
  });
  const opening = (deg: number, y0: number, y1: number, kind: 'arch' | 'leap') => {
    const d = dir(deg);
    return { kind, rooms: [0, -1] as const, centre: v(t.x + d.x * (t.rOut - 0.5), (y0 + y1) / 2, t.z + d.z * (t.rOut - 0.5)), width: 2.5, height: y1 - y0, yaw: (deg * PI) / 180, passable: true };
  };
  return joinParts(part({
    fabric, nav,
    buildings: [{
      id: 'hollowtree', archetype: 'hollow-tree', zone: 'lanternrow',
      footprint: volumeOf(rect(t.x - t.rOut, t.x + t.rOut, t.z - t.rOut, t.z + t.rOut), 0, t.deck),
      storeys: [{ floorY: 0, height: t.wallTop }], roof: { y: t.deck, walkable: true },
    }],
    rooms: [{ building: 0, storey: 0, volume: volumeOf(rect(t.x - 4, t.x + 4, t.z - 4, t.z + 4), 0, t.wallTop) }],
    openings: [opening(0, 0, 3.6, 'arch'), opening(180, 0, 3.6, 'arch'), opening(90, 6.9, 9.3, 'leap'), opening(180, 4.9, 7.3, 'leap')],
    dress: [{
      style: 'hollow-trunk', enterable: true, marks: [], landings: boards,
      balconies: [volumeOf(rect(t.x - 6, t.x + 6, t.z - 6, t.z + 6), t.wallTop, t.deck)],
      stairs: [{ from: at3(0), to: at3(t.turns), width: 2 }],
      roof: { style: 'deck', nestCrown: true, pitchDeg: 0, ridge: null, eaves: t.wallTop, top: t.deck },
    }],
  }), props('lanternrow', [
    deco('canopy', t.x, t.z, 28, 28, 2, 28), deco('roots', t.x, t.z, 14, 14, 1.2), deco('branch-nest', t.x - 4, t.z + 5, 2, 2, 1, 20),
    deco('branch-nest', t.x + 5, t.z - 2, 2, 2, 1, 24), deco('hollow', t.x + 4.5, t.z + 2, 1.2, 0.5, 1.4, 8.5),
    deco('perch-pole', t.x - 5.5, t.z - 5.5, 0.3, 0.3, 3, t.deck), deco('moss', t.x, t.z - 6, 5, 2, 0.2),
  ]));
}

// ---------------------------------------------------------------------------------------------------------------
// Bell Tower (GDD §6.8): floors 0, 4.5, 9 and the belfry at 13.5; spire to 20; ladders through hatches
// ---------------------------------------------------------------------------------------------------------------

const BELL = { x0: -62, x1: -54, z0: -42, z1: -34, top: 18.1, spire: 20 } as const;

function bellTower(): SpecPart {
  const b = BELL;
  const building = shell({
    id: 'belltower', archetype: 'bell-tower', zone: 'oldsquare', style: 'belfry', nestCrown: true,
    x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, floors: [0, 4.5, 9, 13.5], top: b.top, roof: 'flat', parapet: [], material: 'stone',
    gaps: [
      { face: 'n', storey: 0, at: -58, kind: 'door', w: 3 },
      { face: 's', storey: 0, at: -58, kind: 'door', w: 3 },
      { face: 'n', storey: 1, at: -58, kind: 'window' }, { face: 'n', storey: 2, at: -58, kind: 'window' },
      // South: the window lines up under the leap window the Vine reaches.
      { face: 's', storey: 1, at: -56, kind: 'window', w: 2 }, { face: 's', storey: 2, at: -56, kind: 'leap', board: false },
      { face: 'e', storey: 1, at: -38, kind: 'window' }, { face: 'e', storey: 2, at: -38, kind: 'window' },
      { face: 'w', storey: 1, at: -38, kind: 'window' }, { face: 'w', storey: 2, at: -38, kind: 'balcony', w: 3 },
      // The belfry: an open arch on every face over a 1.2 m parapet.
      ...(['n', 's'] as const).map((face) => ({ face, storey: 3, at: -58, kind: 'arch' as const, h: 3, sill: 1.2 })),
      ...(['e', 'w'] as const).map((face) => ({ face, storey: 3, at: -38, kind: 'arch' as const, h: 3, sill: 1.2 })),
    ],
    ladders: [
      { storey: 0, x: -59.5, z: -38, in: 'e' }, { storey: 1, x: -58, z: -36.5, in: 's' }, { storey: 2, x: -56.5, z: -38, in: 'w' },
    ],
    // No rail: the rope walkway from the Hedgerow terrace roofs arrives over its outer edge.
    balconies: [{ face: 'w', storey: 2, from: -40, to: -36, rail: false }],
  });
  const withExtras = extend(building, {
    fabric: [column(-58, -38, 2.5, b.top, b.spire, 'roof')],
    climbs: [vine(-56, b.z0, 9.9, 0, 1)],
  });
  return joinParts(patchDress(withExtras, (d) => ({ ...d, roof: { ...d.roof, style: 'spire', top: b.spire } })), props('oldsquare', [
    deco('feather-banner', -62.2, -36, 0.1, 1.2, 4, 10.5, -PI / 2), deco('roost-rail', -58, -38, 8.6, 8.6, 0.2, b.top),
    deco('bird-bath', -58, -45.5, 1.6, 1.6, 0.9),
  ]));
}

// ---------------------------------------------------------------------------------------------------------------
// Market Hall (GDD §6.8): arcade onto the market square, gallery at 4, roof at 8.4, undercroft at −4
// ---------------------------------------------------------------------------------------------------------------

export const MARKET = { x0: -30, x1: -16, z0: -41, z1: -25, top: 8.4, gallery: 4, under: -4 } as const;
/** The undercroft (10 × 12), its passage south to the street grate, and the stair down from the hall. */
export const UNDERCROFT = rect(-27, -17, -39, -27);
export const PASSAGE = rect(-24.5, -21.5, -45, -39);
export const UNDER_STAIR = rect(-22, -20, -39, -31);
export const GRATE = rect(-24, -22, -44.5, -42.5);
/** Interior Chimney shaft centre: within 25 m of the Riverbank Hawk and of the Badger Sett. */
const MH_SHAFT = { x: -20.9, z: -27.3 } as const;

function marketHall(): SpecPart {
  const m = MARKET;
  // The shaft's opening spans the north gallery's depth and runs on to the north wall, so no sliver of gallery or
  // roof is left beside it.
  const shaft = rect(MH_SHAFT.x - 1.6, MH_SHAFT.x + 1.6, -28.5, m.z1);
  const arches = [-38.4, -34.8, -31.2, -27.6];
  const building = shell({
    id: 'markethall', archetype: 'market-hall', zone: 'oldsquare', style: 'market-stone',
    x0: m.x0, x1: m.x1, z0: m.z0, z1: m.z1, floors: [0], top: m.top, roof: 'flat', parapet: ['n', 's', 'e'], material: 'stone',
    cellar: { floor: m.under, ceiling: -0.4, r: UNDERCROFT },
    gaps: [
      ...arches.map((z) => ({ face: 'e' as const, storey: 0, at: z, kind: 'arch' as const })),
      // Gallery shot windows over the square (1.2 m above the gallery).
      ...arches.map((z) => ({ face: 'e' as const, storey: 0, at: z, kind: 'window' as const, sill: m.gallery + 1.2 })),
      // Jungle face: two doors under the two leap windows to the balcony (2 m wide, so the piers stay 0.5 m).
      { face: 'w', storey: 0, at: -39, kind: 'door', w: 2 }, { face: 'w', storey: 0, at: -27, kind: 'door', w: 2 },
      { face: 'w', storey: 0, at: -39, kind: 'leap', sill: m.gallery + 0.9, board: false },
      { face: 'w', storey: 0, at: -27, kind: 'leap', sill: m.gallery + 0.9, board: false },
      { face: 'n', storey: 0, at: -23, kind: 'door' }, { face: 's', storey: 0, at: -23, kind: 'door' },
    ],
    holes: [{ storey: 'roof', r: shaft, kind: 'void' }],
  });
  const g = m.gallery;
  const galleries = [rect(-29.5, -16.5, -28.5, -25.5), rect(-29.5, -16.5, -40.5, -37.5), rect(-19.5, -16.5, -37.5, -28.5)];
  const stairs: [Rect, 'n' | 's'][] = [[rect(-29.5, -27.5, -36.5, -28.5), 'n'], [rect(-27.5, -25.5, -37.5, -29.5), 's']];
  const u = UNDER_STAIR;
  const balcony = rect(-32, -30, -40, -26);
  const withExtras = extend(building, {
    fabric: [
      ...galleries.flatMap((r) => carve(r, [shaft]).map((q) => slabOf(q, g - 0.4, g, 'wood'))),
      ...stairs.map(([r, up]) => stairPrim(r, up, 0, g, 'wood')),
      // Down to the undercroft, railed both sides.
      stairPrim(u, 's', m.under, 0, 'stone'),
      block(u.x0 - 0.5, u.x0, u.z0, u.z1, 0, 1, 'wood'), block(u.x1, u.x1 + 0.5, u.z0, u.z1, 0, 1, 'wood'),
      // The jungle-side balcony at 4 m, reached through the gallery's leap windows.
      slabOf(balcony, g - 0.4, g, 'wood'), block(-32, -31.5, -40, -26, g, g + 1, 'wood'),
    ],
    nav: [
      v(-28.5, g, -27), v(-28.5, g, -39), v(-18, g, -33), v(-23, g, -39), v(-28.5, 0, -37.5), v(-26.5, 0, -28.5),
      v(-31, g, -33), v(-21, 0, -40), v(-21, -3.75, -30.5), v(-23, m.under, -41), v(-23, m.under, -44),
    ],
    climbs: [
      chimney(MH_SHAFT.x + 1.6, MH_SHAFT.z, m.top, 1, 0),
      vine(m.x1, -36.6, m.top, -1, 0),
      // The street grate: a ladder up from the passage (GDD §6.8).
      ladderClimb({ storey: 0, x: -23, z: GRATE.z0, in: 's' }, m.under, 0),
    ],
    openings: [
      { kind: 'door', rooms: [1, 0], centre: v(-21, 1.5, u.z0), width: 2, height: 3, yaw: PI, passable: true },
      { kind: 'grate', rooms: [1, -1], centre: v(-23, -0.2, -43.5), width: 2, height: 0.4, yaw: PI, passable: true },
    ],
  });
  return joinParts(patchDress(withExtras, (d) => ({
    ...d,
    stairs: [...d.stairs, ...stairs.map(([r, up]) => stairDress(r, up, 0, g)), stairDress(u, 's', m.under, 0)],
    balconies: [...d.balconies, ...galleries.map((r) => volumeOf(r, g - 0.4, g)), volumeOf(balcony, g - 0.4, g + 1)],
  })), props('oldsquare', [
    // Market counters (cover).
    { kind: 'counter', x: -24.75, z: -33.5, w: 0.5, d: 5, h: 1.2, solid: true },
    deco('seed-stall', -14.8, -38.4, 1.5, 2.5, 2.2), deco('seed-stall', -14.8, -31.2, 1.5, 2.5, 2.2),
    deco('feeder', -16.5, -27.6, 0.6, 0.6, 1.2, 5.5), deco('feather-banner', -15.9, -34.8, 0.1, 1.4, 3, 4.6, PI / 2),
    deco('worm-bed', -24, -36, 2, 3, 0.4, m.under), deco('insect-hive', -18, -36, 1, 1, 1.4, m.under),
  ]));
}

// ---------------------------------------------------------------------------------------------------------------
// Hides (GDD §6.8): 3 × 6 m sheds, 3.2 m tall, ivy in the door, a slit band to watch through
// ---------------------------------------------------------------------------------------------------------------

function hide(id: string, zone: string, r: Rect, door: { face: 'w' | 'e'; at: number }, slit: { face: 'n' | 'e'; at: number; w: number }): SpecPart {
  const h = shell({
    id, archetype: 'hide', zone, style: 'woven-reed', nestCrown: false,
    x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1, floors: [0], top: 3.2, roof: 'flat', parapet: [], material: 'wood',
    gaps: [
      { face: door.face, storey: 0, at: door.at, kind: 'door', w: 2, h: 2.8, curtain: true },
      { face: slit.face, storey: 0, at: slit.at, kind: 'slit', w: slit.w },
    ],
  });
  return { ...h, rooms: (h.rooms ?? []).map((room) => ({ ...room, tag: 'hide' as const })) };
}

// ---------------------------------------------------------------------------------------------------------------
// The quarter
// ---------------------------------------------------------------------------------------------------------------

const fills = joinParts(
  // Its west face leaves a 3 m alley from Granary Lane north to Lantern Row: Granary Lane's dogleg, now that the
  // Riverbank bridge's abutment closes its straight run to the lane (D-EP-053).
  fill({ id: 'lanternrow-block', archetype: 'block', zone: 'gatefields', r: rect(-25, -14, -88, -78), h: 8, roof: 'flat', material: 'brick', style: 'jungle-brick', faces: ['n', 's', 'e', 'w'], nestCrown: true }),
  // The gate lodge closes the strip along the base wall between the Hedgerow gate and the Granary.
  fill({ id: 'gate-lodge', archetype: 'block', zone: 'gatefields', r: rect(-32, -26, -114, -110), h: 6, roof: 'flat', material: 'brick', style: 'jungle-brick', faces: ['n', 'w'] }),
  fill({ id: 'riverside-block', archetype: 'block', zone: 'lanternrow', r: rect(-28, -16, -70, -64), h: 7, roof: 'flat', material: 'brick', style: 'jungle-brick', faces: ['n', 's', 'e'] }),
  fill({ id: 'tavern-row', archetype: 'block', zone: 'lanternrow', r: rect(-52, -42, -56, -51), h: 9, roof: 'flat', material: 'brick', style: 'jungle-brick', faces: ['n', 's', 'w'] }),
  fill({ id: 'old-square-house', archetype: 'block', zone: 'oldsquare', r: rect(-52, -40, -42, -30), h: 11, roof: 'flat', material: 'brick', style: 'jungle-brick', faces: ['n', 's', 'e', 'w'], nestCrown: true }),
  fill({ id: 'plaza-house', archetype: 'block', zone: 'oldsquare', r: rect(-66, -58, -12, -5), h: 7, roof: 'flat', material: 'brick', style: 'jungle-brick', faces: ['n', 'e', 'w'] }),
  fill({ id: 'sett-house', archetype: 'block', zone: 'oldsquare', r: rect(-30, -24, -16, -10), h: 6, roof: 'flat', material: 'brick', style: 'jungle-brick', faces: ['n', 's', 'w'] }),
);

/** Twig, Woven and Keepsake Nests of the quarter (GDD §6.10), less the lane-side ones (lanes.ts). Building indices
 * follow BUILDINGS' order below. */
const B = { granary: 0, warehouse: 1, tavern: 2, tree: 3, bell: 4, market: 5 } as const;
const nest = (x: number, y: number, z: number, variant: NestAnchor['variant'], building?: number, storey?: number): NestAnchor => ({
  ...at(x, y, z), variant, ...(building === undefined ? {} : { building }), ...(storey === undefined ? {} : { storey }),
});

const nests: NestAnchor[] = [
  nest(-47.5, 0, -68, 'twig', B.tavern, 0), nest(-33, 0, -61, 'twig'), nest(-55, 0, -40, 'twig', B.bell, 0),
  nest(-44, 0, -84, 'twig', B.warehouse, 0), nest(-30, 0, -80, 'twig', B.warehouse, 0), nest(-17, 5.2, -105, 'twig', B.granary, 1),
  nest(-24, 0, -30, 'twig', B.market, 0), nest(-36, 8, -88, 'twig'), nest(-8.5, 0, -62, 'twig'),
  nest(-70, 0, -30, 'twig'), nest(-58, 0, -50, 'twig'), nest(-24, 0, -71, 'twig'),
  nest(-34, 0, -86, 'woven', B.warehouse, 0), nest(-28, -4.5, -64, 'woven', undefined, -1),
  nest(-46, -4.5, -66, 'woven', B.tavern, -1), nest(-20, -4, -30, 'woven', B.market, -1),
  nest(-62.5, 12, -62, 'keepsake'), nest(-38, 4, -90.5, 'keepsake', B.warehouse, 0), nest(-28.5, 4, -39, 'keepsake', B.market, 0),
];

const thickets: ThicketAnchor[] = [
  { ...at(-65, 0, -22), tier: 1, family: 'beetles' },
  { ...at(-30, 0, -52), tier: 1, family: 'beetles' },
  { ...at(-60, 0, -80), tier: 2, family: 'weasels' },
  { ...at(-21, 1.2, -103), tier: 2, family: 'rats', building: B.granary, storey: 0 },
  { ...at(-23, -4, -33), tier: 2, family: 'toads', building: B.market, storey: -1 },
  { ...at(-40, 0, -12), tier: 3, family: 'badgers' },
];

const interactables: InteractableAnchor[] = [
  { ...at(-58, 13.5, -38), kind: 'feeder', building: B.bell, storey: 3 },
  { ...at(-21, 5.2, -101), kind: 'feeder', building: B.granary, storey: 1, camp: 3 },
  { ...at(-58, 13.5, -38), kind: 'lookout', building: B.bell, storey: 3 },
  { ...at(-62.5, 12, -62), kind: 'lookout' },
  { ...at(-56, 13.5, -36), kind: 'berry', building: B.bell, storey: 3 },
  { ...at(-63, 12, -60), kind: 'berry' },
  { ...at(-18, 8.4, -27), kind: 'berry' },
  { ...at(-30, 8, -80), kind: 'berry' },
];

const outline = (x0: number, x1: number, z0: number, z1: number): Vec3[] => [v(x0, 0, z0), v(x0, 0, z1), v(x1, 0, z1), v(x1, 0, z0)];
const path = (...pts: [number, number][]): Vec3[] => pts.map(([x, z]) => v(x, 0, z));

const zones = part({
  jungle: [
    { id: 'gatefields', half: 'dawn', outline: outline(-76, -9, -114, -88), paths: [path([-50, -95], [-9, -95])] },
    { id: 'lanternrow', half: 'dawn', outline: outline(-76, -9, -88, -44), paths: [path([-54, -74], [-9, -74]), path([-73, -86], [-73, -44])] },
    {
      id: 'oldsquare', half: 'dawn', outline: outline(-76, -9, -44, 0),
      paths: [path([-73, -44], [-73, -4]), path([-73, -45], [-14, -45]), path([-84, 0], [-50, 0], [-22, 0])],
    },
  ],
});

const STAND_Y = 4.5;

/**
 * The Riverbank bridge (D-EP-053), west half (the quarter's x-mirror gives the east half): a 3 m deck at 6 m (8.5 m over
 * the cutting's floor, under the Updraft rider's clearance) across the lane and the river at z −97.5…−94.5, rails on
 * both edges (open at the stair head), a stone abutment under its west end, and a 12 m stair up from the north. The abutment and the stair also close Granary Lane's straight run onto the
 * lane, so it reaches the Riverbank through the alley to Lantern Row.
 */
const RIVER_DECK = 6;
const RIVER_BRIDGE: BlockoutPrim[] = [
  block(-14, 0, -97.5, -94.5, RIVER_DECK - 0.4, RIVER_DECK, 'stone'),
  block(-14, 0, -97.5, -97, RIVER_DECK, RIVER_DECK + 1, 'stone'),
  block(-12, 0, -95, -94.5, RIVER_DECK, RIVER_DECK + 1, 'stone'),
  block(-14, -13, -98, -94.5, 0, RIVER_DECK - 0.4, 'stone'),
  ramp(-14, -12, -94.5, -82.5, 0, RIVER_DECK, 's', 'stone'),
];

/** A roost stand (D-EP-048): a deck on four stilts at 4.5 m and a stair up to it, rising toward `up`. */
function roostStand(deck: Rect, stair: Rect, up: 'n' | 's'): BlockoutPrim[] {
  return [
    slabOf(deck, STAND_Y - 0.4, STAND_Y, 'wood'),
    ...stilts(deck.x0, deck.x1, deck.z0, deck.z1, STAND_Y - 0.4),
    ramp(stair.x0, stair.x1, stair.z0, stair.z1, 0, STAND_Y, up, 'wood'),
  ];
}

/** Open yards, cover, roof links and the outdoor climbs and Springs of the quarter. */
const grounds = joinParts(
  part({
    prims: [
      ...yard(-60, -80, 12, ['s', 'e'], 'stone'),
      ...yard(-30, -52, 12, ['n', 'w'], 'stone'),
      ...yard(-65, -22, 12, ['n', 'e'], 'stone'),
      ...yard(-40, -12, 14, ['n', 'e'], 'stone'),
      // From the Market Hall roof (8.4) up to the Old Square house (11).
      ramp(-40, -30, -32, -30, 8.4, 11, 'w', 'wood'),
      // Rope walkways (D-EP-048): Warehouse roof to the Lantern Row block, Tavern-row roof to the Old Square house,
      // and the Hedgerow terrace roofs to the Bell Tower balcony.
      block(-28, -25, -84, -82.5, 7.7, 8, 'wood'),
      block(-47, -45.5, -51, -42, 8.7, 9, 'wood'),
      ramp(-76, -64, -39.5, -38, 8, 9, 'e', 'wood'),
      // Roost stands on the Riverbank's west edge (east bank in the mirror): 4.5 m decks on stilts with a stair
      // each, and a deck over the Market Hall's south arch, so a stair to a raised spot comes every 40 m (G20).
      ...roostStand(rect(-12.5, -9, -106, -102), rect(-11.5, -9.5, -114, -106), 'n'),
      ...roostStand(rect(-14, -10.5, -24, -20), rect(-14, -12, -32, -24), 'n'),
      ...RIVER_BRIDGE,
      block(-16, -14, -41, -38, 3.6, 4, 'wood'),
      ramp(-16, -14, -49, -41, 0, 4, 'n', 'wood'),
    ],
    climbs: [vine(-22, -88, 8, 0, 1), vine(-52, -36, 11, 1, 0), vine(-58, -8, 7, -1, 0)],
    nav: [
      v(-50, 0, -92), v(-52, 0, -18), v(-27, 7.9, -83.2), v(-46.2, 9, -46.5), v(-70, 8.5, -38.7),
      v(-10.75, STAND_Y, -104), v(-10.5, 0, -115), v(-12.25, STAND_Y, -22),
      v(-13, 0, -81.5), v(-13, RIVER_DECK / 2, -88.5), v(-13, 4.75, -92), v(-13, RIVER_DECK, -96), v(-7, RIVER_DECK, -96), v(-1.5, RIVER_DECK, -96),
      v(-13, 0, -33), v(-15, 4, -39.5), v(-15, 0, -50),
    ],
    springs: [
      { pad: v(-68, 0, -44), radius: 1.2, land: v(-63, 9, -38), apexY: 11 },
      { pad: v(-20, 0, -52), radius: 1.2, land: v(-22, MARKET.top, -37), apexY: 11.5 },
    ],
  }),
  props('lanternrow', [
    // Crate stacks (3 m) across Lantern Row, staggered so no straight sightline runs its length (GDD §6.5).
    crate(-41, -75.5, 3, 2, 5), crate(-29, -72.5, 3, 2, 5),
    ...[-52, -46, -40, -34, -28, -22, -16].flatMap((x, i) => [deco('lantern', x, i % 2 ? -70.6 : -77.4, 0.4, 0.4, 3.2), deco('wire', x + 3, -74, 6, 0.05, 0.05, 6.5)]),
    deco('worm-bed', -36, -66.5, 3, 2, 0.3), deco('insect-hive', -39, -72, 0.9, 0.9, 1.5), deco('nest-pile', -55.5, -71, 2, 2, 1),
  ]),
  props('gatefields', [
    { kind: 'cart', x: -46.5, z: -94.5, w: 3, d: 3, h: 1.5, solid: true }, deco('seed-stall', -33, -96, 2.5, 1.5, 2.2),
    deco('feeder', -21, -96.5, 0.6, 0.6, 1.4, 2), deco('nest-pile', -12, -100, 1.5, 1.5, 0.8), deco('bramble', -60, -80, 6, 6, 1.2),
  ]),
  props('oldsquare', [
    { kind: 'crate', x: -51.5, z: -24.5, w: 3, d: 3, h: 1.5, solid: true }, { kind: 'crate', x: -34.5, z: -41.75, w: 3, d: 5.5, h: 3, solid: true },
    deco('fountain', -36, -24, 3, 3, 1.2), deco('bird-bath', -66, -44, 1.2, 1.2, 0.9), deco('feather-banner', -52.1, -36, 0.1, 1.4, 4, 6, -PI / 2),
    deco('worm-bed', -65, -22, 4, 4, 0.3), deco('bramble', -40, -12, 8, 8, 1.4), deco('branch-nest', -45, -36, 2, 2, 1, 11.2),
    deco('perch-pole', -40.5, -30.5, 0.3, 0.3, 2.5, 11), deco('wire', -54, -46.5, 12, 0.05, 0.05, 7), deco('roost-rail', -46, -42, 12, 0.2, 0.2, 11),
  ]),
);

/** The quarter's buildings, in the order the B indices above assume, then the Hides. */
const buildings = joinParts(
  granary(), warehouse(), tavern(), hollowTree(), bellTower(), marketHall(),
  hide('hide-oldsquare', 'oldsquare', rect(-47, -41, -49.5, -46.5), { face: 'w', at: -48 }, { face: 'n', at: -44, w: 4 }),
  hide('hide-gardens', 'hedgerow', rect(-124.5, -121.5, -43, -37), { face: 'e', at: -41.5 }, { face: 'e', at: -39, w: 2 }),
);

/** The west jungle quarter of the Dawn half: buildings first (anchor indices count from them). */
export const JUNGLE_QUARTER: SpecPart = joinParts(extend(buildings, { nests, thickets, interactables }), fills, grounds, zones);
