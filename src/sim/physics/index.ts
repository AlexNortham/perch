/**
 * sim/physics: the Rapier world, the PhysicsService, the hero character controller (movement phase) and the
 * physics-owned effects (displace, dash, teleport, movementMode, attach).
 * rapier.ts: colliders and queries · controller.ts: hero movement · effects.ts: effect handlers.
 */
import type { CoreContext, Physics } from '../core/contracts';
import { createController } from './controller';
import { registerEffects } from './effects';
import { createSpace } from './rapier';

export async function createPhysics(ctx: CoreContext): Promise<Physics> {
  const space = await createSpace(ctx);
  const ctrl = createController(ctx, space, space.service);
  registerEffects(ctx, ctrl, space.service);

  ctx.bus.on('entity.spawned', (e) => {
    if (e.kind === 'hero') {
      const h = ctx.store.getKind(e.id, 'hero');
      if (!h) return;
      const body = ctx.heroes[h.hero.heroId].def.body;
      // Movement capsule: feet to head centre minus head radius (GDD §9.0.1).
      space.addHero(h.id, body.radius, body.head.centre.up - body.head.radius);
      ctrl.add(h);
    } else if (e.kind === 'structure') {
      const s = ctx.store.getKind(e.id, 'structure');
      if (s) space.addStructure(s.id, s.pos, s.structure.body.radius, s.structure.body.height);
    }
  });
  ctx.bus.on('entity.despawned', (e) => {
    space.remove(e.id);
    ctrl.remove(e.id);
  });
  ctx.bus.on('hero.respawned', (e) => {
    const h = ctx.store.getKind(e.hero, 'hero');
    if (h) ctrl.reseat(h, e.pos);
  });

  return {
    service: space.service,
    system: { name: 'physics', phases: { movement: ctrl.step }, hash: ctrl.hash },
  };
}
