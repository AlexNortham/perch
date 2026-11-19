/** Starling has no hooks: the swarms are projectiles, areas and a dash, all `data/heroes/starling.ts`. */
import type { HeroModule } from '../../core/contracts';
import { starlingDef } from '../../data/heroes/starling';

export const starling: HeroModule = { def: starlingDef, implemented: true };
