// Item-active targeting, the same model as ability casts (sim/abilities): self, direction, point and unit (the
// candidate nearest the crosshair within the 6° cone, range and line of sight; Rescue Call falls back to the holder).
import { LAYERS_SOLID, type EffectTarget, type Entity, type HeroEntity, type ItemActive, type SimContext, type TargetFilter, type Vec3 } from '../core/contracts';
import { heroAimRay, muzzlePoint } from '../core/aim';
import { addScaled, copy, dot, normalize, sub } from '../core/math';
import { canSee } from '../core/vision';
import * as dmath from '../core/dmath';
import { GROUND_PROBE_UP, RAD_PER_DEG, UNIT_TARGET_CONE_DEG } from '../data/abilities';
import { CAMERA } from '../data/core';
import { centreHeight, clearLine, matches, near } from '../abilities/zones';

const COS_CONE = dmath.cos(UNIT_TARGET_CONE_DEG * RAD_PER_DEG);

export function createTargeting(ctx: SimContext) {
  const scratch: number[] = [];

  const aimPoint = (origin: Vec3, dir: Vec3, start: number): Vec3 => {
    const from = addScaled(origin, dir, start);
    const len = CAMERA.aimRange - start;
    return ctx.physics.raycast(from, dir, len, LAYERS_SOLID)?.point ?? addScaled(from, dir, len);
  };
  const centre = (e: Entity): Vec3 => ({ x: e.pos.x, y: e.pos.y + centreHeight(ctx, e), z: e.pos.z });

  function pickUnit(h: HeroEntity, a: ItemActive, ray: ReturnType<typeof heroAimRay>, muzzle: Vec3, filter?: TargetFilter): Entity | null {
    const f = filter ?? a.affects ?? { teams: 'enemies' as const };
    const range = a.range * (1 + h.stats.final.abilityRange);
    let best: Entity | null = null;
    let bestCos = COS_CONE;
    for (const id of near(ctx, f, h.pos, range, scratch)) {
      const e = ctx.store.get(id);
      if (!e || id === h.id || !matches(f, h.team, h.id, e) || e.stats?.conditions.has('intangible')) continue;
      if (e.team !== h.team && !canSee(h.team, e)) continue;
      const c = centre(e);
      const v = sub(c, ray.origin);
      const len = dmath.hypot(v.x, v.y, v.z);
      const cos = len > 0 ? dot(v, ray.dir) / len : -1;
      if (cos <= bestCos || !clearLine(ctx, muzzle, c)) continue;
      best = e;
      bestCos = cos;
    }
    return best ?? (!filter && a.selfFallback ? h : null);
  }

  /** The target an active's effects land on, or null when there is nobody to choose (nothing is spent). */
  return function pick(h: HeroEntity, a: ItemActive): EffectTarget | null {
    const ray = heroAimRay(h, ctx.heroes[h.hero.heroId].def.body);
    const muzzle = muzzlePoint(h.pos, h.yaw, ctx.heroes[h.hero.heroId].def.body, h.motor.crouching);
    switch (a.targeting) {
      case 'self':
        return { entity: h.id, point: copy(h.pos), dir: ray.dir };
      case 'direction': {
        const p = aimPoint(ray.origin, ray.dir, ray.start);
        return { entity: h.id, point: p, dir: normalize(sub(p, muzzle)) };
      }
      case 'point': {
        // A lob lands on the enemy hero under the crosshair, not on the ground beyond it.
        const under = pickUnit(h, a, ray, muzzle, { teams: 'enemies', heroesOnly: true });
        const p = under ? copy(under.pos) : aimPoint(ray.origin, ray.dir, ray.start);
        const dx = p.x - h.pos.x;
        const dz = p.z - h.pos.z;
        const d = dmath.hypot(dx, dz);
        const max = a.range * (1 + h.stats.final.abilityRange);
        const k = d > max ? max / d : 1;
        const x = h.pos.x + dx * k;
        const z = h.pos.z + dz * k;
        const probe = (k < 1 ? h.pos.y : p.y) + GROUND_PROBE_UP;
        const y = ctx.physics.groundHeight(x, z, probe) ?? (k < 1 ? h.pos.y : p.y);
        return { entity: h.id, point: { x, y, z }, dir: normalize({ x: ray.dir.x, y: 0, z: ray.dir.z }) };
      }
      case 'unit': {
        const e = pickUnit(h, a, ray, muzzle);
        if (!e) return null;
        return { entity: e.id, point: copy(e.pos), dir: e === h ? ray.dir : normalize(sub(centre(e), muzzle)) };
      }
    }
  };
}
