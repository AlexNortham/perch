/**
 * Interiors (style guide §5.9): every storey room gets ceiling joists, skirting, a rug or woven mat, a warm lantern
 * and wall dressing chosen by archetype (shelves of jars, seed bins, perch rails, nest-bed alcoves, a hearth with a
 * hanging pot, nectar kegs, sacks and grain heaps, crate stacks, pegs hung with feathers and bundles), all kept against
 * the walls and clear of doors, stairs, ladders, hatches, Chimneys, camps and Nests. Ladders get rails and rungs.
 * Interior pieces are band 0/1 (not drawn far away, §11.4) and 28 % darker in baked ambient (§10.3). Authored art data.
 */
import { Vector3 } from 'three';
import type { BoxVolume, Room, Vec3 } from '../../../../sim/core/contracts';
import { SHADE } from '../constants';
import type { Band } from '../constants';
import { oriented, placed } from '../mesher';
import type { Mesher } from '../mesher';
import { hash2 } from '../world';
import type { Pass, World } from '../world';
import { barrel, hangingFeeder, inPrim, lantern } from './buildings';
import { nest, perchRail } from './nest';
import { bowl, bunting, crateAt, openSack, sack } from './props';
import { POT, ROPE, TWIG } from './styles';
import { carve, rect } from '../../../../sim/world/map/data/interiors';

interface Blocker {
  readonly x: number;
  readonly z: number;
  readonly r: number;
  readonly y0: number;
  readonly y1: number;
}

/** What a room's dressing keeps clear of: everything, the holes in floors and ceilings, and the openings in walls. */
interface Clearances {
  readonly blockers: readonly Blocker[];
  readonly holes: readonly Blocker[];
  readonly gaps: readonly Blocker[];
}

/** Trading halls: one taller than HALL_HEIGHT (m) gets bunting. */
const HALLS = new Set(['market-hall', 'water-mill', 'warehouse', 'seed-exchange']);
const HALL_HEIGHT = 5;
/** Market bunting pennants: madder, woad and weld. */
const BUNTING = [0xc0583a, 0x3a72a8, 0xd0a840] as const;
const TIMBER = { mat: 'timber' } as const;
const DARK = { mat: 'timberDark' } as const;
const LANDING_BOARD = { mat: 'boards', tint: 0xf2e8d6 } as const;

export function dressInteriors(w: World): void {
  const map = w.map;
  const buildings = map.buildings ?? [];
  // Everything an interior piece must keep clear of, as vertical discs.
  const blockers: Blocker[] = [];
  // Holes in floors and ceilings (hatches, grates, skylights, Chimneys, stairwells): floors and joists leave them open.
  const holes: Blocker[] = [];
  // The openings themselves, tight: wainscot breaks only where a doorway or arch cuts the wall.
  const gaps: Blocker[] = [];
  for (const o of map.openings ?? []) {
    const hole = o.kind === 'hatch' || o.kind === 'skylight' || o.kind === 'grate';
    const passable = o.kind !== 'window';
    // Only a hole in a floor or ceiling keeps the climb below it clear; a door or window blocks its own height.
    const b = { x: o.centre.x, z: o.centre.z, r: Math.max(o.width, hole ? 2.2 : 0) / 2 + (passable ? 1.4 : 0.4), y0: o.centre.y - o.height / 2 - (hole ? 4.2 : 0.2), y1: o.centre.y + o.height / 2 + 0.2 };
    blockers.push(b);
    if (hole) holes.push(b);
    else gaps.push({ ...b, r: o.width / 2 + 0.1 });
  }
  for (const c of map.climbs) {
    const b = { x: c.bottom.x, z: c.bottom.z, r: c.kind === 'chimney' ? 2.4 : 1.6, y0: c.bottom.y - 0.5, y1: c.top.y + 0.5 };
    blockers.push(b);
    if (c.kind === 'chimney') holes.push(b);
  }
  for (const d of map.dressing?.buildings ?? []) {
    for (const s of d.stairs) {
      const n = Math.max(2, Math.ceil(Math.hypot(s.to.x - s.from.x, s.to.z - s.from.z) / 1.5));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const x = s.from.x + (s.to.x - s.from.x) * t;
        const z = s.from.z + (s.to.z - s.from.z) * t;
        const y = s.from.y + (s.to.y - s.from.y) * t;
        // Furniture keeps head room over each step; the stairwell is open from each step up to the stair's top.
        blockers.push({ x, z, r: s.width / 2 + 0.9, y0: y - 0.5, y1: y + 3 });
        holes.push({ x, z, r: s.width / 2 + 0.9, y0: y - 0.5, y1: Math.max(s.from.y, s.to.y) + 0.3 });
      }
    }
  }
  for (const a of [...map.nests, ...map.thickets, ...(map.interactables ?? [])]) blockers.push({ x: a.pos.x, z: a.pos.z, r: 1.8, y0: a.pos.y - 0.5, y1: a.pos.y + 2.5 });
  for (const p of map.dressing?.props ?? []) blockers.push({ x: p.pos.x, z: p.pos.z, r: Math.hypot(p.size.x, p.size.z) / 2 + 0.4, y0: p.pos.y - 0.2, y1: p.pos.y + p.size.y });
  const solids = map.prims.filter((q) => q.solid);

  (map.rooms ?? []).forEach((room, ri) => {
    if (room.building < 0 || room.tag === 'tunnel') return;
    const b = buildings[room.building];
    if (!b) return;
    // Only what is near the room matters: keeps the per-slot checks short (load time).
    const reach = Math.hypot(room.volume.size.x, room.volume.size.z) / 2 + 6;
    const near = (x: number, z: number): boolean => Math.hypot(x - room.volume.centre.x, z - room.volume.centre.z) < reach;
    const by = (k: Blocker): boolean => near(k.x, k.z);
    furnish(w, room, b.archetype, 6100 + ri * 41, { blockers: blockers.filter(by), holes: holes.filter(by), gaps: gaps.filter(by) }, solids.filter((q) => near(q.centre.x, q.centre.z) || (q.shape !== 'cylinder' && Math.max(q.size.x, q.size.z) > reach)));
  });
  map.climbs.forEach((c, i) => {
    if (c.kind === 'ladder') ladder(w, c.bottom, c.top, c.out, 6000 + i);
  });
}

function clear(blockers: readonly Blocker[], x: number, y: number, z: number, r: number): boolean {
  return !blockers.some((b) => y > b.y0 && y < b.y1 && Math.hypot(b.x - x, b.z - z) < b.r + r);
}

function furnish(w: World, room: Room, archetype: string, seed: number, { blockers, holes, gaps }: Clearances, solids: readonly import('../../../../sim/core/contracts').BlockoutPrim[]): void {
  const v: BoxVolume = room.volume;
  const floor = v.centre.y - v.size.y / 2;
  const ceil = v.centre.y + v.size.y / 2;
  const hx = v.size.x / 2;
  const hz = v.size.z / 2;
  const frame = placed(v.centre.x, 0, v.centre.z, v.yaw);
  const M = (band: Band, pass: Pass = 'opaque'): Mesher => {
    const g = w.m(pass, band, v.centre.x, v.centre.z, floor);
    g.frame.copy(frame);
    g.ambient = SHADE.interior;
    return g;
  };
  const world = (x: number, z: number): Vec3 => {
    const c = Math.cos(v.yaw);
    const s = Math.sin(v.yaw);
    return { x: v.centre.x + x * c + z * s, y: floor, z: v.centre.z - x * s + z * c };
  };
  const free = (x: number, z: number, r: number, y = floor + 0.6): boolean => {
    const p = world(x, z);
    return clear(blockers, p.x, y, p.z, r) && !solids.some((q) => inPrim(q, { x: p.x, y, z: p.z }, r * 0.6));
  };
  const height = ceil - floor;

  // Ceiling joists every 1.2 m across the shorter span, clear of holes above.
  if (height > 2.6) {
    const g = M(1);
    g.paint(DARK, seed);
    const alongX = hx <= hz;
    const span = alongX ? hz : hx;
    for (let t = -span + 0.6; t < span; t += 1.2) {
      const [x, z] = alongX ? [0, t] : [t, 0];
      const p = world(x, z);
      if (!clear(holes, p.x, ceil - 0.2, p.z, 0)) continue;
      if (alongX) g.span(-hx, hx, ceil - 0.24, ceil - 0.02, t - 0.1, t + 0.1);
      else g.span(t - 0.1, t + 0.1, ceil - 0.24, ceil - 0.02, -hz, hz);
    }
  }
  // A floor where the ground shows (ground floors and cellars stand on the terrain): boards in timber and woven
  // buildings, flagstones in stone ones, with the stair, hatch and Chimney holes left open.
  if (room.storey <= 0) {
    const style = w.dressing.buildings[room.building]?.style ?? '';
    const stone = /stone|belfry|dovecote|brick/.test(style);
    const c = Math.cos(v.yaw);
    const s = Math.sin(v.yaw);
    const open = holes.filter((b) => b.y0 < floor + 0.5 && b.y1 > floor + 0.2).map((b) => {
      const dx = b.x - v.centre.x;
      const dz = b.z - v.centre.z;
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      const r = b.r * 0.6;
      return rect(lx - r, lx + r, lz - r, lz + r);
    });
    const gf = M(1);
    gf.ambient = SHADE.interior;
    gf.paint(stone ? { mat: 'flagstone', tint: 0xe8e0d0 } : { mat: 'boards', tint: 0xd8c4a8 }, seed);
    for (const r of carve(rect(-hx, hx, -hz, hz), open)) {
      gf.poly([new Vector3(r.x0, floor + 0.012, r.z0), new Vector3(r.x1, floor + 0.012, r.z0), new Vector3(r.x1, floor + 0.012, r.z1), new Vector3(r.x0, floor + 0.012, r.z1)], new Vector3(0, 1, 0));
    }
  }
  // Timber wainscot panelling (1.1 m) round the walls, broken at doorways and arches (window sills sit above it).
  {
    const gw = M(1);
    gw.paint({ mat: 'timber', tint: 0xc8a888 }, seed + 1);
    const sides: [number, number, number, number, boolean][] = [[-hx, hx, -hz, 1, true], [-hx, hx, hz, -1, true], [-hz, hz, -hx, 1, false], [-hz, hz, hx, -1, false]];
    for (const [a, b, at, dir, alongX] of sides) {
      for (let u = a + 0.05; u < b - 0.4; u += 1.2) {
        const [x, z] = alongX ? [u + 0.6, at] : [at, u + 0.6];
        const p = world(x, z);
        if (!clear(gaps, p.x, floor + 0.6, p.z, 0.6)) continue;
        const e = Math.min(u + 1.18, b);
        if (alongX) gw.poly([new Vector3(u, floor, at + dir * 0.035), new Vector3(e, floor, at + dir * 0.035), new Vector3(e, floor + 1.1, at + dir * 0.035), new Vector3(u, floor + 1.1, at + dir * 0.035)], new Vector3(0, 0, dir));
        else gw.poly([new Vector3(at + dir * 0.035, floor, u), new Vector3(at + dir * 0.035, floor, e), new Vector3(at + dir * 0.035, floor + 1.1, e), new Vector3(at + dir * 0.035, floor + 1.1, u)], new Vector3(dir, 0, 0));
      }
    }
  }
  // A rug or woven mat in the middle (flat; skipped over holes and stairs).
  if (free(0, 0, Math.min(hx, hz) * 0.4, floor + 0.3)) {
    const g = M(0);
    const rx = Math.min(hx * 0.55, 2.4);
    const rz = Math.min(hz * 0.55, 1.7);
    const woven = hash2(seed, 1) < 0.4;
    g.paint(woven ? TWIG : { mat: 'canvas', tint: [0x9a6a58, 0x6a7a8a, 0x8a7a50][Math.floor(hash2(seed, 2) * 3)] }, seed).span(-rx, rx, floor, floor + 0.015, -rz, rz);
    if (!woven) g.paint({ mat: 'canvas', tint: 0xc8b890 }, seed).span(-rx + 0.15, rx - 0.15, floor + 0.015, floor + 0.022, -rz + 0.15, rz - 0.15);
  }
  // A warm lantern hanging from the middle joist (emissive, §10.3).
  if (height > 2.8 && free(0, 0, 0.3, ceil - 1)) {
    const g = M(1);
    g.paint(ROPE, seed).tube([new Vector3(0.6, ceil - 0.24, 0), new Vector3(0.6, ceil - 0.9, 0)], 0.012, 3);
    lantern(g, 0.6, ceil - 0.9, 0, seed);
  }
  // Nest baskets slung from the joists on three ropes in two corners, high over the floor (birds live here).
  if (height > 3.2 && hx > 2.2 && hz > 2.2) {
    const g = M(1);
    const y = ceil - 1.25;
    for (const [sx, sz] of ([[-1, -1], [1, 1], [1, -1], [-1, 1]] as const).filter((_, i) => hash2(seed, 40 + i) < 0.5).slice(0, 2)) {
      const x = sx * (hx - 1.2);
      const z = sz * (hz - 1.2);
      if (!free(x, z, 0.4, y)) continue;
      g.paint(ROPE, seed);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        g.tube([new Vector3(x, ceil - 0.24, z), new Vector3(x + Math.cos(a) * 0.3, y + 0.2, z + Math.sin(a) * 0.3)], 0.01, 3);
      }
      nest(g, x, y, z, 0.34, 0.24, seed + sx * 3 + sz, hash2(seed, sx + sz * 7) < 0.4 ? 1 : 0, 6);
    }
  }
  // Trading halls two storeys high (Market Hall, mill, warehouse, Seed Exchange): two lines of feather bunting down the long axis, high
  // over head height, so the tall plaster above the wall dressing reads as a market, not a void.
  if (height > HALL_HEIGHT && HALLS.has(archetype)) {
    const g = M(1);
    const alongX = hx >= hz;
    const [long, short] = alongX ? [hx, hz] : [hz, hx];
    // Under the roof, above any gallery: a bird walking a gallery passes well under it.
    const y = ceil - 0.9;
    for (const s of [-1, 1]) {
      const off = (s * short) / 3;
      g.within(alongX ? placed(0, 0, off, 0) : placed(off, 0, 0, Math.PI / 2), () => {
        bunting(g, -long + 0.1, long - 0.1, y, 0.5, BUNTING[Math.floor(hash2(seed, 50 + s) * BUNTING.length)] ?? BUNTING[0]!, seed + s);
      });
    }
  }

  // Wall dressing: walk each wall in 1.6 m slots.
  const walls: { yaw: number; half: number; at: (u: number, d: number) => [number, number] }[] = [
    { yaw: 0, half: hx, at: (u, d) => [u, -hz + d] },
    { yaw: Math.PI, half: hx, at: (u, d) => [-u, hz - d] },
    { yaw: Math.PI / 2, half: hz, at: (u, d) => [-hx + d, -u] },
    { yaw: -Math.PI / 2, half: hz, at: (u, d) => [hx - d, u] },
  ];
  let slot = 0;
  for (const wall of walls) {
    const g = M(0);
    // Skirting along the wall's foot.
    g.paint(DARK, seed + slot);
    for (let u = -wall.half; u < wall.half - 0.2; u += 1.6) {
      const [x, z] = wall.at(u + 0.8, 0.3);
      if (!free(x, z, 0.2, floor + 0.3)) continue;
      g.within(placed(...pos3(wall.at(u + 0.8, 0.02), floor), wall.yaw), () => g.span(-0.8, 0.8, 0, 0.16, 0, 0.03));
    }
    for (let u = -wall.half + 1.0; u < wall.half - 0.9; u += 1.35) {
      slot++;
      const s = seed + slot * 7;
      const [x, z] = wall.at(u, 0.45);
      if (!free(x, z, 0.7)) continue;
      const pick = hash2(s, 1);
      // A tall piece also needs its top clear (window sills sit at 1.2 m); otherwise a low one stands there instead.
      let kind = choose(archetype, pick);
      const tall = TALL[kind];
      if (tall !== undefined && !free(x, z, 0.6, floor + Math.min(tall, height - 0.3))) kind = low(archetype, pick);
      const g1 = M(pick < 0.5 ? 0 : 1);
      g1.within(placed(...pos3(wall.at(u, 0), floor), wall.yaw), () => wallPiece(g1, kind, height, s, M));
    }
  }
}

const pos3 = ([x, z]: [number, number], y: number): [number, number, number] => [x, y, z];

/** One piece against a wall, in a frame at the wall's foot facing into the room (+z). */
function wallPiece(g: Mesher, kind: Piece, height: number, seed: number, M: (band: Band, pass?: Pass) => Mesher): void {
  switch (kind) {
    case 'shelf': {
      g.paint(TIMBER, seed);
      for (const s of [-1, 1]) g.span(s * 0.7 - 0.04, s * 0.7 + 0.04, 0, 2.1, 0.02, 0.4);
      for (const y of [0.5, 1.1, 1.7]) {
        g.span(-0.72, 0.72, y - 0.03, y, 0.02, 0.4);
        for (let k = 0; k < 4; k++) {
          const x = -0.5 + k * 0.33;
          if (hash2(seed, k + y) < 0.6) g.paint(hash2(seed, k) < 0.5 ? POT : { mat: 'glass', tint: 0xa8c0b8, shade: 2 }, seed + k).within(placed(x, y, 0.22, 0), () => g.lathe([[0.08, 0], [0.1, 0.07], [0.09, 0.18], [0.05, 0.22], [0.06, 0.24]], 7));
          else sack(g, x, y, 0.22, 0.1, seed + k);
        }
        g.paint(TIMBER, seed);
      }
      return;
    }
    case 'pegs': {
      // A peg rail hung with feathers, a twig bundle and a coil of rope.
      g.paint(DARK, seed).span(-0.8, 0.8, 1.55, 1.65, 0.02, 0.07);
      for (let k = 0; k < 4; k++) g.tube([new Vector3(-0.6 + k * 0.4, 1.58, 0.05), new Vector3(-0.6 + k * 0.4, 1.62, 0.2)], 0.02, 4);
      g.paint(TWIG, seed).within(oriented(-0.6, 1.25, 0.17, 0, 0, 0), () => g.lathe([[0.06, -0.3], [0.08, 0], [0.05, 0.3]], 6));
      g.paint(ROPE, seed).within(oriented(0.2, 1.38, 0.18, 0, Math.PI / 2), () => g.lathe([[0.18, -0.03], [0.2, 0], [0.18, 0.03], [0.14, 0]], 10));
      const gc = M(0, 'cutout');
      gc.frame.copy(g.frame);
      for (let k = 0; k < 3; k++) gc.paint({ mat: 'featherCard', tint: [0xf0e8d8, 0xb8a890, 0x9aa0b0][k] }, seed + k).card2(new Vector3(-0.2 + k * 0.4 + 0.2, 1.3, 0.19), new Vector3(0.05, 0, 0), new Vector3(0.02, 0.24, 0));
      return;
    }
    case 'rail': {
      perchRail(g, -0.75, 0.75, 1.1, TIMBER, seed);
      bowl(g, 0, 0.0, 0.35, 0.22, seed);
      return;
    }
    case 'bin': {
      g.paint(TIMBER, seed).span(-0.55, 0.55, 0, 0.95, 0.05, 0.65, 0.02);
      g.paint({ mat: 'gravel', tint: 0xe0c890 }, seed).span(-0.5, 0.5, 0.9, 0.97, 0.1, 0.6);
      g.paint(DARK, seed).within(oriented(0, 1.15, 0.1, 0, -1.1), () => g.box(0, 0, 0, 1.12, 0.05, 0.6, 0.01));
      return;
    }
    case 'nestbed': {
      nest(g, 0, 0, 0.85, 0.8, 0.45, seed, hash2(seed, 3) < 0.5 ? 1 : 0, 10);
      g.paint({ mat: 'canvas', tint: 0xe8dcc8 }, seed).within(placed(0, 0.18, 0.85, 0), () => g.lathe([[0.55, 0], [0.3, 0.06], [0.001, 0.08]], 9));
      return;
    }
    case 'hearth': {
      g.paint({ mat: 'brick' }, seed).span(-0.9, 0.9, 0, 1.3, 0.02, 0.5, 0.02);
      g.paint({ mat: 'brickBurnt', shade: 0.35 }, seed).span(-0.55, 0.55, 0.12, 0.9, 0.45, 0.51);
      g.paint({ mat: 'ashlar' }, seed).span(-1.0, 1.0, 1.3, 1.42, 0.0, 0.62, 0.02);
      g.paint({ mat: 'lantern', tint: 0xff9a50 }, seed).span(-0.35, 0.35, 0.12, 0.22, 0.2, 0.42);
      g.paint({ mat: 'iron' }, seed).within(placed(0, 0.55, 0.35, 0), () => g.lathe([[0.001, 0], [0.18, 0.04], [0.22, 0.2], [0.18, 0.3]], 9));
      if (height > 3) g.paint({ mat: 'brick' }, seed).span(-0.5, 0.5, 1.42, height, 0.02, 0.45);
      return;
    }
    case 'kegs': {
      barrel(g, -0.45, 0, 0.45, 0.38, 0.9, seed);
      barrel(g, 0.45, 0, 0.45, 0.38, 0.9, seed + 1);
      g.paint(TIMBER, seed).within(oriented(0, 1.2, 0.4, Math.PI / 2, Math.PI / 2), () => g.lathe([[0.3, -0.4], [0.34, 0], [0.3, 0.4]], 9));
      return;
    }
    case 'sacks': {
      sack(g, -0.4, 0, 0.4, 0.3, seed);
      sack(g, 0.35, 0, 0.35, 0.28, seed + 1, 0xc8b48c);
      openSack(g, 0, 0.0, 0.85, 0.22, seed + 2);
      return;
    }
    case 'grain': {
      g.paint({ mat: 'gravel', tint: 0xe0c890 }, seed).within(placed(0, 0, 0.7, 0), () => g.lathe([[1.0, 0], [0.6, 0.3], [0.001, 0.5]], 10));
      g.paint({ mat: 'thatch', tint: 0xe8d8a8 }, seed).span(-0.8, 0.8, 0, 0.6, 0.02, 0.4, 0.05);
      return;
    }
    case 'crates': {
      crateAt(g, -0.4, 0, 0.45, 0.8, 0.8, 0.8, seed);
      crateAt(g, 0.45, 0, 0.45, 0.7, 0.7, 0.7, seed + 1);
      crateAt(g, -0.35, 0.8, 0.45, 0.7, 0.6, 0.7, seed + 2);
      return;
    }
    case 'cubbies': {
      // A wall of nest cubbies: a 3 × 3 timber grid, nests in some, a perch peg under each row.
      g.paint(TIMBER, seed);
      for (let i = 0; i <= 3; i++) g.span(-0.75 + i * 0.5 - 0.03, -0.75 + i * 0.5 + 0.03, 0.4, 1.95, 0.02, 0.45);
      for (let j = 0; j <= 3; j++) g.span(-0.78, 0.78, 0.4 + j * 0.5 - 0.03, 0.4 + j * 0.5 + 0.03, 0.02, 0.45);
      g.paint({ mat: 'boards', shade: 0.6 }, seed).span(-0.75, 0.75, 0.4, 1.9, 0.02, 0.05);
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          if (hash2(seed, i * 3 + j) < 0.55) nest(g, -0.5 + i * 0.5, 0.43 + j * 0.5, 0.25, 0.19, 0.14, seed + i * 3 + j, hash2(seed, i + j * 5) < 0.3 ? 1 : 0, 5);
        }
        g.paint(TIMBER, seed).tube([new Vector3(-0.78, 0.38 + i * 0.5, 0.5), new Vector3(0.78, 0.38 + i * 0.5, 0.5)], 0.015, 4);
      }
      return;
    }
    case 'sorting': {
      // A sorting table: trays of seed sorted by kind, a scoop, a sieve.
      g.paint(TIMBER, seed).span(-0.8, 0.8, 0.82, 0.88, 0.1, 0.8, 0.01);
      for (const sx of [-0.7, 0.7]) for (const sz of [0.18, 0.72]) g.span(sx - 0.04, sx + 0.04, 0, 0.82, sz - 0.04, sz + 0.04);
      for (let k = 0; k < 3; k++) {
        const x = -0.5 + k * 0.5;
        g.paint({ mat: 'timber', tint: 0xd8c4a0 }, seed + k).span(x - 0.22, x + 0.22, 0.88, 0.94, 0.25, 0.65);
        g.paint({ mat: 'gravel', tint: [0xe0c890, 0x8a6a48, 0xb89060][k] }, seed + k).span(x - 0.19, x + 0.19, 0.9, 0.95, 0.28, 0.62);
      }
      g.paint({ mat: 'twig' }, seed).within(placed(0.55, 0.88, 0.85, 0), () => g.lathe([[0.18, 0], [0.2, 0.06], [0.18, 0.07]], 10));
      return;
    }
    case 'roost': {
      // A roost shelf: three staggered perch boards and dowels up the wall, a feather or two below.
      for (let k = 0; k < 3; k++) {
        const y = 0.9 + k * 0.55;
        const x = (k - 1) * 0.35;
        g.paint(LANDING_BOARD, seed + k).span(x - 0.4, x + 0.4, y - 0.04, y, 0.02, 0.32);
        g.paint(TIMBER, seed).span(x - 0.36, x - 0.3, y - 0.22, y - 0.04, 0.02, 0.28);
        g.span(x + 0.3, x + 0.36, y - 0.22, y - 0.04, 0.02, 0.28);
        g.tube([new Vector3(x - 0.4, y + 0.12, 0.3), new Vector3(x + 0.4, y + 0.12, 0.3)], 0.018, 4);
      }
      g.paint({ mat: 'gravel', tint: 0xe0c890 }, seed).within(placed(0, 0, 0.4, 0), () => g.lathe([[0.3, 0], [0.15, 0.02], [0.001, 0.03]], 8));
      return;
    }
    case 'produce': {
      // Strings of dried fruit and seed heads hanging from a rail (Market Hall).
      g.paint(DARK, seed).span(-0.8, 0.8, 2.3, 2.38, 0.02, 0.3);
      for (let k = 0; k < 5; k++) {
        const x = -0.6 + k * 0.3;
        g.paint(ROPE, seed).tube([new Vector3(x, 2.3, 0.25), new Vector3(x, 1.5, 0.25)], 0.01, 3);
        g.paint({ mat: 'plaster', tint: [0xb06040, 0xd8a050, 0x8a5060][k % 3] }, seed + k);
        for (let j = 0; j < 4; j++) g.box(x, 1.6 + j * 0.17, 0.25, 0.09, 0.09, 0.09);
      }
      hangingFeeder(g, 0.9, 2.3, 0.4, seed);
      return;
    }
    default:
      return;
  }
}

type Piece = 'shelf' | 'pegs' | 'rail' | 'bin' | 'nestbed' | 'hearth' | 'kegs' | 'sacks' | 'grain' | 'crates' | 'produce' | 'cubbies' | 'sorting' | 'roost';

const BY_ARCHETYPE: Readonly<Record<string, readonly Piece[]>> = {
  'market-hall': ['produce', 'bin', 'sorting', 'sacks', 'cubbies', 'roost', 'produce', 'bin'],
  'water-mill': ['sacks', 'grain', 'sorting', 'bin', 'roost', 'crates'],
  tavern: ['kegs', 'hearth', 'cubbies', 'roost', 'nestbed', 'produce'],
  granary: ['sacks', 'grain', 'bin', 'sorting', 'roost', 'cubbies'],
  warehouse: ['crates', 'sacks', 'crates', 'roost', 'cubbies', 'bin'],
  'bell-tower': ['roost', 'cubbies', 'nestbed', 'bin', 'pegs'],
  'hollow-tree': ['nestbed', 'cubbies', 'roost', 'produce', 'pegs'],
  'terrace-house': ['nestbed', 'hearth', 'cubbies', 'roost', 'bin', 'produce'],
  'seed-exchange': ['bin', 'sorting', 'sacks', 'produce', 'cubbies', 'roost'],
  'stilt-house': ['nestbed', 'cubbies', 'roost', 'produce'],
  hide: ['roost', 'pegs'],
  dovecote: ['cubbies', 'nestbed', 'roost'],
};

/** Tops of the pieces that rise past a window sill (m above the floor); the rest stay under 1.1 m. */
const TALL: Partial<Record<Piece, number>> = { shelf: 2.1, pegs: 1.7, rail: 1.2, bin: 1.2, hearth: 3, kegs: 1.6, crates: 1.4, cubbies: 2, roost: 2.1, produce: 2.4 };

function choose(archetype: string, pick: number): Piece {
  const list = BY_ARCHETYPE[archetype] ?? ['shelf', 'rail', 'pegs', 'bin'];
  return list[Math.min(list.length - 1, Math.floor(pick * list.length))] ?? 'shelf';
}

/** A low piece for a slot under a window: the archetype's own if it has one, else sacks. */
function low(archetype: string, pick: number): Piece {
  const list = (BY_ARCHETYPE[archetype] ?? []).filter((k) => TALL[k] === undefined);
  return list[Math.min(list.length - 1, Math.floor(pick * list.length))] ?? 'sacks';
}

/** A ladder: two rails and rungs every 0.3 m at the hatch edge it climbs. */
function ladder(w: World, bottom: Vec3, top: Vec3, out: Vec3, seed: number): void {
  const g = w.m('opaque', 1, bottom.x, bottom.z, bottom.y);
  const yaw = Math.atan2(out.x, out.z);
  const h = top.y - bottom.y;
  g.ambient = SHADE.interior;
  g.paint(TIMBER, seed).within(placed(bottom.x, bottom.y, bottom.z, yaw), () => {
    for (const s of [-1, 1]) g.span(s * 0.35 - 0.05, s * 0.35 + 0.05, 0, h + 0.9, -0.22, -0.14, 0.012);
    for (let y = 0.3; y < h + 0.1; y += 0.3) g.tube([new Vector3(-0.32, y, -0.18), new Vector3(0.32, y, -0.18)], 0.025, 4);
  });
}
