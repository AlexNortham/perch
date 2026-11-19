/**
 * Hummingbird's hooks: only what data can't say yet.
 * - Hover (passive): Space held in the air, once the climb is over, cancels the fall for up to 1.5 s; landing recharges it.
 * - Nectar Sip: the tether is applied here because its break distance (12 m, 16 m from T2) depends on the tier.
 * - Thousand Beats: while it lasts, a Dart's hits damage (and from T3 silence) what the dash touches, and a Dart
 *   that touches a hero refunds a charge. The numbers are the ultimate's own, at the tier bought.
 */
import { Button } from '../../core/contracts';
import type { EffectCause, EntityId, HeroModule } from '../../core/contracts';
import { resolveAbility } from '../../abilities/kit';
import { SILENCE } from '../../data/combat';
import { TICK_SECONDS } from '../../data/core';
import {
  BEATS_ID,
  BEATS_SLOT,
  HOVER_S,
  NECTAR_BREAK_M,
  NECTAR_BREAK_T2_M,
  WHOLE_CHARGE_S,
  hummingbirdDef,
  nectarTether,
} from '../../data/heroes/hummingbird';
import { AIR } from '../../data/movement';

const NECTAR_SLOT = 1;
/** The fall gravity would add this tick, cancelled: with exact integration a start of g·dt/2 ends the step still. */
const HOLD_VY = (AIR.gravity * TICK_SECONDS) / 2;

export const hummingbird: HeroModule = {
  def: hummingbirdDef,
  implemented: true,
  hooks: (ctx) => {
    const hover = new Map<EntityId, number>();
    const refunded = new WeakSet<EffectCause>();
    return {
      onTick(hero) {
        const m = hero.motor;
        if (m.grounded) {
          hover.set(hero.id, HOVER_S);
          return;
        }
        const left = hover.get(hero.id) ?? HOVER_S;
        const free = m.mode === null && !m.knockedUp && !m.dashing && !m.mantling && m.updraft === null && m.climb === null;
        const c = hero.stats.conditions;
        if (left <= 0 || !free || hero.vel.y > 0 || (hero.command.held & Button.Jump) === 0 || c.has('stunned') || c.has('rooted')) return;
        hero.vel.y = HOLD_VY;
        hover.set(hero.id, left - TICK_SECONDS);
      },
      onCast(cast) {
        if (cast.slot !== NECTAR_SLOT || cast.target.entity === null) return;
        ctx.effects.apply(nectarTether(cast.tier >= 2 ? NECTAR_BREAK_T2_M : NECTAR_BREAK_M), cast.target, cast.cause);
      },
      onEffect(name, target, cause) {
        if (name !== 'dartHit' || cause.source === null || target.entity === null) return;
        const hero = ctx.store.getKind(cause.source, 'hero');
        if (!hero || !hero.statuses.some((s) => s.def.id === BEATS_ID)) return;
        const v = resolveAbility(hummingbirdDef.abilities[BEATS_SLOT], hero.abilities.slots[BEATS_SLOT]?.tier ?? 0).values;
        ctx.effects.apply({ kind: 'damage', amount: { of: v.damage ?? 0, song: 0.9 }, type: 'song' }, target, cause);
        if ((v.silence ?? 0) > 0) ctx.effects.apply({ kind: 'applyStatus', status: SILENCE, durationS: v.silence ?? 0 }, target, cause);
        if (ctx.store.getKind(target.entity, 'hero') && !refunded.has(cause)) {
          refunded.add(cause);
          ctx.effects.apply({ kind: 'cooldownMod', scope: 'slot', slot: 0, mode: 'refund', seconds: WHOLE_CHARGE_S }, target, cause);
        }
      },
    };
  },
};
