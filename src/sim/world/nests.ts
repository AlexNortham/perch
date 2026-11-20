/**
 * Nests (GDD §7.9) and Bell Feeders (§7.14): neutral breakables, both structures of type 'nest' (D-ARCH-023).
 *
 * Nests spawn at 3:00 (below ground 5:00, the Hollow's four at 10:00). Twig and Keepsake Nests have no collider and
 * break on any hit or a hero passing through at 8.5 m/s or faster; Woven Nests are solid and break on one heavy melee
 * hit (combat honours `breakable`). On a break world rolls the crumb and keepsake drops (economy drops the sprig)
 * and the Nest returns 3:00 (below ground 5:00) after the break or after its last drop is collected, whichever is
 * later.
 *
 * Bell Feeders spawn at 8:00 with 480 HP. Each melee hit swings back for 70 Song unless it chimes; from 180 HP its
 * lamp blinks on a seeded rhythm, and a breaking hit that lands while lit gives keepsakes (1 light, 3 heavy). It
 * returns 5:00 after the break; a Granary Feeder and its Rat camp return together, once both are down (the Granary).
 */
import type {
  EntityId, Hasher, NestAnchor, SimContext, StructureEntity, StructureInfo, Tick, Vec3,
} from '../core/contracts';
import { ticks } from '../core/math';
import { FEEDERS, NEST_RULES, NESTS, PICKUPS, THICKET_FAMILIES } from '../data/world';
import type { CrumbType, NestVariant } from '../data/world';
import type { Keepsakes } from './keepsakes';
import { creditedHero, flatDistSq, spawnPickup, targetOf, worldCause } from './neutral';

const CRUMB_TYPES: readonly CrumbType[] = ['quick', 'light', 'sweet'];
/** Damage that breaks a Nest outright when a hero runs through it (its HP is NEST_RULES.hp). */
const RUN_THROUGH_DAMAGE = 1_000;
/** A sprig economy drops within this of a broken Nest belongs to it. */
const DROP_LINK_M = 1.5;
/** A hero this far above or below a Nest's base can run through it. */
const RUN_THROUGH_DY = { below: 1, above: 1.5 };
/** Contact slack: a hero brushing the Nest (or stopped by a collider at its skin) still counts as passing through. */
const RUN_THROUGH_MARGIN = 0.25;

/** A Granary: a Bell Feeder and a Rat camp that return together, once both are down (GDD §§7.8, 7.14). */
export interface Granary {
  has(camp: number): boolean;
  ratsDown(camp: number): void;
  feederDown(camp: number): void;
  hash(h: Hasher): void;
}

export function createGranary(ctx: SimContext): Granary {
  const feederOf = new Map<number, number>();
  (ctx.map.interactables ?? []).forEach((a, i) => {
    if (a.kind === 'feeder' && a.camp !== undefined) feederOf.set(a.camp, i);
  });
  const down = new Map<number, { rats: Tick | null; feeder: Tick | null }>();
  const of = (camp: number) => down.get(camp) ?? down.set(camp, { rats: null, feeder: null }).get(camp)!;
  const settle = (camp: number): void => {
    const d = of(camp);
    if (d.rats === null || d.feeder === null) return;
    const t = Math.max(d.rats, d.feeder);
    const anchor = ctx.map.thickets[camp]!;
    const family = THICKET_FAMILIES[anchor.family ?? 'rats'];
    (ctx.objectives.campAt ??= ctx.map.thickets.map(() => null))[camp] = t + ticks(family.respawnS);
    (ctx.objectives.interactableAt ??= (ctx.map.interactables ?? []).map(() => null))[feederOf.get(camp)!] = t + ticks(FEEDERS.respawnS);
    d.rats = d.feeder = null;
  };
  return {
    has: (camp) => feederOf.has(camp),
    ratsDown(camp) {
      of(camp).rats = ctx.clock.tick;
      settle(camp);
    },
    feederDown(camp) {
      of(camp).feeder = ctx.clock.tick;
      settle(camp);
    },
    hash(h) {
      h.value(down);
    },
  };
}

interface Nest {
  readonly index: number;
  readonly anchor: NestAnchor;
  readonly variant: NestVariant;
  readonly respawnS: number;
  e: StructureEntity | null;
  brokeAt: Tick;
  readonly drops: Set<EntityId>;
}

interface Feeder {
  readonly index: number;
  readonly pos: Vec3;
  readonly yaw: number;
  readonly camp: number | undefined;
  e: StructureEntity | null;
  /** The lamp's rhythm once it chimes: start tick, lit ticks per period. */
  chime: { readonly start: Tick; readonly lit: number; readonly period: number } | null;
  /** The last melee hit on it: who, how, and whether the lamp was lit as it landed. */
  last: { readonly hero: EntityId; readonly heavy: boolean; readonly lit: boolean } | null;
}

export interface Nests {
  update(): void;
  hash(h: Hasher): void;
}

export function createNests(ctx: SimContext, keepsakes: Keepsakes, granary: Granary): Nests {
  const rng = ctx.rng.stream('world/nests');
  const hollow = ctx.map.hollow;
  const nestAt = (ctx.objectives.nestAt ??= ctx.map.nests.map(() => null));
  const nests: Nest[] = ctx.map.nests.map((anchor, index) => {
    const inHollow = hollow !== null && anchor.pos.y <= NEST_RULES.hollowMaxY && flatDistSq(anchor.pos, hollow.centre) <= hollow.radius ** 2;
    const below = !inHollow && ((anchor.storey ?? 0) < 0 || anchor.pos.y < NEST_RULES.belowY);
    nestAt[index] = ticks(inHollow ? NEST_RULES.spawnS.hollow : below ? NEST_RULES.spawnS.below : NEST_RULES.spawnS.surface);
    return { index, anchor, variant: anchor.variant ?? 'twig', respawnS: below ? NEST_RULES.respawnS.below : NEST_RULES.respawnS.surface,
      e: null, brokeAt: -1, drops: new Set<EntityId>() };
  });

  const feeders: Feeder[] = (ctx.map.interactables ?? []).flatMap((a, index) =>
    a.kind === 'feeder' ? [{ index, pos: a.pos, yaw: a.yaw, camp: a.camp, e: null, chime: null, last: null }] : []);
  const at = (ctx.objectives.interactableAt ??= (ctx.map.interactables ?? []).map(() => null));
  for (const f of feeders) at[f.index] = ticks(FEEDERS.firstS);

  const nestOf = new Map<EntityId, Nest>();
  const feederOf = new Map<EntityId, Feeder>();
  const dropOf = new Map<EntityId, Nest>();
  const near: EntityId[] = [];
  /** Nests a run-through already broke this tick (their death resolves in the damage phase). */
  const breaking = new Set<EntityId>();

  const structure = (info: StructureInfo, pos: Vec3, yaw: number, hp: number): StructureEntity =>
    ctx.store.spawn({ kind: 'structure', team: 'neutral', pos: { ...pos }, vel: { x: 0, y: 0, z: 0 }, yaw, radius: info.body.radius,
      structure: info, stats: ctx.stats.create({ maxHealth: hp }), statuses: [],
      health: { hp, talonShield: 0, songShield: 0, barrier: 0, dead: false, respawnAt: null, inCombatUntil: 0 } });

  const spawnNest = (n: Nest): void => {
    const def = NESTS[n.variant];
    n.e = structure({ type: 'nest', lane: null, phase: 1, target: null, body: { radius: def.radius, height: def.height }, weakPoint: null,
      variant: n.variant, anchor: n.index, breakable: { by: def.by }, solid: def.solid }, n.anchor.pos, n.anchor.yaw, NEST_RULES.hp);
    nestOf.set(n.e.id, n);
  };

  const spawnFeeder = (f: Feeder): void => {
    f.e = structure({ type: 'nest', lane: null, phase: 1, target: null, body: { radius: FEEDERS.radius, height: FEEDERS.height },
      weakPoint: null, variant: 'feeder', anchor: f.index, breakable: { by: 'melee', light: FEEDERS.light, heavy: FEEDERS.heavy },
      solid: false, lit: false }, f.pos, f.yaw, FEEDERS.hp);
    feederOf.set(f.e.id, f);
  };

  const dropAt = (n: Nest, pos: Vec3): void => {
    const def = NESTS[n.variant];
    const lifted = { x: pos.x, y: pos.y + NEST_RULES.dropLift, z: pos.z };
    if (def.crumb > 0 && rng.chance(def.crumb)) {
      n.drops.add(spawnPickup(ctx, 'crumb', lifted, PICKUPS.radius, { variant: rng.pick(CRUMB_TYPES) }).id);
    }
    if (def.keepsake > 0 && rng.chance(def.keepsake)) n.drops.add(spawnPickup(ctx, 'keepsake', lifted, PICKUPS.radius).id);
    for (const id of n.drops) dropOf.set(id, n);
  };

  ctx.bus.on('entity.died', (ev) => {
    if (ev.victimKind !== 'structure' || ev.victimType !== 'nest') return;
    const n = nestOf.get(ev.victim);
    if (n) {
      nestOf.delete(ev.victim);
      n.e = null;
      n.brokeAt = ctx.clock.tick;
      nestAt[n.index] = ctx.clock.tick + ticks(n.respawnS);
      dropAt(n, ev.pos);
      return;
    }
    const f = feederOf.get(ev.victim);
    if (!f) return;
    feederOf.delete(ev.victim);
    const hero = creditedHero(ctx, ev.creditHero ?? ev.killer);
    if (hero && f.last?.hero === hero.id && f.last.lit) keepsakes.grant(hero, f.last.heavy ? FEEDERS.keepsakes.heavy : FEEDERS.keepsakes.light);
    f.e = null;
    f.chime = null;
    f.last = null;
    if (f.camp !== undefined && granary.has(f.camp)) granary.feederDown(f.camp);
    else at[f.index] = ctx.clock.tick + ticks(FEEDERS.respawnS);
  });

  // Economy drops a broken Nest's sprig: it belongs to the nearest Nest broken this tick.
  ctx.bus.on('entity.spawned', (ev) => {
    if (ev.kind !== 'pickup') return;
    const p = ctx.store.getKind(ev.id, 'pickup');
    if (!p || p.pickup.type !== 'sprig') return;
    let best: Nest | undefined;
    let bestD = DROP_LINK_M * DROP_LINK_M;
    for (const n of nests) {
      if (!(n.brokeAt === ctx.clock.tick || n.e?.health.dead)) continue;
      const d = flatDistSq(n.anchor.pos, p.pos);
      if (d <= bestD) {
        best = n;
        bestD = d;
      }
    }
    if (best) {
      best.drops.add(p.id);
      dropOf.set(p.id, best);
    }
  });

  ctx.bus.on('entity.despawned', (ev) => {
    const n = dropOf.get(ev.id);
    if (!n) return;
    dropOf.delete(ev.id);
    n.drops.delete(ev.id);
    if (n.drops.size === 0 && n.e === null) nestAt[n.index] = Math.max(nestAt[n.index] ?? 0, ctx.clock.tick + ticks(n.respawnS));
  });

  ctx.bus.on('melee', (ev) => {
    if (ev.target === null || ev.parried) return;
    const f = feederOf.get(ev.target);
    const hero = ctx.store.getKind(ev.attacker, 'hero');
    if (!f?.e || !hero) return;
    f.last = { hero: hero.id, heavy: ev.heavy, lit: f.e.structure.lit === true };
    if (f.e.health.hp > FEEDERS.chimeHp) {
      ctx.effects.apply({ kind: 'damage', amount: FEEDERS.swingBack, type: 'song' }, targetOf(hero), worldCause(f.e.id, 'neutral', f.e.pos, 'objective'));
    }
  });

  /** GDD §7.9: a hero moving at 8.5 m/s or faster through a Twig or Keepsake Nest breaks it. */
  const runThrough = (): void => {
    breaking.clear();
    for (const h of ctx.store.list('hero')) {
      if (h.health.dead || h.vel.x * h.vel.x + h.vel.z * h.vel.z < NEST_RULES.breakSpeed ** 2) continue;
      ctx.spatial.query(h.pos, h.radius + NESTS.twig.radius + RUN_THROUGH_MARGIN, near);
      for (const id of near) {
        const n = nestOf.get(id);
        if (!n?.e || n.e.health.dead || NESTS[n.variant].solid || breaking.has(id)) continue;
        const dy = h.pos.y - n.e.pos.y;
        const reach = h.radius + n.e.radius + RUN_THROUGH_MARGIN;
        if (dy < -RUN_THROUGH_DY.below || dy > RUN_THROUGH_DY.above || flatDistSq(h.pos, n.e.pos) > reach * reach) continue;
        breaking.add(id);
        ctx.effects.apply({ kind: 'damage', amount: RUN_THROUGH_DAMAGE, type: 'talon' }, targetOf(n.e), worldCause(h.id, h.team, h.pos, 'objective'));
      }
    }
  };

  return {
    update() {
      const now = ctx.clock.tick;
      for (const n of nests) {
        const t = nestAt[n.index];
        if (n.e === null && t != null && now >= t && n.drops.size === 0) {
          nestAt[n.index] = null;
          spawnNest(n);
        }
      }
      for (const f of feeders) {
        const t = at[f.index];
        if (f.e === null && t != null && now >= t) {
          at[f.index] = null;
          spawnFeeder(f);
        }
        const e = f.e;
        if (!e) continue;
        if (!f.chime && e.health.hp <= FEEDERS.chimeHp && !e.health.dead) {
          const r = ctx.rng.stream('world/feeders').next();
          let acc = 0;
          const beat = FEEDERS.beats.find((b) => (acc += b.chance) > r) ?? FEEDERS.beats[FEEDERS.beats.length - 1]!;
          f.chime = { start: now, lit: ticks(beat.litS), period: ticks(beat.everyS) };
        }
        e.structure.lit = f.chime !== null && (now - f.chime.start) % f.chime.period < f.chime.lit;
      }
      if (nestOf.size > 0) runThrough();
    },
    hash(h) {
      for (const n of nests) h.value([n.e?.id ?? -1, n.brokeAt, [...n.drops]]);
      for (const f of feeders) h.value([f.e?.id ?? -1, f.chime, f.last]);
    },
  };
}
