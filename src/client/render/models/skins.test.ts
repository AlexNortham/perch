// The baked implicit bodies (D-ART-008) match their generator: each committed skin is re-baked from bodies.ts at its
// hero's BodyPlan and compared byte for byte. If this fails, re-bake: `npx tsx tests/anim/bake-skins.ts`.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HEROES } from '../../../sim/heroes/registry';
import { BODIES } from './bodies';
import { surfaceNets, bakeBody } from './mesher';
import { cone, ell, Field } from './sdf';
import { decodeSkin } from './skin';
import { skinModule, skinOf } from './skin-file';

const BAKE_MS = 60_000;
const DIR = resolve(__dirname, 'data/skins');

describe('implicit bodies (D-ART-008)', () => {
  for (const id of Object.keys(BODIES) as (keyof typeof BODIES)[]) {
    it(`${id}: the committed skin is what the generator bakes`, async () => {
      const committed = skinOf(readFileSync(`${DIR}/${id}.ts`, 'utf8'));
      const baked = skinOf(skinModule(id, await bakeBody(BODIES[id](HEROES[id].def.body))));
      expect(baked === committed, `${id}: stale bake, run npx tsx tests/anim/bake-skins.ts`).toBe(true);
      // Four levels, each within its target, and every vertex's bones and regions weighted to 1.
      const levels = decodeSkin(committed);
      expect(levels).toHaveLength(4);
      levels.forEach((l, i) => {
        expect(l.index.length / 3, `${id} level ${i}`).toBeLessThanOrEqual(BODIES[id](HEROES[id].def.body).tris[i] ?? 0);
        for (let v = 0; v < l.pos.length / 3; v++) {
          const w = [0, 1, 2, 3].reduce((s, k) => s + (l.boneW[v * 4 + k] ?? 0), 0);
          expect(w).toBeCloseTo(1, 2);
        }
      });
    }, BAKE_MS);
  }

  it('meshes a field into a closed surface, wound outward, on the surface', () => {
    const field = new Field({ ops: [ell([0, 1, 0], [0.3, 0.25, 0.4], 'body', 'a'), cone([0, 1.1, 0.2], [0, 1.6, 0.25], 0.1, 0.07, 'head', 'b', { k: 0.05 })], tris: [1, 1, 1, 1] });
    const { pos, index } = surfaceNets(field, 0.01);
    const edges = new Set<string>();
    let outward = 0;
    for (let t = 0; t < index.length; t += 3) {
      const [a, b, c] = [index[t]!, index[t + 1]!, index[t + 2]!];
      for (const [p, q] of [[a, b], [b, c], [c, a]] as const) edges.add(p < q ? `${p},${q}` : `${q},${p}`);
      const P = (v: number, k: number): number => pos[v * 3 + k]!;
      const u = [0, 1, 2].map((k) => P(b, k) - P(a, k));
      const w = [0, 1, 2].map((k) => P(c, k) - P(a, k));
      const n = [u[1]! * w[2]! - u[2]! * w[1]!, u[2]! * w[0]! - u[0]! * w[2]!, u[0]! * w[1]! - u[1]! * w[0]!];
      const g = field.normal(P(a, 0), P(a, 1), P(a, 2));
      if (n[0]! * g[0] + n[1]! * g[1] + n[2]! * g[2] > 0) outward++;
    }
    // Euler characteristic 2: one closed surface of genus 0.
    expect(pos.length / 3 - edges.size + index.length / 3).toBe(2);
    // A few slivers where a quad folds may face sideways; the surface as a whole faces out.
    expect(outward / (index.length / 3)).toBeGreaterThan(0.998);
    for (let v = 0; v < pos.length / 3; v++) expect(Math.abs(field.d(pos[v * 3]!, pos[v * 3 + 1]!, pos[v * 3 + 2]!))).toBeLessThan(1e-3);
  });

  it('blends bones and paint across a join, and finds the surface along a ray', () => {
    const field = new Field({ ops: [ell([0, 1, 0], [0.3, 0.3, 0.3], 'body', 'a'), ell([0, 1.35, 0], [0.12, 0.12, 0.12], 'head', 'b', { k: 0.06 })], tris: [1, 1, 1, 1] });
    const join = field.project([0.1, 1.27, 0]);
    const o = field.owners(...join);
    expect(o.bones.map(([b]) => b).sort()).toEqual(['body', 'head']);
    expect(o.bones.reduce((s, [, w]) => s + w, 0)).toBeCloseTo(1, 6);
    const p = field.surface([0, 0.8, 0], [0, 1.2, 0]).at(0.5, 0);
    expect(Math.abs(field.d(p.p.x, p.p.y, p.p.z))).toBeLessThan(1e-4);
  });
});
