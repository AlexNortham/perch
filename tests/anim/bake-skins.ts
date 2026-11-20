// Bake the implicit bird bodies (D-ART-008): `npx tsx tests/anim/bake-skins.ts [hero…]`.
// For each body in src/client/render/models/bodies.ts (or those named), mesh its field at its hero's BodyPlan and write
// src/client/render/models/data/skins/<hero>.ts. Deterministic: skins.test.ts re-bakes and compares.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { HEROES } from '../../src/sim/heroes/registry';
import type { HeroId } from '../../src/sim/core/contracts';
import { BODIES } from '../../src/client/render/models/bodies';
import { bakeBody } from '../../src/client/render/models/mesher';
import { skinModule } from '../../src/client/render/models/skin-file';

const DIR = resolve('src/client/render/models/data/skins');
mkdirSync(DIR, { recursive: true });
const ids = (process.argv.length > 2 ? process.argv.slice(2) : Object.keys(BODIES)) as (keyof typeof BODIES & HeroId)[];
for (const id of ids) {
  const t0 = performance.now();
  const bin = await bakeBody(BODIES[id](HEROES[id].def.body));
  writeFileSync(`${DIR}/${id}.ts`, skinModule(id, bin));
  console.log(`bake-skins: ${id} ${(bin.length / 1024).toFixed(0)} KB in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
}
