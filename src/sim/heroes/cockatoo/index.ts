/**
 * Cockatoo's hooks: only what data can't say.
 * - Sulphur Shriek: counts the pulses each enemy takes in a channel and stuns it on the third; when the channel ends
 *   early (a second press, a stun) the channel's penalty ends with it.
 */
import type { EntityId, HeroModule } from '../../core/contracts';
import { STUN } from '../../data/combat';
import { cockatooDef, SHRIEK_ABILITY, SHRIEK_ID, SHRIEK_PULSE_HOOK, SHRIEK_STUN } from '../../data/heroes/cockatoo';

export const cockatoo: HeroModule = {
  def: cockatooDef,
  implemented: true,
  hooks: (ctx) => {
    /** Pulses taken in the current channel: caster → victim → count. */
    const pulses = new Map<EntityId, Map<EntityId, number>>();
    ctx.bus.on('ability', (e) => {
      if (e.ability !== SHRIEK_ABILITY || (e.stage !== 'end' && e.stage !== 'interrupted')) return;
      const hero = ctx.store.getKind(e.caster, 'hero');
      if (!hero) return;
      const cause = {
        source: hero.id,
        team: hero.team,
        via: 'ability' as const,
        ability: SHRIEK_ABILITY,
        item: null,
        values: null,
        songPower: 0,
        proc: false,
        origin: hero.pos,
      };
      ctx.effects.apply({ kind: 'cleanse', remove: [SHRIEK_ID] }, { entity: hero.id, point: hero.pos, dir: { x: 0, y: 0, z: 1 } }, cause);
    });
    return {
      onCast(cast) {
        if (cast.ability.id === SHRIEK_ABILITY) pulses.set(cast.hero.id, new Map());
      },
      onEffect(name, target, cause) {
        if (name !== SHRIEK_PULSE_HOOK || target.entity === null || cause.source === null) return;
        const counts = pulses.get(cause.source);
        if (!counts) return;
        const n = (counts.get(target.entity) ?? 0) + 1;
        counts.set(target.entity, n);
        if (n === SHRIEK_STUN.pulses) ctx.effects.apply({ kind: 'applyStatus', status: STUN, durationS: SHRIEK_STUN.seconds }, target, cause);
      },
    };
  },
};
