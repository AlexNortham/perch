/**
 * Owl's hooks: only what data can't say yet.
 * - Silent Wing: a glide ends on landing or Space (the glide mode itself only expires). The hook ends it by starting a
 *   one-tick replacement mode, which physics ends on its next step and whose `onEnd` cleans up the buffs.
 *   TODO(physics): glide ends on landing and Space natively, then this hook goes.
 */
import type { EntityId, HeroEntity, HeroModule } from '../../core/contracts';
import { Button } from '../../core/contracts';
import { GLIDE_ID, GLIDE_STOP, owlDef } from '../../data/heroes/owl';

/** Ticks after the leap before "grounded" counts as a landing (the leap's first ticks still read grounded). */
const LEAP_GRACE_TICKS = 4;

export const owl: HeroModule = {
  def: owlDef,
  implemented: true,
  hooks: (ctx) => {
    /** hero → tick its glide was first seen. */
    const since = new Map<EntityId, number>();
    const stop = (hero: HeroEntity): void => {
      since.delete(hero.id);
      ctx.effects.apply(GLIDE_STOP, { entity: hero.id, point: hero.pos, dir: { x: 0, y: 0, z: 1 } }, {
        source: hero.id,
        team: hero.team,
        via: 'ability',
        ability: GLIDE_ID,
        item: null,
        values: {},
        songPower: 0,
        proc: false,
        origin: hero.pos,
      });
    };
    return {
      onTick(hero) {
        if (hero.motor.mode !== 'glide') {
          since.delete(hero.id);
          return;
        }
        const start = since.get(hero.id) ?? ctx.clock.tick;
        since.set(hero.id, start);
        const age = ctx.clock.tick - start;
        const space = age > 1 && (hero.command.pressed & Button.Jump) !== 0;
        if (space || (age >= LEAP_GRACE_TICKS && hero.motor.grounded)) stop(hero);
      },
    };
  },
};
