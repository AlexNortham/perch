// TODO(Hero Engineer A): Penguin's kit is data in src/sim/data/heroes/penguin.ts; add `hooks` here only for what data can't express.
import type { HeroModule } from '../../core/contracts';
import { penguinDef } from '../../data/heroes/penguin';

export const penguin: HeroModule = { def: penguinDef };
