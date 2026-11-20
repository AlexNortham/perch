/**
 * Everything else the Level Designer built in the open (style guide §2.1 "no plain box", §5.1, §5.8): yard and garden
 * walls in rubble stone or brick with copings, moss and ivy; timber fences of posts and boards with a perch rail;
 * raised decks and walkways planked over; outdoor ramps dressed as steps with cheek walls or stringers; stone pillars
 * and round plinths with bases and kerbs; the town wall round the map with buttresses and ivy. Skins sit just proud
 * of the prims; a skin that wholly encloses its prim covers it (the blockout leaves it out). Authored art data.
 */
import { Vector3 } from 'three';
import type { BlockoutPrim, BoxPrim, CylinderPrim, RampPrim } from '../../../../sim/core/contracts';
import { placed } from '../mesher';
import type { Mesher, Paint } from '../mesher';
import { hash2 } from '../world';
import type { Band } from '../constants';
import type { Pass, World } from '../world';
import { inVolume } from './buildings';
import { BARK, MOSS } from './styles';
import { clump } from './nature';

const S = 0.03;
const PAINTS: Readonly<Record<string, Paint>> = {
  stone: { mat: 'granite', tint: 0xe8e0d4 },
  brick: { mat: 'brick' },
  wood: { mat: 'timber' },
};
const COPING: Paint = { mat: 'ashlar', tint: 0xf0e8dc };

export function dressWalls(w: World): void {
  const buildings = w.map.buildings ?? [];
  w.map.prims.forEach((q, i) => {
    if (w.covered.has(i) || w.dressed.has(i) || !q.solid || q.blocks) return;
    if (q.material !== 'stone' && q.material !== 'brick' && q.material !== 'wood') return;
    if (buildings.some((b) => inVolume(b.footprint, q.centre, 0.3))) return;
    const seed = 7100 + i * 11;
    if (q.shape === 'cylinder') {
      pillar(w, q, seed);
      w.covered.add(i);
    } else if (q.shape === 'ramp') {
      if (steps(w, q, seed)) w.covered.add(i);
    } else if (q.size.y >= 15) {
      townWall(w, q, seed);
    } else if (Math.min(q.size.x, q.size.z) <= 1.3 && q.size.y >= 0.5) {
      wall(w, q, seed);
      w.covered.add(i);
    } else if (q.material === 'wood' && q.size.y <= 0.6) {
      deck(w, q, seed);
    } else {
      block(w, q, seed);
      w.covered.add(i);
    }
  });
}

function M(w: World, q: BlockoutPrim, band: Band, pass: Pass = 'opaque'): Mesher {
  const g = w.m(pass, band, q.centre.x, q.centre.z, Math.min(0, q.centre.y - (q.shape === 'cylinder' ? q.height : q.size.y) / 2));
  g.frame.copy(placed(q.centre.x, q.centre.y, q.centre.z, q.shape === 'cylinder' ? 0 : q.yaw));
  return g;
}

/** Yard and garden walls (stone, brick) and fences (timber), skinned all round, capped, mossed, some with ivy. */
function wall(w: World, q: BoxPrim, seed: number): void {
  const [hx, hy, hz] = [q.size.x / 2, q.size.y / 2, q.size.z / 2];
  const alongX = hx >= hz;
  const len = alongX ? hx * 2 : hz * 2;
  const g = M(w, q, 2);
  if (q.material === 'wood') {
    // A board fence: boards between posts every 2 m, a capping rail and a perch rail on the posts.
    g.paint({ mat: 'boards', tint: 0xc8b090 }, seed).box(0, -S / 2, 0, hx * 2 + S * 2, hy * 2 - S, hz * 2 + S * 2);
    const g1 = M(w, q, 1);
    g1.paint({ mat: 'timberDark' }, seed + 1);
    const n = Math.max(1, Math.round(len / 2));
    for (let k = 0; k <= n; k++) {
      const t = -len / 2 + (len * k) / n;
      if (alongX) g1.span(t - 0.09, t + 0.09, -hy - 0.02, hy + 0.12, -hz - 0.06, hz + 0.06);
      else g1.span(-hx - 0.06, hx + 0.06, -hy - 0.02, hy + 0.12, t - 0.09, t + 0.09);
    }
    g.paint({ mat: 'timberDark' }, seed + 2).box(0, hy + 0.04, 0, alongX ? len + 0.1 : hx * 2 + 0.16, 0.08, alongX ? hz * 2 + 0.16 : len + 0.1);
    return;
  }
  g.paint(PAINTS[q.material] ?? PAINTS['stone']!, seed).box(0, -S / 2, 0, hx * 2 + S * 2, hy * 2 - S, hz * 2 + S * 2);
  g.paint(COPING, seed + 1).box(0, hy + 0.06, 0, hx * 2 + 0.14, 0.14, hz * 2 + 0.14, 0.04);
  // A damp, darker foot course.
  g.paint({ mat: 'granite', shade: 0.75 }, seed + 2).box(0, -hy + 0.2, 0, hx * 2 + 0.1, 0.42, hz * 2 + 0.1);
  // Moss cushions gathered along the coping's edges (§5.8: upward-facing ledges).
  const g0 = M(w, q, 0);
  g0.paint(MOSS, seed);
  const edge = (alongX ? hz : hx) + 0.02;
  for (let t = -len / 2 + 0.5; t < len / 2 - 0.4; t += 0.9) {
    if (hash2(seed, t) < 0.4) continue;
    for (let k = 0; k < 3; k++) {
      const s = hash2(seed, t + k) < 0.5 ? 1 : -1;
      const along = t + (hash2(seed, t * 3 + k) - 0.5) * 0.6;
      const across = s * (edge - 0.08 - hash2(seed, t * 5 + k) * 0.12);
      const r = 0.08 + hash2(seed, t * 7 + k) * 0.1;
      g0.within(placed(alongX ? along : across, hy + 0.13, alongX ? across : along, 0), () => g0.lathe([[r, 0], [r * 0.6, 0.035], [0.001, 0.045]], 6));
    }
  }
  // Ivy over one face of some walls; stone walls longer than 6 m get buttress piers.
  if (hash2(seed, 3) < 0.45 && len > 2.5) {
    const gc = M(w, q, 2, 'cutout');
    const side = hash2(seed, 4) < 0.5 ? 1 : -1;
    const off = (alongX ? hz : hx) + 0.06;
    for (let t = -len / 2 + 0.4; t < len / 2 - 0.3; t += 0.35) {
      const top = hy - hash2(seed, t * 3) * hy * 1.4;
      for (let y = hy; y > top; y -= 0.38) {
        const c = alongX ? new Vector3(t, y - 0.15, side * off) : new Vector3(side * off, y - 0.15, t);
        const a = (hash2(seed, t + y) - 0.5) * 1.2;
        const s = 0.16;
        const u = alongX ? new Vector3(Math.cos(a) * s, Math.sin(a) * s, 0.02) : new Vector3(0.02, Math.sin(a) * s, Math.cos(a) * s);
        gc.paint({ mat: 'leafCard', tint: hash2(seed, y + t) < 0.5 ? 0x6f8f62 : 0x82a070 }, seed + Math.round(t * 9));
        gc.card2(c, u, new Vector3(0, s, 0));
      }
    }
  }
  if (len > 6 && q.material === 'stone') {
    const n = Math.floor(len / 4);
    for (let k = 1; k < n; k++) {
      const t = -len / 2 + (len * k) / n;
      for (const s of [-1, 1]) {
        if (alongX) g.paint(COPING, seed + k).span(t - 0.3, t + 0.3, -hy, hy + 0.04, s > 0 ? hz : -hz - 0.22, s > 0 ? hz + 0.22 : -hz);
        else g.paint(COPING, seed + k).span(s > 0 ? hx : -hx - 0.22, s > 0 ? hx + 0.22 : -hx, -hy, hy + 0.04, t - 0.3, t + 0.3);
      }
    }
  }
}

/** Broad blocks (plinths, staddle decks, platforms): skinned, a kerb along the top edge. */
function block(w: World, q: BoxPrim, seed: number): void {
  const [hx, hy, hz] = [q.size.x / 2, q.size.y / 2, q.size.z / 2];
  const g = M(w, q, 2);
  const paint = q.material === 'wood' ? { mat: 'boards' as const, tint: 0xd8c4a8 } : PAINTS[q.material] ?? PAINTS['stone']!;
  g.paint(paint, seed).box(0, 0, 0, hx * 2 + S * 2, hy * 2 + S, hz * 2 + S * 2);
  if (q.material !== 'wood') g.paint(COPING, seed + 1).box(0, hy - 0.05, 0, hx * 2 + 0.1, 0.14, hz * 2 + 0.1, 0.04);
}

/** Raised decks and walkways: planks across, a fascia round the edge. */
function deck(w: World, q: BoxPrim, seed: number): void {
  const [hx, hy, hz] = [q.size.x / 2, q.size.y / 2, q.size.z / 2];
  const g = M(w, q, 2);
  const alongX = hx >= hz;
  const len = alongX ? hx * 2 : hz * 2;
  for (let t = -len / 2 + 0.2; t < len / 2; t += 0.4) {
    g.paint({ mat: 'boards', tint: 0xe0d0b8 }, seed + Math.round(t * 5));
    if (alongX) g.span(t - 0.185, t + 0.185, hy - 0.02, hy + 0.025, -hz - 0.03, hz + 0.03);
    else g.span(-hx - 0.03, hx + 0.03, hy - 0.02, hy + 0.025, t - 0.185, t + 0.185);
  }
  g.paint({ mat: 'timberDark' }, seed);
  g.box(0, 0, 0, hx * 2 + 0.06, hy * 2 - 0.04, hz * 2 + 0.06);
}

/** Outdoor ramps: steps with stringers (timber) or cheek walls (stone); gentle ones get a paved or planked skin. */
function steps(w: World, q: RampPrim, seed: number): boolean {
  const [hx, hy, hz] = [q.size.x / 2, q.size.y / 2, q.size.z / 2];
  const slope = Math.atan2(hy * 2, hz * 2);
  const g = M(w, q, 2);
  const wood = q.material === 'wood';
  if (slope < 0.25 || hz * 2 > 14) {
    // Gentle: a skin over the slope and the sides.
    g.paint(wood ? { mat: 'boards', tint: 0xe0d0b8 } : { mat: 'flagstone' }, seed);
    g.poly([new Vector3(-hx, -hy + 0.03, -hz), new Vector3(hx, -hy + 0.03, -hz), new Vector3(hx, hy + 0.03, hz), new Vector3(-hx, hy + 0.03, hz)], new Vector3(0, hz, -hy).normalize());
    return false;
  }
  const rise = 0.22;
  const n = Math.max(2, Math.round((hy * 2) / rise));
  const run = (hz * 2) / n;
  for (let k = 0; k < n; k++) {
    // Each tread's top crosses the ramp plane at its middle, so feet sink at most half a riser.
    const zc = -hz + run * (k + 0.5);
    const top = -hy + ((zc + hz) / (hz * 2)) * hy * 2 + rise / 2;
    g.paint(wood ? { mat: 'boards', tint: 0xe0d0b8 } : { mat: 'ashlar', tint: 0xe8e0d0 }, seed + k).span(-hx + (wood ? 0.08 : 0), hx - (wood ? 0.08 : 0), -hy, top, zc - run / 2, zc + run / 2 + 0.03, 0.02);
  }
  // Stringers or cheek walls up both sides.
  g.paint(wood ? { mat: 'timberDark' } : PAINTS['stone']!, seed);
  for (const s of [-1, 1]) {
    const x0 = s * hx - (s > 0 ? 0.12 : 0);
    const x1 = x0 + 0.12;
    g.poly([new Vector3(s > 0 ? x1 : x0, -hy, -hz), new Vector3(s > 0 ? x1 : x0, -hy, hz), new Vector3(s > 0 ? x1 : x0, hy + 0.3, hz), new Vector3(s > 0 ? x1 : x0, -hy + 0.3, -hz)], new Vector3(s, 0, 0));
    g.poly([new Vector3(s > 0 ? x0 : x1, -hy, -hz), new Vector3(s > 0 ? x0 : x1, -hy, hz), new Vector3(s > 0 ? x0 : x1, hy + 0.3, hz), new Vector3(s > 0 ? x0 : x1, -hy + 0.3, -hz)], new Vector3(-s, 0, 0));
    g.poly([new Vector3(x0, -hy + 0.3, -hz), new Vector3(x1, -hy + 0.3, -hz), new Vector3(x1, hy + 0.3, hz), new Vector3(x0, hy + 0.3, hz)], new Vector3(0, hz, -hy).normalize());
  }
  // The back face under the top step.
  g.poly([new Vector3(-hx, -hy, hz + 0.03), new Vector3(hx, -hy, hz + 0.03), new Vector3(hx, hy, hz + 0.03), new Vector3(-hx, hy, hz + 0.03)], new Vector3(0, 0, 1));
  return true;
}

/** Stone pillars and round plinths: an ashlar drum with a base moulding and a capital or a kerb. */
function pillar(w: World, q: CylinderPrim, seed: number): void {
  const g = M(w, q, 2, q.height > 3 ? 'cast' : 'opaque');
  const r = q.radius + S;
  const h = q.height / 2;
  const sides = q.radius > 3 ? 32 : 12;
  g.paint({ mat: 'ashlar', tint: 0xe8e0d0 }, seed);
  if (q.height > 3) {
    g.lathe([[r + 0.15, -h], [r + 0.15, -h + 0.35], [r, -h + 0.5], [r, h - 0.5], [r + 0.18, h - 0.3], [r + 0.18, h], [0.001, h]], sides);
  } else {
    g.lathe([[r, -h], [r, h - 0.12], [r + 0.08, h - 0.1], [r + 0.08, h + 0.02], [r - 0.3, h + 0.035]], sides);
    g.paint({ mat: 'flagstone' }, seed).disc(0, h + 0.03, 0, r - 0.28, sides, 1);
    const g1 = M(w, q, 1);
    g1.paint(MOSS, seed).lathe([[r + 0.1, -h], [r + 0.05, -h + 0.25], [r + 0.01, -h + 0.4]], sides);
  }
}

/** The town wall round the map, dressed as the forest edge (no plain wall seen from play). */
function townWall(w: World, q: BoxPrim, seed: number): void {
  const [hx, hy, hz] = [q.size.x / 2, q.size.y / 2, q.size.z / 2];
  const alongZ = hz >= hx;
  const len = alongZ ? hz * 2 : hx * 2;
  // The inner face looks at the map's centre.
  const inward = alongZ ? -Math.sign(q.centre.x) : -Math.sign(q.centre.z);
  const face = (alongZ ? hx : hz) * inward;
  const g = M(w, q, 2);
  const out = new Vector3(alongZ ? inward : 0, 0, alongZ ? 0 : inward);
  const at = (t: number, y: number, d: number): Vector3 => (alongZ ? new Vector3(face + inward * d, y, t) : new Vector3(t, y, face + inward * d));
  // The wall disappears behind a forest (§10.2): its face is deep shade between leaves, giant trunks stand half-sunk
  // in it with buttress roots, leaf clumps cover it from 3 m up and crown its top as a tree line, shrubs bank its foot.
  const shade = { mat: 'hedge', tint: 0x3a4a34, shade: 0.55 } as const;
  g.paint(shade, seed).poly([at(-len / 2, -hy, S), at(len / 2, -hy, S), at(len / 2, hy, S), at(-len / 2, hy, S)], out);
  g.paint(shade, seed).poly([at(-len / 2, hy + S, 0), at(len / 2, hy + S, 0), at(len / 2, hy + S, -2 * (alongZ ? hx : hz)), at(-len / 2, hy + S, -2 * (alongZ ? hx : hz))], new Vector3(0, 1, 0));
  const ground = -q.centre.y;
  const gt = M(w, q, 2, 'cast');
  for (let t = -len / 2 + 6; t < len / 2 - 4; t += 12 + hash2(seed, t) * 4) {
    const r = 1.3 + hash2(seed, t + 1) * 1.1;
    const c = at(t, 0, -r * 0.45);
    // No trunk stands in the camera space behind a spawn or round a shop.
    if (w.inKeepOut(c.clone().setY(ground + 2).applyMatrix4(gt.frame), r + 1.5)) continue;
    gt.paint(BARK, seed + Math.round(t)).within(placed(c.x, 0, c.z, 0), () => {
      gt.radial([ground - 0.1, ground + 0.6, ground + 3, ground + 12, hy + 14], 14, (a, y) => {
        const h = y - ground;
        const lobe = Math.max(0, Math.cos(a * 5 + t)) ** 3;
        return r * (1 - Math.min(0.35, h / 120)) + Math.max(0, 1 - h / 3) ** 2 * r * 0.7 * lobe + 0.08 * Math.abs(Math.sin(a * 9 + t));
      });
    });
  }
  const gc = M(w, q, 2, 'cutout');
  for (let t = -len / 2 + 2; t < len / 2; t += 4.2) {
    for (let y = ground + 3.5; y < hy + 8; y += 3.4) {
      const k = Math.round(t * 7 + y * 3);
      if (y < ground + 8 && hash2(seed, k) < 0.45) continue;
      const c = at(t + (hash2(seed, k + 1) - 0.5) * 3, y + (hash2(seed, k + 2) - 0.5) * 2, 0.6 + hash2(seed, k + 3) * 1.4);
      clump(gc, c.x, c.y, c.z, 2.4 + hash2(seed, k + 4) * 1.6, seed + k, y > hy ? undefined : 0x5a7a50);
    }
  }
  for (let t = -len / 2 + 1; t < len / 2; t += 2.2) {
    const k = Math.round(t * 11);
    const c = at(t, ground + 0.5, 0.5 + hash2(seed, k) * 0.4);
    clump(gc, c.x, c.y, c.z, 0.7 + hash2(seed, k + 1) * 0.4, seed + k, 0x5f7f52);
  }
}
