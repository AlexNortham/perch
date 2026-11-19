/**
 * Lyrebird's hooks: only what data can't say yet.
 * - Grand Chorus: when the channel ends early (a second press, a stun) the "singing" penalty ends with it.
 */
import type { HeroModule } from '../../core/contracts';
import { CHORUS_ID, lyrebirdDef } from '../../data/heroes/lyrebird';

const CHORUS_ABILITY = 'lyrebird.grandChorus';

export const lyrebird: HeroModule = {
  def: lyrebirdDef,
  implemented: true,
  hooks: (ctx) => {
    ctx.bus.on('ability', (e) => {
      if (e.ability !== CHORUS_ABILITY || (e.stage !== 'end' && e.stage !== 'interrupted')) return;
      const hero = ctx.store.getKind(e.caster, 'hero');
      if (!hero) return;
      const cause = {
        source: hero.id,
        team: hero.team,
        via: 'ability' as const,
        ability: CHORUS_ABILITY,
        item: null,
        values: null,
        songPower: 0,
        proc: false,
        origin: hero.pos,
      };
      ctx.effects.apply({ kind: 'cleanse', remove: [CHORUS_ID] }, { entity: hero.id, point: hero.pos, dir: { x: 0, y: 0, z: 1 } }, cause);
    });
    return {};
  },
};
