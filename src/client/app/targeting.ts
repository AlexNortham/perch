import { canSee } from '../../sim/core/vision';
import type { EntityView, Ping, PlayerTeam, SimView, Vec3 } from '../../sim/core/contracts';
import { HEROES } from '../../sim/heroes/registry';
import type { CameraPose } from './contracts';

const DEGREES_PER_HALF_TURN = 180;

/** Perspective projection in CSS pixels, using the renderer's horizontal field of view and Y-up frame. */
export function projectPoint(p: Vec3, camera: CameraPose, width: number, height: number): { x: number; y: number } | null {
  const dx = camera.target.x - camera.position.x;
  const dy = camera.target.y - camera.position.y;
  const dz = camera.target.z - camera.position.z;
  const length = Math.hypot(dx, dy, dz);
  if (!length || !width || !height) return null;
  const horizontal = Math.hypot(dx, dz);
  const rx = horizontal ? -dz / horizontal : -1;
  const rz = horizontal ? dx / horizontal : 0;
  const fx = dx / length, fy = dy / length, fz = dz / length;
  const x = p.x - camera.position.x, y = p.y - camera.position.y, z = p.z - camera.position.z;
  const depth = x * fx + y * fy + z * fz;
  if (depth <= 0) return null;
  const scale = width / (2 * Math.tan(camera.fovDeg * Math.PI / (2 * DEGREES_PER_HALF_TURN)) * depth);
  const up = x * -rz * fy + y * (rz * fx - rx * fz) + z * rx * fy;
  return { x: width / 2 + (x * rx + z * rz) * scale, y: height / 2 - up * scale };
}

/** Contextual crosshair ping. The static surface limits the ray; hidden entities cannot be selected. */
export function targetPing(view: SimView, team: PlayerTeam, origin: Vec3, dir: Vec3, start: number, range: number, surface: Vec3 | null): Ping | null {
  let closest = surface ? Math.hypot(surface.x - origin.x, surface.y - origin.y, surface.z - origin.z) : range;
  let hit: EntityView | null = null;
  for (const e of view.entities) {
    if (e.id === view.localHero || !canSee(team, e) || (e.kind !== 'pickup' && !(e.hp > 0))) continue;
    if (e.team === team && e.kind !== 'structure' && e.kind !== 'pickup') continue;
    const hero = e.kind === 'hero' ? view.heroes.find((h) => h.id === e.id) : undefined;
    const height = e.structure?.body.height ?? (hero ? HEROES[hero.heroId].def.body.height : 2 * e.radius);
    // Intersect the entity's finite vertical cylinder, including top/bottom and nearly vertical aim.
    const x = origin.x - e.pos.x, z = origin.z - e.pos.z;
    const a = dir.x * dir.x + dir.z * dir.z;
    const b = x * dir.x + z * dir.z;
    const c = x * x + z * z - e.radius * e.radius;
    const disc = b * b - a * c;
    if (disc < 0 || (!a && c > 0)) continue;
    let near = start, far = closest;
    if (a) {
      const root = Math.sqrt(disc);
      near = Math.max(near, (-b - root) / a);
      far = Math.min(far, (-b + root) / a);
    }
    const bottom = e.pos.y - (e.kind === 'pickup' ? e.radius : 0);
    if (dir.y) {
      const low = (bottom - origin.y) / dir.y, high = (bottom + height - origin.y) / dir.y;
      near = Math.max(near, Math.min(low, high));
      far = Math.min(far, Math.max(low, high));
    } else if (origin.y < bottom || origin.y > bottom + height) continue;
    if (near > far) continue;
    closest = near;
    hit = e;
  }
  if (!hit) return surface && { kind: 'goHere', target: null, pos: surface };
  const kind = hit.kind === 'pickup' || hit.team === 'neutral' ? 'take' : hit.team === team ? 'defend' : 'attack';
  return { kind, target: hit.id, pos: { ...hit.pos } };
}
