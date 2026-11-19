/**
 * Pelican's hooks: only what data can't say yet.
 * - Gulp: picks the nearest enemy hero or fledgling in its 4 m, 40° cone (data can't choose one target).
 *   A hero is attached to the Pelican (physics), stunned and intangible as CARRIED, and spat on release.
 *   A fledgling is moved to the Pelican's feet and killed through the damage pipeline, so the Pelican gets the
 *   last hit and the pod rises at its feet (economy spawns it where the fledgling dies); the Pelican heals.
 *   The one position write is that move, on a unit that dies in the same call.
 */
import type { AbilityCast, EffectTarget, Entity, EntityId, HeroEntity, HeroModule, UnitEntity } from '../../core/contracts';
import {
  GULP_BRACE,
  GULP_CARRIED,
  GULP_CONE_DEG,
  GULP_DIGEST,
  GULP_FEAST,
  GULP_LAND_STUN,
  GULP_REACH_M,
  GULP_SPIT,
  pelicanDef,
} from '../../data/heroes/pelican';

const GULP_SLOT = 0;
const HALF_CONE_COS = Math.cos((GULP_CONE_DEG / 2) * (Math.PI / 180));

const onEntity = (e: Entity): EffectTarget => ({ entity: e.id, point: e.pos, dir: { x: 0, y: 0, z: 1 } });

export const pelican: HeroModule = {
  def: pelicanDef,
  implemented: true,
  hooks: (ctx) => {
    /** The nearest enemy hero or fledgling the cone reaches, or undefined. */
    const grab = (hero: HeroEntity, aim: { x: number; z: number }): HeroEntity | UnitEntity | undefined => {
      const len = Math.hypot(aim.x, aim.z) || 1;
      let best: HeroEntity | UnitEntity | undefined;
      let bestD = Infinity;
      const consider = (e: HeroEntity | UnitEntity): void => {
        if (e.team === hero.team || e.health.dead || e.removed || e.stats.conditions.has('intangible')) return;
        const dx = e.pos.x - hero.pos.x;
        const dz = e.pos.z - hero.pos.z;
        const d = Math.hypot(dx, dz);
        const reach = d - e.radius;
        if (reach > GULP_REACH_M || Math.abs(e.pos.y - hero.pos.y) > GULP_REACH_M) return;
        const inCone = d <= e.radius + hero.radius || (dx * aim.x + dz * aim.z) / (d * len) >= HALF_CONE_COS;
        if (inCone && d < bestD) {
          best = e;
          bestD = d;
        }
      };
      for (const h of ctx.store.list('hero')) if (h.id !== hero.id) consider(h);
      for (const u of ctx.store.list('unit')) if (u.unit.type === 'scrapper' || u.unit.type === 'slinger') consider(u);
      return best;
    };

    /** Swallowed fledgling → the cast; the heal lands when its death is announced. */
    const feasts = new Map<EntityId, AbilityCast>();
    ctx.bus.on('entity.died', (e) => {
      const cast = feasts.get(e.victim);
      if (!cast) return;
      feasts.delete(e.victim);
      if (!cast.hero.health.dead) ctx.effects.apply(GULP_FEAST, onEntity(cast.hero), cast.cause);
    });

    const gulp = (cast: AbilityCast): void => {
      const { hero, cause } = cast;
      const victim = grab(hero, cast.target.dir);
      if (!victim) return;
      if (victim.kind === 'unit') {
        victim.pos.x = hero.pos.x;
        victim.pos.y = hero.pos.y;
        victim.pos.z = hero.pos.z;
        feasts.set(victim.id, cast);
        ctx.effects.apply(GULP_DIGEST, onEntity(victim), cause);
        return;
      }
      const landStun = cause.values?.landStun ?? 0;
      const spit = landStun > 0 ? [...GULP_SPIT, GULP_LAND_STUN] : GULP_SPIT;
      ctx.effects.apply({ kind: 'attach', durationS: 'carry', onRelease: spit }, onEntity(victim), cause);
      if (victim.motor.attachedTo !== hero.id) return; // unstoppable: it slipped the pouch
      ctx.effects.apply(GULP_CARRIED, onEntity(victim), cause);
      ctx.effects.apply(GULP_BRACE, onEntity(hero), cause);
    };

    return {
      onCast(cast) {
        if (cast.slot === GULP_SLOT) gulp(cast);
      },
    };
  },
};
