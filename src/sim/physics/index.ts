/**
 * sim/physics: the Rapier world, the PhysicsService, the hero character controller (movement phase), units moved by
 * physics effects, and the physics-owned effects (displace, dash, teleport, movementMode, attach).
 * rapier.ts: colliders and queries · updrafts.ts: cables and latch reach · controller.ts: hero movement ·
 * units.ts: displaced units · effects.ts: handlers.
 */
import type { CoreContext, Physics, PhysicsService } from '../core/contracts';
import { createController } from './controller';
import { registerEffects } from './effects';
import { createSpace } from './rapier';
import { createUnitMover } from './units';
import { createUpdrafts } from './updrafts';

export async function createPhysics(ctx: CoreContext): Promise<Physics> {
  const space = await createSpace(ctx);
  const updrafts = createUpdrafts(ctx.map);
  const service: PhysicsService = { ...space.service, updraftInReach: updrafts.service };
  const ctrl = createController(ctx, space, service, updrafts);
  const units = createUnitMover(ctx, service);
  registerEffects(ctx, ctrl, service, units);

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
      // Twig and Keepsake Nests have no collider: heroes pass through them (GDD §7.9).
      if (s && s.structure.solid !== false) space.addStructure(s.id, s.pos, s.structure.body.radius, s.structure.body.height);
    }
  });
  ctx.bus.on('entity.despawned', (e) => {
    space.remove(e.id);
    ctrl.remove(e.id);
    units.remove(e.id);
  });
  ctx.bus.on('hero.respawned', (e) => {
    const h = ctx.store.getKind(e.hero, 'hero');
    if (h) ctrl.reseat(h, e.pos);
  });

  return {
    service,
    system: {
      name: 'physics',
      phases: {
        movement() {
          ctrl.step();
          units.step();
        },
      },
      hash(h) {
        ctrl.hash(h);
        units.hash(h);
      },
    },
  };
}
