/**
 * Cassowary's hooks: only what data can't say.
 * - Rampage: the charge hits heroes only. A hero hit takes the damage and knock-up; unless T3 (`pass`), the charge
 *   then ends by replacing it with a zero-length dash, since a dash's `stopOnHit` can't depend on the tier.
 * - Bristle: while it lasts, an enemy hero within 15 m who damages you takes 20% of that damage back as Song damage.
 *   TODO(framework): `DamageEffect.triggerPct` with `TriggerDef.withinM` (W5 Combat and Items) express this as data.
 */
import type { EffectCause, EntityId, HeroModule, Tick } from '../../core/contracts';
import { lookDir } from '../../core/aim';
import * as dmath from '../../core/dmath';
import { TICK_RATE } from '../../data/core';
import { BRISTLE, cassowaryDef, RAMPAGE_HIT, RAMPAGE_HIT_HOOK } from '../../data/heroes/cassowary';

const BRISTLE_ABILITY = 'cassowary.bristle';

export const cassowary: HeroModule = {
  def: cassowaryDef,
  implemented: true,
  hooks: (ctx) => {
    /** Bristling heroes → the tick it ends. */
    const bristling = new Map<EntityId, Tick>();

    ctx.bus.on('damage.applied', (e) => {
      const until = bristling.get(e.target);
      if (until === undefined || e.proc || e.source === null || e.amount <= 0) return;
      const me = ctx.store.getKind(e.target, 'hero');
      const foe = ctx.store.getKind(e.source, 'hero');
      if (!me || !foe || me.health.dead || foe.team === me.team || foe.health.dead || ctx.clock.tick >= until) return;
      if (dmath.hypot(foe.pos.x - me.pos.x, foe.pos.z - me.pos.z) > BRISTLE.radiusM) return;
      const cause: EffectCause = {
        source: me.id,
        team: me.team,
        via: 'ability',
        ability: BRISTLE_ABILITY,
        item: null,
        values: null,
        songPower: ctx.stats.get(me.id, 'songPower'),
        proc: true,
        origin: me.pos,
      };
      ctx.effects.apply({ kind: 'damage', amount: e.amount * BRISTLE.reflect, type: 'song' }, { entity: foe.id, point: foe.pos, dir: { x: 0, y: 0, z: 1 } }, cause);
    });

    return {
      onCast(cast) {
        if (cast.ability.id !== BRISTLE_ABILITY) return;
        bristling.set(cast.hero.id, ctx.clock.tick + Math.round((cast.cause.values?.duration ?? BRISTLE.durationS) * TICK_RATE));
      },
      onEffect(name, target, cause) {
        if (name !== RAMPAGE_HIT_HOOK || target.entity === null || cause.source === null) return;
        if (!ctx.store.getKind(target.entity, 'hero')) return;
        ctx.effects.applyAll(RAMPAGE_HIT, target, cause);
        if ((cause.values?.pass ?? 0) >= 1) return;
        const me = ctx.store.getKind(cause.source, 'hero');
        if (!me) return;
        ctx.effects.apply({ kind: 'dash', distance: 0, durationS: 0, dir: 'aim', arcHeight: 0 }, { entity: me.id, point: me.pos, dir: lookDir(me.yaw, 0) }, cause);
      },
    };
  },
};
