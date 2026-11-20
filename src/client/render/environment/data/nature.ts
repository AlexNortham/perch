/**
 * Nature and the jungle (style guide §1.3, §6): bark on every trunk prim (giants with fissured ridges and buttress
 * roots, boughs carrying nests), leaf-card crowns in place of the blockout's foliage cylinders, the canopy, clipped
 * hedges with leaf fringes and flowers, reeds and cattails, bramble with dark berries, roots, hollows, branch nests,
 * pines as drooping tiers of needle cards, and ground cover (grass tufts, ferns, leaf litter, pebbles, mushrooms,
 * dropped feathers) over the jungle and the lane verges. Authored art data.
 */
import { Vector3 } from 'three';
import type { BlockoutPrim, CylinderPrim, Vec3 } from '../../../../sim/core/contracts';
import type { PropAnchor } from '../../../../sim/core/contracts';
import type { Band } from '../constants';
import { oriented, placed } from '../mesher';
import type { Mesher } from '../mesher';
import { hash2 } from '../world';
import type { Pass, World } from '../world';
import { inPrim, inVolume } from './buildings';
import { nest } from './nest';
import { BARK, FEATHER, HEDGE, IVY_DARK, MOSS, TWIG } from './styles';

const LEAF_TINTS = [0x7a9a62, 0x6a8a5a, 0x86a66a, 0x5f8458] as const;
const DEEP = 0x56784e;
const SUNLIT = 0x9cbc78;

function m(w: World, band: Band, x: number, z: number, pass: Pass = 'opaque', ground = 0): Mesher {
  return w.m(pass, band, x, z, ground);
}

export function dressNature(w: World): void {
  const crowns = w.map.prims.map((q, i) => [q, i] as const).filter(([q]) => q.shape === 'cylinder' && q.material === 'foliage' && !q.solid);
  w.map.prims.forEach((q, i) => {
    if (w.covered.has(i)) return;
    if (q.material === 'trunk') {
      if (q.shape === 'cylinder') {
        trunk(w, q, i);
        w.covered.add(i);
      } else barkBox(w, q, i);
    } else if (q.material === 'foliage' && q.shape === 'box' && q.solid && !q.blocks) {
      hedge(w, q, i);
      w.covered.add(i);
    } else if (q.blocks === 'sight') {
      ivyCurtain(w, q, i);
      w.covered.add(i);
    } else if (q.solid && q.blocks === 'movement') {
      // A shot window's invisible filler: the window reads open (§5.2).
      w.covered.add(i);
    }
  });
  for (const [q, i] of crowns) {
    if (q.shape !== 'cylinder') continue;
    crown(w, q, i);
    w.covered.add(i);
  }
  w.dressing.props.forEach((p, i) => {
    const s = 9001 + i * 53;
    switch (p.kind) {
      case 'canopy': canopy(w, p, s); break;
      case 'roots': roots(w, p, s); break;
      case 'hollow': hollow(w, p, s); break;
      case 'branch-nest': branchNest(w, p, s); break;
      case 'reeds': reeds(w, p, s); break;
      case 'bramble': bramble(w, p, s); break;
      case 'bush': bramble(w, p, s, false); break;
      case 'flowers': flowers(w, p, s); break;
      case 'moss': mossPatch(w, p, s); break;
      case 'mushrooms': mushrooms(m(w, 0, p.pos.x, p.pos.z), p.pos.x, p.pos.y, p.pos.z, p.size.x, s); break;
      case 'pine': pine(w, p.pos, p.size.y, p.size.x / 2, s); break;
      case 'tree': leafyTree(w, p.pos, p.size.y, p.size.x / 2, s); break;
      case 'ivy': ivyHang(w, p, s); break;
      default: break;
    }
  });
  groundCover(w);
  jungleCanopy(w);
}

// ── Trunks ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** Bark: vertical fissured ridges 5–15 cm wide (§7.2) as a radius ripple, seeded per trunk. */
const ridges = (seed: number, count: number, depth: number) => (a: number): number =>
  depth * (Math.abs(Math.sin(a * count + hash2(seed, 1) * 6)) * 0.7 + Math.abs(Math.sin(a * count * 2.3 + hash2(seed, 2) * 6)) * 0.3 - 0.5);

function trunk(w: World, q: CylinderPrim, i: number): void {
  const seed = 700 + i * 13;
  const y0 = q.centre.y - q.height / 2;
  const y1 = q.centre.y + q.height / 2;
  const R = q.radius + 0.03;
  if (q.radius >= 4) {
    giant(w, q, seed);
    return;
  }
  const g = m(w, 2, q.centre.x, q.centre.z, 'cast', y0);
  const sides = q.radius < 0.5 ? 7 : 12;
  const rid = ridges(seed, q.radius < 0.5 ? 3 : 6, R * 0.12);
  const ys = [y0 - 0.05, y0 + 0.4, y0 + 1.2, (y0 + y1) / 2, y1 - 0.5, y1];
  g.paint(BARK, seed).within(placed(q.centre.x, 0, q.centre.z, hash2(seed, 3) * 6), () => {
    g.radial(ys, sides, (a, y) => {
      const flare = q.radius < 0.5 ? 0.04 : Math.max(0, 1 - (y - y0) / 1.4) ** 2 * R * 0.9 * (0.6 + 0.4 * Math.abs(Math.cos(a * 2.5)));
      const taper = q.radius < 0.5 ? 1 : 1 - 0.25 * ((y - y0) / (y1 - y0));
      return R * taper + flare + rid(a) * (y > y1 - 0.3 ? 0 : 1);
    });
    g.disc(0, y1, 0, R * (q.radius < 0.5 ? 1 : 0.75), sides, 1);
  });
  // Moss collar where it meets the ground.
  const g1 = m(w, 1, q.centre.x, q.centre.z, 'opaque', y0);
  g1.paint(MOSS, seed).within(placed(q.centre.x, y0, q.centre.z, 0), () => g1.lathe([[R * (q.radius < 0.5 ? 1.25 : 1.9), 0], [R * 1.05, 0.25], [R * 1.01, 0.5]], sides));
}

/** Giant trunks (5–10 m wide, §6.1): 24-sided fissured bark, buttress roots to 1.5–3 × the radius, boughs. */
function giant(w: World, q: CylinderPrim, seed: number): void {
  const y0 = q.centre.y - q.height / 2;
  const y1 = q.centre.y + q.height / 2;
  const R = q.radius + 0.05;
  const g = m(w, 2, q.centre.x, q.centre.z, 'cast', y0);
  const rid = ridges(seed, 11, 0.22);
  const lobes = 5 + Math.floor(hash2(seed, 4) * 3);
  const phase = hash2(seed, 5) * 6;
  const ys = [y0 - 0.2, y0 + 0.4, y0 + 1.2, y0 + 2.5, y0 + 4.5, y0 + 9, y0 + 16, y0 + 24, y0 + 33, y0 + 42, y1];
  g.paint(BARK, seed).within(placed(q.centre.x, 0, q.centre.z, 0), () => {
    g.radial(ys, 28, (a, y) => {
      const h = y - y0;
      const lobe = Math.max(0, Math.cos(a * lobes + phase)) ** 3;
      const buttress = Math.max(0, 1 - h / 3.5) ** 2 * R * 0.9 * lobe;
      const bulge = 1 + 0.04 * Math.sin(y * 0.35 + a * 2 + phase);
      return R * bulge + buttress + rid(a);
    });
  });
  // Buttress root tails running out along the ground and under paving.
  const g1 = m(w, 1, q.centre.x, q.centre.z, 'opaque', y0);
  g1.paint(BARK, seed + 1);
  for (let k = 0; k < lobes; k++) {
    const a = (k * Math.PI * 2 - phase) / lobes;
    const dir = new Vector3(Math.cos(a), 0, Math.sin(a));
    const p0 = new Vector3(q.centre.x, y0 + 0.5, q.centre.z).addScaledVector(dir, R * 1.6);
    const p1 = p0.clone().addScaledVector(dir, 1.6 + hash2(seed, k) * 1.5).setY(y0 + 0.15);
    const p2 = p1.clone().addScaledVector(dir.applyAxisAngle(new Vector3(0, 1, 0), (hash2(seed, k + 9) - 0.5) * 0.8), 1.5).setY(y0 - 0.1);
    g1.tube([p0, p1, p2], [0.55, 0.32, 0.08], 6);
  }
  // Boughs from 12–25 m, tapering, each carrying a nest or a clump cluster.
  const boughs = 3;
  for (let k = 0; k < boughs; k++) {
    const a = hash2(seed, 20 + k) * Math.PI * 2;
    const y = y0 + 22 + k * 5 + hash2(seed, 30 + k) * 3;
    const dir = new Vector3(Math.cos(a), 0, Math.sin(a));
    const base = new Vector3(q.centre.x, y, q.centre.z).addScaledVector(dir, R * 0.8);
    const mid = base.clone().addScaledVector(dir, 6).setY(y + 3);
    const tip = mid.clone().addScaledVector(dir, 6).setY(y + 4.5);
    g.paint(BARK, seed + k).tube([base, mid, tip], [1.1, 0.7, 0.3], 9);
    clumps(w, tip.x, tip.y + 2, tip.z, 7, 6, seed + 40 + k, 2);
    if (k === 0) nest(m(w, 2, mid.x, mid.z), mid.x, mid.y + 0.4, mid.z, 1.6, 1.0, seed + 50, 2);
  }
  // The crown above the top.
  clumps(w, q.centre.x, y1 + 2, q.centre.z, R + 7, 8, seed + 60, 2);
}

/**
 * Trunk boxes and ramps are boughs and root walks: a round, tapering bark limb whose top runs along the walking
 * surface (the prim's top or slope), a moss strip along it and a few leafy sprigs. Short squat boxes are stumps.
 */
function barkBox(w: World, q: BlockoutPrim, i: number): void {
  if (q.shape === 'cylinder') return;
  const seed = 800 + i * 7;
  const y0 = q.centre.y - q.size.y / 2;
  const g = m(w, 2, q.centre.x, q.centre.z, 'cast', Math.min(0, y0));
  const [hx, hy, hz] = [q.size.x / 2, q.size.y / 2, q.size.z / 2];
  const wall = (w.map.buildings ?? []).some((b) => inVolume(b.footprint, q.centre, 0.1));
  g.paint(BARK, seed).within(placed(q.centre.x, q.centre.y, q.centre.z, q.yaw), () => {
    if (wall) {
      // A building's trunk walls (the Hollow-tree House): bark over every face; archetypes.ts rounds the trunk.
      if (q.shape === 'box') g.box(0, 0, 0, hx * 2 + 0.024, hy * 2 + 0.024, hz * 2 + 0.024, 0.06);
      else {
        const [x, y, z] = [hx + 0.03, hy + 0.03, hz + 0.03];
        g.poly([new Vector3(-x, -y, -z), new Vector3(x, -y, -z), new Vector3(x, y, z), new Vector3(-x, y, z)], new Vector3(0, z * 2, -y * 2).normalize());
        g.poly([new Vector3(-x, -y, z), new Vector3(x, -y, z), new Vector3(x, y, z), new Vector3(-x, y, z)], new Vector3(0, 0, 1));
        for (const s of [-1, 1]) g.poly([new Vector3(s * x, -y, -z), new Vector3(s * x, -y, z), new Vector3(s * x, y, z)], new Vector3(s, 0, 0));
      }
      return;
    }
    if (q.shape === 'box' && Math.max(hx, hz) < hy * 2.5) {
      g.radial([-hy - 0.05, -hy + 0.3, hy - 0.1, hy + 0.02], 10, (a, y) => Math.hypot(hx, hz) * (y < -hy + 0.3 ? 1.08 : 1) + ridges(seed, 4, 0.05)(a));
      g.disc(0, hy + 0.02, 0, Math.hypot(hx, hz) * 0.95, 10, 1);
      return;
    }
    // Along the longer horizontal axis; ramps rise from −z to +z.
    const alongZ = q.shape === 'ramp' || hz >= hx;
    const len = alongZ ? hz : hx;
    const r = Math.max(alongZ ? hx : hz, 0.4) * 1.02;
    const rise = q.shape === 'ramp' ? hy * 2 : 0;
    const topAt = (t: number): number => (q.shape === 'ramp' ? -hy + rise * t : hy);
    const pts: Vector3[] = [];
    const radii: number[] = [];
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      const s = -len + t * len * 2;
      const rr = r * (1.08 - 0.16 * t);
      const y = topAt(t) + 0.03 - rr + (q.shape === 'ramp' ? 0 : Math.sin(t * Math.PI) * 0.05);
      pts.push(alongZ ? new Vector3(0, y, s) : new Vector3(s, y, 0));
      radii.push(rr);
    }
    g.tube(pts, radii, 12);
    g.paint(MOSS, seed + 1).tube(pts.map((p, k) => p.clone().setY(p.y + radii[k]! - 0.04)), radii.map((rr) => rr * 0.35), 5);
  });
  const gc = m(w, 1, q.centre.x, q.centre.z, 'cutout');
  gc.within(placed(q.centre.x, q.centre.y, q.centre.z, q.yaw), () => {
    for (let k = 0; k < 3; k++) {
      const s = (hash2(seed, k) - 0.5) * 1.6 * Math.max(hx, hz);
      const side = k % 2 ? 1 : -1;
      const along = q.shape === 'ramp' || hz >= hx;
      const c = along ? new Vector3(side * (hx + 0.2), 0, s) : new Vector3(s, 0, side * (hz + 0.2));
      clump(gc, c.x, c.y, c.z, 0.6, seed + k);
    }
  });
}

/**
 * Ivy curtains (gameplay sight blockers, §5.3): dense strands hanging to the floor across the prim's broad face, in
 * two staggered layers, darker than decorative ivy (§6.2), so a curtain reads at 30 m.
 */
function ivyCurtain(w: World, q: BlockoutPrim, i: number): void {
  if (q.shape !== 'box') return;
  const seed = 2900 + i * 23;
  const wide = q.size.x >= q.size.z;
  const [span, thick] = wide ? [q.size.x, q.size.z] : [q.size.z, q.size.x];
  const g = m(w, 2, q.centre.x, q.centre.z, 'cutout');
  const y0 = q.centre.y - q.size.y / 2;
  const y1 = q.centre.y + q.size.y / 2;
  g.paint(IVY_DARK, seed).within(placed(q.centre.x, 0, q.centre.z, q.yaw + (wide ? 0 : Math.PI / 2)), () => {
    const n = Math.max(4, Math.round(span / 0.3));
    for (const layer of [-1, 1]) {
      for (let k = 0; k < n; k++) {
        const x = -span / 2 + ((k + 0.5 + (layer > 0 ? 0.5 : 0)) * span) / n;
        if (x > span / 2) continue;
        const z = layer * thick * 0.22;
        // Strands are a touch shorter at their ends so the hem is ragged.
        const bottom = y0 + hash2(seed, k * 2 + layer) * 0.35;
        for (let y = y1; y > bottom + 0.05; y -= 0.5) {
          const len = Math.min(0.55, y - bottom);
          g.card2(new Vector3(x + (hash2(seed, k + y) - 0.5) * 0.1, y - len / 2, z), new Vector3(0.24, 0, (hash2(seed, k) - 0.5) * 0.12), new Vector3(0, len / 2 + 0.06, 0));
        }
      }
    }
  });
}

// ── Foliage ──────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A leaf clump (3–6 m, §6.1): crossed rosette cards around a centre, dark inside and light at the sun-facing tips
 * (+15 % value). Cards per clump scale with its size.
 */
export function clump(g: Mesher, x: number, y: number, z: number, r: number, seed: number, tint?: number): void {
  const n = Math.max(5, Math.round(r * 2.3));
  for (let k = 0; k < n; k++) {
    const u = hash2(seed, k * 3);
    const v = hash2(seed, k * 3 + 1);
    const a = u * Math.PI * 2;
    const el = Math.acos(1 - 2 * v) - Math.PI / 2;
    const d = r * (0.35 + 0.55 * hash2(seed, k * 3 + 2));
    const c = new Vector3(x + Math.cos(a) * Math.cos(el) * d, y + Math.sin(el) * d * 0.7, z + Math.sin(a) * Math.cos(el) * d);
    const sun = (c.y - y) / r + (c.x - x) * -0.5 / r + (c.z - z) * -0.3 / r;
    const base = tint ?? LEAF_TINTS[Math.floor(hash2(seed, k + 99) * LEAF_TINTS.length)]!;
    g.paint({ mat: 'leafCard', tint: sun > 0.35 ? SUNLIT : sun < -0.3 ? DEEP : base }, seed + k);
    const s = r * (0.66 + 0.28 * hash2(seed, k + 50));
    const t = hash2(seed, k + 70) * Math.PI;
    const tilt = (hash2(seed, k + 80) - 0.5) * 1.4;
    const ua = new Vector3(Math.cos(t) * s, 0, Math.sin(t) * s);
    const va = new Vector3(-Math.sin(t) * Math.sin(tilt) * s, Math.cos(tilt) * s, Math.cos(t) * Math.sin(tilt) * s);
    g.card2(c, ua, va);
  }
}

/** A cluster of clumps filling an ellipsoid (rx across, ry up), in the cutout pass. */
export function clumps(w: World, x: number, y: number, z: number, rx: number, ry: number, seed: number, band: Band): void {
  const g = m(w, band, x, z, 'cutout');
  const n = Math.max(3, Math.round((rx * rx * ry) / 45));
  for (let k = 0; k < n; k++) {
    const a = hash2(seed, k) * Math.PI * 2;
    const d = Math.sqrt(hash2(seed, k + 100)) * rx * 0.75;
    const h = (hash2(seed, k + 200) - 0.4) * ry * 0.8;
    clump(g, x + Math.cos(a) * d, y + h, z + Math.sin(a) * d, 2.8 + hash2(seed, k + 300) * 1.8, seed + k * 17);
  }
}

/** A blockout crown cylinder becomes leaf clumps in that volume, with branches into them. */
function crown(w: World, q: CylinderPrim, i: number): void {
  const seed = 1500 + i * 31;
  const y0 = q.centre.y - q.height / 2;
  const y1 = q.centre.y + q.height / 2;
  const pinewood = q.centre.x > 70 && q.radius < 3.2 && q.height > 10;
  if (pinewood) {
    pineTiers(w, q.centre.x, y0, q.centre.z, y1, q.radius, seed);
    return;
  }
  const g = m(w, 2, q.centre.x, q.centre.z, 'cutout');
  const layers = Math.max(2, Math.round(q.height / 3.5));
  for (let k = 0; k < layers; k++) {
    const t = (k + 0.5) / layers;
    const y = y0 + t * q.height;
    const r = q.radius * (0.65 + 0.4 * Math.sin(Math.PI * Math.min(1, t * 1.2)));
    const n = 3;
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2 + k * 1.3;
      clump(g, q.centre.x + Math.cos(a) * r * 0.45, y, q.centre.z + Math.sin(a) * r * 0.45, r * 0.75, seed + k * 11 + j);
    }
  }
  clump(g, q.centre.x, y1 - 0.5, q.centre.z, q.radius * 0.7, seed + 99);
  // The crown spreads into the canopy on boughs (§6.1: 2–4 boughs, clumps dark inside and light at the tips).
  const gb0 = m(w, 2, q.centre.x, q.centre.z, 'cast');
  gb0.paint(BARK, seed + 5);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + hash2(seed, k + 40) * 0.8;
    const reach = 5 + hash2(seed, k + 41) * 4;
    const base = new Vector3(q.centre.x, y0 + q.height * 0.55, q.centre.z);
    const tip = new Vector3(q.centre.x + Math.cos(a) * reach, y1 + 1 + hash2(seed, k + 42) * 3, q.centre.z + Math.sin(a) * reach);
    const mid = base.clone().lerp(tip, 0.5).setY(tip.y - 0.5);
    gb0.tube([base, mid, tip], [0.32, 0.2, 0.06], 6);
    for (let j = 0; j < 3; j++) clump(g, tip.x + (hash2(seed, k * 9 + j) - 0.5) * 3, tip.y + (hash2(seed, k * 9 + j + 3) - 0.3) * 2, tip.z + (hash2(seed, k * 9 + j + 6) - 0.5) * 3, 2.2 + hash2(seed, j) * 1.2, seed + k * 13 + j);
  }
  // Branches up into the crown.
  const gb = m(w, 1, q.centre.x, q.centre.z, 'opaque');
  gb.paint(BARK, seed);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + hash2(seed, k);
    const y = y0 + 1 + k * (q.height / 6);
    gb.tube([new Vector3(q.centre.x, y, q.centre.z), new Vector3(q.centre.x + Math.cos(a) * q.radius * 0.8, y + 1.6, q.centre.z + Math.sin(a) * q.radius * 0.8)], [0.18, 0.05], 5);
  }
}

/** Pines (Pinewood, §6.1): stacked drooping tiers of needle cards around a straight trunk. */
function pineTiers(w: World, x: number, y0: number, z: number, y1: number, r: number, seed: number): void {
  const g = m(w, 2, x, z, 'cutout');
  const tiers = Math.max(4, Math.round((y1 - y0) / 1.6));
  for (let k = 0; k < tiers; k++) {
    const t = k / (tiers - 1);
    const y = y0 + t * (y1 - y0);
    const rr = r * (1.15 - 0.95 * t) + 0.3;
    const n = Math.max(5, Math.round(rr * 4));
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2 + k * 0.7 + hash2(seed, j) * 0.3;
      const out = new Vector3(Math.cos(a), 0, Math.sin(a));
      const c = new Vector3(x, y, z).addScaledVector(out, rr * 0.5);
      // Drooping: the card runs out and down from the trunk.
      const along = out.clone().multiplyScalar(rr * 0.55).add(new Vector3(0, -rr * 0.25, 0));
      const side = new Vector3(-out.z, 0, out.x).multiplyScalar(rr * 0.32);
      // Dense rosette cards in pine green keep their coverage at distance; needle cards fringe the tips.
      g.paint({ mat: 'leafCard', tint: t > 0.7 ? 0x6f8f6a : hash2(seed, j + k) < 0.5 ? 0x5a7a5e : 0x4f6e54 }, seed + k * 7 + j);
      g.card2(c, side, along);
      g.paint({ mat: 'pineCard', tint: 0xa0b898 }, seed + k * 7 + j + 1);
      g.card2(c.clone().addScaledVector(out, rr * 0.35).setY(c.y - rr * 0.12), side.clone().multiplyScalar(0.8), along.clone().multiplyScalar(0.6));
    }
  }
}

function pine(w: World, p: Vec3, h: number, r: number, seed: number): void {
  const g = m(w, 2, p.x, p.z, 'cast', p.y);
  g.paint(BARK, seed).within(placed(p.x, p.y, p.z, 0), () => g.radial([0, 0.6, h * 0.5, h], 9, (a, y) => 0.35 * (1 - (y / h) * 0.75) + (y < 0.6 ? 0.15 : 0) + ridges(seed, 4, 0.04)(a)));
  pineTiers(w, p.x, p.y + h * 0.28, p.z, p.y + h, r, seed);
}

function leafyTree(w: World, p: Vec3, h: number, r: number, seed: number): void {
  const g = m(w, 2, p.x, p.z, 'cast', p.y);
  g.paint(BARK, seed).within(placed(p.x, p.y, p.z, 0), () => g.radial([0, 0.5, h * 0.6], 9, (a, y) => 0.32 * (1 - (y / h) * 0.5) + (y < 0.5 ? 0.18 : 0) + ridges(seed, 4, 0.04)(a)));
  clumps(w, p.x, p.y + h * 0.75, p.z, r, h * 0.4, seed, 2);
}

/** The canopy (§6.4): leaf clumps at 25–40 m over the anchor's square, 60–80 % coverage, with gaps for light. */
function canopy(w: World, p: PropAnchor, seed: number): void {
  const { x: sx, z: sz } = p.size;
  const g = m(w, 2, p.pos.x, p.pos.z, 'cutout');
  const step = 4.2;
  for (let x = -sx / 2 + step / 2; x < sx / 2; x += step) {
    for (let z = -sz / 2 + step / 2; z < sz / 2; z += step) {
      const k = Math.round(x * 7 + z * 13);
      if (hash2(seed, k) < 0.28) continue;
      const jx = (hash2(seed, k + 1) - 0.5) * step;
      const jz = (hash2(seed, k + 2) - 0.5) * step;
      const y = p.pos.y + (hash2(seed, k + 3) - 0.5) * 4;
      clump(g, p.pos.x + x + jx, y, p.pos.z + z + jz, 2.6 + hash2(seed, k + 4) * 1.4, seed + k);
    }
  }
}

/** Clipped hedges (§6.2): a bevelled box with a leaf fringe along the top edges, flowers on 1 face in 3, twigs. */
function hedge(w: World, q: BlockoutPrim, i: number): void {
  if (q.shape !== 'box') return;
  const seed = 2100 + i * 19;
  const y0 = q.centre.y - q.size.y / 2;
  const g = m(w, 2, q.centre.x, q.centre.z, 'cast', y0);
  const [sx, sy, sz] = [q.size.x + 0.08, q.size.y + 0.04, q.size.z + 0.08];
  g.paint(HEDGE, seed).within(placed(q.centre.x, q.centre.y, q.centre.z, q.yaw), () => {
    g.box(0, -0.1, 0, sx, sy - 0.2, sz, 0.2);
    // A grown, broken silhouette: lumps of foliage along the top and bulging out of the flanks.
    const long = sx >= sz;
    const len = long ? sx : sz;
    const thick = long ? sz : sx;
    for (let t = -len / 2 + 0.3; t < len / 2 - 0.1; t += 0.55 + hash2(seed, t) * 0.3) {
      const r = thick * (0.42 + hash2(seed, t + 1) * 0.2);
      const h = 0.25 + hash2(seed, t + 2) * 0.35;
      const [x, z] = long ? [t, (hash2(seed, t + 3) - 0.5) * thick * 0.2] : [(hash2(seed, t + 3) - 0.5) * thick * 0.2, t];
      g.within(placed(x, sy / 2 - 0.35, z, hash2(seed, t + 4) * 3), () => g.radial([0, h * 0.5, h], 6, (a, y) => r * (1 - (y / h) ** 2 * 0.75) * (0.85 + 0.15 * Math.sin(a * 3 + t))));
      if (hash2(seed, t + 5) < 0.45) {
        const s = hash2(seed, t + 6) < 0.5 ? 1 : -1;
        const [bx, bz] = long ? [t, s * thick / 2] : [s * thick / 2, t];
        g.within(placed(bx, (hash2(seed, t + 7) - 0.5) * sy * 0.5, bz, 0), () => g.radial([-0.35, 0, 0.35], 6, (a, y) => 0.32 * (1 - (y / 0.35) ** 2 * 0.8)));
      }
    }
  });
  const gc = m(w, 1, q.centre.x, q.centre.z, 'cutout');
  gc.within(placed(q.centre.x, q.centre.y + sy / 2, q.centre.z, q.yaw), () => {
    for (const [len, axis] of [[sx, 'x'], [sz, 'z']] as const) {
      const n = Math.max(2, Math.round(len / 0.45));
      for (const s of [-1, 1]) {
        for (let k = 0; k < n; k++) {
          const t = -len / 2 + ((k + 0.5) * len) / n;
          const c = axis === 'x' ? new Vector3(t, -0.02, s * (sz / 2 - 0.08)) : new Vector3(s * (sx / 2 - 0.08), -0.02, t);
          const along = axis === 'x' ? new Vector3(0.28, 0, 0) : new Vector3(0, 0, 0.28);
          gc.paint({ mat: 'leafCard', tint: hash2(seed, k) < 0.5 ? 0x86a66a : 0x7a9a62 }, seed + k).card2(c, along, new Vector3(0, 0.16, 0).addScaledVector(axis === 'x' ? new Vector3(0, 0, s) : new Vector3(s, 0, 0), 0.06));
        }
      }
    }
  });
  if (hash2(seed, 1) < 0.34) {
    // Hedgerow flowers in clumps on one face (#E7A1B0, #F2D46B).
    const g0 = m(w, 0, q.centre.x, q.centre.z, 'opaque', y0);
    const colour = hash2(seed, 2) < 0.5 ? 0xe7a1b0 : 0xf2d46b;
    g0.paint({ mat: 'plaster', tint: colour, shade: 1.05 }, seed).within(placed(q.centre.x, y0, q.centre.z, q.yaw), () => {
      for (let k = 0; k < 22; k++) {
        const x = (hash2(seed, k + 10) - 0.5) * (sx - 0.3);
        const y = 0.3 + hash2(seed, k + 20) * (sy - 0.5);
        g0.bead(x, y, sz / 2 + 0.03, 0.09);
      }
    });
  }
  // A few bare twigs at the foot.
  const g1 = m(w, 0, q.centre.x, q.centre.z, 'opaque', y0);
  g1.paint(TWIG, seed).within(placed(q.centre.x, y0, q.centre.z, q.yaw), () => {
    for (let k = 0; k < 4; k++) {
      const x = (hash2(seed, k + 40) - 0.5) * sx;
      g1.tube([new Vector3(x, 0, sz / 2 - 0.05), new Vector3(x + 0.1, 0.35, sz / 2 + 0.1)], [0.02, 0.005], 3);
    }
  });
}

/** Reeds and cattails 1.2–2.0 m along banks (§1.3, §6.3), with a drying rack on some beds. */
function reeds(w: World, p: PropAnchor, seed: number): void {
  const { x: sx, y: sy, z: sz } = p.size;
  const gc = m(w, 1, p.pos.x, p.pos.z, 'cutout', p.pos.y);
  const g = m(w, 1, p.pos.x, p.pos.z, 'opaque', p.pos.y);
  gc.within(placed(p.pos.x, p.pos.y, p.pos.z, p.yaw), () => {
    g.within(placed(p.pos.x, p.pos.y, p.pos.z, p.yaw), () => {
      const n = Math.round((sx * sz) / 0.35);
      for (let k = 0; k < n; k++) {
        const x = (hash2(seed, k) - 0.5) * sx;
        const z = (hash2(seed, k + 500) - 0.5) * sz;
        const h = sy * (0.75 + hash2(seed, k + 900) * 0.5);
        const a = hash2(seed, k + 1300) * Math.PI;
        gc.paint({ mat: 'pineCard', tint: hash2(seed, k + 1700) < 0.5 ? 0xb8c890 : 0xa0b480 }, seed + k).card2(new Vector3(x, h / 2, z), new Vector3(Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25), new Vector3(0.05, h / 2, 0));
        if (k % 5 === 0) {
          // A cattail: stem and brown head.
          g.paint({ mat: 'grass', tint: 0xb0c088 }, seed).tube([new Vector3(x, 0, z), new Vector3(x + 0.04, h + 0.25, z)], 0.012, 3);
          g.paint({ mat: 'timberDark', tint: 0xc09070 }, seed).within(placed(x + 0.04, h + 0.05, z, 0), () => g.lathe([[0.035, 0], [0.045, 0.1], [0.04, 0.22], [0.001, 0.26]], 5));
        }
      }
    });
  });
}

/** Bramble thickets (§1.3): tangled thorny canes, leaves, and dark red-purple berries (never the Berry pickup). */
function bramble(w: World, p: PropAnchor, seed: number, berries = true): void {
  const { x: sx, y: sy, z: sz } = p.size;
  const g = m(w, 1, p.pos.x, p.pos.z, 'opaque', p.pos.y);
  const gc = m(w, 1, p.pos.x, p.pos.z, 'cutout', p.pos.y);
  const g0 = m(w, 0, p.pos.x, p.pos.z, 'opaque', p.pos.y);
  const mounds = Math.max(2, Math.round((sx * sz) / 6));
  for (let k = 0; k < mounds; k++) {
    const cx = p.pos.x + (hash2(seed, k) - 0.5) * sx * 0.75;
    const cz = p.pos.z + (hash2(seed, k + 50) - 0.5) * sz * 0.75;
    const r = Math.min(sx, sz) * (0.25 + hash2(seed, k + 100) * 0.15);
    g.paint(TWIG, seed + k);
    for (let j = 0; j < 7; j++) {
      const a = hash2(seed, k * 10 + j) * Math.PI * 2;
      const p0 = new Vector3(cx, p.pos.y, cz);
      const p1 = new Vector3(cx + Math.cos(a) * r * 0.5, p.pos.y + sy * 0.9, cz + Math.sin(a) * r * 0.5);
      const p2 = new Vector3(cx + Math.cos(a) * r * 1.1, p.pos.y + sy * 0.25, cz + Math.sin(a) * r * 1.1);
      g.tube([p0, p1, p2], [0.03, 0.02, 0.008], 3);
    }
    gc.paint({ mat: 'leafCard', tint: berries ? 0x6a8a5a : 0x7a9a62 }, seed + k);
    for (let j = 0; j < 7; j++) {
      const a = (j / 7) * Math.PI * 2;
      gc.card2(new Vector3(cx + Math.cos(a) * r * 0.5, p.pos.y + sy * 0.55, cz + Math.sin(a) * r * 0.5), new Vector3(Math.cos(a + 1.6) * r * 0.55, 0, Math.sin(a + 1.6) * r * 0.55), new Vector3(Math.cos(a) * 0.1, sy * 0.45, Math.sin(a) * 0.1));
    }
    if (berries) {
      g0.paint({ mat: 'plaster', tint: 0x5a2038, shade: 0.9 }, seed + k);
      for (let j = 0; j < 12; j++) {
        const a = hash2(seed, k * 20 + j) * Math.PI * 2;
        const d = r * (0.6 + hash2(seed, k * 20 + j + 7) * 0.5);
        g0.bead(cx + Math.cos(a) * d, p.pos.y + sy * (0.3 + hash2(seed, j + 3) * 0.6), cz + Math.sin(a) * d, 0.07);
      }
    }
  }
}

function flowers(w: World, p: PropAnchor, seed: number): void {
  const { x: sx, y: sy, z: sz } = p.size;
  const gc = m(w, 1, p.pos.x, p.pos.z, 'cutout', p.pos.y);
  const g0 = m(w, 0, p.pos.x, p.pos.z, 'opaque', p.pos.y);
  gc.within(placed(p.pos.x, p.pos.y, p.pos.z, p.yaw), () => {
    g0.within(placed(p.pos.x, p.pos.y, p.pos.z, p.yaw), () => {
      const n = Math.round((sx * sz) / 0.5);
      for (let k = 0; k < n; k++) {
        const x = (hash2(seed, k) - 0.5) * sx;
        const z = (hash2(seed, k + 70) - 0.5) * sz;
        const a = hash2(seed, k + 140) * Math.PI;
        gc.paint({ mat: 'leafCard', tint: 0x9cbf7a }, seed + k).card2(new Vector3(x, sy * 0.45, z), new Vector3(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3), new Vector3(0, sy * 0.45, 0));
        g0.paint({ mat: 'plaster', tint: [0xe7a1b0, 0xf2d46b, 0xe8e0f0][k % 3], shade: 1.05 }, seed + k);
        for (let j = 0; j < 3; j++) g0.bead(x + (hash2(seed, k * 3 + j) - 0.5) * 0.4, sy * (0.7 + hash2(seed, j + k) * 0.35), z + (hash2(seed, k * 5 + j) - 0.5) * 0.4, 0.09);
      }
    });
  });
}

function mossPatch(w: World, p: PropAnchor, seed: number): void {
  const { x: sx, z: sz } = p.size;
  const g = m(w, 1, p.pos.x, p.pos.z, 'opaque', p.pos.y);
  g.paint(MOSS, seed);
  for (let k = 0; k < 6; k++) {
    const x = p.pos.x + (hash2(seed, k) - 0.5) * sx;
    const z = p.pos.z + (hash2(seed, k + 9) - 0.5) * sz;
    const r = 0.5 + hash2(seed, k + 19) * 0.8;
    g.within(placed(x, p.pos.y, z, 0), () => g.lathe([[r, 0], [r * 0.7, 0.06], [0.001, 0.08]], 9));
  }
}

function mushrooms(g: Mesher, x: number, y: number, z: number, spread: number, seed: number): void {
  for (let k = 0; k < 4; k++) {
    const px = x + (hash2(seed, k) - 0.5) * spread;
    const pz = z + (hash2(seed, k + 4) - 0.5) * spread;
    const h = 0.08 + hash2(seed, k + 8) * 0.18;
    g.paint({ mat: 'plaster', tint: 0xe0d4bc }, seed + k).within(placed(px, y, pz, 0), () => g.lathe([[0.025, 0], [0.02, h]], 4));
    g.paint({ mat: 'plaster', tint: hash2(seed, k + 12) < 0.5 ? 0xb07850 : 0xc8a888 }, seed + k).within(placed(px, y + h, pz, 0), () => g.lathe([[h * 0.6, 0.0], [h * 0.45, h * 0.3], [0.001, h * 0.4]], 6));
  }
}

/** Buttress roots spread over the ground from the anchor's centre (§1.3 roots and hollows). */
function roots(w: World, p: PropAnchor, seed: number): void {
  const { x: sx, y: sy } = p.size;
  const g = m(w, 1, p.pos.x, p.pos.z, 'opaque', p.pos.y);
  g.paint(BARK, seed);
  const n = 9;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + hash2(seed, k) * 0.4;
    const r0 = sx * 0.33;
    const r1 = sx * (0.5 + hash2(seed, k + 9) * 0.25);
    const dir = new Vector3(Math.cos(a), 0, Math.sin(a));
    const c = new Vector3(p.pos.x, p.pos.y, p.pos.z);
    const pts = [c.clone().addScaledVector(dir, r0).setY(p.pos.y + sy * 0.8), c.clone().addScaledVector(dir, (r0 + r1) / 2).setY(p.pos.y + sy * 0.35), c.clone().addScaledVector(dir.applyAxisAngle(new Vector3(0, 1, 0), (hash2(seed, k + 3) - 0.5) * 0.6), r1).setY(p.pos.y - 0.05)];
    g.tube(pts, [0.5, 0.32, 0.06], 6);
  }
  mushrooms(m(w, 0, p.pos.x, p.pos.z), p.pos.x + sx * 0.38, p.pos.y, p.pos.z + sx * 0.1, 0.8, seed);
}

/** A hollow in a trunk (§1.3): a dark oval mouth with a rolled bark lip, a nest or lantern inside. */
function hollow(w: World, p: PropAnchor, seed: number): void {
  const { x: sx, y: sy } = p.size;
  const g = m(w, 1, p.pos.x, p.pos.z, 'opaque', 0);
  g.within(placed(p.pos.x, p.pos.y, p.pos.z, p.yaw), () => {
    g.paint({ mat: 'timberDark', shade: 0.15 }, seed);
    const pts: Vector3[] = [];
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      pts.push(new Vector3(Math.cos(a) * sx * 0.45, sy * 0.5 + Math.sin(a) * sy * 0.45, 0.05));
    }
    g.poly(pts, new Vector3(0, 0, 1));
    const lip = pts.map((q) => q.clone().setZ(0.12));
    lip.push(lip[0]!.clone());
    g.paint(BARK, seed).tube(lip, 0.12, 5);
  });
  nest(m(w, 1, p.pos.x, p.pos.z), p.pos.x, p.pos.y + 0.1, p.pos.z, 0.35, 0.25, seed, 2, 8);
}

/** A woven nest 2–4 m across in a bough (§1.3), on a stub of branch. */
function branchNest(w: World, p: PropAnchor, seed: number): void {
  const { x: sx, y: sy } = p.size;
  const g = m(w, 2, p.pos.x, p.pos.z, 'opaque', 0);
  nest(g, p.pos.x, p.pos.y, p.pos.z, sx / 2, sy, seed, 1 + Math.floor(hash2(seed, 1) * 2), 16);
  g.paint(BARK, seed).tube([new Vector3(p.pos.x - sx, p.pos.y - 0.4, p.pos.z), new Vector3(p.pos.x, p.pos.y - 0.1, p.pos.z), new Vector3(p.pos.x + sx * 0.9, p.pos.y + 0.2, p.pos.z + 0.3)], [0.32, 0.25, 0.08], 6);
}

function ivyHang(w: World, p: PropAnchor, seed: number): void {
  const { x: sx, y: sy } = p.size;
  const gc = m(w, 2, p.pos.x, p.pos.z, 'cutout');
  gc.paint({ mat: 'leafCard', tint: 0x6f8f62 }, seed).within(placed(p.pos.x, p.pos.y, p.pos.z, p.yaw), () => {
    for (let x = -sx / 2 + 0.3; x < sx / 2; x += 0.55) {
      for (let y = 0.2; y < sy; y += 0.45) gc.card2(new Vector3(x, y, 0.05), new Vector3(0.3, 0, 0.03), new Vector3(0, 0.28, 0.05));
    }
  });
}

// ── Ground cover ─────────────────────────────────────────────────────────────────────────────────────────────────

function insidePoly(poly: readonly Vec3[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

/** Distance from (x, z) to a polyline on the ground. */
export function distToPath(path: readonly Vec3[], x: number, z: number): number {
  let best = Infinity;
  for (let k = 0; k + 1 < path.length; k++) {
    const a = path[k]!;
    const b = path[k + 1]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t)));
  }
  return best;
}

/**
 * Ground layer and understory (§6.3, §6.4): grass tufts, ferns, leaf litter, pebbles, mushrooms and dropped feathers
 * over jungle zones and lane verges; never in the middle 70 % of a lane, inside buildings or solid prims.
 */
function groundCover(w: World): void {
  const zones = w.map.jungle ?? [];
  const lanes = w.map.lanes;
  const buildings = w.map.buildings ?? [];
  const solids = w.map.prims.filter((q) => q.solid && q.material !== 'grass' && q.material !== 'ground' && (q.shape !== 'box' || q.size.y < 30));
  const { min, max } = w.map.bounds;
  const step = 2.0;
  for (let x = min.x + 2; x < max.x - 2; x += step) {
    for (let z = min.z + 2; z < max.z - 2; z += step) {
      const k = Math.round(x * 31 + z * 17);
      const px = x + (hash2(k, 1) - 0.5) * step;
      const pz = z + (hash2(k, 2) - 0.5) * step;
      const jungle = zones.some((j) => insidePoly(j.outline, px, pz));
      const laneD = Math.min(...lanes.map((l) => distToPath(l.path, px, pz) / l.halfWidth));
      const verge = laneD > 0.85 && laneD < 2.2;
      if (!jungle && !verge) continue;
      if (laneD < 0.85) continue;
      if (Math.abs(px) < 24 && Math.abs(pz) < 24) continue;
      if (buildings.some((b) => inVolume(b.footprint, { x: px, y: b.footprint.centre.y, z: pz }, 0.4))) continue;
      const probe = { x: px, y: 0.3, z: pz };
      if (solids.some((q) => inPrim(q, probe, 0.25))) continue;
      const pathD = Math.min(Infinity, ...zones.flatMap((j) => j.paths.map((pp) => distToPath(pp, px, pz))));
      const r = hash2(k, 3);
      const g0 = m(w, 0, px, pz, 'cutout');
      if (jungle) {
        jungleFloor(w, px, pz, pathD, k);
        continue;
      }
      if (pathD < 1.4 && r < 0.75) continue;
      if (r < 0.62) {
        tuft(g0, px, 0, pz, 0.25 + hash2(k, 4) * 0.2, k);
      } else if (r < 0.72 && jungle && pathD > 2.5) {
        fern(m(w, 1, px, pz, 'cutout'), px, 0, pz, 0.6 + hash2(k, 5) * 0.5, k);
      } else if (r < 0.84) {
        litter(g0, px, pz, k);
      } else if (r < 0.9) {
        pebbles(m(w, 0, px, pz), px, pz, k);
      } else if (r < 0.93 && jungle) {
        mushrooms(m(w, 0, px, pz), px, 0, pz, 0.5, k);
      } else if (r < 0.96) {
        // A dropped feather (§1.2: 1 per 40 m² anywhere).
        const a = hash2(k, 6) * Math.PI * 2;
        g0.paint({ mat: 'featherCard', tint: [0xe8e0d0, 0xa89a88, 0x8a8a90][k % 3] }, k).card2(new Vector3(px, 0.02, pz), new Vector3(Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05), new Vector3(-Math.sin(a) * 0.15, 0.01, Math.cos(a) * 0.15));
      }
    }
  }
}

/**
 * The jungle floor (§6.4): dappled canopy shade on the ground everywhere, then ferns, soft bushes, litter, moss
 * cushions, mushrooms, fallen logs and stones, thinning toward the paths so routes stay readable.
 */
function jungleFloor(w: World, x: number, z: number, pathD: number, k: number): void {
  const r = hash2(k, 3);
  const g0 = m(w, 0, x, z, 'cutout');
  // Dapple: dark leaf shadows lying on the ground (§10.1 baked dapple at Medium).
  const a = hash2(k, 9) * Math.PI * 2;
  const s = 0.7 + hash2(k, 10) * 0.9;
  m(w, 1, x, z, 'cutout').paint({ mat: 'leafCard', tint: 0x1c2618, shade: 0.55 }, k).card2(new Vector3(x, 0.025, z), new Vector3(Math.cos(a) * s, 0, Math.sin(a) * s), new Vector3(-Math.sin(a) * s, 0, Math.cos(a) * s));
  if (pathD < 1.2) {
    if (r < 0.3) litter(g0, x, z, k);
    return;
  }
  if (r < 0.3) tuft(g0, x, 0, z, 0.3 + hash2(k, 4) * 0.25, k);
  else if (r < 0.52 && pathD > 1.8) fern(m(w, 1, x, z, 'cutout'), x, 0, z, 0.75 + hash2(k, 5) * 0.55, k);
  else if (r < 0.64 && pathD > 2.2) clump(m(w, 1, x, z, 'cutout'), x, 0.45, z, 0.55 + hash2(k, 6) * 0.25, k, 0x5f7f52);
  else if (r < 0.74) litter(g0, x, z, k);
  else if (r < 0.79) {
    const g = m(w, 1, x, z);
    g.paint(MOSS, k).within(placed(x, 0, z, 0), () => g.lathe([[0.6 + hash2(k, 7) * 0.5, 0], [0.4, 0.06], [0.001, 0.09]], 7));
  } else if (r < 0.83) mushrooms(m(w, 0, x, z), x, 0, z, 0.5, k);
  else if (r < 0.86 && pathD > 3) {
    // A fallen log, low, mossy along its top.
    const g = m(w, 1, x, z);
    const yaw = hash2(k, 8) * Math.PI;
    const len = 1.8 + hash2(k, 11) * 1.8;
    const rr = 0.18 + hash2(k, 12) * 0.12;
    g.paint(BARK, k).within(oriented(x, rr, z, yaw, Math.PI / 2), () => g.lathe([[rr, -len / 2], [rr * 1.08, 0], [rr * 0.9, len / 2]], 7));
    g.paint(MOSS, k).within(oriented(x, rr * 1.7, z, yaw, Math.PI / 2), () => g.lathe([[rr * 0.5, -len * 0.4], [rr * 0.55, 0], [rr * 0.4, len * 0.35]], 5));
    mushrooms(m(w, 0, x, z), x + Math.cos(yaw) * 0.4, 0, z - Math.sin(yaw) * 0.4, 0.4, k + 1);
  } else if (r < 0.89) pebbles(m(w, 0, x, z), x, z, k);
  else if (r < 0.91) {
    const b = hash2(k, 6) * Math.PI * 2;
    g0.paint({ mat: 'featherCard', tint: [0xe8e0d0, 0xa89a88, 0x8a8a90][k % 3] }, k).card2(new Vector3(x, 0.03, z), new Vector3(Math.cos(b) * 0.05, 0, Math.sin(b) * 0.05), new Vector3(-Math.sin(b) * 0.15, 0.01, Math.cos(b) * 0.15));
  }
}

/**
 * The jungle canopy (§6.4: 60–80 % over the jungle, 30–50 % over lanes) on a 9 m grid at 17–25 m, clear of towers,
 * with lianas hanging from it to 6–9 m (soft foliage above 3 m is free of the sightline rule).
 */
function jungleCanopy(w: World): void {
  const zones = w.map.jungle ?? [];
  const tall = (w.map.buildings ?? []).filter((b) => b.footprint.centre.y + b.footprint.size.y / 2 > 13);
  const { min, max } = w.map.bounds;
  const step = 9;
  for (let x = min.x + 4; x < max.x - 4; x += step) {
    for (let z = min.z + 4; z < max.z - 4; z += step) {
      const k = Math.round(x * 13 + z * 7) + 77;
      const px = x + (hash2(k, 1) - 0.5) * step * 0.8;
      const pz = z + (hash2(k, 2) - 0.5) * step * 0.8;
      const jungle = zones.some((j) => insidePoly(j.outline, px, pz));
      const laneD = Math.min(...w.map.lanes.map((l) => distToPath(l.path, px, pz) / l.halfWidth));
      const p = jungle ? 0.75 : laneD < 1.6 ? 0.3 : 0;
      if (hash2(k, 3) > p) continue;
      if (tall.some((b) => Math.hypot(b.footprint.centre.x - px, b.footprint.centre.z - pz) < Math.max(b.footprint.size.x, b.footprint.size.z) / 2 + 5)) continue;
      const y = 17 + hash2(k, 4) * 8;
      const g = m(w, 2, px, pz, 'cutout');
      for (let j = 0; j < 3; j++) clump(g, px + (hash2(k, j + 5) - 0.5) * 6, y + (hash2(k, j + 8) - 0.5) * 2.5, pz + (hash2(k, j + 11) - 0.5) * 6, 2.8 + hash2(k, j + 14) * 1.2, k * 3 + j);
      if (jungle && hash2(k, 20) < 0.4) {
        // A liana: a thin stem hanging from the canopy with leaf strips along it.
        const bottom = 6 + hash2(k, 21) * 3;
        const gs = m(w, 1, px, pz);
        gs.paint({ mat: 'bark', tint: 0x8a8060 }, k).tube([new Vector3(px, y - 1, pz), new Vector3(px + 0.3, (y + bottom) / 2, pz + 0.2), new Vector3(px + 0.1, bottom, pz)], [0.04, 0.03, 0.015], 4);
        const gl = m(w, 1, px, pz, 'cutout');
        for (let yy = bottom + 0.3; yy < y - 1.5; yy += 0.9) {
          const ang = hash2(k, yy) * Math.PI;
          gl.paint({ mat: 'leafCard', tint: 0x5f8052 }, k + Math.round(yy)).card2(new Vector3(px + 0.15, yy, pz + 0.1), new Vector3(Math.cos(ang) * 0.35, 0, Math.sin(ang) * 0.35), new Vector3(0, 0.4, 0));
        }
      }
    }
  }
}

/** A grass tuft: three crossed blade cards (20–40 cm). */
function tuft(g: Mesher, x: number, y: number, z: number, h: number, seed: number): void {
  for (let k = 0; k < 2; k++) {
    const a = hash2(seed, k + 30) * Math.PI;
    g.paint({ mat: 'pineCard', tint: k ? 0xc8d898 : 0xb0c888 }, seed + k).card2(new Vector3(x, y + h / 2, z), new Vector3(Math.cos(a) * h * 0.6, 0, Math.sin(a) * h * 0.6), new Vector3(0.03, h / 2, 0));
  }
}

function fern(g: Mesher, x: number, y: number, z: number, h: number, seed: number): void {
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + hash2(seed, k) * 0.5;
    const out = new Vector3(Math.cos(a), 0, Math.sin(a));
    g.paint({ mat: 'pineCard', tint: 0x98b878 }, seed + k).card2(new Vector3(x, y + h * 0.45, z).addScaledVector(out, h * 0.45), new Vector3(-out.z, 0, out.x).multiplyScalar(h * 0.25), out.clone().multiplyScalar(h * 0.5).setY(h * 0.35));
  }
}

function litter(g: Mesher, x: number, z: number, seed: number): void {
  for (let k = 0; k < 3; k++) {
    const a = hash2(seed, k + 60) * Math.PI * 2;
    const px = x + (hash2(seed, k + 70) - 0.5) * 0.8;
    const pz = z + (hash2(seed, k + 80) - 0.5) * 0.8;
    g.paint({ mat: 'leafCard', tint: [0xc0a070, 0xa88858, 0x98a068][k % 3] }, seed + k).card2(new Vector3(px, 0.015 + k * 0.004, pz), new Vector3(Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22), new Vector3(-Math.sin(a) * 0.22, 0, Math.cos(a) * 0.22));
  }
}

function pebbles(g: Mesher, x: number, z: number, seed: number): void {
  g.paint({ mat: 'granite' }, seed);
  for (let k = 0; k < 3; k++) {
    const r = 0.05 + hash2(seed, k + 90) * 0.1;
    g.within(oriented(x + (hash2(seed, k + 91) - 0.5) * 0.6, 0, z + (hash2(seed, k + 92) - 0.5) * 0.6, hash2(seed, k) * 3, 0), () => g.lathe([[r, 0], [r * 0.9, r * 0.4], [0.001, r * 0.6]], 5));
  }
  void FEATHER;
}
