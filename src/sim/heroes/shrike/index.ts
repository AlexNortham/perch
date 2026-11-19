/**
 * Shrike's hooks: only what data can't say yet.
 * - boltPin: Impaling Bolt's wall pin until physics applies `DisplaceEffect.onWall` (Systems follow-up, #21).
 */
import type { HeroModule } from '../../core/contracts';
import { LAYERS_SOLID } from '../../core/contracts';
import { BOLT_PIN, shrikeDef } from '../../data/heroes/shrike';

/** TODO(framework): set true once the Systems follow-up's wall slam is merged, then delete the hook and this. */
const WALL_SLAM_IN_FRAMEWORK = false;
const KNOCKBACK_M = 6;
const CHEST_M = 1;

export const shrike: HeroModule = {
  def: shrikeDef,
  implemented: true,
  hooks: (ctx) => ({
    onEffect(name, target, cause) {
      if (name !== 'boltPin' || WALL_SLAM_IN_FRAMEWORK || target.entity === null) return;
      const e = ctx.store.get(target.entity);
      if (!e) return;
      // A wall within the knockback's reach pins the hero where it stands.
      const from = { x: e.pos.x, y: e.pos.y + CHEST_M, z: e.pos.z };
      const dir = { x: target.dir.x, y: 0, z: target.dir.z };
      if (ctx.physics.raycast(from, dir, KNOCKBACK_M + e.radius, LAYERS_SOLID)) ctx.effects.applyAll(BOLT_PIN, target, cause);
    },
  }),
};
