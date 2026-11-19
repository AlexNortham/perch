import { SeenBy } from './contracts';
import type { PlayerTeam } from './contracts';

/**
 * The shared visibility service's read side: can `team` see this entity (or its EntityView) this tick? sim/world
 * writes `seenBy` every tick in the world phase from the GDD §11.1 vision rule and the reveal, invisibility and true
 * sight statuses; bots, structure and fledgling targeting, the minimap and outlines all read it through this.
 */
export function canSee(team: PlayerTeam, entity: { readonly seenBy: number }): boolean {
  return (entity.seenBy & SeenBy[team]) !== 0;
}

/** World and map-only reveals both put an icon on the minimap. */
export function canSeeOnMap(team: PlayerTeam, entity: { readonly seenBy: number; readonly mapSeenBy?: number }): boolean {
  return ((entity.mapSeenBy ?? entity.seenBy) & SeenBy[team]) !== 0;
}
