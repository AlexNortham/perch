// TODO(Hero Engineer B): Starling's kit is data in src/sim/data/heroes/starling.ts; add `hooks` here only for what data can't express.
import type { HeroModule } from '../../core/contracts';
import { starlingDef } from '../../data/heroes/starling';

export const starling: HeroModule = { def: starlingDef };
