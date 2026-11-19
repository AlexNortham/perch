/**
 * Hitboxes (GDD §5.4, §7, §9.0.1): head sphere and body capsule per hero from its BodyPlan (Lyrebird's decoys use
 * their owner's), a capsule per unit, a cylinder per structure plus the Patron's weak point, a sphere per pickup.
 * Broad phase: ctx.spatial (padded, it holds feet positions) and the short structure list; physics is not involved.
 */
import { COMBAT } from '../data/combat';
import { CROUCH_SCALE } from '../data/core';
import type { BodyPlan, Entity, EntityId, SimContext, Team, Vec3 } from '../core/contracts';
import { nearer, rayBox, rayCapsule, rayCylinder, raySphere } from './geometry';

export interface Hit {
  id: EntityId;
  /** Distance along the ray. */
  t: number;
  /** The ray touched the head sphere (a bullet that hits head and body is a beak shot, GDD §5.4). */
  head: boolean;
  /** The ray touched the Patron's weak point. */
  weak: boolean;
}

/** What a cast may hit. */
export interface CastFilter {
  /** Skip heroes, units and structures of this team (no friendly fire); null hits every team. */
  team: Team | null;
  /** Invert `team`: hit only that team (ally-targeting projectiles). */
  allies: boolean;
  /** Skip this entity (the shooter); −1 for none. */
  ignore: EntityId;
  heroes: boolean;
  units: boolean;
  structures: boolean;
  /** Seed pods of either team. */
  pods: boolean;
  /** The Phoenix Ember. */
  ember: boolean;
}

export interface Hitboxes {
  /** Hitboxes touched by the segment o + t·d (0 ≤ t ≤ maxT) swept with `radius`, nearest first. Reused between casts. */
  cast(o: Vec3, d: Vec3, maxT: number, radius: number, f: CastFilter): readonly Hit[];
  /** Head centre of a hero or decoy into `out`; returns the head radius, or −1 for entities without a head. */
  head(e: Entity, out: Vec3): number;
}

export function createHitboxes(ctx: SimContext): Hitboxes {
  const ids: EntityId[] = [];
  const pool: Hit[] = [];
  const hits: Hit[] = [];
  const mid = { x: 0, y: 0, z: 0 };

  /** The body plan an entity's hitbox uses, if it has a head. */
  const bodyOf = (e: Entity): BodyPlan | null => {
    if (e.kind === 'hero') return ctx.heroes[e.hero.heroId].def.body;
    if (e.kind === 'unit' && e.unit.summon === 'decoy' && e.unit.owner !== null) {
      const owner = ctx.store.getKind(e.unit.owner, 'hero');
      return owner ? ctx.heroes[owner.hero.heroId].def.body : null;
    }
    return null;
  };
  const crouched = (e: Entity): boolean => e.kind === 'hero' && (e.motor.crouching || e.motor.sliding);

  const head = (e: Entity, out: Vec3): number => {
    const body = bodyOf(e);
    if (!body) return -1;
    const c = body.head.centre;
    const s = Math.sin(e.yaw);
    const k = Math.cos(e.yaw);
    out.x = e.pos.x + s * c.forward - k * c.right;
    out.y = e.pos.y + c.up * (crouched(e) ? CROUCH_SCALE : 1);
    out.z = e.pos.z + k * c.forward + s * c.right;
    return body.head.radius;
  };

  const push = (id: EntityId, t: number, isHead: boolean, weak: boolean): void => {
    let h = pool[hits.length];
    if (!h) {
      h = { id, t, head: isHead, weak };
      pool.push(h);
    } else {
      h.id = id;
      h.t = t;
      h.head = isHead;
      h.weak = weak;
    }
    // Insertion sort by (t, id): few hits per cast, and no ties left to chance.
    let i = hits.length;
    hits.push(h);
    while (i > 0) {
      const prev = hits[i - 1] as Hit;
      if (prev.t < t || (prev.t === t && prev.id < id)) break;
      hits[i] = prev;
      i--;
    }
    hits[i] = h;
  };

  const passes = (e: Entity, f: CastFilter): boolean => {
    if (e.removed || e.id === f.ignore) return false;
    switch (e.kind) {
      case 'hero':
      case 'unit':
      case 'structure':
        if (e.kind === 'hero' ? !f.heroes : e.kind === 'unit' ? !f.units : !f.structures) return false;
        if (f.team !== null && (e.team === f.team) !== f.allies) return false;
        return !e.health.dead && !e.stats.conditions.has('intangible');
      case 'pickup':
        return e.pickup.type === 'pod' ? f.pods : e.pickup.type === 'ember' && f.ember;
      default:
        return false;
    }
  };

  const centre = { x: 0, y: 0, z: 0 };
  const consider = (e: Entity, o: Vec3, d: Vec3, maxT: number, radius: number): void => {
    let t = -1;
    let isHead = false;
    let weak = false;
    const p = e.pos;
    switch (e.kind) {
      case 'hero':
      case 'unit': {
        const body = bodyOf(e);
        if (body) {
          const k = crouched(e) ? CROUCH_SCALE : 1;
          const hr = head(e, centre);
          const th = raySphere(o, d, centre.x, centre.y, centre.z, hr + radius);
          isHead = th >= 0 && th <= maxT;
          const y0 = p.y + body.radius;
          const y1 = Math.max(y0, p.y + (body.head.centre.up - body.head.radius) * k - body.radius);
          t = nearer(isHead ? th : -1, rayCapsule(o, d, p.x, p.z, y0, y1, body.radius + radius));
        } else if (e.kind === 'unit' && e.unit.size) {
          // A wall (Gale Shield): a box of its size standing on pos, turned by yaw.
          const s = e.unit.size;
          t = rayBox(o, d, p.x, p.y + s.y / 2, p.z, e.yaw, s.x / 2, s.y / 2, s.z / 2, radius);
        } else if (e.kind === 'unit') {
          const y0 = p.y + e.radius;
          const y1 = Math.max(y0, p.y + e.unit.height - e.radius);
          t = rayCapsule(o, d, p.x, p.z, y0, y1, e.radius + radius);
        }
        break;
      }
      case 'structure': {
        const b = e.structure.body;
        t = rayCylinder(o, d, p.x, p.z, p.y, p.y + b.height, b.radius + radius);
        const wp = e.structure.weakPoint;
        if (wp) {
          const tw = raySphere(o, d, wp.centre.x, wp.centre.y, wp.centre.z, wp.radius + radius);
          weak = tw >= 0 && tw <= maxT && (t < 0 || tw <= t);
          if (weak) t = tw;
        }
        break;
      }
      case 'pickup':
        t = raySphere(o, d, p.x, p.y, p.z, e.radius + radius);
        break;
      default:
        break;
    }
    if (t >= 0 && t <= maxT) push(e.id, t, isHead, weak);
  };

  return {
    head,
    cast(o, d, maxT, radius, f) {
      hits.length = 0;
      const half = maxT / 2;
      const reach = radius + COMBAT.hitboxQueryPad;
      if (half > COMBAT.hitboxLongCast) {
        // Long rays (aim rays, hitscan) would touch hundreds of grid cells: scan the short lists with a cheap
        // distance-to-segment reject instead.
        const scan = (list: readonly Entity[]): void => {
          for (const e of list) {
            const vx = e.pos.x - o.x;
            const vy = e.pos.y - o.y;
            const vz = e.pos.z - o.z;
            const t = Math.min(maxT, Math.max(0, vx * d.x + vy * d.y + vz * d.z));
            const r = reach + e.radius;
            const ex = vx - d.x * t;
            const ey = vy - d.y * t;
            const ez = vz - d.z * t;
            if (ex * ex + ey * ey + ez * ez <= r * r && passes(e, f)) consider(e, o, d, maxT, radius);
          }
        };
        if (f.heroes) scan(ctx.store.list('hero'));
        if (f.units) scan(ctx.store.list('unit'));
        if (f.pods || f.ember) scan(ctx.store.list('pickup'));
      } else {
        mid.x = o.x + d.x * half;
        mid.y = o.y + d.y * half;
        mid.z = o.z + d.z * half;
        ctx.spatial.query(mid, half + reach, ids);
        for (const id of ids) {
          const e = ctx.store.get(id);
          if (e && e.kind !== 'structure' && passes(e, f)) consider(e, o, d, maxT, radius);
        }
      }
      // Structures are tall and few: test them all instead of padding every query by their height.
      if (f.structures) for (const s of ctx.store.list('structure')) if (passes(s, f)) consider(s, o, d, maxT, radius);
      return hits;
    },
  };
}
