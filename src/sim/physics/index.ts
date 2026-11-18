/**
 * sim/physics: the Rapier world, the PhysicsService, the hero character controller (movement phase) and the
 * physics-owned effects (displace, dash, teleport, movementMode, attach). See rapier.ts for the collider layout.
 */
import type { CoreContext, Physics } from '../core/contracts';
import { createSpace } from './rapier';

export async function createPhysics(ctx: CoreContext): Promise<Physics> {
  const space = await createSpace(ctx);

  ctx.bus.on('entity.spawned', (e) => {
    if (e.kind === 'hero') {
      const h = ctx.store.getKind(e.id, 'hero');
      if (!h) return;
      const body = ctx.heroes[h.hero.heroId].def.body;
      space.addHero(h.id, body.radius, body.head.centre.up - body.head.radius);
    } else if (e.kind === 'structure') {
      const s = ctx.store.getKind(e.id, 'structure');
      if (s) space.addStructure(s.id, s.pos, s.structure.body.radius, s.structure.body.height);
    }
  });
  ctx.bus.on('entity.despawned', (e) => space.remove(e.id));

  return {
    service: space.service,
    system: { name: 'physics', phases: {} },
  };
}
