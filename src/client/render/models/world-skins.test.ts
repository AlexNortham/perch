// The world's baked implicit bodies (D-ART-014) match their generator: each committed skin is re-baked from
// world-bodies.ts and compared byte for byte. If this fails, re-bake: `npx tsx tests/anim/bake-world.ts`.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bakeBody } from './mesher';
import { decodeSkin } from './skin';
import { skinModule, skinOf } from './skin-file';
import { WORLD_BODIES } from './world-bodies';
import type { WorldBody } from './world-bodies';

const BAKE_MS = 90_000;
const DIR = resolve(__dirname, 'data/world');

describe('world bodies (D-ART-014)', () => {
  for (const name of Object.keys(WORLD_BODIES) as WorldBody[]) {
    it(`${name}: the committed skin is what the generator bakes, within its targets`, async () => {
      const committed = skinOf(readFileSync(`${DIR}/${name}.ts`, 'utf8'));
      const body = WORLD_BODIES[name]();
      const baked = skinOf(skinModule(name, await bakeBody(body)));
      expect(baked === committed, `${name}: stale bake, run npx tsx tests/anim/bake-world.ts ${name}`).toBe(true);
      const levels = decodeSkin(committed);
      expect(levels).toHaveLength(4);
      levels.forEach((l, i) => expect(l.index.length / 3, `${name} level ${i}`).toBeLessThanOrEqual(body.tris[i] ?? 0));
    }, BAKE_MS);
  }
});
