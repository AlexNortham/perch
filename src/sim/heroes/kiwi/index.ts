/**
 * Kiwi's hooks: only what data can't say.
 * - Burrow T3: resurfacing heals 15% of max HP (a Magnitude can't take a fraction of max HP); the tier raises the
 *   `healPct` value from 0.
 * - Night Sense: each area tick reveals an enemy hero below 50% HP for a moment longer.
 */
import type { HeroModule } from '../../core/contracts';
import { REVEAL } from '../../data/combat';
import { BURROW_HEAL_HOOK, kiwiDef, NIGHT_SENSE_HOOK, NIGHT_SENSE_HP, NIGHT_SENSE_REVEAL_S } from '../../data/heroes/kiwi';

export const kiwi: HeroModule = {
  def: kiwiDef,
  implemented: true,
  hooks: (ctx) => ({
    onEffect(name, target, cause) {
      if (target.entity === null) return;
      if (name === BURROW_HEAL_HOOK) {
        const pct = cause.values?.healPct ?? 0;
        const hero = ctx.store.getKind(target.entity, 'hero');
        if (pct > 0 && hero && !hero.health.dead) ctx.effects.apply({ kind: 'heal', amount: hero.stats.final.maxHealth * pct }, target, cause);
      } else if (name === NIGHT_SENSE_HOOK) {
        const foe = ctx.store.getKind(target.entity, 'hero');
        if (foe && !foe.health.dead && foe.health.hp < foe.stats.final.maxHealth * NIGHT_SENSE_HP) {
          ctx.effects.apply({ kind: 'applyStatus', status: REVEAL, durationS: NIGHT_SENSE_REVEAL_S }, target, cause);
        }
      }
    },
  }),
};
