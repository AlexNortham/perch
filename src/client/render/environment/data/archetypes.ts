/**
 * Archetype extras (style guide §1.1, §5.9, §5.10) on top of the generic facades and roofs: the Dovecote's pigeonhole
 * rows and open cap, the Bell Tower's belfry (bell in its frame, perch bars, nest) and spire, the Hollow-tree House's
 * rounded trunk and crown deck, stilt houses' birdhouse entries and bracing, Hides' woven roofs, the Water Mill's
 * wheel, the Granary's staddle stones, the Tavern's emblem, the Warehouse's skylights and the Seed Exchange's awning.
 * Authored art data.
 */
import { Vector3 } from 'three';
import { oriented, placed } from '../mesher';
import type { Mesher } from '../mesher';
import { hash2 } from '../world';
import { awning, bframe, ivyPatch, lantern, PLINTH } from './buildings';
import type { Ctx, Face } from './buildings';
import { nest } from './nest';
import { flockTint } from './props';
import { BARK, BRASS, IRON, LANDING, MOSS, ROPE, STRAW, TWIG } from './styles';

export function dressArchetype(c: Ctx): void {
  switch (c.b.archetype) {
    case 'dovecote': dovecote(c); break;
    case 'bell-tower': belfry(c); break;
    case 'hollow-tree': hollowTree(c); break;
    case 'stilt-house': stiltHouse(c); break;
    case 'hide': hide(c); break;
    case 'water-mill': waterMill(c); break;
    case 'granary': granary(c); break;
    case 'tavern': emblem(c, 'jug'); break;
    case 'seed-exchange': seedExchange(c); break;
    case 'warehouse': warehouse(c); break;
    case 'market-hall': emblem(c, 'seed'); break;
    case 'sawmill': sawmill(c); break;
    default: break;
  }
}

/** The face looking most toward a direction (unit x, z). */
function faceToward(c: Ctx, x: number, z: number): Face | undefined {
  return [...c.faces].filter((f) => !f.hidden).sort((a, b) => (Math.sin(b.yaw) * x + Math.cos(b.yaw) * z) - (Math.sin(a.yaw) * x + Math.cos(a.yaw) * z))[0];
}

/** The face facing the nearest lane or the map centre line: the "street" face. */
function streetFace(c: Ctx): Face | undefined {
  const lanes = c.w.map.lanes;
  let best: Face | undefined;
  let bestD = Infinity;
  for (const f of c.faces) {
    if (f.hidden) continue;
    const px = f.cx + Math.sin(f.yaw) * 3;
    const pz = f.cz + Math.cos(f.yaw) * 3;
    const d = Math.min(...lanes.flatMap((l) => l.path.map((p) => Math.hypot(p.x - px, p.z - pz))));
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

// ── Dovecote (§1.1 showpieces) ───────────────────────────────────────────────────────────────────────────────────

function dovecote(c: Ctx): void {
  const top = c.d.roof.top;
  // Pigeonhole rows on every octagon face above the door: arched holes 0.25 × 0.32 m, 0.40 m apart, ledge per row.
  for (const f of c.faces) {
    const g = c.M(2, f.frame);
    const g1 = c.M(1, f.frame);
    const W = f.width / 2;
    const door = f.holes.find((h) => h.kind === 'door');
    const startY = door ? door.y1 + 0.9 : 3.4;
    const n = Math.max(1, Math.floor((f.width - 0.5) / 0.4));
    for (let y = startY; y < top - 1.4; y += 0.85) {
      g.paint({ mat: 'ashlar', tint: 0xf0e8d8 }, c.seed + Math.round(y)).span(-W - 0.04, W + 0.04, y - 0.07, y, -0.02, 0.14, 0.02);
      g.paint({ mat: 'timberDark', shade: 0.16 }, c.seed);
      for (let k = 0; k < n; k++) {
        const x = -((n - 1) * 0.4) / 2 + k * 0.4;
        g.poly([new Vector3(x - 0.125, y + 0.02, 0.045), new Vector3(x + 0.125, y + 0.02, 0.045), new Vector3(x + 0.125, y + 0.24, 0.045), new Vector3(x + 0.07, y + 0.31, 0.045), new Vector3(x, y + 0.34, 0.045), new Vector3(x - 0.07, y + 0.31, 0.045), new Vector3(x - 0.125, y + 0.24, 0.045)], new Vector3(0, 0, 1));
      }
      g1.paint({ mat: 'ashlar' }, c.seed);
      for (let k = 0; k <= n; k++) {
        const x = -((n - 1) * 0.4) / 2 + (k - 0.5) * 0.4;
        g1.span(x - 0.07, x + 0.07, y, y + 0.4, 0, 0.05, 0, '-z');
      }
    }
    // A lantern at the door (§5.10).
    if (door) {
      const gl = c.M(1, f.frame);
      gl.paint(IRON, c.seed).tube([new Vector3(door.u + door.w / 2 + 0.35, door.y1 - 0.2, 0.02), new Vector3(door.u + door.w / 2 + 0.35, door.y1 - 0.1, 0.35)], 0.02, 4);
      lantern(gl, door.u + door.w / 2 + 0.35, door.y1 - 0.15, 0.35, c.seed);
    }
  }
  // The crown: a deck rail, an open conical cap on four posts with a finial perch, a pennant mast (§1.4 vantage).
  const g = c.M(2, bframe(c), 'cast');
  const R = c.sx / 2;
  g.paint({ mat: 'timberDark' }, c.seed);
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    g.within(placed(Math.cos(a) * (R - 0.3), top, Math.sin(a) * (R - 0.3), 0), () => g.lathe([[0.1, 0], [0.08, 2.8]], 6));
  }
  g.paint({ mat: 'roofSlate' }, c.seed + 1).within(placed(0, top + 2.8, 0, Math.PI / 8), () => g.lathe([[R + 0.5, 0], [R + 0.45, 0.15], [0.25, 2.6], [0.001, 2.9]], 8));
  g.paint({ mat: 'verdigris' }, c.seed + 2).within(placed(0, top + 5.6, 0, 0), () => {
    g.lathe([[0.08, 0], [0.12, 0.2], [0.05, 0.6], [0.001, 0.9]], 8);
    g.box(0, 0.45, 0, 0.9, 0.04, 0.04);
  });
  rail(c.M(1, bframe(c)), R, top, 8, c.seed);
  pennant(c.M(1, bframe(c)), -R + 0.4, top, 0, 4.6, flockTint(c.cz), c.seed);
  nest(c.M(2, bframe(c)), R * 0.45, top, -R * 0.45, 0.8, 0.6, c.seed + 9, 2);
}

/** An octagonal (or n-sided) deck rail of posts and a dowel top rail, radius r, standing on y. */
function rail(g: Mesher, r: number, y: number, sides: number, seed: number): void {
  g.paint({ mat: 'timber' }, seed);
  const pts: Vector3[] = [];
  for (let k = 0; k <= sides; k++) {
    const a = (k / sides) * Math.PI * 2 + Math.PI / sides;
    const p = new Vector3(Math.cos(a) * r, y + 1.05, Math.sin(a) * r);
    pts.push(p);
    if (k < sides) g.span(p.x - 0.05, p.x + 0.05, y, y + 1.05, p.z - 0.05, p.z + 0.05);
  }
  g.tube(pts, 0.045, 6);
  g.paint(ROPE, seed).tube(pts.map((p) => p.clone().setY(y + 0.55)), 0.02, 4);
}

/** A mast with a feather-cut pennant in the faded flock tint (§1.4 vantage points). */
function pennant(g: Mesher, x: number, y: number, z: number, h: number, tint: number, seed: number): void {
  g.paint({ mat: 'timberDark' }, seed).within(placed(x, y, z, 0), () => g.lathe([[0.07, 0], [0.04, h], [0.07, h + 0.05], [0.001, h + 0.15]], 6));
  g.paint({ mat: 'canvas', tint }, seed);
  const pts = [new Vector3(x, y + h - 0.1, z), new Vector3(x, y + h - 0.7, z), new Vector3(x + 1.4, y + h - 0.5, z + 0.1), new Vector3(x + 1.1, y + h - 0.4, z + 0.08), new Vector3(x + 1.5, y + h - 0.25, z + 0.12)];
  g.poly(pts, new Vector3(0, 0, 1));
  g.poly(pts, new Vector3(0, 0, -1));
  // A perch bar across the mast (§1.4).
  g.paint({ mat: 'timber' }, seed).tube([new Vector3(x - 0.5, y + h - 1.2, z), new Vector3(x + 0.5, y + h - 1.2, z)], 0.03, 5);
}

// ── Bell Tower (§1.1 belfries) ───────────────────────────────────────────────────────────────────────────────────

function belfry(c: Ctx): void {
  const top = c.d.roof.eaves + 0.4;
  const belfryFloor = c.b.storeys[c.b.storeys.length - 1]?.floorY ?? top - 4.6;
  // Perch bars across each belfry arch (2 bars, 6–8 cm, the lower at 1.1 m over the sill).
  for (const f of c.faces) {
    const g = c.M(1, f.frame);
    for (const h of f.holes.filter((x) => x.kind === 'arch' && x.y0 > belfryFloor)) {
      g.paint({ mat: 'timber' }, c.seed);
      for (const dy of [1.1, 2.0]) g.tube([new Vector3(h.u - h.w / 2 - 0.05, h.y0 + dy, -0.25), new Vector3(h.u + h.w / 2 + 0.05, h.y0 + dy, -0.25)], 0.035, 6);
    }
  }
  // The bell (1.6 m) in a timber frame near the ceiling, a rope down, a woven nest on the beam.
  const f = bframe(c);
  const g = c.M(2, f, 'opaque');
  const beamY = top - 0.9;
  g.paint({ mat: 'timberDark' }, c.seed);
  g.span(-c.sx / 2 + 0.5, c.sx / 2 - 0.5, beamY - 0.15, beamY + 0.15, -0.25, 0.25, 0.03);
  for (const s of [-1, 1]) g.within(oriented(s * 1.4, beamY - 0.7, 0, 0, 0, s * 0.45), () => g.box(0, 0, 0, 0.18, 1.6, 0.18, 0.02));
  g.paint(BRASS, c.seed + 1).within(placed(0, beamY - 0.2, 0, 0), () => {
    g.lathe([[0.001, 0.05], [0.25, 0.02], [0.42, -0.25], [0.5, -0.8], [0.66, -1.25], [0.8, -1.45], [0.74, -1.5], [0.58, -1.4]], 18);
  });
  g.paint(ROPE, c.seed).tube([new Vector3(0.2, beamY - 1.5, 0), new Vector3(0.25, belfryFloor + 0.6, 0.1)], 0.025, 4);
  nest(c.M(1, f), c.sx / 2 - 1.4, beamY + 0.15, 0, 0.75, 0.55, c.seed + 3, 2, 10);
  // The spire: a drum over the roof cylinder, then a slate-coursed octagonal spire with a finial perch.
  const gs = c.M(2, f, 'cast');
  gs.paint({ mat: 'ashlar', tint: 0xe0d6c4 }, c.seed + 4).within(placed(0, top, 0, Math.PI / 8), () => gs.lathe([[2.62, 0], [2.62, 2.02], [2.9, 2.1], [2.9, 2.35]], 8));
  const courses = 14;
  for (let k = 0; k < courses; k++) {
    const t0 = k / courses;
    const t1 = (k + 1) / courses;
    const r0 = 3.0 * (1 - t0) + 0.05;
    const r1 = 3.0 * (1 - t1) + 0.05;
    gs.paint({ mat: 'roofSlate', shade: k % 3 === 0 ? 0.88 : 1 }, c.seed + k).within(placed(0, top + 2.35, 0, Math.PI / 8), () => gs.lathe([[r0 + 0.06, t0 * 7.2], [r1, t1 * 7.2 + 0.05]], 8));
  }
  gs.paint({ mat: 'verdigris' }, c.seed + 5).within(placed(0, top + 9.5, 0, 0), () => {
    gs.lathe([[0.1, 0], [0.16, 0.15], [0.06, 0.5], [0.15, 0.62], [0.001, 0.8]], 8);
    gs.box(0, 0.35, 0, 1.0, 0.045, 0.045);
  });
  nest(c.M(2, f), 1.6, top + 2.2, 1.6, 0.9, 0.6, c.seed + 6, 1);
  // The roof cylinder is wholly inside the drum.
  c.w.map.prims.forEach((q, i) => {
    if (q.shape === 'cylinder' && q.material === 'roof' && Math.hypot(q.centre.x - c.cx, q.centre.z - c.cz) < 0.5) c.w.covered.add(i);
  });
}

// ── Hollow-tree House (§1.1, §5.10) ─────────────────────────────────────────────────────────────────────────────

function hollowTree(c: Ctx): void {
  const f = bframe(c);
  const R = c.sx / 2;
  const top = c.d.roof.eaves;
  const g = c.M(2, f, 'cast');
  // Rounded bark ridges over every octagon corner, so the trunk reads round.
  g.paint(BARK, c.seed);
  for (let k = 0; k < 8; k++) {
    const a = Math.PI / 8 + (k * Math.PI) / 4;
    const cr = R / Math.cos(Math.PI / 8) - 0.35;
    g.within(placed(Math.sin(a) * cr, 0, Math.cos(a) * cr, a), () => g.radial([-0.1, 1, top * 0.5, top + 0.4], 7, (b, y) => (y < 1 ? 0.95 : 0.7) * (0.85 + 0.15 * Math.abs(Math.sin(b * 2 + k)))));
  }
  // The trunk carries on above the deck as a crown of broken limbs reaching up into the canopy.
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + Math.PI / 4 + hash2(c.seed, k) * 0.3;
    const base = new Vector3(Math.sin(a) * (R + 0.4), top - 0.5, Math.cos(a) * (R + 0.4));
    const mid = new Vector3(Math.sin(a) * (R + 2.2), top + 6, Math.cos(a) * (R + 2.2));
    const tip = new Vector3(Math.sin(a + 0.3) * (R + 5), top + 15, Math.cos(a + 0.3) * (R + 5));
    g.tube([base, mid, tip], [0.85, 0.55, 0.2], 8);
  }
  // Crown deck: rail of posts and rope (the deck's own balcony volume has no rail prim), a lantern, a perch frame.
  const g1 = c.M(1, f);
  const deck = c.d.roof.top;
  g1.paint({ mat: 'timber' }, c.seed + 1);
  const D = 6;
  for (const [x0, z0, x1, z1] of [[-D, -D, D, -D], [D, -D, D, D], [D, D, -D, D], [-D, D, -D, -D]] as const) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.round(len / 1.5);
    for (let k = 0; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n;
      const z = z0 + ((z1 - z0) * k) / n;
      g1.span(x - 0.06, x + 0.06, deck, deck + 1.0, z - 0.06, z + 0.06);
    }
    g1.paint(ROPE, c.seed).tube([new Vector3(x0, deck + 0.95, z0), new Vector3((x0 + x1) / 2, deck + 0.82, (z0 + z1) / 2), new Vector3(x1, deck + 0.95, z1)], 0.03, 5);
    g1.paint({ mat: 'timber' }, c.seed + 1);
  }
  // Deck boards (pale, worn: a place to land) over the roof slab.
  const gd = c.M(2, f);
  for (let x = -D + 0.25; x < D; x += 0.5) {
    gd.paint(LANDING, c.seed + Math.round(x * 4)).span(x - 0.23, x + 0.23, deck - 0.02, deck + 0.025, -D, D, 0);
  }
  lantern(g1, D - 0.4, deck + 1.6, -D + 0.4, c.seed);
  g1.paint({ mat: 'timberDark' }, c.seed).span(D - 0.45, D - 0.35, deck, deck + 1.7, -D + 0.35, -D + 0.45);
  // Knot-hole windows: a rolled bark lip around every leap opening.
  for (const face of c.faces) {
    const gk = c.M(1, face.frame);
    for (const h of face.holes.filter((x) => x.kind === 'leap')) {
      const pts: Vector3[] = [];
      for (let k = 0; k <= 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        pts.push(new Vector3(h.u + Math.cos(a) * (h.w / 2 + 0.25), (h.y0 + h.y1) / 2 + Math.sin(a) * ((h.y1 - h.y0) / 2 + 0.25), 0.12));
      }
      gk.paint(BARK, c.seed).tube(pts, 0.2, 6);
    }
    if (face.side % 2 === 0) ivyPatch(c, face, -face.width * 0.2, 1.4, PLINTH, 6, c.seed + face.side);
  }
  // Moss up the north side.
  const gm = c.M(1, f);
  gm.paint(MOSS, c.seed);
  for (let k = 0; k < 6; k++) gm.within(oriented((hash2(c.seed, k) - 0.5) * 6, 0.6 + k * 1.3, R + 0.1, 0, Math.PI / 2), () => gm.lathe([[0.6, 0], [0.4, 0.06], [0.001, 0.08]], 7));
}

// ── Stilt houses (§1.1 birdhouse dwellings) ─────────────────────────────────────────────────────────────────────

function stiltHouse(c: Ctx): void {
  // Birdhouse entries: a round trim ring around each door and a perch peg below the windows.
  for (const f of c.faces) {
    const g = c.M(1, f.frame);
    for (const h of f.holes) {
      if (h.kind === 'door') {
        const pts: Vector3[] = [];
        for (let k = 0; k <= 20; k++) {
          const a = (k / 20) * Math.PI * 2;
          pts.push(new Vector3(h.u + Math.cos(a) * 1.95, h.y0 + 1.5 + Math.sin(a) * 1.95, 0.08));
        }
        g.paint({ mat: 'timber', tint: 0xe0d2b8 }, c.seed).tube(pts, 0.14, 6);
      } else if (h.kind === 'window') {
        g.paint({ mat: 'timber' }, c.seed).tube([new Vector3(h.u, h.y0 - 0.25, 0), new Vector3(h.u, h.y0 - 0.25, 0.3)], 0.03, 5);
      }
    }
  }
  // The lid roof: a shallow pitched lid overhanging the flat roof edge, with a perch peg on the ridge.
  const f = bframe(c);
  const g = c.M(2, f, 'cast');
  const top = c.d.roof.top;
  g.paint({ mat: 'roofShingle' }, c.seed + 2);
  for (const s of [-1, 1]) g.within(oriented(0, top + 0.95, s * (c.sz / 4 + 0.15), 0, s * 0.42), () => g.box(0, 0, 0, c.sx + 0.6, 0.08, c.sz / 2 + 0.55, 0.02));
  g.paint({ mat: 'timberDark' }, c.seed).tube([new Vector3(-c.sx / 2 - 0.3, top + 1.4, 0), new Vector3(c.sx / 2 + 0.3, top + 1.4, 0)], 0.1, 6);
  for (const s of [-1, 1]) g.span(s * (c.sx / 2 - 0.2) - 0.08, s * (c.sx / 2 - 0.2) + 0.08, top, top + 1.4, -0.08, 0.08);
  g.paint({ mat: 'timber' }, c.seed).tube([new Vector3(c.sx / 2 + 0.3, top + 1.4, 0), new Vector3(c.sx / 2 + 0.75, top + 1.55, 0)], 0.035, 5);
}

// ── Hides (§5.10) ────────────────────────────────────────────────────────────────────────────────────────────────

function hide(c: Ctx): void {
  const f = bframe(c);
  const g = c.M(2, f, 'cast');
  const top = c.d.roof.top;
  // A woven reed roof: a rolled thatch cap with a ridge roll, moss on it.
  g.paint(STRAW, c.seed).box(0, top + 0.15, 0, c.sx + 0.5, 0.36, c.sz + 0.5, 0.15);
  const along = c.sx >= c.sz;
  const len = (along ? c.sx : c.sz) + 0.5;
  g.paint({ mat: 'thatch', shade: 0.85 }, c.seed).tube(along ? [new Vector3(-len / 2, top + 0.4, 0), new Vector3(len / 2, top + 0.4, 0)] : [new Vector3(0, top + 0.4, -len / 2), new Vector3(0, top + 0.4, len / 2)], 0.22, 7);
  const gm = c.M(1, f);
  gm.paint(MOSS, c.seed);
  for (let k = 0; k < 3; k++) gm.within(placed((hash2(c.seed, k) - 0.5) * c.sx * 0.6, top + 0.33, (hash2(c.seed, k + 5) - 0.5) * c.sz * 0.6, 0), () => gm.lathe([[0.5, 0], [0.3, 0.05], [0.001, 0.07]], 7));
  // Woven screens of reed bundles along the walls' feet.
  const gt = c.M(1, f);
  gt.paint(TWIG, c.seed);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    gt.within(oriented(Math.cos(a) * (c.sx / 2 + 0.15), 0, Math.sin(a) * (c.sz / 2 + 0.15), a, 0.15), () => gt.lathe([[0.1, 0], [0.12, 0.6], [0.001, 0.9]], 5));
  }
}

// ── Water Mill (§5.9, §5.10) ─────────────────────────────────────────────────────────────────────────────────────

function waterMill(c: Ctx): void {
  const face = faceToward(c, -Math.sign(c.cx), 0);
  if (!face) return;
  const g = c.M(2, face.frame, 'cast');
  const R = 3.1;
  const W = 1.0;
  const y = R - 0.4;
  const z = 0.75;
  g.within(placed(0, y, z, 0), () => {
    g.within(oriented(0, 0, 0, 0, Math.PI / 2), () => {
      // Two rims, 16 paddles, spokes and the axle into the wall.
      g.paint({ mat: 'timberDark' }, c.seed);
      for (const s of [-W / 2, W / 2]) {
        const rim: Vector3[] = [];
        for (let k = 0; k <= 24; k++) rim.push(new Vector3(Math.cos((k / 24) * Math.PI * 2) * R, s, Math.sin((k / 24) * Math.PI * 2) * R));
        g.tube(rim, 0.09, 5);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          g.tube([new Vector3(0, s, 0), new Vector3(Math.cos(a) * R, s, Math.sin(a) * R)], 0.06, 4);
        }
      }
      g.lathe([[0.25, -W / 2 - 0.2], [0.25, W / 2 + z + 0.1]], 8);
      g.paint({ mat: 'timber' }, c.seed + 1);
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        g.within(oriented(Math.cos(a) * (R - 0.25), 0, Math.sin(a) * (R - 0.25), -a, 0, 0), () => g.box(0, 0, 0, 0.6, W + 0.1, 0.06));
      }
    });
  });
  // A stone mill race under the wheel with water in it.
  const gr = c.M(2, face.frame);
  gr.paint({ mat: 'granite' }, c.seed).span(-1.0, 1.0, -0.05, 0.25, 0.1, 1.5, 0.03);
  gr.paint({ mat: 'water' }, c.seed).span(-0.8, 0.8, 0.2, 0.22, 0.2, 1.4);
}

// ── Granary (§5.10) ─────────────────────────────────────────────────────────────────────────────────────────────

function granary(c: Ctx): void {
  if (c.base < 0.5) return;
  // Staddle stones: mushroom posts along the deck's long faces, standing just proud of it.
  for (const f of c.faces) {
    if (f.width < 12) continue;
    const g = c.M(2, f.frame);
    for (let u = -f.width / 2 + 1; u <= f.width / 2 - 1; u += 2.4) {
      g.paint({ mat: 'granite' }, c.seed + Math.round(u)).within(placed(u, 0, 0.1, 0), () => {
        g.lathe([[0.3, 0], [0.2, c.base * 0.75], [0.14, c.base * 0.82]], 8, Math.PI, Math.PI * 2);
        g.lathe([[0.2, c.base * 0.82], [0.48, c.base * 0.86], [0.5, c.base - 0.02], [0.3, c.base]], 10, Math.PI, Math.PI * 2);
      });
    }
  }
}

// ── Emblems, awnings, skylights ─────────────────────────────────────────────────────────────────────────────────

/** A hanging carved emblem on an iron bracket by the street door (§5.6: a shape only, no lettering). */
function emblem(c: Ctx, shape: 'jug' | 'seed'): void {
  const f = streetFace(c);
  if (!f) return;
  const door = f.holes.find((h) => h.kind === 'door' || h.kind === 'arch');
  const u = door ? door.u + door.w / 2 + 0.9 : f.width / 4;
  const y = (door ? door.y1 : c.base + 3) + 0.6;
  const g = c.M(1, f.frame);
  g.paint(IRON, c.seed).tube([new Vector3(u, y, 0.02), new Vector3(u, y + 0.08, 0.95)], 0.025, 4);
  g.tube([new Vector3(u, y - 0.4, 0.02), new Vector3(u, y - 0.02, 0.6)], 0.02, 4);
  g.tube([new Vector3(u, y + 0.05, 0.85), new Vector3(u, y - 0.25, 0.85)], 0.012, 3);
  g.paint({ mat: 'timber', tint: 0xd8b888 }, c.seed + 1).within(placed(u, y - 0.95, 0.85, Math.PI / 2), () => {
    if (shape === 'jug') {
      g.lathe([[0.001, 0], [0.22, 0.05], [0.3, 0.3], [0.22, 0.55], [0.12, 0.65], [0.15, 0.72]], 10);
      g.within(oriented(0, 0.4, 0.27, 0, 0, Math.PI / 2), () => g.lathe([[0.12, -0.03], [0.12, 0.03]], 8));
    } else {
      g.lathe([[0.001, 0], [0.18, 0.12], [0.24, 0.35], [0.16, 0.6], [0.001, 0.72]], 10);
    }
  });
}

function seedExchange(c: Ctx): void {
  const f = streetFace(c);
  if (f) {
    const door = f.holes.find((h) => h.kind === 'door');
    if (door) awning(c, f, door.u, door.w + 2.4, door.y1 + 0.5, 2.0, c.seed);
  }
  emblem(c, 'seed');
  // The roof Lookout dressed as a crow's nest (§5.10): mast, woven basket, pennant.
  const top = c.d.roof.top;
  const g = c.M(2, bframe(c), 'cast');
  const [x, z] = [c.sx / 2 - 1.2, -c.sz / 2 + 1.2];
  g.paint({ mat: 'timberDark' }, c.seed).within(placed(x, top, z, 0), () => g.lathe([[0.12, 0], [0.09, 4.2]], 7));
  g.paint(TWIG, c.seed).within(placed(x, top + 3.0, z, 0), () => g.lathe([[0.25, 0], [0.8, 0.15], [0.9, 0.85], [0.82, 0.9]], 10));
  pennant(c.M(1, bframe(c)), x, top + 3.6, z, 2.2, flockTint(c.cz), c.seed);
}

function warehouse(c: Ctx): void {
  // Frames round each skylight in the roof (§5.10): a raised curb with a timber edge.
  const openings = (c.w.map.openings ?? []).filter((o) => o.kind === 'skylight' && Math.abs(o.centre.x - c.cx) < c.sx / 2 && Math.abs(o.centre.z - c.cz) < c.sz / 2);
  for (const o of openings) {
    const g = c.M(2, placed(o.centre.x, o.centre.y + 0.2, o.centre.z, 0));
    const hw = o.width / 2;
    g.paint({ mat: 'timberDark' }, c.seed);
    for (const s of [-1, 1]) {
      g.span(-hw - 0.15, hw + 0.15, 0, 0.3, s * hw - (s > 0 ? 0 : 0.15), s * hw + (s > 0 ? 0.15 : 0), 0.02);
      g.span(s * hw - (s > 0 ? 0 : 0.15), s * hw + (s > 0 ? 0.15 : 0), 0, 0.3, -hw, hw, 0.02);
    }
  }
  emblem(c, 'seed');
}

function sawmill(c: Ctx): void {
  const f = streetFace(c);
  if (!f) return;
  // A big saw blade hung on the wall and a stack of sawn planks by it.
  const g = c.M(1, f.frame);
  g.paint(IRON, c.seed).within(oriented(-f.width / 4, c.base + 3.2, 0.05, 0, Math.PI / 2), () => g.lathe([[0.001, 0], [0.9, 0], [0.95, 0.03], [0.001, 0.03]], 24));
  g.paint({ mat: 'boards' }, c.seed);
  for (let k = 0; k < 6; k++) g.span(f.width / 4 - 1.4, f.width / 4 + 1.4, c.base + k * 0.12, c.base + k * 0.12 + 0.1, 0.3, 0.9 - (k % 2) * 0.1);
}
