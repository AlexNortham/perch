/**
 * The shared visibility service (GDD §11.1, §5.9; D-ARCH-009): writes every entity's `seenBy` in the world phase.
 *
 * A flock always sees its own entities. It sees an enemy or neutral one within 20 m of one of its fledglings, 30 m of
 * one of its structures or 40 m of one of its living heroes with line of sight, or while it is revealed. An invisible
 * one (not revealed) is seen only within 8 m of one of those eyes or inside a true-sight holder's radius.
 *
 * Heroes are evaluated every tick; every other entity every VISION.staggerTicks ticks (by id), so its bits lag by at
 * most 0.1 s (ARCHITECTURE §11 allows 0.25 s). Line-of-sight raycasts run only when no cheaper eye sees the entity.
 */
import { LAYERS_SOLID, SeenBy } from '../core/contracts';
import type { Entity, EntityId, AreaEntity, HeroEntity, PlayerTeam, SimContext } from '../core/contracts';
import { VISION } from '../data/world';

const TEAMS = ['dawn', 'dusk'] as const;
const HERO2 = VISION.hero * VISION.hero;
const INVISIBLE2 = VISION.invisible * VISION.invisible;
const EPS = 1e-6;

/** A hero's eye height: its head centre. */
const eyeHeight = (ctx: SimContext, h: HeroEntity): number => ctx.heroes[h.hero.heroId].def.body.head.centre.up;

/** Height above `pos` that sight and attacks aim at: the middle of the body. */
export function aimHeight(ctx: SimContext, e: Entity): number {
  switch (e.kind) {
    case 'hero':
      return eyeHeight(ctx, e) / 2;
    case 'unit':
      return e.unit.height / 2;
    case 'structure':
      return e.structure.body.height / 2;
    default:
      return 0;
  }
}

/** One flock's eyes this tick, in flat arrays reused every tick. */
interface Eyes {
  /** Fledglings and structures: position and squared sight radius. */
  n: number;
  readonly x: number[];
  readonly y: number[];
  readonly z: number[];
  readonly r2: number[];
  /** Living heroes: eye point (head) and id. */
  hn: number;
  readonly hx: number[];
  readonly hy: number[];
  readonly hz: number[];
  readonly feetY: number[];
  /** True-sight holders. */
  tn: number;
  readonly tx: number[];
  readonly ty: number[];
  readonly tz: number[];
  readonly tr2: number[];
}

const eyes = (): Eyes => ({ n: 0, x: [], y: [], z: [], r2: [], hn: 0, hx: [], hy: [], hz: [], feetY: [], tn: 0, tx: [], ty: [], tz: [], tr2: [] });

export function createVision(ctx: SimContext): { update(): void } {
  const byTeam: Record<PlayerTeam, Eyes> = { dawn: eyes(), dusk: eyes() };
  const from = { x: 0, y: 0, z: 0 };
  const dir = { x: 0, y: 0, z: 0 };

  const prox = (team: PlayerTeam, x: number, y: number, z: number, r: number): void => {
    const E = byTeam[team];
    const i = E.n++;
    E.x[i] = x;
    E.y[i] = y;
    E.z[i] = z;
    E.r2[i] = r * r;
  };

  const gather = (): void => {
    for (const t of TEAMS) {
      const E = byTeam[t];
      E.n = 0;
      E.hn = 0;
      E.tn = 0;
    }
    for (const h of ctx.store.list('hero')) {
      if (h.health.dead) continue;
      const E = byTeam[h.team];
      const i = E.hn++;
      E.hx[i] = h.pos.x;
      E.hy[i] = h.pos.y + eyeHeight(ctx, h);
      E.hz[i] = h.pos.z;
      E.feetY[i] = h.pos.y;
      if (h.stats.conditions.has('trueSight')) {
        const k = E.tn++;
        E.tx[k] = h.pos.x;
        E.ty[k] = h.pos.y;
        E.tz[k] = h.pos.z;
        E.tr2[k] = (h.stats.final.trueSightRadius || VISION.trueSight) ** 2;
      }
    }
    for (const u of ctx.store.list('unit')) {
      if (u.team !== 'neutral' && (u.unit.type === 'scrapper' || u.unit.type === 'slinger')) {
        prox(u.team, u.pos.x, u.pos.y, u.pos.z, VISION.fledgling);
      }
    }
    for (const s of ctx.store.list('structure')) {
      if (s.team !== 'neutral') prox(s.team, s.pos.x, s.pos.y, s.pos.z, VISION.structure);
    }
  };

  /** Nothing solid between the eye and the point (the target's own collider aside). */
  const clear = (x: number, y: number, z: number, px: number, py: number, pz: number, target: EntityId): boolean => {
    const dx = px - x;
    const dy = py - y;
    const dz = pz - z;
    const d = Math.hypot(dx, dy, dz);
    if (d < EPS) return true;
    from.x = x;
    from.y = y;
    from.z = z;
    dir.x = dx / d;
    dir.y = dy / d;
    dir.z = dz / d;
    return ctx.physics.raycast(from, dir, d, LAYERS_SOLID, target) === null;
  };

  // Fog Bank has a resolved radius (sphere or upright cylinder). Compare each eye to the same volume as its subject.
  const fogs: AreaEntity[] = [];
  const aroundTarget: AreaEntity[] = [];
  const inFog = (a: AreaEntity, x: number, y: number, z: number): boolean => {
    const d = a.area.dimensions;
    if (d?.kind === 'sphere') return dist2(x, y, z, a.pos.x, a.pos.y, a.pos.z) <= d.radius ** 2;
    return d?.kind === 'cylinder' && Math.abs(y - a.pos.y) <= d.half &&
      (x - a.pos.x) ** 2 + (z - a.pos.z) ** 2 <= d.radius ** 2;
  };
  const outsideFog = (x: number, y: number, z: number): boolean =>
    aroundTarget.some((fog) => !inFog(fog, x, y, z));

  const sees = (E: Eyes, e: Entity, invisible: boolean, revealed: boolean): boolean => {
    const { x, y, z } = e.pos;
    if (!invisible && aroundTarget.length === 0) {
      if (revealed) return true;
      for (let i = 0; i < E.n; i++) {
        if (dist2(E.x[i], E.y[i], E.z[i], x, y, z) <= E.r2[i]!) return true;
      }
      const py = y + aimHeight(ctx, e);
      for (let i = 0; i < E.hn; i++) {
        const hx = E.hx[i]!, hy = E.hy[i]!, hz = E.hz[i]!;
        if (dist2(hx, hy, hz, x, py, z) <= HERO2 && clear(hx, hy, hz, x, py, z, e.id)) return true;
      }
      return false;
    }
    for (let i = 0; i < E.tn; i++) {
      if (dist2(E.tx[i], E.ty[i], E.tz[i], x, y, z) <= E.tr2[i]!) return true;
    }
    for (let i = 0; i < E.n; i++) {
      const hidden = invisible || (aroundTarget.length > 0 && outsideFog(E.x[i]!, E.y[i]!, E.z[i]!));
      if (dist2(E.x[i], E.y[i], E.z[i], x, y, z) <= (hidden ? INVISIBLE2 : E.r2[i]!)) return true;
    }
    const py = y + aimHeight(ctx, e);
    for (let i = 0; i < E.hn; i++) {
      const hx = E.hx[i] as number;
      const hy = E.hy[i] as number;
      const hz = E.hz[i] as number;
      const hidden = invisible || (aroundTarget.length > 0 && outsideFog(hx, E.feetY[i]!, hz));
      if (hidden) {
        if (dist2(hx, hy, hz, x, y, z) <= INVISIBLE2) return true;
      } else if (revealed || (dist2(hx, hy, hz, x, py, z) <= HERO2 && clear(hx, hy, hz, x, py, z, e.id))) return true;
    }
    return false;
  };

  return {
    update() {
      gather();
      fogs.length = 0;
      for (const a of ctx.store.list('area')) if (a.area.concealsAlliesOutside) fogs.push(a);
      const tick = ctx.clock.tick;
      for (const e of ctx.store.all()) {
        if (e.kind !== 'hero' && (e.id + tick) % VISION.staggerTicks !== 0) continue;
        const cond = 'stats' in e ? e.stats.conditions : null;
        aroundTarget.length = 0;
        if (e.kind === 'hero' || e.kind === 'unit') for (const a of fogs) {
          if (a.team === e.team && inFog(a, e.pos.x, e.pos.y, e.pos.z)) aroundTarget.push(a);
        }
        const revealed = cond?.has('revealed') ?? false;
        const invisible = cond?.has('invisible') ?? false;
        let bits = e.team === 'neutral' ? 0 : SeenBy[e.team];
        for (const t of TEAMS) if (t !== e.team && sees(byTeam[t], e, invisible, revealed)) bits |= SeenBy[t];
        e.seenBy = bits;
        if (revealed || e.mapOnlySeenBy) e.mapOnlySeenBy = revealed ? SeenBy.all & ~bits : 0;
      }
    },
  };
}

function dist2(ax: number | undefined, ay: number | undefined, az: number | undefined, bx: number, by: number, bz: number): number {
  const dx = (ax as number) - bx;
  const dy = (ay as number) - by;
  const dz = (az as number) - bz;
  return dx * dx + dy * dy + dz * dz;
}
