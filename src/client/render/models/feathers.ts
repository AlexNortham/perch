/* eslint-disable @typescript-eslint/no-magic-numbers -- texture recipes: the numbers are the drawing */
/**
 * Procedural bird textures (style guide §7.1, §7.2 "Feathers", §8.2), generated once per session from seeded code, no
 * image files. Two atlases, both sRGB colour multipliers on the vertex colour:
 * - the SOLID atlas: 4 × 2 seamless tiles of surface pattern for the opaque body, gear and gun (feather scales, barred
 *   and mottled plumage, wood grain, leather, weave, tarsus scutes, and a flat white tile);
 * - the CARD atlas: 4 × 4 feather shapes for the alpha-tested cards (contour, primary, tail, down, the Peacock's eye,
 *   crest spoon, hair plume, wing blur, barred, mottled, quill, cloth, ragged, ruff, sickle, spotted), each with a
 *   rachis line, a vane gradient and edge notches, cut out at alpha 0.5.
 * Painted, not photographic: flat blocks, soft gradients, dark crevices and light edges; detail in shape, not grain.
 */
import { ClampToEdgeWrapping, DataTexture, LinearFilter, LinearMipmapLinearFilter, RGBAFormat, SRGBColorSpace, UnsignedByteType } from 'three';

/** Solid atlas tiles (the `tile` of a Finish). */
export const TILE = { flat: 0, scales: 1, barred: 2, mottle: 3, wood: 4, leather: 5, weave: 6, rings: 7 } as const;
export const TILE_GRID = { cols: 4, rows: 2, px: 128 } as const;

/** Card atlas cells (the `cell` of a card). */
export const CARD = {
  contour: 0, primary: 1, tail: 2, down: 3,
  eye: 4, spoon: 5, hair: 6, blur: 7,
  barred: 8, mottled: 9, quill: 10, cloth: 11,
  ragged: 12, ruff: 13, sickle: 14, spotted: 15,
} as const;
export const CARD_GRID = { cols: 4, rows: 4, w: 128, h: 256 } as const;

type RGBA = [number, number, number, number];

const fract = (v: number): number => v - Math.floor(v);
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (e0: number, e1: number, v: number): number => {
  const t = clamp01((v - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
/** Integer hash → [0, 1). Deterministic: screenshots compare run to run. */
function hash(x: number, y: number, seed: number): number {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + seed * 2246822519;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/** Smooth value noise on a lattice that wraps every `period` cells (so tiles stay seamless). */
function noise(x: number, y: number, period: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const w = (i: number): number => ((i % period) + period) % period;
  const a = hash(w(xi), w(yi), seed);
  const b = hash(w(xi + 1), w(yi), seed);
  const c = hash(w(xi), w(yi + 1), seed);
  const d = hash(w(xi + 1), w(yi + 1), seed);
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
const fbm = (x: number, y: number, period: number, seed: number): number =>
  noise(x, y, period, seed) * 0.6 + noise(x * 2, y * 2, period * 2, seed + 7) * 0.3 + noise(x * 4, y * 4, period * 4, seed + 13) * 0.1;

// ---------------------------------------------------------------------------------------------------------------
// Solid tiles: (x, y) in pixels 0..127, v (y) runs along a loft from its start; feathers point toward the start.

const PX = TILE_GRID.px;

/**
 * Overlapping feather scales: round-tipped feathers in offset rows pointing toward low y, each row laid over the one
 * below it. A soft painted read: a lighter middle, a darker rim and a thin shadow under the edge of the row above.
 */
function scale(x: number, y: number, R = 16, sh = 16): number {
  const sw = R * 2;
  const centre = (row: number, px: number): number => {
    const off = ((row % 2) + 2) % 2 ? R : 0;
    return Math.round((px - off) / sw) * sw + off;
  };
  const top = Math.floor(y / sh);
  let own = -1;
  let t = 1;
  for (let row = top; row >= top - 2 && own < 0; row--) {
    for (const dx of [-sw, 0, sw]) {
      const cx = centre(row, x) + dx;
      const dist = Math.hypot(x - cx, y - (row * sh + R));
      if (dist < R * 1.12 && own < 0) {
        own = row;
        t = dist / (R * 1.12);
      }
    }
  }
  // Shadow cast by the row above's rim just below it.
  let shadow = 0;
  for (const dx of [-sw, 0, sw]) {
    const cx = centre(own + 1, x) + dx;
    const dist = Math.hypot(x - cx, y - ((own + 1) * sh + R));
    shadow = Math.max(shadow, 1 - smooth(R * 1.12, R * 1.12 + 3.5, dist));
  }
  const body = 1 - 0.1 * smooth(0.55, 1, t) + 0.04 * (1 - t);
  return Math.min(1, body - 0.14 * shadow);
}

function solidTile(tile: number, x: number, y: number): number {
  switch (tile) {
    case TILE.scales:
      return scale(x, y);
    case TILE.barred: {
      // Black-and-white ladder bars over the scales (use with a pale vertex colour).
      const bar = smooth(0.38, 0.46, fract(y / 32)) * (1 - smooth(0.86, 0.94, fract(y / 32)));
      return scale(x, y) * (0.16 + 0.84 * bar);
    }
    case TILE.mottle: {
      // Bark mottling: dark vermiculation and pale speckles over soft scales.
      const n = fbm(x / 16, y / 16, 8, 3);
      const worm = Math.abs(Math.sin((x + 9 * fbm(x / 22, y / 22, 6, 5)) * 0.22 + y * 0.09));
      const speck = hash(x >> 2, y >> 2, 11) > 0.93 ? 1.18 : 1;
      return Math.min(1, scale(x, y, 32, 32) * (0.55 + 0.45 * smooth(0.25, 0.75, n)) * (0.82 + 0.18 * smooth(0.1, 0.5, worm)) * speck);
    }
    case TILE.wood: {
      // Grain along the length (y), soft growth lines, a darker knot now and then.
      const wob = 7 * fbm(x / 32, y / 64, 4, 21);
      const grain = 0.5 + 0.5 * Math.sin((x + wob) * 0.42);
      const streak = fbm(x / 6, y / 40, 21, 23);
      return 0.72 + 0.16 * grain * grain + 0.12 * streak;
    }
    case TILE.leather: {
      const peb = noise(x / 3, y / 3, 42, 31);
      const blot = fbm(x / 32, y / 32, 4, 37);
      return 0.8 + 0.1 * peb + 0.1 * blot;
    }
    case TILE.weave: {
      // Over-under basket weave of 16 px strands, each shaded across its width.
      const cx = Math.floor(x / 16);
      const cy = Math.floor(y / 16);
      const across = (cx + cy) % 2 === 0;
      const t = across ? fract(y / 16) : fract(x / 16);
      const along = across ? fract(x / 16) : fract(y / 16);
      return 0.62 + 0.38 * Math.sin(Math.PI * t) * (0.85 + 0.15 * Math.sin(Math.PI * along));
    }
    case TILE.rings: {
      // Tarsus scutes: bands every 16 px split by staggered seams, each scute domed.
      const band = Math.floor(y / 16);
      const yy = fract(y / 16);
      const xx = fract((x + (band % 2) * 16) / 32);
      const seam = Math.min(yy, 1 - yy) * 16;
      const side = Math.min(xx, 1 - xx) * 32;
      return 0.76 + 0.24 * smooth(0, 3, seam) * smooth(0, 2.5, side) * (0.9 + 0.1 * Math.sin(Math.PI * yy));
    }
    default:
      return 1;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Card shapes: x in [-1, 1] across (64 px per unit), y in [0, 1] root to tip (256 px per unit).

const CW = CARD_GRID.w / 2;
const CH = CARD_GRID.h;
const GREY = (v: number, a: number): RGBA => [v, v, v, a];
/** Soft edge over ~1.5 px for an inside distance `d` in pixels (positive inside). */
const edge = (d: number): number => smooth(-0.75, 0.75, d);

/** A vane between a left and right half-width at height y, with rachis, gradient, barbs and seeded notches. */
function vane(x: number, y: number, left: number, right: number, seed: number, o: { rachis?: number; notch?: number; barb?: number; base?: number } = {}): RGBA {
  const rx = o.rachis ?? 0;
  const half = x < rx ? left : right;
  const dx = Math.abs(x - rx);
  let inside = (half - dx) * CW;
  // Notches: thin wedges cut in from the edge at seeded heights.
  const notches = o.notch ?? 3;
  for (let i = 0; i < notches; i++) {
    const ny = 0.35 + 0.55 * hash(i, x < rx ? 1 : 2, seed);
    const depth = 0.25 + 0.35 * hash(i, 9, seed);
    const dist = Math.abs(y - ny) * CH - (dx / Math.max(half, 1e-3)) * 6;
    if (dx > half * (1 - depth)) inside = Math.min(inside, dist - 1);
  }
  // Fluffy afterfeather at the base.
  const base = o.base ?? 0.12;
  let a = edge(inside);
  if (y < base) a *= 0.35 + 0.65 * smooth(0.45, 0.6, hash(Math.floor(x * 40), Math.floor(y * 90), seed + 5));
  const shaft = Math.abs(x - rx) * CW < 1.1 ? 1 : 0;
  const barb = 1 - (o.barb ?? 0.05) * smooth(0.55, 0.85, Math.sin((y * CH * 0.9 - dx * CW * 1.6) * 0.9));
  const grad = 0.72 + 0.28 * smooth(0, 0.85, y);
  const rim = 1 - 0.12 * smooth(2.5, 0, inside);
  const v = shaft ? Math.min(1, grad + 0.12) : grad * barb * rim;
  return GREY(v, a);
}

/** A tapering bare shaft from root to `top`, `w0` px wide at the root. */
const shaftAlpha = (x: number, y: number, top: number, w0: number, rx = 0): number =>
  y > top ? 0 : edge(w0 * (1 - 0.7 * (y / top)) - Math.abs(x - rx) * CW);

function card(cell: number, x: number, y: number): RGBA {
  switch (cell) {
    case CARD.contour: {
      const w = 0.92 * Math.sqrt(Math.max(0, 1 - ((y - 0.56) / 0.44) ** 2));
      return vane(x, y, w, w, 1, { notch: 2, base: 0.25 });
    }
    case CARD.primary: {
      const p = Math.sqrt(Math.max(0, Math.sin(Math.PI * Math.min(0.999, y ** 0.75))));
      return vane(x, y, 0.32 * p, 0.86 * p, 2, { rachis: -0.42, notch: 2, barb: 0.07 });
    }
    case CARD.tail: {
      const w = y < 0.88 ? 0.74 * Math.sqrt(clamp01(y * 5)) : 0.74 * Math.sqrt(Math.max(0, 1 - ((y - 0.88) / 0.12) ** 2));
      return vane(x, y, w, w, 3, { notch: 3, barb: 0.07 });
    }
    case CARD.down: {
      // Filaments radiating from the root, curling at the ends.
      let a = 0;
      for (let k = 0; k < 18; k++) {
        const ang = -1.15 + (2.3 * k) / 17 + 0.12 * (hash(k, 1, 4) - 0.5);
        const len = 0.65 + 0.35 * hash(k, 2, 4);
        const t = y / len;
        if (t > 1) continue;
        const cx = Math.sin(ang) * t * 0.95 * (CH / CW) * 0.32 + 0.15 * Math.sin(t * 5 + k) * t;
        a = Math.max(a, edge(2.2 * (1 - t) + 0.6 - Math.abs(x - cx) * CW));
      }
      return GREY(0.82 + 0.18 * y, a * smooth(0, 0.08, y));
    }
    case CARD.eye: {
      // The Peacock's train feather: a bare shaft with loose bronze-green barbs, ending in the ocellus.
      const ey = 0.8;
      const ex = (x / 0.78) ** 2 + ((y - ey) / 0.19) ** 2;
      if (ex <= 1.12) {
        const r = Math.sqrt(ex);
        // Heart-shaped navy centre (offset down), turquoise, bronze and gold-green rings, then a fringe.
        const heart = (x / 0.3) ** 2 + ((y - ey + 0.02) / 0.075) ** 2 - 0.25 * Math.max(0, (y - ey) / 0.075) * Math.abs(x / 0.3);
        const col: RGBA = heart < 1 ? [0.11, 0.16, 0.5, 1] : r < 0.55 ? [0.12, 0.62, 0.66, 1] : r < 0.72 ? [0.67, 0.52, 0.2, 1] : r < 0.9 ? [0.2, 0.52, 0.28, 1] : [0.55, 0.6, 0.22, 1];
        const fringe = r > 0.9 ? smooth(0.4, 0.6, hash(Math.floor(x * 50), Math.floor(y * 120), 41)) : 1;
        return [col[0], col[1], col[2], edge((1.12 - ex) * 30) * fringe];
      }
      const shaft = shaftAlpha(x, y, ey, 1.6);
      const barbs = y > 0.12 && y < ey && Math.abs(x) < 0.55 * Math.sin(Math.PI * (y / ey)) && Math.sin((y * CH - Math.abs(x) * CW * 1.2) * 0.75) > -0.35 ? 1 : 0;
      const a = Math.max(shaft, barbs * 0.95);
      return [0.42, 0.56, 0.2, a];
    }
    case CARD.spoon: {
      // Crest spoon: a bare shaft and a small fan at the tip with a pale rim.
      const fy = 0.8;
      const d = Math.hypot(x * CW, (y - fy) * CH);
      if (y > 0.58) {
        const r = 50;
        const v = d < r - 8 ? 0.82 + 0.1 * Math.sin(Math.atan2(x, y - fy) * 12) : 1;
        return GREY(v, Math.max(edge(r - d), shaftAlpha(x, y, fy, 4)));
      }
      return GREY(0.8, shaftAlpha(x, y, 1, 4));
    }
    case CARD.hair: {
      // Hair-like plume (Cassowary): strands splitting from a short shaft, wavy and tapering.
      let a = 0;
      for (let k = 0; k < 4; k++) {
        const spread = (k - 1.5) * 0.18;
        const cx = spread * smooth(0.1, 1, y) * 1.6 + 0.05 * Math.sin(y * 14 + k * 2);
        const w = 3.2 * (1 - 0.8 * y) * (y < 0.08 && k > 0 ? 0 : 1);
        a = Math.max(a, edge(w - Math.abs(x - cx) * CW));
      }
      return GREY(0.78 + 0.22 * (1 - y), a);
    }
    case CARD.blur: {
      // Hummingbird wing blur: a fan of motion streaks from the root, denser at the edges of the sweep.
      const px = x * CW;
      const py = y * CH * 0.5;
      const r = Math.hypot(px, py) / (CW * 0.98);
      const ang = Math.atan2(px, py);
      if (r > 1 || Math.abs(ang) > 1.2) return GREY(1, 0);
      const sweepEdge = smooth(0.7, 1.2, Math.abs(ang));
      const streak = fract(ang * 9 + hash(Math.floor(r * 6), 1, 51) * 0.3);
      const keep = streak < 0.42 + 0.4 * sweepEdge ? 1 : 0;
      return GREY(0.85 + 0.15 * r, keep * edge((1 - r) * CW) * smooth(0.05, 0.2, r));
    }
    case CARD.barred: {
      const p = Math.sqrt(Math.max(0, Math.sin(Math.PI * Math.min(0.999, y ** 0.8))));
      const f = vane(x, y, 0.5 * p, 0.8 * p, 8, { rachis: -0.25, notch: 1 });
      const bar = 0.14 + 0.86 * smooth(0.42, 0.5, fract(y * 7.5 + 0.2)) * (1 - smooth(0.88, 0.96, fract(y * 7.5 + 0.2)));
      return [f[0] * bar, f[1] * bar, f[2] * bar, f[3]];
    }
    case CARD.mottled: {
      const w = 0.9 * Math.sqrt(Math.max(0, 1 - ((y - 0.55) / 0.45) ** 2));
      const f = vane(x, y, w, w, 9, { notch: 2, base: 0.2 });
      const m = 0.55 + 0.45 * smooth(0.3, 0.7, fbm(x * 4 + 3, y * 9, 64, 61));
      const worm = 0.8 + 0.2 * smooth(0.2, 0.6, Math.abs(Math.sin(x * 9 + y * 30 + 3 * fbm(x * 2, y * 4, 64, 63))));
      const tip = smooth(0.82, 0.9, y) * 0.3;
      const v = Math.min(1, f[0] * m * worm + tip);
      return GREY(v, f[3]);
    }
    case CARD.quill: {
      // A bare, glossy quill (Cassowary wing spines): a thick shaft to a point.
      const w = 4.5 * (1 - y) + 0.5;
      return GREY(0.75 + 0.25 * (1 - Math.abs(x) * CW / w), edge(w - Math.abs(x) * CW) * (y < 0.98 ? 1 : 0));
    }
    case CARD.cloth: {
      // A woven scarf tail with a frayed, fringed end.
      const w = 0.92;
      const weave = 0.86 + 0.14 * Math.sin(x * CW * 1.6) * Math.sin(y * CH * 1.6);
      const hem = Math.abs(Math.abs(x) - 0.8) * CW < 1.2 ? 0.75 : 1;
      let a = edge((w - Math.abs(x)) * CW);
      if (y > 0.86) a *= Math.sin(x * CW * 1.4) > -0.2 ? edge((1 - y) * CH * 0.5 + 2) : 0;
      return GREY(weave * hem * (0.9 + 0.1 * y), a);
    }
    case CARD.ragged: {
      // Vulture coat: broad and dark with a deeply ragged, uneven tip.
      const w = 0.94 * Math.sqrt(clamp01(y * 5));
      const tipLine = 0.86 + 0.08 * Math.sin(x * 7 + 1) * Math.sin(x * 13) + 0.05 * hash(Math.floor((x + 1) * 9), 3, 71);
      const f = vane(x, y, w, w, 12, { notch: 1, barb: 0.1 });
      return GREY(f[0] * (0.85 + 0.15 * (1 - y)), f[3] * edge((tipLine - y) * CH));
    }
    case CARD.ruff: {
      // A soft lance of down for ruffs and throats.
      const w = 0.7 * Math.sqrt(Math.max(0, Math.sin(Math.PI * Math.min(0.999, y))));
      const fil = smooth(0.25, 0.55, Math.abs(Math.sin(x * CW * 0.7 + y * 20)));
      const a = edge((w - Math.abs(x)) * CW) * (Math.abs(x) > w * 0.6 ? fil : 1);
      return GREY(0.88 + 0.12 * y, a);
    }
    case CARD.sickle: {
      // Swift primary: long, narrow and pointed.
      const p = y < 0.9 ? Math.sqrt(clamp01(y * 6)) : Math.max(0, (1 - y) / 0.1);
      return vane(x, y, 0.22 * p, 0.6 * p, 14, { rachis: -0.3, notch: 1, barb: 0.06 });
    }
    case CARD.spotted: {
      // A long feather with a pale spot near the tip (Nightjar wing and tail spots).
      const p = Math.sqrt(Math.max(0, Math.sin(Math.PI * Math.min(0.999, y ** 0.8))));
      const f = vane(x, y, 0.55 * p, 0.8 * p, 15, { rachis: -0.2, notch: 2 });
      const spot = ((x - 0.1) / 0.45) ** 2 + ((y - 0.7) / 0.08) ** 2 < 1 ? 1 : 0;
      const m = 0.7 + 0.3 * fbm(x * 3, y * 8, 64, 81);
      return spot ? [1, 0.98, 0.94, f[3]] : GREY(f[0] * m * 0.75, f[3]);
    }
    default:
      return GREY(1, 0);
  }
}

// ---------------------------------------------------------------------------------------------------------------

function texture(width: number, height: number, fill: (px: number, py: number) => RGBA): DataTexture {
  const data = new Uint8Array(width * height * 4);
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const [r, g, b, a] = fill(px, py);
      const o = (py * width + px) * 4;
      data[o] = Math.round(clamp01(r) * 255);
      data[o + 1] = Math.round(clamp01(g) * 255);
      data[o + 2] = Math.round(clamp01(b) * 255);
      data[o + 3] = Math.round(clamp01(a) * 255);
    }
  }
  const t = new DataTexture(data, width, height, RGBAFormat, UnsignedByteType);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = ClampToEdgeWrapping;
  t.magFilter = LinearFilter;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

let solid: DataTexture | null = null;
let cards: DataTexture | null = null;

/** The solid pattern atlas (shared by every sculpted bird). */
export function solidAtlas(): DataTexture {
  solid ??= texture(TILE_GRID.cols * PX, TILE_GRID.rows * PX, (px, py) => {
    const tile = Math.floor(py / PX) * TILE_GRID.cols + Math.floor(px / PX);
    const v = solidTile(tile, px % PX, py % PX);
    return [v, v, v, 1];
  });
  return solid;
}

/** The feather card atlas (shared by every sculpted bird). */
export function cardAtlas(): DataTexture {
  cards ??= texture(CARD_GRID.cols * CARD_GRID.w, CARD_GRID.rows * CARD_GRID.h, (px, py) => {
    const cell = Math.floor(py / CARD_GRID.h) * CARD_GRID.cols + Math.floor(px / CARD_GRID.w);
    const x = ((px % CARD_GRID.w) + 0.5) / CW - 1;
    const y = ((py % CARD_GRID.h) + 0.5) / CH;
    return card(cell, x, y);
  });
  return cards;
}

/** UV rectangle of a card cell: [u0, v0, u1, v1]. */
export function cardUv(cell: number): readonly [number, number, number, number] {
  const c = cell % CARD_GRID.cols;
  const r = Math.floor(cell / CARD_GRID.cols);
  return [c / CARD_GRID.cols, r / CARD_GRID.rows, (c + 1) / CARD_GRID.cols, (r + 1) / CARD_GRID.rows];
}
