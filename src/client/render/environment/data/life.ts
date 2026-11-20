/**
 * The town is inhabited (style guide §1.2, D-EP-048): small ambient birds perched on ridges, rails, sills, gutters,
 * wires, baths and feeders (muted browns and greys, no flock colour, static: a client-only cosmetic); street life along
 * every lane edge (berry bushes with dark berries, worm beds, feeder posts, nesting bundles, seed sacks with spills);
 * and feathers and seed on the lane floors, sparse and clear of the crosshair line (§2.5). Authored art data.
 */
import { Vector3 } from 'three';
import type { Vec3 } from '../../../../sim/core/contracts';
import { oriented, placed } from '../mesher';
import type { Mesher } from '../mesher';
import { hash2 } from '../world';
import type { World } from '../world';
import { hangingFeeder, inPrim, inVolume } from './buildings';
import { clump, distToPath } from './nature';
import { MOSS, ROPE, TWIG } from './styles';

const BIRD_TINTS = [[0x8a7560, 0xc8b8a0], [0x6f6a64, 0xb8b4ac], [0x9a8a70, 0xd8ccb4], [0x5a5048, 0xa89a88], [0x7a6a58, 0xe0d0b8]] as const;
const MIN_SPACING = 3.5;
const MAX_BIRDS = 260;
const SHARE = 0.4;

export function dressLife(w: World): void {
  addPropPerches(w);
  birds(w);
  laneEdges(w);
  laneFloors(w);
}

/** Perches on props: wires, baths, fountains, rails, poles, feeders and stall roofs. */
function addPropPerches(w: World): void {
  for (const p of w.dressing.props) {
    const f = placed(p.pos.x, p.pos.y, p.pos.z, p.yaw);
    const { x: sx, y: sy, z: sz } = p.size;
    switch (p.kind) {
      case 'wire':
        for (const t of [-0.3, 0.1, 0.35]) w.perch(f, t * sx, 0.02 - Math.sin((t + 0.5) * Math.PI) * sx * 0.04, 0, Math.PI / 2);
        break;
      case 'bird-bath':
      case 'fountain':
        for (let k = 0; k < 3; k++) {
          const a = k * 2.1;
          w.perch(f, Math.cos(a) * sx * 0.48, sy + 0.01, Math.sin(a) * sx * 0.48, -a - Math.PI / 2);
        }
        break;
      case 'roost-rail':
        for (const t of [-0.35, 0, 0.3]) w.perch(f, sx > sz ? t * sx : 0, 0.12, sx > sz ? 0 : t * sz, 0);
        break;
      case 'perch-pole':
        w.perch(f, 0, sy + 0.18, 0, 0);
        break;
      case 'feeder':
        w.perch(f, 0.2, p.pos.y < 0.5 ? sy + 0.22 : 0.05, 0, Math.PI / 2);
        break;
      case 'seed-stall':
      case 'stall':
        w.perch(f, 0, sy + 0.02, -Math.min(sx, sz) / 2, 0);
        break;
      default:
        break;
    }
  }
}

/** A small perched bird (0.15–0.25 m, ≤ 120 triangles, §11.3). */
export function perchedBird(g: Mesher, x: number, y: number, z: number, yaw: number, seed: number, peck = false): void {
  const [back, belly] = BIRD_TINTS[Math.floor(hash2(seed, 1) * BIRD_TINTS.length)]!;
  const s = 0.85 + hash2(seed, 2) * 0.4;
  g.within(placed(x, y, z, yaw), () => {
    // Body: an egg tipped forward; the paler belly is a second, smaller egg under it.
    g.paint({ mat: 'plaster', tint: back }, seed).within(oriented(0, 0.06 * s, 0, 0, peck ? 1.2 : 0.75), () => {
      g.lathe([[0.001, -0.075 * s], [0.045 * s, -0.05 * s], [0.055 * s, 0], [0.042 * s, 0.05 * s], [0.001, 0.07 * s]], 6);
    });
    g.paint({ mat: 'plaster', tint: belly }, seed).within(oriented(0, 0.05 * s, 0.012 * s, 0, peck ? 1.2 : 0.75), () => {
      g.lathe([[0.001, -0.05 * s], [0.04 * s, -0.02 * s], [0.035 * s, 0.03 * s], [0.001, 0.045 * s]], 5);
    });
    const hy = peck ? 0.05 * s : 0.13 * s;
    const hz = peck ? 0.09 * s : 0.05 * s;
    g.paint({ mat: 'plaster', tint: back }, seed + 1).within(placed(0, hy, hz, 0), () => g.lathe([[0.001, -0.035 * s], [0.032 * s, -0.01 * s], [0.03 * s, 0.015 * s], [0.001, 0.035 * s]], 6));
    // Beak, eye, tail.
    g.paint({ mat: 'timberDark', tint: 0xc8a060 }, seed);
    const b = new Vector3(0, hy - (peck ? 0.01 : 0), hz + 0.03 * s);
    g.poly([b.clone().add(new Vector3(-0.008, 0.006, 0)), b.clone().add(new Vector3(0.008, 0.006, 0)), b.clone().add(new Vector3(0, -0.004, 0.028 * s))], new Vector3(0, 1, 0.3).normalize());
    g.poly([b.clone().add(new Vector3(-0.008, 0.006, 0)), b.clone().add(new Vector3(0, -0.004, 0.028 * s)), b.clone().add(new Vector3(0.008, 0.006, 0))], new Vector3(0, -1, 0.3).normalize());
    g.paint({ mat: 'plaster', tint: back, shade: 0.75 }, seed + 2).within(oriented(0, 0.03 * s, -0.07 * s, 0, peck ? 0.1 : -0.5), () => g.box(0, 0, -0.04 * s, 0.035 * s, 0.008, 0.09 * s));
  });
}

function birds(w: World): void {
  const placedAt: Vec3[] = [];
  const spots = w.perches.map((p, i) => ({ p, r: hash2(i, 7) })).filter(({ r }) => r < SHARE).sort((a, b) => a.r - b.r);
  for (const { p } of spots) {
    if (placedAt.length >= MAX_BIRDS) break;
    if (placedAt.some((q) => Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z) < MIN_SPACING)) continue;
    placedAt.push(p);
    const seed = Math.round(p.x * 13 + p.z * 7 + p.y * 3);
    perchedBird(w.m('opaque', 1, p.x, p.z, p.y), p.x, p.y, p.z, p.yaw + (hash2(seed, 3) - 0.5) * 1.2, seed);
  }
}

/** Free ground for soft dressing: not in a building, a solid prim, a doorway or another prop. */
function freeSpot(w: World, x: number, z: number, r: number): boolean {
  if ((w.map.buildings ?? []).some((b) => inVolume(b.footprint, { x, y: b.footprint.centre.y, z }, r))) return false;
  if (w.map.prims.some((q) => q.solid && q.material !== 'grass' && q.material !== 'ground' && q.material !== 'road' && inPrim(q, { x, y: 0.4, z }, r))) return false;
  if ((w.map.openings ?? []).some((o) => o.passable && Math.hypot(o.centre.x - x, o.centre.z - z) < 2.5 + r)) return false;
  return !w.dressing.props.some((p) => Math.hypot(p.pos.x - x, p.pos.z - z) < Math.max(p.size.x, p.size.z) / 2 + r + 0.5);
}

/** Street life along both edges of every lane, every ~14 m, low and soft so it never reads as cover (§2.5). */
function laneEdges(w: World): void {
  for (const lane of w.map.lanes) {
    let along = 0;
    for (let k = 0; k + 1 < lane.path.length; k++) {
      const a = lane.path[k]!;
      const b = lane.path[k + 1]!;
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const dir = new Vector3((b.x - a.x) / len, 0, (b.z - a.z) / len);
      const side = new Vector3(dir.z, 0, -dir.x);
      for (let t = 4; t < len; t += 7) {
        const s = Math.round(along + t) % 2 ? 1 : -1;
        const off = lane.halfWidth * 0.92 + 0.6 + hash2(along + t, 1) * 1.2;
        const x = a.x + dir.x * t + side.x * s * off;
        const z = a.z + dir.z * t + side.z * s * off;
        if (Math.abs(x) > 128 || Math.abs(z) > 140 || !freeSpot(w, x, z, 0.7)) continue;
        const seed = Math.round(x * 17 + z * 29);
        const kind = hash2(seed, 2);
        const g = w.m('opaque', 1, x, z, 0);
        if (kind < 0.3) berryBush(w, x, z, seed);
        else if (kind < 0.45) wormBed(g, x, z, Math.atan2(dir.x, dir.z), seed);
        else if (kind < 0.62) feederPost(g, w, x, z, seed);
        else if (kind < 0.78) bundle(g, x, z, seed);
        else seedSacks(g, w, x, z, seed);
      }
      along += len;
    }
  }
}

/** A berry bush (soft, under 1 m): leaf clumps and dark red-purple berries, never the Berry pickup's look (§1.3). */
export function berryBush(w: World, x: number, z: number, seed: number): void {
  const gc = w.m('cutout', 1, x, z, 0);
  for (let k = 0; k < 3; k++) clump(gc, x + (hash2(seed, k) - 0.5) * 0.8, 0.45 + k * 0.08, z + (hash2(seed, k + 3) - 0.5) * 0.8, 0.45, seed + k, 0x5f7f52);
  const g = w.m('opaque', 0, x, z, 0);
  g.paint({ mat: 'plaster', tint: 0x5a2038, shade: 0.9 }, seed);
  for (let k = 0; k < 14; k++) {
    const a = hash2(seed, k + 10) * Math.PI * 2;
    const d = 0.25 + hash2(seed, k + 20) * 0.35;
    g.bead(x + Math.cos(a) * d, 0.3 + hash2(seed, k + 30) * 0.45, z + Math.sin(a) * d, 0.06);
  }
  w.perches.push({ x, y: 0.9, z, yaw: hash2(seed, 4) * 6 });
}

function wormBed(g: Mesher, x: number, z: number, yaw: number, seed: number): void {
  g.at(x, 0, z, yaw, () => {
    g.paint({ mat: 'timber' }, seed);
    for (const s of [-1, 1]) {
      g.span(-0.9, 0.9, 0, 0.28, s * 0.4 - 0.05, s * 0.4, 0);
      g.span(s * 0.9 - 0.05, s * 0.9, 0, 0.28, -0.4, 0.4, 0);
    }
    g.paint({ mat: 'earth', tint: 0x8a7058 }, seed).span(-0.85, 0.85, 0, 0.25, -0.35, 0.35);
    g.paint({ mat: 'earth', tint: 0xa08870 }, seed);
    for (let k = 0; k < 6; k++) {
      const px = (hash2(seed, k) - 0.5) * 1.5;
      const pz = (hash2(seed, k + 9) - 0.5) * 0.6;
      g.tube([new Vector3(px, 0.25, pz), new Vector3(px + 0.05, 0.29, pz + 0.03), new Vector3(px + 0.02, 0.3, pz + 0.07)], 0.018, 3);
    }
  });
}

function feederPost(g: Mesher, w: World, x: number, z: number, seed: number): void {
  g.paint({ mat: 'timberDark' }, seed).span(x - 0.05, x + 0.05, 0, 1.9, z - 0.05, z + 0.05);
  g.paint({ mat: 'timberDark' }, seed).span(x - 0.05, x + 0.45, 1.85, 1.93, z - 0.04, z + 0.04);
  hangingFeeder(g, x + 0.4, 1.86, z, seed);
  w.perches.push({ x: x + 0.6, y: 1.28, z, yaw: Math.PI / 2 });
  // Seed spilled under it, and a bird pecking at it.
  g.paint({ mat: 'gravel', tint: 0xe0c890 }, seed).within(placed(x + 0.4, 0, z, 0), () => g.lathe([[0.45, 0], [0.25, 0.015], [0.001, 0.02]], 8));
  w.perches.push({ x: x + 0.55, y: 0.02, z: z + 0.2, yaw: hash2(seed, 2) * 6 });
}

function bundle(g: Mesher, x: number, z: number, seed: number): void {
  for (let k = 0; k < 3; k++) {
    const a = hash2(seed, k) * 6;
    g.paint(k === 1 ? MOSS : k === 2 ? { mat: 'thatch' } : TWIG, seed + k).within(oriented(x + (k - 1) * 0.35, 0, z, a, 0.35), () => g.lathe([[0.1, 0], [0.13, 0.2], [0.1, 0.45], [0.14, 0.7], [0.001, 0.75]], 6));
  }
  g.paint(ROPE, seed).within(oriented(x, 0, z, 0, 0.35), () => g.lathe([[0.12, 0.35], [0.12, 0.4]], 6));
}

function seedSacks(g: Mesher, w: World, x: number, z: number, seed: number): void {
  for (let k = 0; k < 2; k++) {
    g.paint({ mat: 'canvas', tint: k ? 0xc8b48c : 0xb09a78 }, seed + k).within(placed(x + k * 0.5, 0, z, hash2(seed, k) * 3), () => {
      g.lathe([[0.22, 0], [0.28, 0.16], [0.27, 0.45], [0.2, 0.6], [0.23, 0.63], [0.001, 0.62]], 8);
    });
  }
  g.paint({ mat: 'gravel', tint: 0xe0c890 }, seed).within(placed(x + 0.25, 0, z + 0.45, 0), () => g.lathe([[0.4, 0], [0.2, 0.02], [0.001, 0.03]], 8));
  w.perches.push({ x: x + 0.3, y: 0.02, z: z + 0.5, yaw: hash2(seed, 5) * 6 });
}

/** Feathers and seed on the lane floor: about 1 per 30 m², off the lane's centre line (§1.2, §2.5). */
function laneFloors(w: World): void {
  for (const lane of w.map.lanes) {
    for (let k = 0; k + 1 < lane.path.length; k++) {
      const a = lane.path[k]!;
      const b = lane.path[k + 1]!;
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const dir = new Vector3((b.x - a.x) / len, 0, (b.z - a.z) / len);
      const side = new Vector3(dir.z, 0, -dir.x);
      const n = Math.floor((len * lane.halfWidth * 2) / 30);
      for (let i = 0; i < n; i++) {
        const seed = k * 1000 + i + Math.round(a.x);
        const t = hash2(seed, 1) * len;
        const s = (hash2(seed, 2) < 0.5 ? -1 : 1) * lane.halfWidth * (0.3 + hash2(seed, 3) * 0.55);
        const x = a.x + dir.x * t + side.x * s;
        const z = a.z + dir.z * t + side.z * s;
        if (distToPath(lane.path, x, z) < lane.halfWidth * 0.28) continue;
        const y = Math.max(0, a.y + (b.y - a.y) * (t / len)) + 0.02;
        if (hash2(seed, 4) < 0.55) {
          const ang = hash2(seed, 5) * Math.PI * 2;
          w.m('cutout', 0, x, z, y).paint({ mat: 'featherCard', tint: [0xe8e0d0, 0xa89a88, 0x8a8a90][seed % 3] }, seed).card2(new Vector3(x, y, z), new Vector3(Math.cos(ang) * 0.05, 0, Math.sin(ang) * 0.05), new Vector3(-Math.sin(ang) * 0.16, 0.005, Math.cos(ang) * 0.16));
        } else {
          const g = w.m('opaque', 0, x, z, y);
          g.paint({ mat: 'gravel', tint: 0xd8c08a }, seed);
          for (let j = 0; j < 5; j++) g.box(x + (hash2(seed, j + 6) - 0.5) * 0.5, y - 0.01, z + (hash2(seed, j + 12) - 0.5) * 0.5, 0.03, 0.015, 0.02);
        }
      }
    }
  }
}
