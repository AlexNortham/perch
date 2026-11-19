/**
 * Albatross's hooks: only what data can't say yet.
 * - galeShield (summon behaviour): the wall follows you, 2 m ahead and turning with your aim. It writes the wall's
 *   `pos` and `yaw`, which SummonEffect.onEnd (the T3 burst) reads when the wall ends.
 * - Wall end: lifts the 15% slow when the wall breaks early.
 * - Salt Hide: heals 10% of max HP over its duration (a Magnitude can't take a fraction of max HP).
 */
import type { EffectCause, EntityId, HeroModule } from '../../core/contracts';
import { albatrossDef, SHIELD_SLOW_ID } from '../../data/heroes/albatross';

const WALL_AHEAD_M = 2;
const SALT_HIDE_HEAL = 0.1;
const SALT_HIDE_S = 6;

interface Wall {
  readonly hero: EntityId;
  readonly cause: EffectCause;
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
      if (hero) ctx.effects.apply({ kind: 'cleanse', remove: [SHIELD_SLOW_ID] }, { entity: hero.id, point: hero.pos, dir: { x: 0, y: 0, z: 1 } }, w.cause);
    });
    return {
      onEffect(name, target, cause) {
        if (name !== 'galeShield' || target.entity === null || cause.source === null) return;
        const wall = ctx.store.getKind(target.entity, 'unit');
        const hero = ctx.store.getKind(cause.source, 'hero');
        if (!wall || !hero) return;
        wall.pos.x = hero.pos.x + Math.sin(hero.yaw) * WALL_AHEAD_M;
        wall.pos.y = hero.pos.y;
        wall.pos.z = hero.pos.z + Math.cos(hero.yaw) * WALL_AHEAD_M;
        wall.yaw = hero.yaw;
        if (!walls.has(wall.id)) walls.set(wall.id, { hero: hero.id, cause });
      },
      onCast(cast) {
        if (cast.slot !== 2) return;
        const max = cast.hero.stats.final.maxHealth;
        ctx.effects.apply({ kind: 'heal', amount: max * SALT_HIDE_HEAL, overS: SALT_HIDE_S }, cast.target, cast.cause);
      },
    };
  },
};
