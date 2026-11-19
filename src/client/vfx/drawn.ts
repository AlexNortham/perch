import type { EntityView } from '../../sim/core/contracts';

/** Summons the VFX layer draws as placeholder shapes (decoys keep their model: they must look like a hero). */
const SUMMON_SHAPES: readonly string[] = ['trap', 'turret', 'wall'];

/**
 * Entities the VFX layer draws from the view (projectiles, areas, seed pods, summon placeholders). The entity layer
 * (render/entities.ts) skips them, so the model kit never makes a placeholder box for them.
 */
export function drawnByVfx(e: EntityView): boolean {
  switch (e.kind) {
    case 'projectile':
    case 'area':
      return true;
    case 'pickup':
      return e.type === 'pod';
    case 'unit':
      return SUMMON_SHAPES.includes(e.type);
    default:
      return false;
  }
}
