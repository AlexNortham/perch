/**
 * Street, yard and interior props (style guide §1.2, §5.6, §5.9): every PropAnchor of the dressing descriptor built as
 * a model fitted to its box (x across, y up, z along the yaw). Solid props skin a collision prim of the same box: the
 * environment covers that prim (the blockout leaves it out) and draws the model in band 2 so cover always shows.
 * Nature kinds (trees, reeds, ivy…) are built in nature.ts. Authored art data.
 */
import { Vector3 } from 'three';
import type { PropAnchor, PropKind } from '../../../../sim/core/contracts';
import type { Band } from '../constants';
import { oriented, placed } from '../mesher';
import type { Mesher, Paint } from '../mesher';
import { hash2 } from '../world';
import type { Pass, World } from '../world';
import { barrel, hangingFeeder, lantern, lanternPost } from './buildings';
import { nest } from './nest';
import { BRASS, FADED, FEATHER, IRON, MOSS, POT, ROPE, STRAW, TWIG, WATER } from './styles';

/** Kinds built by nature.ts. */
export const NATURE_KINDS: ReadonlySet<PropKind> = new Set<PropKind>([
  'tree', 'pine', 'canopy', 'roots', 'hollow', 'branch-nest', 'reeds', 'bramble', 'bush', 'flowers', 'ivy', 'moss', 'mushrooms', 'hedge',
]);

const TIMBER: Paint = { mat: 'timber' };
const TIMBER_DARK: Paint = { mat: 'timberDark' };
const SACK: Paint = { mat: 'canvas', tint: 0xb8a684 };
const STONE: Paint = { mat: 'ashlar' };
const SOIL: Paint = { mat: 'earth', shade: 0.85 };
const SEEDS = [0xe0c890, 0xb89060, 0x8a6a48, 0xd8b070] as const;

export interface PropCtx {
  readonly w: World;
  readonly p: PropAnchor;
  readonly seed: number;
  /** Mesher at the prop's frame (pos, yaw) for a band and pass. */
  M(band: Band, pass?: Pass): Mesher;
}

/** The faded flock tint for dressing at this z (§1.2: amber on Dawn's half, violet on Dusk's, cream near the centre). */
export function flockTint(z: number): number {
  return Math.abs(z) < 20 ? FADED.neutral : z < 0 ? FADED.dawn : FADED.dusk;
}

export function dressProps(w: World): void {
  const solidKey = new Map<string, number>();
  w.map.prims.forEach((q, i) => {
    if (q.solid && q.shape === 'box') solidKey.set(key(q.centre.x, q.centre.y, q.centre.z), i);
  });
  w.dressing.props.forEach((p, i) => {
    if (NATURE_KINDS.has(p.kind)) return;
    const ctx: PropCtx = {
      w, p, seed: 5003 + i * 37,
      M(band, pass = 'opaque') {
        const g = w.m(pass, band, p.pos.x, p.pos.z, p.pos.y);
        g.frame.copy(placed(p.pos.x, p.pos.y, p.pos.z, p.yaw));
        return g;
      },
    };
    if (p.solid) {
      const k = solidKey.get(key(p.pos.x, p.pos.y + p.size.y / 2, p.pos.z));
      if (k !== undefined) w.covered.add(k);
    }
    BUILD[p.kind]?.(ctx);
  });
}

const key = (x: number, y: number, z: number): string => `${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`;

type Builder = (c: PropCtx) => void;

// ── Builders ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** A planked crate with corner battens and a diagonal brace; tall anchors stack two. */
function crateAt(g: Mesher, x: number, y: number, z: number, sx: number, sy: number, sz: number, seed: number): void {
  g.paint({ mat: 'timber', tint: 0xd8c4a0 }, seed).span(x - sx / 2, x + sx / 2, y, y + sy, z - sz / 2, z + sz / 2, 0.03);
  g.paint(TIMBER_DARK, seed + 1);
  const t = 0.09;
  for (const [cx, cz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    g.span(x + cx * sx / 2 - t, x + cx * sx / 2 + t, y, y + sy, z + cz * sz / 2 - t, z + cz * sz / 2 + t, 0);
  }
  for (const yy of [y + 0.04, y + sy - 0.04]) {
    g.span(x - sx / 2 - 0.02, x + sx / 2 + 0.02, yy - 0.05, yy + 0.05, z - sz / 2 - 0.02, z + sz / 2 + 0.02, 0);
  }
  const len = Math.hypot(sx, sy) - 0.2;
  for (const s of [-1, 1]) g.within(oriented(x, y + sy / 2, z + s * (sz / 2 + 0.015), 0, 0, Math.atan2(sy, sx) * s), () => g.box(0, 0, 0, len, 0.1, 0.03));
}

const crate: Builder = (c) => {
  const { x: sx, y: sy, z: sz } = c.p.size;
  const g = c.M(2, 'cast');
  if (sy > 2.2) {
    crateAt(g, 0, 0, 0, sx, sy / 2, sz, c.seed);
    crateAt(g, (hash2(c.seed, 1) - 0.5) * 0.06, sy / 2, (hash2(c.seed, 2) - 0.5) * 0.06, sx - 0.06, sy / 2, sz - 0.06, c.seed + 7);
  } else crateAt(g, 0, 0, 0, sx, sy, sz, c.seed);
  // A burlap cover or seed sack on top of some.
  if (hash2(c.seed, 3) < 0.4) sack(c.M(1), (hash2(c.seed, 4) - 0.5) * sx * 0.4, sy, 0, 0.35, c.seed);
};

/** A sack: a slumped lathe with a tied neck. */
function sack(g: Mesher, x: number, y: number, z: number, r: number, seed: number, tint?: number): void {
  g.paint({ ...SACK, ...(tint !== undefined && { tint }) }, seed).within(oriented(x, y, z, hash2(seed, 1) * 3, (hash2(seed, 2) - 0.5) * 0.4), () => {
    g.lathe([[r * 0.8, 0], [r * 1.05, r * 0.25], [r, r * 0.9], [r * 0.75, r * 1.45], [r * 0.3, r * 1.75], [r * 0.22, r * 1.9], [r * 0.3, r * 2.05], [0.001, r * 2.1]], 9);
  });
  g.paint(ROPE, seed).within(placed(x, y + r * 1.82, z, 0), () => g.lathe([[r * 0.26, -0.03], [r * 0.26, 0.03]], 6));
}

const sacks: Builder = (c) => {
  const { x: sx, y: sy, z: sz } = c.p.size;
  const g = c.M(2, 'cast');
  // A heap filling the box: a bottom row, then a top row.
  const r = Math.min(sx, sz) / 4.2;
  const nx = Math.max(1, Math.round(sx / (r * 2.1)));
  const nz = Math.max(1, Math.round(sz / (r * 2.1)));
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
    sack(g, -sx / 2 + (sx * (i + 0.5)) / nx, 0, -sz / 2 + (sz * (k + 0.5)) / nz, r * 1.05, c.seed + i * 7 + k, (i + k) % 2 === 0 ? 0xc8b48c : 0xb09a78);
  }
  for (let i = 0; i < Math.max(1, nx - 1); i++) sack(g, -sx / 2 + (sx * (i + 1)) / nx, r * 1.7, (hash2(c.seed, i) - 0.5) * sz * 0.3, r, c.seed + 50 + i);
  // A spill of seed at the foot.
  seedHeap(c.M(0), sx / 2 + 0.15, 0, 0, 0.25, c.seed);
  void sy;
};

function seedHeap(g: Mesher, x: number, y: number, z: number, r: number, seed: number): void {
  g.paint({ mat: 'gravel', tint: SEEDS[Math.floor(hash2(seed, 9) * SEEDS.length)] }, seed).within(placed(x, y, z, 0), () => g.lathe([[r, 0], [r * 0.6, r * 0.25], [0.001, r * 0.35]], 8));
}

const barrels: Builder = (c) => {
  const { x: sx, y: sy, z: sz } = c.p.size;
  const r = (Math.min(sx, sz) / 2) * 1.02;
  barrel(c.M(c.p.solid ? 2 : 1, c.p.solid ? 'cast' : 'opaque'), 0, 0, 0, r, sy, c.seed);
};

const cart: Builder = (c) => {
  const { x: sx, y: sy, z: sz } = c.p.size;
  const g = c.M(2, 'cast');
  const bed = 0.75;
  g.paint(TIMBER, c.seed).span(-sx / 2 + 0.1, sx / 2 - 0.1, bed, bed + 0.12, -sz / 2 + 0.2, sz / 2 - 0.4, 0.02);
  g.paint({ mat: 'timber', tint: 0xb8a080 }, c.seed + 1);
  for (const s of [-1, 1]) g.span(s * (sx / 2 - 0.1) - 0.05, s * (sx / 2 - 0.1) + 0.05, bed, bed + 0.5, -sz / 2 + 0.2, sz / 2 - 0.4, 0.015);
  g.span(-sx / 2 + 0.1, sx / 2 - 0.1, bed, bed + 0.5, -sz / 2 + 0.15, -sz / 2 + 0.25, 0.015);
  // Wheels: rim, hub and spokes.
  g.paint(TIMBER_DARK, c.seed + 2);
  for (const s of [-1, 1]) {
    g.within(oriented(s * (sx / 2 - 0.02), bed - 0.05, 0, Math.PI / 2, 0, Math.PI / 2), () => {
      const rim: Vector3[] = [];
      for (let k = 0; k <= 16; k++) rim.push(new Vector3(Math.cos((k / 16) * Math.PI * 2) * 0.62, 0, Math.sin((k / 16) * Math.PI * 2) * 0.62));
      g.tube(rim, 0.06, 5);
      g.lathe([[0.12, -0.12], [0.12, 0.12]], 8);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        g.tube([new Vector3(Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1), new Vector3(Math.cos(a) * 0.58, 0, Math.sin(a) * 0.58)], 0.03, 4);
      }
    });
  }
  // Shafts.
  for (const s of [-0.4, 0.4]) g.tube([new Vector3(s, bed + 0.05, sz / 2 - 0.5), new Vector3(s * 0.8, 0.35, sz / 2 + 0.1)], 0.05, 5);
  // A load of sacks and a crate.
  const g1 = c.M(1);
  sack(g1, -0.4, bed + 0.12, -0.2, 0.3, c.seed + 5);
  sack(g1, 0.35, bed + 0.12, 0.1, 0.28, c.seed + 6, 0xc8b48c);
  crateAt(g1, 0.1, bed + 0.12, -sz / 2 + 0.7, 0.7, 0.6, 0.6, c.seed + 7);
  void sy;
};

const planter: Builder = (c) => {
  const { x: sx, y: sy, z: sz } = c.p.size;
  const g = c.M(2, 'cast');
  const rim = 0.12;
  g.paint(STONE, c.seed).span(-sx / 2 + 0.06, sx / 2 - 0.06, 0, sy - rim, -sz / 2 + 0.06, sz / 2 - 0.06, 0.04);
  g.paint({ mat: 'ashlar', shade: 0.85 }, c.seed + 1).span(-sx / 2, sx / 2, 0, 0.18, -sz / 2, sz / 2, 0.03);
  g.paint({ mat: 'ashlar', tint: 0xf0e8d8 }, c.seed + 2).span(-sx / 2, sx / 2, sy - rim, sy, -sz / 2, sz / 2, 0.035);
  g.paint(SOIL, c.seed).span(-sx / 2 + 0.12, sx / 2 - 0.12, sy - 0.04, sy + 0.01, -sz / 2 + 0.12, sz / 2 - 0.12);
  // A clipped round shrub or flowers (seeded).
  if (hash2(c.seed, 3) < 0.6) {
    g.paint({ mat: 'hedge' }, c.seed).within(placed(0, sy, 0, 0), () => g.lathe([[0.001, 0], [sx * 0.35, 0.12], [sx * 0.42, sx * 0.4], [sx * 0.3, sx * 0.7], [0.001, sx * 0.8]], 10));
  } else {
    const gc = c.M(1, 'cutout');
    gc.paint({ mat: 'leafCard', tint: 0x9cbf7a }, c.seed);
    for (let k = 0; k < 5; k++) gc.card2(new Vector3((hash2(c.seed, k) - 0.5) * sx * 0.6, sy + 0.25, (hash2(c.seed, k + 5) - 0.5) * sz * 0.6), new Vector3(0.3, 0, 0.12 * (k % 2 ? 1 : -1)), new Vector3(0, 0.25, 0));
    const g0 = c.M(0);
    g0.paint({ mat: 'plaster', tint: k2(c.seed), shade: 1.05 }, c.seed);
    for (let k = 0; k < 9; k++) g0.box((hash2(c.seed, k + 20) - 0.5) * sx * 0.7, sy + 0.25 + hash2(c.seed, k + 30) * 0.25, (hash2(c.seed, k + 40) - 0.5) * sz * 0.7, 0.08, 0.06, 0.08);
  }
};

const k2 = (seed: number): number => (hash2(seed, 77) < 0.5 ? 0xe7a1b0 : 0xf2d46b);

const counter: Builder = (c) => {
  const { x: sx, y: sy, z: sz } = c.p.size;
  const g = c.M(2, 'cast');
  g.paint(TIMBER, c.seed).span(-sx / 2 + 0.04, sx / 2 - 0.04, 0, sy - 0.08, -sz / 2 + 0.04, sz / 2 - 0.04, 0.02);
  g.paint({ mat: 'timberDark' }, c.seed + 1).span(-sx / 2 - 0.04, sx / 2 + 0.04, sy - 0.08, sy, -sz / 2 - 0.06, sz / 2 + 0.06, 0.02);
  g.paint({ mat: 'timberDark' }, c.seed + 2).span(-sx / 2, sx / 2, 0, 0.12, -sz / 2, sz / 2, 0.02);
  // Panelled front: raised panels on the long faces.
  const long = sx >= sz;
  const len = long ? sx : sz;
  const n = Math.max(1, Math.round(len / 0.9));
  const g1 = c.M(1);
  g1.paint({ mat: 'timber', tint: 0xc8b090 }, c.seed + 3);
  for (let k = 0; k < n; k++) {
    const a = -len / 2 + (len * k) / n + 0.08;
    const b = -len / 2 + (len * (k + 1)) / n - 0.08;
    for (const s of [-1, 1]) {
      if (long) g1.span(a, b, 0.22, sy - 0.2, s * (sz / 2) - 0.02, s * (sz / 2) + 0.02);
      else g1.span(s * (sx / 2) - 0.02, s * (sx / 2) + 0.02, 0.22, sy - 0.2, a, b);
    }
  }
  // Wares: a brass scale, scoops and seed bowls (§5.9 Market Hall).
  const g0 = c.M(0);
  const along = (t: number): [number, number] => (long ? [t * len, 0] : [0, t * len]);
  const [bx, bz] = along(-0.3);
  scale(g0, bx, sy, bz, c.seed);
  for (let k = 0; k < 3; k++) {
    const [x, z] = along(0.05 + k * 0.14);
    bowl(g0, x, sy, z, 0.16, c.seed + k);
  }
};

/** A brass balance scale. */
function scale(g: Mesher, x: number, y: number, z: number, seed: number): void {
  g.paint(BRASS, seed);
  g.within(placed(x, y, z, 0), () => {
    g.lathe([[0.1, 0], [0.08, 0.03], [0.02, 0.05], [0.02, 0.42]], 8);
    g.box(0, 0.42, 0, 0.5, 0.025, 0.025);
    for (const s of [-1, 1]) g.within(placed(s * 0.24, 0.2, 0, 0), () => g.lathe([[0.001, 0], [0.1, 0.02], [0.12, 0.05]], 8));
  });
}

function bowl(g: Mesher, x: number, y: number, z: number, r: number, seed: number): void {
  g.paint(POT, seed).within(placed(x, y, z, 0), () => g.lathe([[r * 0.5, 0], [r * 0.9, r * 0.35], [r, r * 0.6], [r * 0.9, r * 0.6]], 8));
  g.paint({ mat: 'gravel', tint: SEEDS[Math.floor(hash2(seed, 3) * SEEDS.length)] }, seed).within(placed(x, y + r * 0.45, z, 0), () => g.lathe([[r * 0.88, 0], [0.001, r * 0.18]], 8));
}

const logs: Builder = (c) => {
  const { x: sx, y: sy, z: sz } = c.p.size;
  const g = c.M(2, 'cast');
  // Logs lie along local z, stacked in a pyramid that fills the box.
  const r = Math.min(sx / 6.2, sy / 5.2);
  const rows = Math.max(1, Math.floor(sy / (r * 1.75)));
  for (let row = 0; row < rows; row++) {
    const n = Math.max(1, Math.floor(sx / (r * 2.05)) - row);
    for (let k = 0; k < n; k++) {
      const x = -((n - 1) * r * 2.05) / 2 + k * r * 2.05;
      const y = r + row * r * 1.75;
      const len = sz * (0.92 + hash2(c.seed, row * 9 + k) * 0.08);
      g.paint({ mat: 'bark' }, c.seed + row * 9 + k).within(oriented(x, y, 0, 0, Math.PI / 2), () => {
        g.lathe([[r, -len / 2], [r * 1.03, 0], [r, len / 2]], 9);
        g.paint({ mat: 'timber', tint: 0xe0c8a0 }, c.seed + k);
        g.disc(0, len / 2, 0, r * 0.95, 9, 1);
        g.disc(0, -len / 2, 0, r * 0.95, 9, -1);
      });
    }
  }
  // Moss on the top log and a mushroom or two at the foot.
  const g0 = c.M(0);
  g0.paint({ mat: 'plaster', tint: 0xd8c8a8 }, c.seed);
  for (let k = 0; k < 2; k++) g0.within(placed(sx / 2 - 0.1 * k, 0, (hash2(c.seed, k) - 0.5) * sz * 0.8, 0), () => g0.lathe([[0.03, 0], [0.03, 0.08], [0.09, 0.09], [0.001, 0.14]], 7));
};

const table: Builder = (c) => {
  const { x: sx, y: sy, z: sz } = c.p.size;
  const g = c.M(1);
  g.paint(TIMBER, c.seed).span(-sx / 2, sx / 2, sy - 0.08, sy, -sz / 2, sz / 2, 0.025);
  g.paint(TIMBER_DARK, c.seed + 1);
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) g.span(a * (sx / 2 - 0.12) - 0.05, a * (sx / 2 - 0.12) + 0.05, 0, sy - 0.08, b * (sz / 2 - 0.12) - 0.05, b * (sz / 2 - 0.12) + 0.05);
  // Perch-height stools around it and a seed bowl, a nectar jug.
  const g0 = c.M(0);
  bowl(g0, -0.2, sy, 0.1, 0.18, c.seed);
  g0.paint(POT, c.seed).within(placed(0.25, sy, -0.15, 0), () => g0.lathe([[0.08, 0], [0.11, 0.1], [0.07, 0.22], [0.05, 0.28], [0.07, 0.3]], 8));
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.4;
    const x = Math.cos(a) * (sx / 2 + 0.45);
    const z = Math.sin(a) * (sz / 2 + 0.45);
    g.paint(TIMBER, c.seed + k).within(placed(x, 0, z, 0), () => {
      g.lathe([[0.18, 0.62], [0.2, 0.66], [0.001, 0.68]], 8);
      g.lathe([[0.05, 0], [0.04, 0.62]], 5);
      g.tube([new Vector3(-0.15, 0.25, 0), new Vector3(0.15, 0.25, 0)], 0.02, 4);
    });
  }
};

const shelf: Builder = (c) => {
  const { x: sx, y: sy, z: sz } = c.p.size;
  const g = c.M(1);
  g.paint(TIMBER, c.seed);
  for (const s of [-1, 1]) g.span(-sx / 2, sx / 2, 0, sy, s * sz / 2 - 0.06, s * sz / 2, 0.01);
  const levels = 4;
  for (let k = 0; k < levels; k++) {
    const y = 0.3 + (k * (sy - 0.4)) / (levels - 1);
    g.span(-sx / 2, sx / 2, y - 0.04, y, -sz / 2, sz / 2, 0.01);
  }
  g.paint({ mat: 'boards', shade: 0.7 }, c.seed).span(-sx / 2, -sx / 2 + 0.03, 0, sy, -sz / 2, sz / 2);
  // Jars, bundles and sacks on the shelves (§5.9 wall dressing).
  const g0 = c.M(0);
  for (let k = 0; k < levels; k++) {
    const y = 0.3 + (k * (sy - 0.4)) / (levels - 1);
    for (let z = -sz / 2 + 0.25; z < sz / 2 - 0.2; z += 0.32 + hash2(c.seed, z * 10 + k) * 0.25) {
      const r = hash2(c.seed, z + k * 3);
      if (r < 0.45) {
        g0.paint(r < 0.2 ? POT : { mat: 'glass', tint: 0x9fb8b0, shade: 2 }, c.seed + k).within(placed(0, y, z, 0), () => g0.lathe([[0.09, 0], [0.11, 0.08], [0.1, 0.2], [0.06, 0.24], [0.07, 0.27]], 7));
      } else if (r < 0.75) {
        sack(g0, 0, y, z, 0.11, c.seed + k * 13);
      } else {
        // A bundle of twigs, tied.
        g0.paint(TWIG, c.seed).within(oriented(0, y + 0.07, z, 0, Math.PI / 2), () => g0.lathe([[0.07, -0.22], [0.08, 0], [0.07, 0.22]], 6));
      }
    }
  }
};

const signpost: Builder = (c) => {
  const { y: sy } = c.p.size;
  const g = c.M(1);
  g.paint(TIMBER_DARK, c.seed).span(-0.08, 0.08, 0, sy, -0.08, 0.08, 0.02);
  g.paint(TIMBER_DARK, c.seed).within(placed(0, sy, 0, 0), () => g.lathe([[0.1, 0], [0.001, 0.15]], 4));
  // Pointer boards shaped as flying birds (no lettering): body, wings, tail fork.
  for (let k = 0; k < 2; k++) {
    const y = sy - 0.45 - k * 0.5;
    const dir = k % 2 ? 1 : -1;
    g.paint({ mat: 'timber', tint: [0xd8c8a8, 0xa8b89a][k] }, c.seed + k).within(placed(0, y, 0, dir > 0 ? 0.3 : 2.6), () => {
      g.span(0, 0.75, -0.11, 0.11, -0.025, 0.025);
      g.within(oriented(0.82, 0, 0, 0, 0, 0.785), () => g.box(0, 0, 0, 0.16, 0.16, 0.05));
      for (const s of [-1, 1]) g.within(oriented(0.4, s * 0.12, 0, 0, 0, s * 0.5), () => g.box(0, 0, 0, 0.3, 0.06, 0.04));
    });
  }
};

/** A market stall (§5.6): posts, a striped canvas roof with a feather-cut edge, a counter heaped with goods. */
function stallAt(c: PropCtx, seedGoods: boolean): void {
  const { x: sx, y: sy, z: sz } = c.p.size;
  const g = c.M(2, 'cast');
  // The stall's front faces local +z; posts at the corners.
  const [w, d] = sx >= sz ? [sx, sz] : [sz, sx];
  const turn = sx >= sz ? 0 : Math.PI / 2;
  g.within(placed(0, 0, 0, turn), () => {
    g.paint(TIMBER_DARK, c.seed);
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) g.span(a * (w / 2 - 0.08) - 0.06, a * (w / 2 - 0.08) + 0.06, 0, sy - 0.1 - (b > 0 ? 0.3 : 0), b * (d / 2 - 0.08) - 0.06, b * (d / 2 - 0.08) + 0.06);
    g.paint({ mat: 'canvas', tint: hash2(c.seed, 1) < 0.5 ? 0x8c9a74 : 0xa08060 }, c.seed + 1);
    const back = new Vector3(0, sy, -d / 2 - 0.1);
    const front = new Vector3(0, sy - 0.45, d / 2 + 0.35);
    const a = new Vector3(-w / 2 - 0.15, back.y, back.z);
    const b = new Vector3(w / 2 + 0.15, back.y, back.z);
    const cc = new Vector3(w / 2 + 0.15, front.y, front.z);
    const dd = new Vector3(-w / 2 - 0.15, front.y, front.z);
    g.quad(a, b, cc, dd);
    g.quad(dd, cc, b, a);
    const n = Math.max(4, Math.round(w / 0.4));
    for (let k = 0; k < n; k++) {
      const x0 = -w / 2 - 0.15 + ((w + 0.3) * k) / n;
      const x1 = x0 + (w + 0.3) / n;
      const tip = new Vector3((x0 + x1) / 2, front.y - 0.25, front.z + 0.02);
      g.poly([new Vector3(x0, front.y, front.z), new Vector3(x1, front.y, front.z), tip], new Vector3(0, 0, 1));
      g.poly([new Vector3(x0, front.y, front.z), new Vector3(x1, front.y, front.z), tip], new Vector3(0, 0, -1));
    }
    g.paint(TIMBER, c.seed + 2).span(-w / 2 + 0.1, w / 2 - 0.1, 0, 1.0, -d / 2 + 0.15, d / 2 - 0.15, 0.02);
    g.paint({ mat: 'timberDark' }, c.seed + 3).span(-w / 2 + 0.05, w / 2 - 0.05, 1.0, 1.08, -d / 2 + 0.1, d / 2 - 0.05, 0.02);
    // Goods: open sacks of seed with scoops, berry crates, worm jars.
    const g1 = c.M(1);
    g1.within(placed(0, 0, 0, turn), () => {
      const n2 = Math.max(2, Math.round(w / 0.7));
      for (let k = 0; k < n2; k++) {
        const x = -w / 2 + 0.35 + ((w - 0.7) * k) / Math.max(1, n2 - 1);
        const r = hash2(c.seed, k + 10);
        if (seedGoods || r < 0.5) {
          openSack(g1, x, 1.08, 0, 0.22, c.seed + k);
        } else if (r < 0.75) {
          berryCrate(g1, x, 1.08, 0, c.seed + k);
        } else {
          g1.paint({ mat: 'glass', tint: 0xb0c8b8, shade: 2 }, c.seed + k).within(placed(x, 1.08, 0, 0), () => g1.lathe([[0.1, 0], [0.12, 0.1], [0.11, 0.26], [0.07, 0.3], [0.08, 0.33]], 8));
        }
      }
      if (seedGoods) scale(g1, w / 2 - 0.4, 1.08, -d / 2 + 0.35, c.seed);
    });
  });
}

function openSack(g: Mesher, x: number, y: number, z: number, r: number, seed: number): void {
  g.paint(SACK, seed).within(placed(x, y, z, 0), () => g.lathe([[r * 0.85, 0], [r, r * 0.6], [r * 1.05, r * 1.4], [r * 1.15, r * 1.6], [r * 1.08, r * 1.65], [r * 0.95, r * 1.5]], 9));
  g.paint({ mat: 'gravel', tint: SEEDS[Math.floor(hash2(seed, 2) * SEEDS.length)] }, seed).within(placed(x, y + r * 1.45, z, 0), () => g.lathe([[r * 0.96, 0], [r * 0.5, r * 0.25], [0.001, r * 0.32]], 9));
  if (hash2(seed, 5) < 0.5) g.paint(BRASS, seed).within(oriented(x + r * 0.3, y + r * 1.75, z, 0.4, 0.5), () => g.box(0, 0, 0, 0.08, 0.05, 0.22));
}

function berryCrate(g: Mesher, x: number, y: number, z: number, seed: number): void {
  g.paint(TIMBER, seed).span(x - 0.25, x + 0.25, y, y + 0.16, z - 0.18, z + 0.18);
  // Dark red-purple berries (never the Berry pickup's look, §1.3).
  g.paint({ mat: 'plaster', tint: 0x6a2840, shade: 0.9 }, seed);
  for (let k = 0; k < 10; k++) g.box(x - 0.2 + hash2(seed, k) * 0.4, y + 0.17 + hash2(seed, k + 3) * 0.04, z - 0.14 + hash2(seed, k + 6) * 0.28, 0.06, 0.06, 0.06);
}

const stall: Builder = (c) => stallAt(c, false);
const seedStall: Builder = (c) => stallAt(c, true);

/** Feeders (§1.2): a tray on a post, or a hanging tube feeder / seed-cake cage. */
const feeder: Builder = (c) => {
  const { y: sy } = c.p.size;
  const g = c.M(1);
  const kind = hash2(c.seed, 1);
  if (c.p.pos.y < 0.5) {
    g.paint(TIMBER_DARK, c.seed).span(-0.05, 0.05, 0, sy - 0.2, -0.05, 0.05, 0.015);
    hangingFeeder(g, 0, sy + 0.42, 0, c.seed);
    return;
  }
  // Hanging: a rope up to the bough or beam above.
  g.paint(ROPE, c.seed).tube([new Vector3(0, sy, 0), new Vector3(0, sy + 1.2, 0)], 0.015, 3);
  if (kind < 0.5) {
    // Tube feeder: glass tube of seed, brass ports with perch pegs.
    g.paint({ mat: 'glass', tint: 0xc0d0c8, shade: 2 }, c.seed).within(placed(0, 0.15, 0, 0), () => g.lathe([[0.09, 0], [0.09, sy - 0.35]], 10));
    g.paint({ mat: 'gravel', tint: 0xe0c890 }, c.seed).within(placed(0, 0.16, 0, 0), () => g.lathe([[0.08, 0], [0.08, (sy - 0.35) * 0.7]], 8));
    g.paint(BRASS, c.seed);
    g.within(placed(0, sy - 0.22, 0, 0), () => g.lathe([[0.12, 0], [0.001, 0.14]], 10));
    g.within(placed(0, 0.08, 0, 0), () => g.lathe([[0.001, 0], [0.12, 0.02], [0.12, 0.08]], 10));
    for (let k = 0; k < 2; k++) {
      const y = 0.3 + k * 0.4;
      g.tube([new Vector3(-0.2, y, 0), new Vector3(0.2, y, 0)].map((v) => v.applyAxisAngle(new Vector3(0, 1, 0), k * 1.57)), 0.012, 4);
    }
  } else {
    // Seed-cake cage.
    g.paint({ mat: 'gravel', tint: 0xc8a870 }, c.seed).span(-0.14, 0.14, 0.2, sy - 0.3, -0.06, 0.06);
    g.paint(IRON, c.seed);
    for (const s of [-1, 1]) g.span(-0.16, 0.16, 0.18, sy - 0.28, s * 0.075 - 0.008, s * 0.075 + 0.008);
    g.within(placed(0, sy - 0.3, 0, 0), () => g.lathe([[0.2, 0], [0.001, 0.12]], 4));
  }
};

/** A stone bird bath (§1.2): basin 1.2–2.0 m on a 0.9 m pedestal, shallow water with a floating feather. */
const birdBath: Builder = (c) => {
  const { x: sx, y: sy } = c.p.size;
  const r = sx / 2;
  const g = c.M(2, 'cast');
  g.paint(STONE, c.seed).within(placed(0, 0, 0, 0), () => {
    g.lathe([[r * 0.45, 0], [r * 0.45, 0.12], [r * 0.22, 0.2], [r * 0.16, sy * 0.5], [r * 0.2, sy - 0.25], [r * 0.6, sy - 0.12], [r, sy - 0.06], [r, sy], [r * 0.88, sy], [r * 0.8, sy - 0.1]], 16);
  });
  g.paint(WATER, c.seed).disc(0, sy - 0.07, 0, r * 0.84, 16, 1);
  const g0 = c.M(0, 'cutout');
  g0.paint(FEATHER, c.seed).card2(new Vector3(r * 0.3, sy - 0.06, 0.1), new Vector3(0.05, 0, 0.02), new Vector3(-0.02, 0, 0.14));
  mossRing(c.M(1), r * 0.45, 0.13, c.seed);
};

function mossRing(g: Mesher, r: number, y: number, seed: number): void {
  g.paint(MOSS, seed).within(placed(0, 0, 0, 0), () => g.lathe([[r + 0.04, 0], [r + 0.03, y], [r * 0.7, y + 0.02]], 12));
}

/** A tiered fountain (§1.2): a moulded basin, a column, a bowl and a carved bird spouting into it. */
const fountain: Builder = (c) => {
  const { x: sx, y: sy } = c.p.size;
  const r = sx / 2;
  const g = c.M(2, 'cast');
  const base = -c.p.pos.y;
  g.paint(STONE, c.seed).lathe([[r * 1.6, base], [r * 1.6, 0.45], [r * 1.66, 0.5], [r * 1.66, 0.6], [r * 1.5, 0.6], [r * 1.45, 0.15]], 20);
  g.paint(WATER, c.seed).disc(0, 0.42, 0, r * 1.48, 20, 1);
  g.paint({ mat: 'ashlar', tint: 0xf0e4d0 }, c.seed + 1).lathe([[r * 0.25, 0.15], [r * 0.2, sy * 0.9], [r * 0.28, sy], [r * 0.75, sy + 0.25], [r * 0.8, sy + 0.38], [r * 0.7, sy + 0.38], [r * 0.3, sy + 0.25]], 14);
  g.paint(WATER, c.seed).disc(0, sy + 0.33, 0, r * 0.7, 14, 1);
  // The bird: a sleek body with lifted wings, bill open over the bowl.
  g.paint({ mat: 'verdigris' }, c.seed + 2).within(placed(0, sy + 0.38, 0, hash2(c.seed, 3) * 6), () => {
    g.lathe([[0.001, 0], [0.16, 0.08], [0.2, 0.3], [0.14, 0.5], [0.1, 0.62], [0.12, 0.72], [0.001, 0.82]], 10);
    g.within(oriented(0, 0.72, 0.12, 0, 0.2), () => g.box(0, 0, 0, 0.06, 0.06, 0.2));
    for (const s of [-1, 1]) g.within(oriented(s * 0.2, 0.42, -0.02, 0, 0, s * 0.7), () => g.box(0, 0, 0, 0.42, 0.06, 0.24, 0.02));
  });
  mossRing(c.M(1), r * 1.62, 0.3 - c.p.pos.y, c.seed);
};

/** Worm beds (§1.2): raised soil in a timber kerb, worm casts and a few sprouts. */
const wormBed: Builder = (c) => {
  const { x: sx, y: sy, z: sz } = c.p.size;
  const g = c.M(1);
  g.paint(TIMBER, c.seed);
  for (const s of [-1, 1]) {
    g.span(-sx / 2, sx / 2, 0, sy, s * sz / 2 - 0.06, s * sz / 2, 0.01);
    g.span(s * sx / 2 - 0.06, s * sx / 2, 0, sy, -sz / 2, sz / 2, 0.01);
  }
  g.paint({ mat: 'earth', tint: 0x8a7058 }, c.seed).span(-sx / 2 + 0.06, sx / 2 - 0.06, 0, sy - 0.03, -sz / 2 + 0.06, sz / 2 - 0.06);
  const g0 = c.M(0);
  g0.paint({ mat: 'earth', tint: 0xa08870 }, c.seed);
  for (let k = 0; k < 10; k++) {
    const x = (hash2(c.seed, k) - 0.5) * (sx - 0.3);
    const z = (hash2(c.seed, k + 20) - 0.5) * (sz - 0.3);
    g0.tube([new Vector3(x, sy - 0.02, z), new Vector3(x + 0.05, sy + 0.02, z + 0.03), new Vector3(x + 0.02, sy + 0.04, z + 0.07)], 0.018, 4);
  }
  const gc = c.M(0, 'cutout');
  gc.paint({ mat: 'leafCard', tint: 0xa8c888 }, c.seed);
  for (let k = 0; k < 5; k++) gc.card2(new Vector3((hash2(c.seed, k + 40) - 0.5) * (sx - 0.3), sy + 0.1, (hash2(c.seed, k + 50) - 0.5) * (sz - 0.3)), new Vector3(0.1, 0, 0.04), new Vector3(0, 0.1, 0));
};

/** Insect hives (§1.2): a coiled straw bee skep on a stand, a beetle log or a moth lantern. */
const insectHive: Builder = (c) => {
  const { y: sy } = c.p.size;
  const g = c.M(1);
  const r = hash2(c.seed, 1);
  if (r < 0.6) {
    g.paint(TIMBER, c.seed).span(-0.45, 0.45, 0.5, 0.58, -0.45, 0.45, 0.015);
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) g.span(a * 0.38 - 0.04, a * 0.38 + 0.04, 0, 0.5, b * 0.38 - 0.04, b * 0.38 + 0.04);
    const h = sy - 0.6;
    g.paint(STRAW, c.seed).within(placed(0, 0.58, 0, 0), () => {
      const prof: [number, number][] = [];
      for (let k = 0; k <= 8; k++) {
        const t = k / 8;
        const rr = 0.38 * Math.sqrt(Math.max(0, 1 - t * t * 0.92)) + (k % 2) * 0.02;
        prof.push([rr, t * h]);
      }
      prof.push([0.001, h + 0.02]);
      g.lathe(prof, 12);
    });
    g.paint({ mat: 'timberDark', shade: 0.3 }, c.seed).span(-0.07, 0.07, 0.58, 0.68, 0.33, 0.37);
  } else if (r < 0.8) {
    // A beetle log: a hollow log riddled with holes.
    g.paint({ mat: 'bark' }, c.seed).within(oriented(0, 0.3, 0, 0.3, Math.PI / 2), () => g.lathe([[0.3, -0.5], [0.32, 0], [0.3, 0.5]], 9));
    g.paint({ mat: 'timberDark', shade: 0.3 }, c.seed);
    for (let k = 0; k < 6; k++) g.box((hash2(c.seed, k) - 0.5) * 0.6, 0.45 + hash2(c.seed, k + 5) * 0.12, (hash2(c.seed, k + 9) - 0.5) * 0.3, 0.05, 0.05, 0.05);
  } else {
    lanternPost(g, 0, 0, 0, sy, c.seed);
  }
};

/** Nesting material (§1.2): bundles of twigs, moss, wool, string and reed leaning together. */
const nestPile: Builder = (c) => {
  const { x: sx, y: sy, z: sz } = c.p.size;
  const g = c.M(1);
  const n = 4 + Math.floor(hash2(c.seed, 1) * 3);
  for (let k = 0; k < n; k++) {
    const x = (hash2(c.seed, k) - 0.5) * sx * 0.7;
    const z = (hash2(c.seed, k + 10) - 0.5) * sz * 0.7;
    const kind = k % 4;
    if (kind === 0 || kind === 3) {
      // A tied bundle of twigs or reeds leaning over.
      g.paint(kind === 0 ? TWIG : { mat: 'thatch' }, c.seed + k).within(oriented(x, 0, z, hash2(c.seed, k + 20) * 6, 0.25 + hash2(c.seed, k + 30) * 0.4), () => g.lathe([[0.1, 0], [0.14, sy * 0.2], [0.1, sy * 0.5], [0.16, sy * 1.1], [0.001, sy * 1.15]], 7));
      g.paint(ROPE, c.seed).within(oriented(x, 0, z, hash2(c.seed, k + 20) * 6, 0.25 + hash2(c.seed, k + 30) * 0.4), () => g.lathe([[0.12, sy * 0.45], [0.12, sy * 0.52]], 7));
    } else if (kind === 1) {
      // A ball of wool.
      g.paint({ mat: 'canvas', tint: [0xe8e0d0, 0xc8b8a8, 0xb8c0c8][k % 3] }, c.seed + k).within(placed(x, 0, z, 0), () => g.lathe([[0.001, 0], [0.2, 0.08], [0.24, 0.24], [0.18, 0.4], [0.001, 0.45]], 9));
    } else {
      // A heap of moss.
      g.paint(MOSS, c.seed + k).within(placed(x, 0, z, 0), () => g.lathe([[0.32, 0], [0.26, 0.15], [0.12, 0.26], [0.001, 0.28]], 9));
    }
  }
};

/** Feather banners (§1.2): feather-cut pennants on a pole, faded flock tint by half. */
const featherBanner: Builder = (c) => {
  const { y: sy, z: sz } = c.p.size;
  const g = c.M(2);
  const tint = flockTint(c.p.pos.z);
  g.paint(TIMBER_DARK, c.seed).tube([new Vector3(0, sy / 2 + 0.3, -sz / 2 - 0.1), new Vector3(0, sy / 2 + 0.3, sz / 2 + 0.1)], 0.04, 6);
  // A long feather: rachis down the middle, vane cut into a few notched lobes, drawn as a double-sided strip.
  const lobes = 6;
  g.paint({ mat: 'canvas', tint }, c.seed + 1);
  for (let k = 0; k < lobes; k++) {
    const t0 = k / lobes;
    const t1 = (k + 1) / lobes;
    const y0 = sy / 2 + 0.25 - t0 * sy;
    const y1 = sy / 2 + 0.25 - t1 * sy;
    const w0 = (sz / 2) * Math.sin(Math.PI * (0.15 + t0 * 0.85));
    const w1 = (sz / 2) * Math.sin(Math.PI * (0.15 + t1 * 0.85)) * 0.85;
    const pts = [new Vector3(0, y0, -w0), new Vector3(0, y0, w0), new Vector3(0, y1, w1 * 0.9), new Vector3(0, y1 - 0.06, 0), new Vector3(0, y1, -w1 * 0.9)];
    g.poly(pts, new Vector3(1, 0, 0));
    g.poly(pts, new Vector3(-1, 0, 0));
  }
  g.paint({ mat: 'canvas', tint: 0xf0e8d8 }, c.seed + 2).span(-0.02, 0.02, -sy / 2 + 0.25, sy / 2 + 0.25, -0.02, 0.02);
};

/** Roost rails: dowel rails on posts; a square anchor rings the space it frames (belfry tops). */
const roostRail: Builder = (c) => {
  const { x: sx, z: sz } = c.p.size;
  const g = c.M(1);
  g.paint(TIMBER, c.seed);
  const ring = sx > 1 && sz > 1;
  const sides: [Vector3, Vector3][] = ring
    ? [[new Vector3(-sx / 2, 0, -sz / 2), new Vector3(sx / 2, 0, -sz / 2)], [new Vector3(sx / 2, 0, -sz / 2), new Vector3(sx / 2, 0, sz / 2)], [new Vector3(sx / 2, 0, sz / 2), new Vector3(-sx / 2, 0, sz / 2)], [new Vector3(-sx / 2, 0, sz / 2), new Vector3(-sx / 2, 0, -sz / 2)]]
    : sx >= sz ? [[new Vector3(-sx / 2, 0, 0), new Vector3(sx / 2, 0, 0)]] : [[new Vector3(0, 0, -sz / 2), new Vector3(0, 0, sz / 2)]];
  for (const [a, b] of sides) {
    const len = a.distanceTo(b);
    const n = Math.max(2, Math.round(len / 1.5) + 1);
    for (let k = 0; k < n; k++) {
      const p = a.clone().lerp(b, k / (n - 1));
      g.span(p.x - 0.05, p.x + 0.05, -0.6, 0.05, p.z - 0.05, p.z + 0.05);
    }
    g.tube([a.clone().setY(0.08), b.clone().setY(0.08)], 0.04, 6);
  }
};

/** Perch poles: a tall turned pole with crossbars and a cap. */
const perchPole: Builder = (c) => {
  const { y: sy } = c.p.size;
  const g = c.M(1);
  g.paint(TIMBER, c.seed).lathe([[0.1, 0], [0.08, 0.3], [0.07, sy], [0.1, sy + 0.05], [0.001, sy + 0.18]], 8);
  for (let k = 0; k < 3; k++) {
    const y = sy * (0.45 + k * 0.22);
    const a = k * 1.1 + hash2(c.seed, k);
    g.tube([new Vector3(-Math.cos(a) * 0.45, y, -Math.sin(a) * 0.45), new Vector3(Math.cos(a) * 0.45, y, Math.sin(a) * 0.45)], 0.03, 5);
  }
};

const nestCrown: Builder = (c) => {
  const { x: sx, y: sy } = c.p.size;
  nest(c.M(2), 0, 0, 0, sx / 2, sy, c.seed, 1 + Math.floor(hash2(c.seed, 1) * 2), 18);
};

/** Wires strung between buildings (§1.1): 2–4 lines sagging 3–5 % of the span; dressing only. */
const wire: Builder = (c) => {
  const { x: sx } = c.p.size;
  const g = c.M(1);
  g.paint(IRON, c.seed);
  const lines = 2 + Math.floor(hash2(c.seed, 1) * 2);
  for (let l = 0; l < lines; l++) {
    const pts: Vector3[] = [];
    const sag = sx * (0.03 + hash2(c.seed, l) * 0.02);
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      pts.push(new Vector3(-sx / 2 + t * sx, -l * 0.25 - Math.sin(t * Math.PI) * sag, l * 0.06));
    }
    g.tube(pts, 0.012, 3);
  }
  // A feeder or a sprig of bunting on some spans.
  if (hash2(c.seed, 2) < 0.5) bunting(c.M(1), -sx / 2, sx / 2, 0, sx * 0.04, flockTint(c.p.pos.z), c.seed);
};

/** Feather-shaped pennants on a sagging line, every ~0.5 m (§1.2 bunting). */
export function bunting(g: Mesher, x0: number, x1: number, y: number, sag: number, tint: number, seed: number): void {
  const len = x1 - x0;
  const n = Math.max(3, Math.round(len / 0.5));
  g.paint(ROPE, seed);
  const pts: Vector3[] = [];
  for (let k = 0; k <= 8; k++) pts.push(new Vector3(x0 + (len * k) / 8, y - Math.sin((k / 8) * Math.PI) * sag, 0));
  g.tube(pts, 0.01, 3);
  for (let k = 1; k < n; k++) {
    const t = k / n;
    const x = x0 + len * t;
    const yy = y - Math.sin(t * Math.PI) * sag - 0.02;
    g.paint({ mat: 'canvas', tint: k % 3 === 0 ? FADED.neutral : tint }, seed + k);
    const pts2 = [new Vector3(x - 0.12, yy, 0), new Vector3(x + 0.12, yy, 0), new Vector3(x + 0.04, yy - 0.3, 0), new Vector3(x, yy - 0.36, 0), new Vector3(x - 0.04, yy - 0.3, 0)];
    g.poly(pts2, new Vector3(0, 0, 1));
    g.poly(pts2, new Vector3(0, 0, -1));
  }
}

/** Rope walkways (the walkable deck is a prim): slatted planks over it, rope handrails on posts. */
const ropeWalkway: Builder = (c) => {
  const { x: sx, y: sy, z: sz } = c.p.size;
  const g = c.M(2, 'cast');
  const n = Math.max(4, Math.round(sz / 0.3));
  for (let k = 0; k < n; k++) {
    const z = -sz / 2 + (sz * (k + 0.5)) / n;
    g.paint({ mat: 'boards', tint: 0xe8dcc8 }, c.seed + k).span(-sx / 2 - 0.05, sx / 2 + 0.05, sy / 2 - 0.08, sy / 2 + 0.03, z - sz / n / 2 + 0.03, z + sz / n / 2 - 0.03);
  }
  const g1 = c.M(1);
  g1.paint(TIMBER_DARK, c.seed);
  for (const s of [-1, 1]) {
    for (const e of [-1, 1]) g1.span(s * sx / 2 - 0.06, s * sx / 2 + 0.06, -0.2, sy / 2 + 1.1, e * sz / 2 - 0.06, e * sz / 2 + 0.06);
    const pts: Vector3[] = [];
    for (let k = 0; k <= 10; k++) {
      const t = k / 10;
      pts.push(new Vector3(s * sx / 2, sy / 2 + 1.05 - Math.sin(t * Math.PI) * 0.25, -sz / 2 + t * sz));
    }
    g1.paint(ROPE, c.seed).tube(pts, 0.03, 5);
    for (let k = 1; k < 10; k++) {
      const t = k / 10;
      g1.tube([new Vector3(s * sx / 2, sy / 2 + 1.05 - Math.sin(t * Math.PI) * 0.25, -sz / 2 + t * sz), new Vector3(s * sx / 2, sy / 2, -sz / 2 + t * sz)], 0.012, 3);
    }
  }
};

/** Dovecote boxes (§1.1): rows of arched pigeonholes 0.25 × 0.32 m, 0.40 m apart, each row with a landing ledge. */
const dovecoteBoxes: Builder = (c) => {
  const { x: sx, y: sy, z: sz } = c.p.size;
  const g = c.M(2);
  const g1 = c.M(1);
  const rows = Math.max(3, Math.min(6, Math.floor(sy / 0.8)));
  for (let side = 0; side < 4; side++) {
    const width = side % 2 ? sz : sx;
    const depth = side % 2 ? sx : sz;
    g.within(placed(0, 0, 0, (side * Math.PI) / 2), () => {
      g1.within(placed(0, 0, 0, (side * Math.PI) / 2), () => {
        const n = Math.floor((width - 0.6) / 0.4);
        for (let r = 0; r < rows; r++) {
          const y = 0.3 + (r * (sy - 0.6)) / rows;
          g.paint({ mat: 'ashlar', tint: 0xf0e8d8 }, c.seed + r).span(-width / 2 + 0.1, width / 2 - 0.1, y - 0.06, y, depth / 2 - 0.02, depth / 2 + 0.12);
          g.paint({ mat: 'timberDark', shade: 0.18 }, c.seed);
          for (let k = 0; k < n; k++) {
            const x = -((n - 1) * 0.4) / 2 + k * 0.4;
            g.poly([new Vector3(x - 0.125, y + 0.02, depth / 2 + 0.035), new Vector3(x + 0.125, y + 0.02, depth / 2 + 0.035), new Vector3(x + 0.125, y + 0.24, depth / 2 + 0.035), new Vector3(x, y + 0.34, depth / 2 + 0.035), new Vector3(x - 0.125, y + 0.24, depth / 2 + 0.035)], new Vector3(0, 0, 1));
          }
          g1.paint({ mat: 'ashlar' }, c.seed + r);
          for (let k = 0; k <= n; k++) {
            const x = -((n - 1) * 0.4) / 2 + (k - 0.5) * 0.4;
            g1.span(x - 0.035, x + 0.035, y, y + 0.36, depth / 2, depth / 2 + 0.06);
          }
        }
      });
    });
  }
};

const lanternProp: Builder = (c) => {
  const g = c.M(1);
  g.paint(IRON, c.seed).tube([new Vector3(0, c.p.size.y, 0), new Vector3(0, c.p.size.y + 0.6, 0)], 0.012, 3);
  lantern(g, 0, c.p.size.y, 0, c.seed);
};

const bench: Builder = (c) => {
  const { x: sx, y: sy, z: sz } = c.p.size;
  const g = c.M(1);
  g.paint(TIMBER, c.seed);
  for (let k = 0; k < 3; k++) g.span(-sx / 2, sx / 2, sy - 0.06, sy, -sz / 2 + (sz * k) / 3 + 0.02, -sz / 2 + (sz * (k + 1)) / 3 - 0.02, 0.01);
  g.paint(TIMBER_DARK, c.seed);
  for (const s of [-1, 1]) g.span(s * (sx / 2 - 0.2) - 0.05, s * (sx / 2 - 0.2) + 0.05, 0, sy - 0.06, -sz / 2 + 0.05, sz / 2 - 0.05);
};

const well: Builder = (c) => {
  const { x: sx, y: sy } = c.p.size;
  const r = sx / 2;
  const g = c.M(2, 'cast');
  g.paint(STONE, c.seed).lathe([[r, 0], [r, 0.85], [r * 0.82, 0.85], [r * 0.82, 0.1]], 14);
  g.paint({ mat: 'timberDark', shade: 0.3 }, c.seed).disc(0, 0.3, 0, r * 0.82, 14, 1);
  g.paint(TIMBER_DARK, c.seed);
  for (const s of [-1, 1]) g.span(s * r - 0.07, s * r + 0.07, 0.8, sy, -0.07, 0.07);
  g.tube([new Vector3(-r, sy - 0.6, 0), new Vector3(r, sy - 0.6, 0)], 0.06, 6);
  g.paint({ mat: 'roofShingle' }, c.seed);
  for (const s of [-1, 1]) g.within(oriented(0, sy - 0.05, s * 0.4, 0, s * 0.6), () => g.box(0, 0, 0, sx + 0.4, 0.05, 1.0));
  barrel(c.M(1), 0.1, 0.85, 0, 0.16, 0.3, c.seed);
};

const BUILD: Partial<Record<PropKind, Builder>> = {
  crate, barrel: barrels, cart, planter, counter, sacks, logs, table, shelf, signpost, stall, 'seed-stall': seedStall,
  feeder, 'bird-bath': birdBath, fountain, 'worm-bed': wormBed, 'insect-hive': insectHive, 'nest-pile': nestPile,
  'feather-banner': featherBanner, 'roost-rail': roostRail, 'perch-pole': perchPole, 'nest-crown': nestCrown, wire,
  'rope-walkway': ropeWalkway, 'dovecote-boxes': dovecoteBoxes, lantern: lanternProp, bench, well,
};

export { sack, openSack, crateAt, berryCrate, seedHeap, bowl, scale };
