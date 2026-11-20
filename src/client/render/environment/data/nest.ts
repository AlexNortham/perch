/**
 * Bird-built pieces shared by every generator (style guide §1.1, §4.1 "bird-built": bowls, domes, woven bands,
 * drooping fringes): woven nests with straggling twigs, eggs and down; perch rails on brackets; pennant bunting;
 * pigeonholes. Authored art data.
 */
import { Vector3 } from 'three';
import { oriented } from '../mesher';
import type { Mesher } from '../mesher';
import { hash2 } from '../world';
import { EGG_BLUE, EGG_CREAM, FEATHER, IRON, TWIG } from './styles';
import type { Paint } from '../mesher';

const NEST_SIDES = 12;
const TWIG_SIDES = 3;

/**
 * A woven nest bowl centred at (x, y, z) local (y = bottom), outer radius r, depth h: a lathed bowl with a thick
 * rolled rim, straggling twigs past the rim, and `eggs` eggs (0–3) with a few down feathers inside.
 */
export function nest(g: Mesher, x: number, y: number, z: number, r: number, h: number, seed: number, eggs = 0, twigs = 14): void {
  g.at(x, y, z, hash2(seed, 1) * Math.PI, () => {
    g.paint(TWIG, seed).lathe([
      [r * 0.35, 0], [r * 0.75, h * 0.18], [r * 0.95, h * 0.5], [r * 1.02, h * 0.82], [r * 0.95, h], [r * 0.82, h * 1.02],
      [r * 0.66, h * 0.75], [r * 0.4, h * 0.42], [0.001, h * 0.38],
    ], NEST_SIDES);
    // Straggling twigs: leaning outward and up past the rim, thin and bent once.
    for (let i = 0; i < twigs; i++) {
      const a = (i / twigs) * Math.PI * 2 + hash2(seed, i + 3) * 0.6;
      const lean = 0.3 + hash2(seed, i + 40) * 0.9;
      const len = r * (0.45 + hash2(seed, i + 80) * 0.6);
      const y0 = h * (0.55 + hash2(seed, i + 120) * 0.4);
      const p0 = new Vector3(Math.cos(a) * r * 0.8, y0, Math.sin(a) * r * 0.8);
      const out = new Vector3(Math.cos(a + (hash2(seed, i + 160) - 0.5)), lean, Math.sin(a + (hash2(seed, i + 160) - 0.5))).normalize();
      const p1 = p0.clone().addScaledVector(out, len * 0.55);
      const p2 = p1.clone().addScaledVector(out, len * 0.45).add(new Vector3(0, -len * 0.12, 0));
      g.tube([p0, p1, p2], [r * 0.035, r * 0.025, r * 0.01], TWIG_SIDES);
    }
    for (let e = 0; e < eggs; e++) {
      const a = e * 2.1 + hash2(seed, 200) * 3;
      const er = Math.min(0.14, r * 0.12);
      g.paint(e % 2 ? EGG_CREAM : EGG_BLUE, seed + e).within(eggFrame(Math.cos(a) * r * 0.22, h * 0.42, Math.sin(a) * r * 0.22, a), () => {
        g.lathe(eggProfile(er), 8);
      });
    }
    if (eggs > 0) {
      // Down feathers caught in the rim.
      for (let f = 0; f < 3; f++) {
        const a = f * 2.4 + hash2(seed, 300);
        const c = new Vector3(Math.cos(a) * r * 0.85, h * 0.95, Math.sin(a) * r * 0.85);
        g.paint(FEATHER, seed + f).card2(c, new Vector3(0.06, 0, 0.03), new Vector3(0.02, 0.1, -0.05));
      }
    }
  });
}

/** Eggs lie tipped over in the bowl. */
const eggFrame = (x: number, y: number, z: number, a: number) => oriented(x, y, z, a, 1.2);

/** An egg's lathe profile, pointed end up, radius r. */
export function eggProfile(r: number): [number, number][] {
  return [[0.001, -r * 1.1], [r * 0.7, -r * 0.85], [r, -r * 0.25], [r * 0.92, r * 0.35], [r * 0.6, r * 0.95], [0.001, r * 1.3]];
}

/**
 * A dowel perch rail (6–8 cm) 0.2 m off a wall, on brackets every ~1.4 m (style guide §1.1), from u0 to u1 at height
 * y, in a wall frame (x along, z out). Stays under 0.25 m deep (decoration only, §2.6).
 */
export function perchRail(g: Mesher, u0: number, u1: number, y: number, timber: Paint, seed: number, brackets: Mesher = g): void {
  const len = u1 - u0;
  if (len < 0.6) return;
  const n = Math.max(2, Math.round(len / 1.4) + 1);
  brackets.paint(timber, seed);
  for (let i = 0; i < n; i++) {
    const u = u0 + 0.12 + ((len - 0.24) * i) / (n - 1);
    // A tapered carved bracket: deep at the wall, shallow at the rail.
    brackets.span(u - 0.03, u + 0.03, y - 0.06, y + 0.02, 0, 0.22, 0, '-z');
    brackets.span(u - 0.03, u + 0.03, y - 0.2, y - 0.06, 0, 0.1, 0, '-z');
  }
  g.paint(timber, seed + 1).tube([new Vector3(u0, y + 0.05, 0.2), new Vector3(u1, y + 0.05, 0.2)], 0.035, 6);
}

/** Iron hook bracket with a short arm, for hanging feeders, emblems and lanterns, from a wall at (u, y). */
export function wallBracket(g: Mesher, u: number, y: number, reach: number, seed: number): void {
  g.paint(IRON, seed);
  g.span(u - 0.08, u + 0.08, y - 0.18, y + 0.18, 0, 0.03);
  g.tube([new Vector3(u, y, 0.02), new Vector3(u, y + 0.02, reach)], 0.025, 5);
  g.tube([new Vector3(u, y - 0.15, 0.02), new Vector3(u, y - 0.02, reach * 0.6)], 0.018, 4);
}
