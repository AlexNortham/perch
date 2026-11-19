/**
 * Flamingo's hooks: only what data can't say yet.
 * - Tide Turn: heals 30% of the target's max HP over the first 3 s (a Magnitude can't take a fraction of max HP);
 *   with T2 the same for every allied hero within 6 m of the target.
 */
import type { HeroModule } from '../../core/contracts';
import { flamingoDef, TIDE_ALLY_RADIUS, TIDE_HEAL_HOOK_FRACTION, TIDE_HEAL_OVER_S } from '../../data/heroes/flamingo';
const ULT_SLOT = 3;

export const flamingo: HeroModule = {
  def: flamingoDef,
  implemented: true,
  hooks: (ctx) => ({
    onCast(cast) {
      if (cast.slot !== ULT_SLOT || cast.target.entity === null) return;
      const main = ctx.store.getKind(cast.target.entity, 'hero');
      if (!main) return;
      const healed = [main];
      if (cast.tier >= 2) {
        for (const h of ctx.store.list('hero')) {
          if (h.id === main.id || h.team !== cast.hero.team || h.health.dead) continue;
          const dx = h.pos.x - main.pos.x;
          const dz = h.pos.z - main.pos.z;
          if (dx * dx + dz * dz <= TIDE_ALLY_RADIUS * TIDE_ALLY_RADIUS) healed.push(h);
        }
      }
      for (const h of healed) {
        const amount = h.stats.final.maxHealth * TIDE_HEAL_HOOK_FRACTION;
        ctx.effects.apply({ kind: 'heal', amount, overS: TIDE_HEAL_OVER_S }, { entity: h.id, point: h.pos, dir: cast.target.dir }, cast.cause);
      }
    },
  }),
};
