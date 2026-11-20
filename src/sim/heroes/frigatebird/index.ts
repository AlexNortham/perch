/**
 * Frigatebird's hooks: only what data can't say.
 * - Plunder Shot: the Song shield goes to the caster when the bolt lands (an onHit effect lands on the victim).
 */
import type { HeroModule } from '../../core/contracts';
import { frigatebirdDef, PLUNDER_HIT_HOOK, PLUNDER_SHIELD } from '../../data/heroes/frigatebird';

export const frigatebird: HeroModule = {
  def: frigatebirdDef,
  implemented: true,
  hooks: (ctx) => ({
    onEffect(name, _target, cause) {
      if (name !== PLUNDER_HIT_HOOK || cause.source === null) return;
      const hero = ctx.store.getKind(cause.source, 'hero');
      if (!hero || hero.health.dead) return;
      ctx.effects.apply(PLUNDER_SHIELD, { entity: hero.id, point: { ...hero.pos }, dir: { x: 0, y: 0, z: 1 } }, cause);
    },
  }),
};
