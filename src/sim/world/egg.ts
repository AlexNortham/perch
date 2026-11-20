/**
 * The Golden Egg (GDD §7.11, D-EP-039).
 *
 * At 10:00 an Egg is lowered over 10 s onto an Egg Perch chosen by seeded RNG; the other perch is its Hatching Stone.
 * Any melee hit takes it once it has landed (combat reports the pickup as `melee.target`). The carrier gets the
 * carrier status (can't fire, cast, use items, parry, mantle or ride; revealed; +1.5 m/s, +1 stamina pip, slows
 * cleansed) and, while its flock trails in net worth, +2% resists and +0.2 m/s sprint per 1% of deficit (to 15%).
 * It drops on the carrier's death, a stun, a displacement or an enemy hero's melee hit; the carrier's own Melee sets
 * it down 1 m ahead; nobody can take it for 1 s after. Left alone 180 s after landing or a drop it rolls along the
 * nav graph toward its Stone at 2 m/s. 45 s after the first pickup it cools to nothing over 45 s and cracks. Carried
 * into the Stone's 3 m circle it is delivered at once: `eggDelivered` carries its value (× 1.25 for a trailing
 * flock; economy hatches the golden pods), the courier gets 3 keepsakes and each other hero of the flock within 30 m
 * of the Stone 1. Later Eggs come at each 5:00 mark on the perch that didn't hold the last one; an untouched Egg is
 * replaced, and while a touched one is out the next waits for the first mark after it is delivered or spoils.
 */
import { Button } from '../core/contracts';
import type { EggState, Hasher, HeroEntity, PickupEntity, PlayerTeam, SimContext, StatusDef, Tick, Vec3 } from '../core/contracts';
import { ticks } from '../core/math';
import { EGG } from '../data/world';
import type { Keepsakes } from './keepsakes';
import { MINUTE_TICKS, flatDistSq, giveStatus, spawnPickup, targetOf, worldCause } from './neutral';
import * as dmath from '../core/dmath';

/** GDD §7.11 carrier status (Stage 4 numbers); world cleanses it by id on every drop. */
export const EGG_CARRIER: StatusDef = {
  id: 'eggCarrier',
  name: 'Egg carrier',
  negative: false,
  stacking: 'max',
  maxStacks: 1,
  durationS: 3600,
  modifiers: {
    conditions: ['eggCarrier', 'revealed'],
    stats: [{ stat: 'moveSpeed', op: 'add', value: EGG.carrier.moveSpeed }, { stat: 'stamina', op: 'add', value: EGG.carrier.stamina }],
  },
};
const TRAILING = 'world:eggTrailing';
/** The carried Egg rides this far above the carrier's feet. */
const CARRY_LIFT = 1.2;
const PCT = 100;

export interface Egg {
  update(): void;
  hash(h: Hasher): void;
}

/**
 * Per Stone (perch index): for each nav node, the next node toward it over walk and drop links (−1: none). Dijkstra
 * on the reversed links with a binary heap, once per perch at match start.
 */
function towardStones(ctx: SimContext): Int32Array[] {
  const { nodes, links } = ctx.map.nav;
  const into: number[][] = nodes.map(() => []);
  for (const l of links) if (l.kind === 'walk' || l.kind === 'drop') into[l.to]!.push(l.from);
  return ctx.map.eggPerches.map((perch) => {
    const next = new Int32Array(nodes.length).fill(-1);
    const dist = new Float64Array(nodes.length).fill(Infinity);
    const goal = nearestNode(ctx, perch.pos);
    if (goal < 0) return next;
    dist[goal] = 0;
    next[goal] = goal;
    const heap: number[] = [goal];
    const up = (i: number): void => {
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (dist[heap[p]!]! <= dist[heap[i]!]!) return;
        [heap[p], heap[i]] = [heap[i]!, heap[p]!];
        i = p;
      }
    };
    const pop = (): number => {
      const top = heap[0]!;
      const last = heap.pop()!;
      if (heap.length > 0) {
        heap[0] = last;
        for (let i = 0; ;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < heap.length && dist[heap[l]!]! < dist[heap[m]!]!) m = l;
          if (r < heap.length && dist[heap[r]!]! < dist[heap[m]!]!) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i]!, heap[m]!];
          i = m;
        }
      }
      return top;
    };
    const done = new Uint8Array(nodes.length);
    while (heap.length > 0) {
      const u = pop();
      if (done[u]) continue;
      done[u] = 1;
      const a = nodes[u]!;
      for (const v of into[u]!) {
        const b = nodes[v]!;
        const d = dist[u]! + dmath.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
        if (d < dist[v]!) {
          dist[v] = d;
          next[v] = u;
          heap.push(v);
          up(heap.length - 1);
        }
      }
    }
    return next;
  });
}

function nearestNode(ctx: SimContext, p: Vec3): number {
  let best = -1;
  let bestD = Infinity;
  ctx.map.nav.nodes.forEach((n, i) => {
    const d = flatDistSq(n, p) + (n.y - p.y) ** 2;
    if (d < bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
}

export function createEgg(ctx: SimContext, keepsakes: Keepsakes): Egg {
  const perches = ctx.map.eggPerches;
  const rng = ctx.rng.stream('world/egg');
  const every = ticks(EGG.everyS);
  const first = ticks(EGG.firstS);
  const state: EggState = { pickup: null, perch: 0, rollsAt: null, coolsAt: null, value: 0 };
  let egg: PickupEntity | null = null;
  let carrier: HeroEntity | null = null;
  let touched = false;
  let landAt: Tick = 0;
  /** E when it landed (before cooling). */
  let full = 0;
  let spawned = 0;
  let trailingPct = 0;
  /** Rolling: the polyline toward the Stone and progress along it (m). */
  let roll: { readonly path: readonly Vec3[]; leg: number; along: number } | null = null;
  const toward = perches.length >= 2 ? towardStones(ctx) : [];
  if (perches.length >= 2) {
    ctx.objectives.eggAt = first;
    ctx.objectives.egg = state;
  }

  const stone = (): Vec3 => perches[1 - state.perch]!.pos;
  const restY = (x: number, z: number, fromY: number): number => (ctx.physics.groundHeight(x, z, fromY + 1) ?? fromY) + EGG.radius;
  const emit = (action: 'eggSpawned' | 'eggTaken' | 'eggDropped' | 'eggRolling' | 'eggSpoiled' | 'eggDelivered', hero: HeroEntity | null,
    pos: Vec3 | undefined = egg?.pos, value?: number) =>
    ctx.bus.emit({ type: 'objective', action, hero: hero?.id ?? null, team: hero?.team ?? 'neutral', pickup: egg?.id ?? null,
      pickupType: 'egg', pos: { ...(pos ?? stone()) }, ...(value !== undefined && { value }) });

  const netWorth = (team: PlayerTeam): number =>
    ctx.store.list('hero').reduce((sum, h) => (h.team === team ? sum + h.progress.netWorth : sum), 0);
  /** The flock's net-worth deficit in percent (0 when it doesn't trail). */
  const deficitPct = (team: PlayerTeam): number => {
    const mine = netWorth(team);
    const theirs = netWorth(team === 'dawn' ? 'dusk' : 'dawn');
    return mine < theirs ? ((theirs - mine) / theirs) * PCT : 0;
  };

  const spawn = (): void => {
    const now = ctx.clock.tick;
    state.perch = spawned === 0 ? rng.int(0, 1) : 1 - state.perch;
    spawned++;
    const perch = perches[state.perch]!.pos;
    landAt = now + ticks(EGG.lowerS);
    // It sits on the perch from the start; the client lowers it from the canopy until `claimableAt` (D-OBJ-010).
    egg = spawnPickup(ctx, 'egg', { x: perch.x, y: perch.y + EGG.radius, z: perch.z }, EGG.radius, { melee: 'any', claimableAt: landAt });
    touched = false;
    roll = null;
    full = EGG.value.base + EGG.value.perMinute * Math.floor(landAt / MINUTE_TICKS);
    Object.assign(state, { pickup: egg.id, rollsAt: landAt + ticks(EGG.unattendedS), coolsAt: null, value: full });
    emit('eggSpawned', null);
  };

  const remove = (): void => {
    if (carrier) release(carrier);
    if (egg && !egg.removed) ctx.store.despawn(egg.id);
    egg = null;
    carrier = null;
    roll = null;
    Object.assign(state, { pickup: null, rollsAt: null, coolsAt: null });
    // The next Egg waits for the first 5:00 mark after this one is gone.
    const now = ctx.clock.tick;
    ctx.objectives.eggAt = first + Math.max(0, Math.floor((now - first) / every) + 1) * every;
  };

  const release = (h: HeroEntity): void => {
    const cause = worldCause(null, 'neutral', h.pos, 'objective');
    ctx.effects.apply({ kind: 'cleanse', remove: [EGG_CARRIER.id] }, targetOf(h), cause);
    ctx.stats.set(h.id, TRAILING, null);
    trailingPct = 0;
  };

  const take = (h: HeroEntity): void => {
    if (!egg) return;
    carrier = h;
    egg.pickup.carrier = h.id;
    touched = true;
    roll = null;
    state.rollsAt = null;
    state.coolsAt ??= ctx.clock.tick + ticks(EGG.coolAfterS);
    giveStatus(ctx, h, EGG_CARRIER, worldCause(null, 'neutral', egg.pos, 'objective'));
    trail(h);
    emit('eggTaken', h);
  };

  const drop = (at: Vec3): void => {
    if (!egg || !carrier) return;
    const h = carrier;
    release(h);
    carrier = null;
    egg.pickup.carrier = null;
    egg.pos.x = at.x;
    egg.pos.z = at.z;
    egg.pos.y = restY(at.x, at.z, at.y);
    egg.pickup.claimableAt = ctx.clock.tick + ticks(EGG.dropLockoutS);
    state.rollsAt = ctx.clock.tick + ticks(EGG.unattendedS);
    emit('eggDropped', h);
  };

  /** Trailing carrier: resists and sprint per 1% of net-worth deficit (GDD §7.11). */
  const trail = (h: HeroEntity): void => {
    const pct = Math.min(EGG.trailing.capPct, deficitPct(h.team));
    if (pct === trailingPct) return;
    trailingPct = pct;
    const resist = pct * EGG.trailing.resistPerPct;
    ctx.stats.set(h.id, TRAILING, pct > 0 ? { stats: [
      { stat: 'talonResist', op: 'stack', value: resist },
      { stat: 'songResist', op: 'stack', value: resist },
      { stat: 'sprintSpeed', op: 'add', value: pct * EGG.trailing.sprintPerPct },
    ] } : null);
  };

  /** Immune to slows: cleanse any status that slows the carrier. */
  const shrugSlows = (h: HeroEntity): void => {
    if (h.stats.final.slow <= 0) return;
    const ids = h.statuses.filter((s) => s.def.modifiers?.stats?.some((m) => m.stat === 'slow')).map((s) => s.def.id);
    if (ids.length > 0) ctx.effects.apply({ kind: 'cleanse', remove: ids }, targetOf(h), worldCause(null, 'neutral', h.pos, 'objective'));
  };

  const deliver = (h: HeroEntity): void => {
    const value = state.value * (deficitPct(h.team) > 0 ? EGG.value.trailingMult : 1);
    const at = stone();
    emit('eggDelivered', h, at, value);
    keepsakes.grant(h, EGG.keepsakes.courier);
    for (const other of ctx.store.list('hero')) {
      if (other !== h && other.team === h.team && !other.health.dead && flatDistSq(other.pos, at) <= EGG.keepsakes.escortM ** 2) {
        keepsakes.grant(other, EGG.keepsakes.escort);
      }
    }
    remove();
  };

  const startRoll = (): void => {
    if (!egg) return;
    const next = toward[1 - state.perch]!;
    const path: Vec3[] = [{ ...egg.pos }];
    let n = nearestNode(ctx, egg.pos);
    for (let guard = 0; n >= 0 && guard < next.length; guard++) {
      const p = ctx.map.nav.nodes[n]!;
      path.push({ x: p.x, y: p.y + EGG.radius, z: p.z });
      if (next[n] === n || next[n]! < 0) break;
      n = next[n]!;
    }
    const s = stone();
    path.push({ x: s.x, y: s.y + EGG.radius, z: s.z });
    roll = { path, leg: 0, along: 0 };
    emit('eggRolling', null);
  };

  const rollOn = (): void => {
    if (!egg || !roll) return;
    let step = EGG.rollSpeed / ticks(1);
    const { path } = roll;
    while (step > 0 && roll.leg < path.length - 1) {
      const a = path[roll.leg]!;
      const b = path[roll.leg + 1]!;
      const len = dmath.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      const left = len - roll.along;
      if (step < left) {
        roll.along += step;
        step = 0;
        const t = roll.along / len;
        egg.pos.x = a.x + (b.x - a.x) * t;
        egg.pos.y = a.y + (b.y - a.y) * t;
        egg.pos.z = a.z + (b.z - a.z) * t;
      } else {
        step -= left;
        roll.leg++;
        roll.along = 0;
        egg.pos.x = b.x;
        egg.pos.y = b.y;
        egg.pos.z = b.z;
      }
    }
  };

  ctx.bus.on('melee', (ev) => {
    if (ev.parried || ev.target === null || !egg) return;
    const hero = ctx.store.getKind(ev.attacker, 'hero');
    if (!hero || hero.health.dead) return;
    if (ev.target === egg.id) {
      if (!carrier && ctx.clock.tick >= (egg.pickup.claimableAt ?? 0)) take(hero);
    } else if (carrier && ev.target === carrier.id && hero.team !== carrier.team) drop(carrier.pos);
  });
  ctx.bus.on('entity.died', (ev) => {
    if (carrier && ev.victim === carrier.id) drop(ev.pos);
  });
  ctx.bus.on('movement', (ev) => {
    if (carrier && ev.hero === carrier.id && ev.action === 'displaced') drop(carrier.pos);
  });

  return {
    update() {
      const now = ctx.clock.tick;
      const at = ctx.objectives.eggAt;
      if (at !== null && now >= at && perches.length >= 2) {
        if (egg && touched) ctx.objectives.eggAt = null;
        else {
          if (egg) {
            ctx.store.despawn(egg.id);
            egg = null;
          }
          spawn();
          ctx.objectives.eggAt = at + every;
        }
      }
      if (!egg) return;
      if (egg.removed) {
        egg = null;
        return;
      }
      if (state.coolsAt !== null && now >= state.coolsAt) {
        state.value = full * Math.max(0, 1 - (now - state.coolsAt) / ticks(EGG.coolForS));
        if (state.value <= 0) {
          emit('eggSpoiled', carrier);
          remove();
          return;
        }
      }
      if (now < landAt) return;
      const h = carrier;
      if (h) {
        if (h.stats.conditions.has('stunned')) return drop(h.pos);
        if ((h.command.pressed & Button.Melee) !== 0) {
          return drop({ x: h.pos.x + dmath.sin(h.yaw) * EGG.setDownM, y: h.pos.y, z: h.pos.z + dmath.cos(h.yaw) * EGG.setDownM });
        }
        egg.pos.x = h.pos.x;
        egg.pos.y = h.pos.y + CARRY_LIFT;
        egg.pos.z = h.pos.z;
        const s = stone();
        if (flatDistSq(h.pos, s) <= EGG.stoneM ** 2 && Math.abs(h.pos.y - s.y) <= EGG.stoneHeightM) return deliver(h);
        trail(h);
        shrugSlows(h);
        return;
      }
      if (state.rollsAt !== null && now >= state.rollsAt) {
        if (!roll) startRoll();
        rollOn();
      }
    },
    hash(h) {
      h.value([egg?.id ?? -1, carrier?.id ?? -1, touched, landAt, full, spawned, trailingPct, roll]);
    },
  };
}
