/**
 * Walk-in pickups (GDD §§7.9, 7.13, 7.15): crumbs and keepsakes a hero of either flock collects within 1.5 m, and
 * the Berries (eaten within 1.2 m: 15% of max HP over 4 s; first at 2:30, back 3:00 after being eaten). Seed pods
 * and sprigs are economy's. Distances are flat, with a height band around the feet.
 */
import type { EntityId, Hasher, HeroEntity, PickupEntity, SimContext, StatusDef } from '../core/contracts';
import { ticks } from '../core/math';
import { CRUMBS, INTERACTABLES, PICKUPS } from '../data/world';
import type { CrumbType } from '../data/world';
import type { Keepsakes } from './keepsakes';
import { flatDistSq, giveStatus, spawnPickup, targetOf, worldCause } from './neutral';

const BERRY = INTERACTABLES.berry;

export const CRUMB_STATUS: Readonly<Record<CrumbType, StatusDef>> = {
  quick: crumb('quick'),
  light: crumb('light'),
  sweet: crumb('sweet'),
};

function crumb(type: CrumbType): StatusDef {
  const t = CRUMBS.types[type];
  return { id: 'crumb', name: t.name, negative: false, stacking: 'max', maxStacks: 1, durationS: CRUMBS.durationS,
    modifiers: { stats: [{ stat: t.stat, op: t.op, value: t.value }] } };
}

export interface Pickups {
  update(): void;
  hash(h: Hasher): void;
}

export function createPickups(ctx: SimContext, keepsakes: Keepsakes): Pickups {
  const live: PickupEntity[] = [];
  /** Berry pickup id → index into MapData.interactables. */
  const berryOf = new Map<EntityId, number>();
  const berries = (ctx.map.interactables ?? []).flatMap((a, i) => (a.kind === 'berry' ? [i] : []));
  const at = (ctx.objectives.interactableAt ??= (ctx.map.interactables ?? []).map(() => null));
  for (const i of berries) at[i] = ticks(BERRY.firstS);

  ctx.bus.on('entity.spawned', (ev) => {
    if (ev.kind !== 'pickup') return;
    const p = ctx.store.getKind(ev.id, 'pickup');
    if (p && (p.pickup.type === 'keepsake' || p.pickup.type === 'crumb' || p.pickup.type === 'berry')) live.push(p);
  });

  const collect = (p: PickupEntity, h: HeroEntity): void => {
    ctx.store.despawn(p.id);
    const cause = worldCause(null, 'neutral', p.pos, 'objective');
    if (p.pickup.type === 'keepsake') keepsakes.grant(h, 1);
    else if (p.pickup.type === 'crumb') {
      const status = CRUMB_STATUS[p.pickup.variant as CrumbType];
      if (status) giveStatus(ctx, h, status, cause);
    } else {
      ctx.effects.apply({ kind: 'heal', amount: h.stats.final.maxHealth * BERRY.healFraction, overS: BERRY.healS }, targetOf(h), cause);
      const i = berryOf.get(p.id);
      if (i !== undefined) at[i] = ctx.clock.tick + ticks(BERRY.respawnS);
      ctx.bus.emit({ type: 'objective', action: 'berryEaten', hero: h.id, team: h.team, pickup: p.id, pickupType: 'berry', pos: { ...p.pos } });
    }
  };

  return {
    update() {
      const now = ctx.clock.tick;
      for (const i of berries) {
        const t = at[i];
        if (t == null || now < t) continue;
        at[i] = null;
        const b = spawnPickup(ctx, 'berry', ctx.map.interactables![i]!.pos, PICKUPS.radius);
        berryOf.set(b.id, i);
      }
      if (live.length === 0) return;
      const heroes = ctx.store.list('hero');
      let k = 0;
      for (const p of live) {
        if (p.removed) {
          berryOf.delete(p.id);
          continue;
        }
        live[k++] = p;
        const reach = p.pickup.type === 'berry' ? PICKUPS.berryReachM : PICKUPS.reachM;
        for (const h of heroes) {
          const dy = p.pos.y - h.pos.y;
          if (h.health.dead || dy < -PICKUPS.below || dy > PICKUPS.above || flatDistSq(h.pos, p.pos) > reach * reach) continue;
          collect(p, h);
          break;
        }
      }
      live.length = k;
    },
    hash(h) {
      h.value(live.map((p) => p.id));
      h.value(berryOf);
    },
  };
}
