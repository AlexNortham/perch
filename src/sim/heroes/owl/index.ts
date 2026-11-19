/**
 * Owl needs no hooks: Silent Wing's glide ends on landing or Space in Physics' glide mode itself (GDD §9.5).
 */
import type { HeroModule } from '../../core/contracts';
import { owlDef } from '../../data/heroes/owl';

export const owl: HeroModule = {
  def: owlDef,
  implemented: true,
};
