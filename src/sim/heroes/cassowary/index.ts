/**
 * Cassowary's hooks: only what data can't say.
 * - Rampage: the charge hits heroes only. A hero hit takes the damage and knock-up; unless T3 (`pass`), the charge
 *   then ends by replacing it with a zero-length dash, since a dash's `stopOnHit` can't depend on the tier.
 * Bristle's thorns are a 'damaged' trigger in its data (D-SYS-014).
 */
import type { HeroModule } from '../../core/contracts';
import { lookDir } from '../../core/aim';
import { cassowaryDef, RAMPAGE_HIT, RAMPAGE_HIT_HOOK } from '../../data/heroes/cassowary';

export const cassowary: HeroModule = {
  def: cassowaryDef,
  implemented: true,
  hooks: (ctx) => ({
    onEffect(name, target, cause) {
      if (name !== RAMPAGE_HIT_HOOK || target.entity === null || cause.source === null) return;
      if (!ctx.store.getKind(target.entity, 'hero')) return;
      ctx.effects.applyAll(RAMPAGE_HIT, target, cause);
      if ((cause.values?.pass ?? 0) >= 1) return;
      const me = ctx.store.getKind(cause.source, 'hero');
      if (!me) return;
      ctx.effects.apply({ kind: 'dash', distance: 0, durationS: 0, dir: 'aim', arcHeight: 0 }, { entity: me.id, point: me.pos, dir: lookDir(me.yaw, 0) }, cause);
    },
  }),
};
