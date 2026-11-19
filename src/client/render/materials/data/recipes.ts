/**
 * Material recipes (style guide §7.2): authored art data, like map data, so its literals are exempt from the
 * magic-number rule (D-RENDER-010). Each recipe paints one texture-array layer covering `tile` metres (u along the
 * surface, v up it); cards cover their own 0..1 quad. Colours are the guide's sRGB values; every pattern is
 * periodic in its tile. Value jitter follows §4.4: ±6 % per piece, 1 piece in 12 noticeably darker or lighter.
 * `make(seed)` builds a recipe's tables and noise fields once and returns the per-pixel sampler.
 */
import { clamp01, Courses, fbm, lattice, mix, paintPx, rgb, Rng, smooth, Voronoi } from '../generate';
import type { CellHit, LayerSpec, Px, Sampler, VHit } from '../generate';

/** Every material the library paints, in texture-array layer order. */
export const MATERIAL_IDS = [
  'brick', 'brickBurnt', 'ashlar', 'granite', 'sandstone', 'flagstone', 'cobble', 'plaster', 'plasterOchre',
  'timber', 'timberDark', 'timberRed', 'boards', 'roofClay', 'roofSlate', 'roofShingle', 'thatch',
  'iron', 'brass', 'pewter', 'verdigris', 'glass', 'windowLit', 'lantern', 'canvas', 'rope', 'twig',
  'bark', 'hedge', 'grass', 'moss', 'earth', 'gravel', 'water', 'leafCard', 'pineCard', 'featherCard',
] as const;
export type MaterialId = (typeof MATERIAL_IDS)[number];

export interface Recipe extends LayerSpec {
  /** The guide's base colour: Low-quality fallbacks, LOD tints and UI swatches use it. */
  readonly colour: number;
  /** Emissive strength (lit windows and lanterns, §5.2 and §10.3). */
  readonly emissive?: number;
}

const hit = (): CellHit => ({ d: 0, lx: 0, ly: 0, len: 1, rowH: 1, row: 0, r1: 0, r2: 0, r3: 0 });
const vhit = (): VHit => ({ d1: 0, d2: 0, dx: 0, dy: 0, r1: 0, r2: 0 });
/** §4.4 per-piece value: ±6 %, and 1 in 12 noticeably darker or lighter. */
const pieceValue = (c: CellHit | VHit): number => (1 + (c.r1 - 0.5) * 0.12) * (c.r2 < 1 / 12 ? (c.r1 < 0.5 ? 0.86 : 1.14) : 1);
const running = (row: number): number => (row % 2) * 0.5;
const randomOffset = (_row: number, rng: Rng): number => rng.next();
const rows = (n: number, h = 1): number[] => Array.from({ length: n }, () => h);
const rowsRandom = (n: number, lo: number, hi: number, seed: number): number[] => {
  const r = new Rng(seed);
  return Array.from({ length: n }, () => r.range(lo, hi));
};

// ── Masonry ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** Brick (§7.2): 32 × 10 cm bricks, 1.5 cm mortar recessed, stretcher bond, a header course every 6th. */
function brick(face: number, burnt: number, mortar: number): (seed: number) => Sampler {
  return (seed) => {
    const W = 6 * 0.335;
    const H = 18 * 0.115;
    const joint = 0.015;
    const c = new Courses({ w: W, h: H, rows: rows(18), cell: (r) => (r % 6 === 5 ? { lo: W / 12, hi: W / 12 } : { lo: W / 6, hi: W / 6 }), offset: running }, new Rng(seed));
    const [f, b, m] = [rgb(face), rgb(burnt), rgb(mortar)];
    const grain = fbm(W, H, 0.03, 0.03, 2, seed + 7);
    const chips = fbm(W, H, 0.012, 0.012, 2, seed + 11);
    const soot = fbm(W, H, 0.7, 0.5, 2, seed + 13);
    const h = hit();
    return (X, Y, px) => {
      c.at(X, Y, h);
      const n = grain(X, Y);
      if (h.d < joint / 2) {
        paintPx(px, m, m, 0, 0.92 + n * 0.12);
        px.h = 0.25 + n * 0.05;
        px.rough = 0.95;
        return;
      }
      const bevel = smooth(joint / 2, joint / 2 + 0.012, h.d);
      const wear = h.d < joint / 2 + 0.008 ? 1.07 : 1;
      const chip = chips(X, Y) > 0.78 && h.d < 0.03 ? 0.82 : 1;
      const k = pieceValue(h) * (0.94 + 0.12 * n) * (1 + (h.ly / h.rowH - 0.5) * 0.06) * wear * chip * (1 - 0.1 * smooth(0.55, 0.8, soot(X, Y)));
      paintPx(px, f, b, h.r3 < 0.3 ? h.r3 * 2.4 : 0, k);
      px.h = 0.5 + 0.45 * bevel + (n - 0.5) * 0.08;
      px.rough = 0.85;
    };
  };
}

/** Ashlar, granite and sandstone (§7.2): blocks 0.6–1.2 × 0.3–0.45 m, 1 cm joints, chisel-face noise, worn edges. */
function ashlar(colour: number, joint: number, rowH: number, lo: number, hi: number): (seed: number) => Sampler {
  return (seed) => {
    const W = 2.4;
    const n = Math.round(W / rowH);
    const c = new Courses({ w: W, h: W, rows: rowsRandom(n, 0.8, 1.2, seed + 3), cell: () => ({ lo, hi }), offset: randomOffset }, new Rng(seed));
    const base = rgb(colour);
    const dark = [base[0] * 0.55, base[1] * 0.55, base[2] * 0.55];
    const chisel = fbm(W, W, 0.08, 0.08, 3, seed + 5);
    const fine = fbm(W, W, 0.02, 0.02, 1, seed + 9);
    const stains = fbm(W, W, 0.6, 0.6, 2, seed + 13);
    const h = hit();
    return (X, Y, px) => {
      c.at(X, Y, h);
      if (h.d < joint / 2) {
        paintPx(px, base, dark, 0.65, 1);
        px.h = 0.15;
        px.rough = 0.95;
        return;
      }
      const ch = chisel(X, Y);
      const fn = fine(X, Y);
      const edge = smooth(joint / 2, joint / 2 + 0.025, h.d);
      const stain = smooth(0.55, 0.85, stains(X, Y));
      const k = pieceValue(h) * (0.86 + 0.2 * ch) * (0.96 + 0.08 * fn) * (1 + 0.08 * (1 - edge)) * (1 - 0.12 * stain) * (1 + (h.ly / h.rowH - 0.5) * 0.05);
      paintPx(px, base, dark, 0, k);
      px.h = 0.45 + 0.4 * edge + (ch - 0.5) * 0.2 + (fn - 0.5) * 0.05;
      px.rough = 0.8;
    };
  };
}

/** Flagstones (§7.2): 0.5–0.9 m slabs in offset courses, 1.5 cm joints with moss, a few cracks. */
const flagstone = (seed: number): Sampler => {
  const W = 3;
  const joint = 0.015;
  const c = new Courses({ w: W, h: W, rows: rowsRandom(5, 0.85, 1.15, seed + 1), cell: () => ({ lo: 0.5, hi: 0.9 }), offset: randomOffset }, new Rng(seed));
  const slab = rgb(0x7d7262);
  const moss = rgb(0x4d5a3c);
  const grain = fbm(W, W, 0.1, 0.1, 3, seed + 4);
  const cracks = fbm(W, W, 0.25, 0.25, 2, seed + 8);
  const h = hit();
  return (X, Y, px) => {
    c.at(X, Y, h);
    const n = grain(X, Y);
    if (h.d < joint / 2 + n * 0.006) {
      paintPx(px, moss, slab, n * 0.4, 0.8 + n * 0.3);
      px.h = 0.15;
      px.rough = 0.9;
      return;
    }
    const tilt = 1 + (h.lx / h.len - 0.5) * (h.r3 - 0.5) * 0.12;
    const crack = h.r3 > 0.65 && Math.abs(cracks(X, Y) - 0.5) < 0.006 ? 0.6 : 1;
    const edge = smooth(joint / 2, joint / 2 + 0.02, h.d);
    const k = pieceValue(h) * tilt * crack * (0.9 + 0.2 * n) * (1 + 0.06 * (1 - edge));
    paintPx(px, slab, moss, h.r3 < 0.2 ? 0.15 : 0, k);
    px.h = 0.55 + 0.35 * edge + (n - 0.5) * 0.12 - (crack < 1 ? 0.3 : 0);
    px.rough = 0.75;
  };
};

/** Cobbles (§7.2): rounded 15–20 cm stones with dark gaps. */
const cobble = (seed: number): Sampler => {
  const W = 1.5;
  const v = new Voronoi(9, 9, W, W, 0.85, new Rng(seed));
  const stone = rgb(0x6e6253);
  const warm = rgb(0x7f6a52);
  const gap = rgb(0x3f372d);
  const grain = fbm(W, W, 0.04, 0.04, 2, seed + 3);
  const h = vhit();
  return (X, Y, px) => {
    v.at(X, Y, h);
    const edge = (h.d2 - h.d1) / 2;
    const n = grain(X, Y);
    if (edge < 0.012) {
      paintPx(px, gap, gap, 0, 0.85 + 0.3 * n);
      px.h = 0.05;
      px.rough = 0.9;
      return;
    }
    const dome = Math.sqrt(clamp01((edge - 0.012) / 0.07));
    paintPx(px, stone, warm, h.r2, pieceValue(h) * (0.8 + 0.25 * dome) * (0.93 + 0.14 * n));
    px.h = 0.2 + 0.8 * dome;
    px.rough = 0.8;
  };
};

/** Plaster and limewash (§7.2): soft 0.5–2 m blotches, hairline cracks, patches showing brick beneath. */
function plaster(colour: number): (seed: number) => Sampler {
  return (seed) => {
    const W = 4;
    const base = rgb(colour);
    const under = brick(0xa4573f, 0x7e4634, 0xb7aa8f)(seed + 21);
    const sub: Px = { r: 0, g: 0, b: 0, a: 1, h: 0, rough: 1, metal: 0 };
    const blotches = fbm(W, W, 1, 1, 3, seed);
    const stains = fbm(W, W, 2, 2, 2, seed + 2);
    const fine = fbm(W, W, 0.05, 0.05, 2, seed + 4);
    const patches = fbm(W, W, 1.33, 1.33, 3, seed + 6);
    const cracks = fbm(W, W, 0.5, 0.5, 3, seed + 8);
    return (X, Y, px) => {
      const patch = patches(X, Y);
      if (patch > 0.7) {
        under(X, Y, sub);
        const rim = smooth(0.7, 0.73, patch);
        px.r = mix(base[0] * 1.06, sub.r, rim);
        px.g = mix(base[1] * 1.06, sub.g, rim);
        px.b = mix(base[2] * 1.06, sub.b, rim);
        px.h = 0.3 * sub.h * rim + 0.7 * (1 - rim);
        px.rough = 0.9;
        return;
      }
      const blotch = blotches(X, Y);
      const fn = fine(X, Y);
      const crack = Math.abs(cracks(X, Y) - 0.5) < 0.004 ? 0.72 : 1;
      const k = (0.92 + 0.16 * blotch) * (1 - 0.1 * smooth(0.6, 0.9, stains(X, Y))) * (0.97 + 0.06 * fn) * crack;
      paintPx(px, base, base, 0, k);
      px.h = 0.75 + 0.06 * blotch + 0.03 * fn - (crack < 1 ? 0.2 : 0);
      px.rough = 0.9;
    };
  };
}

// ── Timber and roofs ──────────────────────────────────────────────────────────────────────────────────────────────

/** Planks 12–18 cm along u with grain, butt joints, end nails and dark gaps (§7.2). `worn` lightens the middle. */
function planks(colour: number, worn: number): (seed: number) => Sampler {
  return (seed) => {
    const W = 2.4;
    const c = new Courses({ w: W, h: W, rows: rowsRandom(16, 0.12, 0.18, seed + 1), cell: () => ({ lo: 0.8, hi: 2.4 }), offset: randomOffset }, new Rng(seed));
    const base = rgb(colour);
    const dark = [base[0] * 0.6, base[1] * 0.58, base[2] * 0.55];
    const grain = fbm(W, W, 0.5, 0.012, 3, seed + 3);
    const wearField = fbm(W, W, 0.3, 0.3, 2, seed + 5);
    const h = hit();
    return (X, Y, px) => {
      c.at(X, Y, h);
      if (h.d < 0.004) {
        paintPx(px, dark, dark, 0, 0.5);
        px.h = 0.05;
        px.rough = 0.9;
        return;
      }
      const g = grain(X + h.r3 * 7, Y);
      const ring = 0.5 + 0.5 * Math.sin((Y * 60 + g * 9 + h.r3 * 20) * Math.PI);
      const across = h.ly / h.rowH - 0.5;
      const cup = 1 - across * across * 0.25;
      const end = Math.min(h.lx, h.len - h.lx);
      const nail = end < 0.05 && Math.hypot(end - 0.025, Math.abs(across) * h.rowH - h.rowH * 0.28) < 0.006;
      const wear = 1 + worn * (1 - Math.abs(across) * 2) * wearField(X, Y);
      const k = pieceValue(h) * (0.86 + 0.18 * g) * (0.93 + 0.07 * ring) * cup * wear * (nail ? 0.45 : 1);
      paintPx(px, base, dark, ring < 0.15 ? 0.4 : 0, k);
      px.h = 0.7 + 0.15 * cup + 0.06 * g - (nail ? 0.3 : 0);
      px.rough = 0.7;
    };
  };
}

/**
 * Roof courses (§5.4, §7.2): rows of `rowH` metres, pieces `lo`–`hi` wide. `profile` shapes a piece across its width
 * (pantile barrel, flat slate, grained shingle); each course's lip throws a shadow onto the top of the course below.
 */
function roof(colour: number, rowH: number, lo: number, hi: number, profile: 'pantile' | 'slate' | 'shingle'): (seed: number) => Sampler {
  return (seed) => {
    const W = 2.4;
    const n = Math.round(W / rowH);
    const c = new Courses({ w: W, h: W, rows: rows(n), cell: () => ({ lo, hi }), offset: profile === 'pantile' ? running : randomOffset }, new Rng(seed));
    const base = rgb(colour);
    const mossC = rgb(0x5f7f4a);
    const rags = lattice(96, 64, seed);
    const grain = fbm(W, W, 0.012, 0.4, 2, seed + 4);
    const fine = fbm(W, W, 0.05, 0.05, 2, seed + 6);
    const mossField = fbm(W, W, 0.6, 0.6, 3, seed + 8);
    const h = hit();
    return (X, Y, px) => {
      c.at(X, Y, h);
      const t = h.ly / h.rowH;
      const across = h.lx / h.len;
      const rag = profile === 'shingle' ? (rags(X * 40, h.row) - 0.5) * 0.12 : 0;
      const shadow = 1 - 0.45 * smooth(0.72 + rag, 1, t);
      const lip = t < 0.06 ? 1.08 : 1;
      let shape = 0;
      if (profile === 'pantile') shape = Math.sin(across * Math.PI);
      else if (profile === 'slate') shape = h.d > 0.006 ? 0.8 : 0;
      else shape = grain(X, Y);
      const gap = profile === 'pantile' ? 1 : h.d < 0.005 ? 0.55 : 1;
      const mossy = smooth(0.62, 0.8, mossField(X, Y)) * (1 - t);
      const k = pieceValue(h) * shadow * lip * gap * (0.85 + 0.25 * (profile === 'shingle' ? shape : 0.5 + shape * 0.4)) * (0.95 + 0.1 * fine(X, Y));
      paintPx(px, base, mossC, mossy * 0.6, k);
      px.h = 0.25 + 0.45 * (1 - t) + 0.25 * shape;
      px.rough = profile === 'slate' ? 0.7 : 0.75;
    };
  };
}

/** Woven reed and thatch (§5.4): dense strands in courses with a shadow under each. */
const thatch = (seed: number): Sampler => {
  const W = 2;
  const base = rgb(0x9c8a5e);
  const strands = lattice(166, 8, seed);
  const tufts = fbm(W, W, 0.2, 0.3, 2, seed + 2);
  return (X, Y, px) => {
    const course = W / 6;
    const t = (Y % course) / course;
    const strand = strands((X / W) * 166, (Y / W) * 8);
    const k = (0.75 + 0.35 * strand) * (1 - 0.35 * smooth(0.7, 1, t)) * (0.9 + 0.2 * tufts(X, Y)) * (t < 0.1 ? 1.08 : 1);
    paintPx(px, base, base, 0, k);
    px.h = 0.3 + 0.4 * strand + 0.3 * (1 - t);
    px.rough = 0.9;
  };
};

// ── Metals, glass, cloth, light ───────────────────────────────────────────────────────────────────────────────────

/** Metals (§7.2): iron is hammered with flaked rusty edges; brass and pewter are rubbed bright with tarnish. */
function metal(colour: number, rough: number, hammered: boolean): (seed: number) => Sampler {
  return (seed) => {
    const W = 1;
    const base = rgb(colour);
    const rust = rgb(0x5a4535);
    const v = new Voronoi(10, 10, W, W, 0.9, new Rng(seed));
    const tarnishes = fbm(W, W, 0.25, 0.25, 3, seed + 2);
    const brushes = fbm(W, W, 0.3, 0.01, 2, seed + 4);
    const h = vhit();
    return (X, Y, px) => {
      const tarnish = tarnishes(X, Y);
      const brush = brushes(X, Y);
      let dent = 0;
      if (hammered) {
        v.at(X, Y, h);
        dent = clamp01(h.d1 / 0.06);
      }
      const flake = hammered && tarnish > 0.68;
      paintPx(px, base, flake ? rust : base, flake ? 0.8 : 0, (0.85 + 0.2 * brush) * (hammered ? 0.9 + 0.15 * dent : 1.05 - 0.2 * smooth(0.3, 0.1, tarnish)));
      px.h = 0.5 + (hammered ? 0.3 * dent : 0.05 * brush);
      px.rough = flake ? 0.85 : rough + (hammered ? 0.1 * dent : 0.1 * (1 - tarnish));
      px.metal = flake ? 0.2 : 1;
    };
  };
}

/** Verdigris and copper (§7.2): vertical patina streaks with copper showing through. */
const verdigris = (seed: number): Sampler => {
  const W = 2;
  const green = rgb(0x5e7d6b);
  const copper = rgb(0x8a5a3a);
  const streaks = fbm(W, W, 0.05, 0.6, 3, seed);
  const patches = fbm(W, W, 0.5, 0.5, 3, seed + 2);
  return (X, Y, px) => {
    const streak = streaks(X, Y);
    const cu = smooth(0.32, 0.22, patches(X, Y));
    paintPx(px, green, copper, cu, 0.85 + 0.3 * streak);
    px.h = 0.5 + 0.2 * streak;
    px.rough = mix(0.6, 0.4, cu);
    px.metal = mix(0.1, 0.8, cu);
  };
};

/** Glass (§5.2, §7.2): dark blue-grey, nearly flat, with faint smears; reflects the sky through the env map. */
const glass = (seed: number): Sampler => {
  const base = rgb(0x2e3a46);
  const smears = fbm(1, 1, 0.2, 0.08, 2, seed);
  return (X, Y, px) => {
    const smear = smears(X, Y);
    paintPx(px, base, base, 0, 0.9 + 0.15 * Y + 0.08 * smear);
    px.h = 0.5;
    px.rough = 0.08 + 0.12 * smooth(0.6, 0.8, smear);
  };
};

/** A lit window (§5.2): warm light behind half-drawn curtains; u, v span the pane. */
const windowLit = (seed: number): Sampler => {
  const glow = rgb(0xffb866);
  const cloth = rgb(0x7a3e2a);
  const r = new Rng(seed);
  const left = r.range(0.12, 0.3);
  const right = 1 - r.range(0.12, 0.3);
  return (X, Y, px) => {
    const curtain = X < left || X > right;
    const fold = 0.75 + 0.25 * Math.sin(X * 70);
    const pool = 0.75 + 0.25 * (1 - Math.abs(X - 0.5) * 2) * (1 - Y * 0.5);
    if (curtain) paintPx(px, cloth, cloth, 0, fold * (0.8 + 0.2 * Y));
    else paintPx(px, glow, glow, 0, pool);
    px.h = curtain ? 0.6 + 0.2 * fold : 0.4;
    px.rough = 0.6;
  };
};

/** Lantern glass and hearth glow (§10.3): warm, brightest at the centre. */
const lantern = (): Sampler => {
  const glow = rgb(0xffb866);
  const hot = rgb(0xfff0d0);
  return (X, Y, px) => {
    const d = Math.hypot(X - 0.5, Y - 0.5) * 2;
    paintPx(px, hot, glow, smooth(0, 0.8, d), 1);
    px.h = 0.5;
    px.rough = 0.4;
  };
};

/** Canvas (§5.6): a fine weave in cream with darker stripes; tint it with district colours. */
const canvas = (seed: number): Sampler => {
  const W = 2;
  const cream = rgb(0xd2c6a6);
  const dirt = fbm(W, W, 0.5, 0.5, 2, seed);
  return (X, Y, px) => {
    const stripe = Math.floor(X / 0.25) % 2 === 1 ? 0.72 : 1;
    const weave = 0.97 + 0.03 * Math.sin((X / W) * Math.PI * 400) * Math.sin((Y / W) * Math.PI * 400);
    paintPx(px, cream, cream, 0, stripe * weave * (0.92 + 0.12 * dirt(X, Y)));
    px.h = 0.5 + 0.1 * weave;
    px.rough = 0.9;
  };
};

/** Rope (§7.2): twisted strands with dark grooves. */
const rope = (seed: number): Sampler => {
  const W = 0.5;
  const base = rgb(0xc9ae7c);
  const fibres = fbm(W, W, 0.005, 0.03, 2, seed);
  return (X, Y, px) => {
    const s = ((((X + Y) / 0.05) % 1) + 1) % 1;
    const strand = Math.sqrt(Math.sin(s * Math.PI));
    paintPx(px, base, base, 0, (0.55 + 0.5 * strand) * (0.9 + 0.2 * fibres(X, Y)));
    px.h = 0.2 + 0.8 * strand;
    px.rough = 0.85;
  };
};

/** Woven twig (§1.1, §7.2): weavers 3–6 cm passing over and under upright stakes every 20 cm. */
const twig = (seed: number): Sampler => {
  const W = 1.2;
  const base = rgb(0x7a5e3e);
  const stakeC = rgb(0x4e3a26);
  const gap = rgb(0x22180f);
  const rowH = 0.048;
  const stake = 0.2;
  const barkF = fbm(W, W, 0.03, 0.008, 2, seed);
  const tones = lattice(25, 1, seed + 3);
  return (X, Y, px) => {
    const row = Math.floor(Y / rowH);
    const t = (Y - row * rowH) / rowH;
    const k = Math.floor(X / stake);
    const s = (X - k * stake) / stake;
    const over = (row + k) % 2 === 0;
    const bulge = Math.sin(s * Math.PI);
    const lift = over ? 0.55 + 0.45 * bulge : 0.55 - 0.45 * bulge;
    const round = Math.sqrt(Math.max(0, Math.sin(t * Math.PI)));
    const b = barkF(X, Y);
    // Stakes show where the weaver dips under: a 3 cm upright between rows.
    const stakeD = Math.abs(s - 0.5) * stake;
    if (!over && stakeD < 0.022 && bulge > 0.7) {
      paintPx(px, stakeC, stakeC, 0, 0.8 + 0.3 * b);
      px.h = 0.5;
      px.rough = 0.85;
      return;
    }
    if (round < 0.3) {
      paintPx(px, gap, gap, 0, 1);
      px.h = 0;
      px.rough = 0.95;
      return;
    }
    const tone = 1 + (tones(row, 0) - 0.5) * 0.3;
    paintPx(px, base, base, 0, tone * (0.3 + 0.85 * round * lift) * (0.85 + 0.3 * b));
    px.h = round * lift;
    px.rough = 0.85;
  };
};

// ── Nature ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Bark (§6.1): vertical fissured ridges 5–15 cm wide, cracked into plates, moss in some fissures. */
const bark = (seed: number): Sampler => {
  const [W, H] = [2, 4];
  const base = rgb(0x4e3424);
  const light = rgb(0x7a6048);
  const deep = rgb(0x1e140e);
  const mossC = rgb(0x5f7f4a);
  const ridges = fbm(W, H, 0.1, 0.9, 3, seed);
  const plateF = fbm(W, H, 0.25, 0.35, 2, seed + 2);
  const mossF = fbm(W, H, 0.5, 1, 3, seed + 4);
  const crossCracks = lattice(40, 24, seed + 6);
  return (X, Y, px) => {
    const r = clamp01((ridges(X, Y) - 0.5) * 2.6 + 0.5);
    const ridge = Math.pow(1 - Math.abs(2 * r - 1), 0.7);
    const crack = crossCracks((X / W) * 40, (Y / H) * 24) > 0.86 && Math.abs(((Y / H) * 24) % 1 - 0.5) < 0.06;
    const plates = plateF(X, Y);
    const mossy = smooth(0.55, 0.72, mossF(X, Y)) * smooth(0.45, 0.15, ridge);
    if (ridge < 0.18 || crack) {
      paintPx(px, deep, mossC, mossy, 1);
      px.h = 0;
      px.rough = 0.95;
      return;
    }
    paintPx(px, base, light, clamp01(ridge * 0.9 * plates + 0.1), 0.6 + 0.55 * ridge);
    if (mossy > 0) paintPx(px, [px.r, px.g, px.b], mossC, mossy, 1);
    px.h = ridge;
    px.rough = 0.9;
  };
};

/** Clipped hedge (§6.2): densely packed small leaves, lit on their upper side, with dark gaps. */
const hedge = (seed: number): Sampler => {
  const W = 1.5;
  const v = new Voronoi(26, 26, W, W, 0.9, new Rng(seed));
  const leaf = rgb(0x5a8a44);
  const blue = rgb(0x3f6e45);
  const gap = rgb(0x1e3019);
  const h = vhit();
  return (X, Y, px) => {
    v.at(X, Y, h);
    const edge = (h.d2 - h.d1) / 2;
    const dome = Math.sqrt(clamp01(edge / 0.025));
    if (edge < 0.0025) {
      paintPx(px, gap, leaf, 0.2, 1);
      px.h = 0;
      px.rough = 0.9;
      return;
    }
    const lit = 0.8 + 0.3 * clamp01(0.5 - h.dy * 14 + h.dx * (h.r1 - 0.5) * 8);
    paintPx(px, leaf, blue, h.r2, lit * (0.6 + 0.45 * dome) * pieceValue(h));
    px.h = 0.3 + 0.7 * dome;
    px.rough = 0.8;
  };
};

/** Lawn and verge grass: speckled blades with drier patches. */
const grass = (seed: number): Sampler => {
  const W = 2;
  const green = rgb(0x5e7a45);
  const dry = rgb(0x8a8550);
  const blades = lattice(200, 200, seed);
  const clumps = fbm(W, W, 0.15, 0.15, 2, seed + 2);
  const patches = fbm(W, W, 0.8, 0.8, 3, seed + 4);
  return (X, Y, px) => {
    const b = blades(X / 0.01, Y / 0.01);
    const clump = clumps(X, Y);
    paintPx(px, green, dry, smooth(0.55, 0.75, patches(X, Y)) * 0.7, (0.7 + 0.4 * b) * (0.85 + 0.25 * clump));
    px.h = 0.3 + 0.5 * b * clump;
    px.rough = 0.9;
  };
};

/** Moss (§6.2): soft cushions. */
const moss = (seed: number): Sampler => {
  const W = 1;
  const v = new Voronoi(12, 12, W, W, 0.9, new Rng(seed));
  const base = rgb(0x5f7f4a);
  const deep = rgb(0x3e5a33);
  const fineF = lattice(125, 125, seed + 1);
  const h = vhit();
  return (X, Y, px) => {
    v.at(X, Y, h);
    const dome = Math.sqrt(clamp01(1 - h.d1 / 0.07));
    const fine = fineF(X / 0.008, Y / 0.008);
    paintPx(px, deep, base, dome, (0.85 + 0.25 * fine) * pieceValue(h));
    px.h = dome * 0.8 + fine * 0.2;
    px.rough = 0.95;
  };
};

/** Packed earth with small pebbles. */
const earth = (seed: number): Sampler => {
  const W = 2;
  const v = new Voronoi(20, 20, W, W, 1, new Rng(seed));
  const base = rgb(0x6b5a45);
  const pebble = rgb(0x8a7e68);
  const soilF = fbm(W, W, 0.2, 0.2, 3, seed + 1);
  const h = vhit();
  return (X, Y, px) => {
    v.at(X, Y, h);
    const soil = soilF(X, Y);
    const p = h.r1 < 0.35 && h.d1 < 0.012 + h.r2 * 0.012;
    paintPx(px, base, pebble, p ? 0.8 : 0, (0.82 + 0.3 * soil) * (p ? pieceValue(h) : 1));
    px.h = p ? 0.8 : 0.3 + 0.3 * soil;
    px.rough = 0.9;
  };
};

/** Gravel: small stones with dark gaps. */
const gravel = (seed: number): Sampler => {
  const W = 2;
  const v = new Voronoi(30, 30, W, W, 0.9, new Rng(seed));
  const base = rgb(0x8a7e68);
  const gap = rgb(0x4a4134);
  const h = vhit();
  return (X, Y, px) => {
    v.at(X, Y, h);
    const edge = (h.d2 - h.d1) / 2;
    const dome = Math.sqrt(clamp01((edge - 0.004) / 0.02));
    paintPx(px, gap, base, dome, pieceValue(h) * (0.9 + 0.2 * h.r2));
    px.h = dome;
    px.rough = 0.85;
  };
};

/** Water (§7.2): depth-tinted, with gentle periodic ripples for the normal map. */
const water = (seed: number): Sampler => {
  const W = 4;
  const base = rgb(0x3f8c8a);
  const deep = rgb(0x2a6466);
  const tones = fbm(W, W, 1, 1, 2, seed);
  return (X, Y, px) => {
    const rip = Math.sin((X / W) * Math.PI * 6 + Math.sin((Y / W) * Math.PI * 4) * 1.5) * 0.5 + Math.sin((Y / W) * Math.PI * 8 + (X / W) * Math.PI * 2) * 0.5;
    paintPx(px, deep, base, tones(X, Y), 0.95 + 0.06 * rip);
    px.h = 0.5 + 0.25 * rip;
    px.rough = 0.05;
  };
};

// ── Cards (alpha-tested, u and v span the card) ───────────────────────────────────────────────────────────────────

/** A leaf clump card (§6.1): overlapping leaves filling the card, darker at the centre, lighter edges, a vein. */
const leafCard = (seed: number): Sampler => {
  const r = new Rng(seed);
  // A rosette: an outer ring of long leaves and an inner ring of short ones, all growing out from near the centre.
  const leaves = Array.from({ length: 20 }, (_, i) => {
    const outer = i < 12;
    const a = ((outer ? i : i - 12) / (outer ? 12 : 8)) * Math.PI * 2 + r.range(-0.2, 0.2) + (outer ? 0 : 0.4);
    const len = outer ? r.range(0.3, 0.4) : r.range(0.2, 0.28);
    const start = outer ? r.range(0.06, 0.12) : r.range(0.02, 0.06);
    return { a, len, w: len * r.range(0.4, 0.5), x: 0.5 + Math.sin(a) * start, y: 0.5 + Math.cos(a) * start, tone: r.range(0.82, 1.15), hue: r.next() };
  });
  const base = rgb(0x6f9a52);
  const blue = rgb(0x4f8452);
  return (X, Y, px) => {
    px.a = 0;
    px.h = 0;
    px.rough = 0.8;
    paintPx(px, base, base, 0, 0.5);
    for (let i = leaves.length - 1; i >= 0; i--) {
      const l = leaves[i];
      if (!l) continue;
      const dx = X - l.x;
      const dy = Y - l.y;
      const ca = Math.cos(l.a);
      const sa = Math.sin(l.a);
      const along = (dx * sa + dy * ca) / l.len;
      if (along < 0 || along > 1) continue;
      const across = (dx * ca - dy * sa) / (l.w / 2);
      const lens = Math.sqrt(Math.max(0, 1 - (2 * along - 1) ** 2)) * (1 - 0.35 * along * along);
      if (Math.abs(across) > lens) continue;
      const rim = Math.abs(across) / Math.max(lens, 1e-3);
      const vein = Math.abs(across) < 0.05 ? 0.8 : 1;
      const centre = Math.hypot(X - 0.5, Y - 0.5) * 2;
      paintPx(px, base, blue, l.hue, l.tone * (0.6 + 0.25 * along + 0.15 * rim) * (0.8 + 0.25 * centre) * vein);
      px.a = 1;
      px.h = 1 - rim * 0.5;
      return;
    }
  };
};

/** A pine sprig card (§6.1): needles along three stems, lighter at the tips. */
const pineCard = (seed: number): Sampler => {
  const r = new Rng(seed);
  const stems = [0, 1, 2].map((i) => ({ x: 0.5, y: 0.05, a: (i - 1) * 0.45 + r.range(-0.08, 0.08), len: r.range(0.75, 0.9) }));
  const base = rgb(0x4a7458);
  return (X, Y, px) => {
    px.a = 0;
    px.h = 0;
    px.rough = 0.8;
    paintPx(px, base, base, 0, 0.5);
    for (const s of stems) {
      const dx = X - s.x;
      const dy = Y - s.y;
      const along = dx * Math.sin(s.a) + dy * Math.cos(s.a);
      const side = dx * Math.cos(s.a) - dy * Math.sin(s.a);
      if (along < 0 || along > s.len) continue;
      const reach = 0.13 * (1 - (along / s.len) * 0.6);
      if (Math.abs(side) > reach) continue;
      if (Math.abs(side) < 0.008) {
        paintPx(px, base, base, 0, 0.55);
        px.a = 1;
        return;
      }
      const phase = ((along - Math.abs(side) * 0.9) / 0.018) % 1;
      if (phase < 0.38) {
        paintPx(px, base, base, 0, 0.7 + 0.5 * (Math.abs(side) / reach));
        px.a = 1;
        px.h = 1;
        return;
      }
    }
  };
};

/** A feather card (§8.2): a rachis, a narrow vane tapering to a rounded tip, barbs, small notches; neutral for tinting. */
const featherCard = (seed: number): Sampler => {
  const base = rgb(0xdedad2);
  const dark = rgb(0x9a958c);
  const notches = lattice(24, 2, seed);
  return (X, Y, px) => {
    px.a = 0;
    px.h = 0;
    px.rough = 0.7;
    paintPx(px, base, base, 0, 0.6);
    const t = (Y - 0.03) / 0.94;
    if (t < 0 || t > 1) return;
    const shaft = 0.5 + 0.03 * Math.sin(t * Math.PI);
    const dx = X - shaft;
    const taper = Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, t - 0.55) / 0.45, 2)));
    const half = (dx < 0 ? 0.13 : 0.19) * smooth(0, 0.18, t) * taper;
    const notch = notches(t * 24, dx < 0 ? 0 : 1) > 0.8 ? 0.82 : 1;
    if (Math.abs(dx) < 0.008 + 0.008 * (1 - t)) {
      paintPx(px, base, base, 0, 1.06);
      px.a = 1;
      px.h = 1;
      return;
    }
    if (Math.abs(dx) > half * notch) return;
    const barb = 0.5 + 0.5 * Math.sin(((Y - Math.abs(dx) * 0.7) / 0.01) * Math.PI);
    const down = smooth(0.18, 0.02, t);
    paintPx(px, base, dark, 0.3 * (Math.abs(dx) / Math.max(half, 1e-3)) + 0.4 * down, 0.84 + 0.16 * barb);
    px.a = down > 0.5 && barb < 0.4 ? 0 : 1;
    px.h = 0.5 + 0.3 * barb;
  };
};

const card = { tile: [1, 1] as const, normal: 0.6, cavity: 0.3, card: true };

/** The library's recipes, keyed by material. Tiles are in metres (u × v); see the guide's §7.2 table. */
export const RECIPES: Readonly<Record<MaterialId, Recipe>> = {
  brick: { colour: 0xa4573f, tile: [2.01, 2.07], normal: 1, cavity: 0.8, make: brick(0xa4573f, 0x7e4634, 0xb7aa8f) },
  brickBurnt: { colour: 0x7e4634, tile: [2.01, 2.07], normal: 1, cavity: 0.8, make: brick(0x7e4634, 0x5e3326, 0xa39780) },
  ashlar: { colour: 0xb9a98a, tile: [2.4, 2.4], normal: 0.8, cavity: 0.7, make: ashlar(0xb9a98a, 0.01, 0.4, 0.6, 1.2) },
  granite: { colour: 0x8c8579, tile: [2.4, 2.4], normal: 0.8, cavity: 0.7, make: ashlar(0x8c8579, 0.01, 0.4, 0.6, 1.2) },
  sandstone: { colour: 0xb08a5e, tile: [2.4, 2.4], normal: 0.8, cavity: 0.7, make: ashlar(0xb08a5e, 0.012, 0.48, 0.7, 1.3) },
  flagstone: { colour: 0x7d7262, tile: [3, 3], normal: 0.8, cavity: 0.7, make: flagstone },
  cobble: { colour: 0x6e6253, tile: [1.5, 1.5], normal: 1.4, cavity: 0.9, make: cobble },
  plaster: { colour: 0xa9a294, tile: [4, 4], normal: 0.3, cavity: 0.5, make: plaster(0xa9a294) },
  plasterOchre: { colour: 0xa88c5e, tile: [4, 4], normal: 0.3, cavity: 0.5, make: plaster(0xa88c5e) },
  timber: { colour: 0x7a5236, tile: [2.4, 2.4], normal: 0.4, cavity: 0.6, make: planks(0x7a5236, 0) },
  timberDark: { colour: 0x4e3424, tile: [2.4, 2.4], normal: 0.4, cavity: 0.6, make: planks(0x4e3424, 0) },
  timberRed: { colour: 0x8a4b32, tile: [2.4, 2.4], normal: 0.4, cavity: 0.6, make: planks(0x8a4b32, 0) },
  boards: { colour: 0x9c8466, tile: [2.4, 2.4], normal: 0.4, cavity: 0.6, make: planks(0x9c8466, 0.2) },
  roofClay: { colour: 0x9a4e36, tile: [2.4, 2.4], normal: 1.2, cavity: 0.8, make: roof(0x9a4e36, 0.3, 0.2667, 0.2667, 'pantile') },
  roofSlate: { colour: 0x5c6470, tile: [2.4, 2.4], normal: 1, cavity: 0.8, make: roof(0x5c6470, 0.25, 0.22, 0.34, 'slate') },
  roofShingle: { colour: 0x5c4433, tile: [2.4, 2.4], normal: 1.2, cavity: 0.8, make: roof(0x5c4433, 0.3, 0.1, 0.25, 'shingle') },
  thatch: { colour: 0x9c8a5e, tile: [2, 2], normal: 1, cavity: 0.7, make: thatch },
  iron: { colour: 0x3a3836, tile: [1, 1], normal: 0.4, cavity: 0.4, make: metal(0x3a3836, 0.5, true) },
  brass: { colour: 0xb5893a, tile: [1, 1], normal: 0, cavity: 0.2, make: metal(0xb5893a, 0.35, false) },
  pewter: { colour: 0x8e93a6, tile: [1, 1], normal: 0, cavity: 0.2, make: metal(0x8e93a6, 0.4, false) },
  verdigris: { colour: 0x5e7d6b, tile: [2, 2], normal: 0.3, cavity: 0.4, make: verdigris },
  glass: { colour: 0x2e3a46, tile: [1, 1], normal: 0, cavity: 0, make: glass },
  windowLit: { colour: 0xffb866, tile: [1, 1], normal: 0, cavity: 0, emissive: 0.8, make: windowLit },
  lantern: { colour: 0xffb866, tile: [1, 1], normal: 0, cavity: 0, emissive: 1, make: lantern },
  canvas: { colour: 0xd2c6a6, tile: [2, 2], normal: 0.2, cavity: 0.3, make: canvas },
  rope: { colour: 0xc9ae7c, tile: [0.5, 0.5], normal: 1, cavity: 0.8, make: rope },
  twig: { colour: 0x6b5236, tile: [1.2, 1.2], normal: 1.4, cavity: 0.9, make: twig },
  bark: { colour: 0x4e3424, tile: [2, 4], normal: 1.4, cavity: 0.8, make: bark },
  hedge: { colour: 0x4f7d3b, tile: [1.5, 1.5], normal: 1, cavity: 0.8, make: hedge },
  grass: { colour: 0x5e7a45, tile: [2, 2], normal: 0.5, cavity: 0.5, make: grass },
  moss: { colour: 0x5f7f4a, tile: [1, 1], normal: 0.8, cavity: 0.6, make: moss },
  earth: { colour: 0x6b5a45, tile: [2, 2], normal: 0.6, cavity: 0.6, make: earth },
  gravel: { colour: 0x8a7e68, tile: [2, 2], normal: 1, cavity: 0.8, make: gravel },
  water: { colour: 0x3f8c8a, tile: [4, 4], normal: 0.6, cavity: 0, make: water },
  leafCard: { colour: 0x3e6b3a, ...card, make: leafCard },
  pineCard: { colour: 0x2e4f3a, ...card, make: pineCard },
  featherCard: { colour: 0xdedad2, ...card, make: featherCard },
};
