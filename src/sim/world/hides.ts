/**
 * Hides (GDD §7.15): a hero wholly inside a bird hide (`Room.tag 'hide'`) has the `hidden` condition and stamina
 * regenerates 100% faster; it regains 3 HP/s + 0.25% of max HP per second. Vision folds `hidden` into `seenBy`
 * (vision.ts): enemies outside can't see it unless it dealt damage or applied a status to an enemy in the last 2 s,
 * an enemy hero stands in the same Hide, or true sight covers it.
 */
import type { EntityId, Hasher, HeroEntity, SimContext, Tick } from '../core/contracts';
import { ticks } from '../core/math';
import { INTERACTABLES } from '../data/world';
import { creditedHero, frameOf, inBox, targetOf, worldCause } from './neutral';
import type { BoxFrame } from './neutral';

const HIDE = INTERACTABLES.hide;
const SOURCE = 'world:hide';

export interface Hides {
  /** Index into MapData.rooms of the Hide the hero is hidden in, or −1. */
  hiddenIn(id: EntityId): number;
  /** Index of the Hide whose floor the hero stands on (wholly inside or not), or −1. */
  presentIn(h: HeroEntity): number;
  /** Dealt damage or applied a status to an enemy within the last 2 s. */
  exposed(id: EntityId): boolean;
  update(): void;
  hash(h: Hasher): void;
}

export function createHides(ctx: SimContext): Hides {
  const rooms: { readonly index: number; readonly f: BoxFrame }[] = (ctx.map.rooms ?? []).flatMap((r, index) =>
    r.tag === 'hide' ? [{ index, f: frameOf(r.volume) }] : []);
  const hidden = new Map<EntityId, number>();
  const hostileAt = new Map<EntityId, Tick>();
  const show = ticks(HIDE.showS);
  const every = ticks(HIDE.tickS);

  const roomAt = (h: HeroEntity, inset: number): number => {
    for (const r of rooms) if (inBox(r.f, h.pos, inset)) return r.index;
    return -1;
  };

  const hostile = (source: EntityId | null, target: EntityId): void => {
    const by = creditedHero(ctx, source);
    const victim = ctx.store.get(target);
    if (by && victim && victim.team !== 'neutral' && victim.team !== by.team) hostileAt.set(by.id, ctx.clock.tick);
  };
  if (rooms.length > 0) {
    ctx.bus.on('damage.applied', (ev) => hostile(ev.source, ev.target));
    ctx.bus.on('status.applied', (ev) => hostile(ev.source, ev.target));
  }

  return {
    hiddenIn: (id) => hidden.get(id) ?? -1,
    presentIn: (h) => roomAt(h, 0),
    exposed: (id) => ctx.clock.tick - (hostileAt.get(id) ?? -Infinity) <= show,
    update() {
      if (rooms.length === 0) return;
      const now = ctx.clock.tick;
      for (const h of ctx.store.list('hero')) {
        const room = h.health.dead ? -1 : roomAt(h, HIDE.insetM);
        if (room !== (hidden.get(h.id) ?? -1)) {
          if (room < 0) hidden.delete(h.id);
          else hidden.set(h.id, room);
          ctx.stats.set(h.id, SOURCE, room < 0 ? null : { conditions: ['hidden'],
            stats: [{ stat: 'staminaRecharge', op: 'mul', value: HIDE.staminaRecharge }] });
        }
        const max = h.stats.final.maxHealth;
        if (room >= 0 && now % every === 0 && h.health.hp < max) {
          ctx.effects.apply({ kind: 'heal', amount: (HIDE.regen + HIDE.regenMaxHp * max) * HIDE.tickS }, targetOf(h),
            worldCause(null, 'neutral', h.pos, 'objective'));
        }
      }
    },
    hash(h) {
      h.value(hidden);
      h.value(hostileAt);
    },
  };
}
