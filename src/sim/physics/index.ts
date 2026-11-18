// TODO(Character Controller): Rapier world from ctx.map (await RAPIER.init() here; that is why createSim is async),
// hero character controllers (walk, sprint, jump, dash, dash-jump, slide, mantle, stamina, Updrafts, Chimneys, Vines,
// knockback) in the movement phase, colliders on entity.spawned, and the displace, dash, teleport, movementMode and
// attach effects (ctx.effects.handle(kind, 'physics', handler)). Until then: no collisions, every query misses.
import type { CoreContext, Physics } from '../core/contracts';

export async function createPhysics(ctx: CoreContext): Promise<Physics> {
  return {
    service: {
      raycast: () => null,
      shapeCast: () => null,
      overlap: (_shape, _centre, _mask, out) => {
        out.length = 0;
        return out;
      },
      moveCharacter: (id, delta) => {
        const p = ctx.store.get(id)?.pos ?? { x: 0, y: 0, z: 0 };
        return { pos: { x: p.x + delta.x, y: p.y + delta.y, z: p.z + delta.z }, grounded: true, wall: null };
      },
      groundHeight: () => null,
    },
    system: { name: 'physics', phases: {} },
  };
}
