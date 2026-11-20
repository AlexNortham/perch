/**
 * Swan's hooks: only what data can't say.
 * - Swan Song: when an ally's undying ends it heals 25% of its max HP (a Magnitude can't take a fraction of max HP).
 */
import type { HeroModule } from '../../core/contracts';
import { SONG_HEAL_FRACTION, SONG_HEAL_HOOK, swanDef } from '../../data/heroes/swan';

export const swan: HeroModule = {
  def: swanDef,
  implemented: true,
  hooks: (ctx) => ({
    onEffect(name, target, cause) {
      if (name !== SONG_HEAL_HOOK || target.entity === null) return;
      const ally = ctx.store.getKind(target.entity, 'hero');
      if (!ally || ally.health.dead) return;
      ctx.effects.apply({ kind: 'heal', amount: ally.stats.final.maxHealth * SONG_HEAL_FRACTION }, target, cause);
    },
  }),
};
