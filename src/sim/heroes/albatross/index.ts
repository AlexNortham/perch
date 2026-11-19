/**
 * Albatross's hooks: only what data can't say yet.
 * - galeShield (summon behaviour): the wall follows you, 2 m ahead and turning with your aim.
 * - Wall end: lifts the 15% slow when the wall breaks early; until the framework runs SummonEffect.onEnd it also
 *   applies the tier 3 burst.
 * - Salt Hide: heals 10% of max HP over its duration (a Magnitude can't take a fraction of max HP).
 */
import type { EffectCause, EntityId, HeroModule, Vec3 } from '../../core/contracts';
import { albatrossDef, GALE_BURST, SHIELD_SLOW_ID, TEMPEST_LEAP } from '../../data/heroes/albatross';

/** TODO(framework): set true once the Systems follow-up's SummonEffect.onEnd is merged, then drop the burst below. */
const SUMMON_END_IN_FRAMEWORK = false;
const WALL_AHEAD_M = 2;
const SALT_HIDE_HEAL = 0.1;
const SALT_HIDE_S = 6;

interface Wall {
  readonly hero: EntityId;
  readonly cause: EffectCause;
  readonly pos: Vec3;
  yaw: number;
}

export const albatross: HeroModule = {
  def: albatrossDef,
  implemented: true,
  hooks: (ctx) => {
    const walls = new Map<EntityId, Wall>();
    ctx.bus.on('entity.despawned', (e) => {
      const w = walls.get(e.id);
      if (!w) return;
      walls.delete(e.id);
      const hero = ctx.store.getKind(w.hero, 'hero');
      if (!hero) return;
      ctx.effects.apply({ kind: 'cleanse', remove: [SHIELD_SLOW_ID] }, { entity: hero.id, point: hero.pos, dir: w.pos }, w.cause);
      if (SUMMON_END_IN_FRAMEWORK || !(w.cause.values?.burst ?? 0)) return;
      const dir = { x: Math.sin(w.yaw), y: 0, z: Math.cos(w.yaw) };
      ctx.effects.applyAll(GALE_BURST, { entity: null, point: w.pos, dir }, { ...w.cause, origin: w.pos });
    });
    return {
      onEffect(name, target, cause) {
        if (name === 'tempestLeap') {
          // TODO(framework): a dash 'target' on a point cast leaves the caster standing (its own pos is the goal);
          // drop this hook when physics treats target.entity === cause.source as "no entity" and put the dash in data.
          ctx.effects.apply(TEMPEST_LEAP, { entity: null, point: target.point, dir: target.dir }, cause);
          return;
        }
        if (name !== 'galeShield' || target.entity === null || cause.source === null) return;
        const wall = ctx.store.getKind(target.entity, 'unit');
        const hero = ctx.store.getKind(cause.source, 'hero');
        if (!wall || !hero) return;
        wall.pos.x = hero.pos.x + Math.sin(hero.yaw) * WALL_AHEAD_M;
        wall.pos.y = hero.pos.y;
        wall.pos.z = hero.pos.z + Math.cos(hero.yaw) * WALL_AHEAD_M;
        wall.yaw = hero.yaw;
        const w = walls.get(wall.id);
        if (w) {
          w.pos.x = wall.pos.x;
          w.pos.y = wall.pos.y;
          w.pos.z = wall.pos.z;
          w.yaw = hero.yaw;
        } else walls.set(wall.id, { hero: hero.id, cause, pos: { ...wall.pos }, yaw: hero.yaw });
      },
      onCast(cast) {
        if (cast.slot !== 2) return;
        const max = cast.hero.stats.final.maxHealth;
        ctx.effects.apply({ kind: 'heal', amount: max * SALT_HIDE_HEAL, overS: SALT_HIDE_S }, cast.target, cast.cause);
      },
    };
  },
};
