/** Shrike has no hooks: Impaling Bolt's wall pin is `DisplaceEffect.onWall` data. */
import type { HeroModule } from '../../core/contracts';
import { shrikeDef } from '../../data/heroes/shrike';

export const shrike: HeroModule = { def: shrikeDef, implemented: true };
