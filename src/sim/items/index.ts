import { ITEM_BUTTONS, type EntityId, type HeroEntity, type ItemDef, type ItemId, type OwnedItem, type SystemFactory } from '../core/contracts';
import { distSq, ticks, vec3 } from '../core/math';
import { DEW, ITEMS, SHOP } from '../data/items';
import { createSongItems } from './song';
import { createTriggers, itemCause } from './triggers';

const byId = new Map(ITEMS.map((item) => [item.id, item]));
const dewKey = 'items:dew-quiet';
const dewBonus = { stats: [{ stat: 'healthRegen', op: 'add', value: DEW.bonusRegen }] } as const;
const dewDelay = ticks(DEW.quietSeconds);
const refundWindow = ticks(SHOP.refundSeconds);

export const createItemSystem: SystemFactory = (ctx) => {
  ctx.itemCatalogue?.push(...ITEMS);
  const triggers = createTriggers(ctx);
  createSongItems(ctx);
  const lastHurt = new Map<EntityId, number>();
  const dewOwners = new Set<EntityId>();
  const cooldowns = new Map<EntityId, Map<ItemId, number>>();

  function equip(h: HeroEntity, item: ItemDef): void {
    ctx.stats.set(h.id, 'items:' + item.id, item.passive);
    triggers.equip(h, item);
    if (item.id === 'dew-drinker') dewOwners.add(h.id);
  }

  function unequip(h: HeroEntity, item: ItemDef, owned: OwnedItem): void {
    if (item.active) {
      // Record the current timer on removal so an ability's reset or refund survives a repurchase.
      const saved = cooldowns.get(h.id) ?? new Map<ItemId, number>();
      saved.set(item.id, owned.readyAt);
      cooldowns.set(h.id, saved);
    }
    ctx.stats.set(h.id, 'items:' + item.id, null);
    triggers.remove(h, item);
    if (item.id === 'dew-drinker') {
      dewOwners.delete(h.id);
      ctx.stats.set(h.id, dewKey, null);
    }
  }

  function bindActives(h: HeroEntity): void {
    const { items, actives } = h.inventory;
    let slot = 0;
    actives.fill(null);
    for (const owned of items) {
      if (byId.get(owned.item)?.active) actives[slot++] = owned.item;
      if (slot === actives.length) break;
    }
  }

  function shopZone(h: HeroEntity): number | null {
    if (h.health.dead) return null;
    for (const [index, shop] of ctx.map.shops.entries()) {
      if (h.team === shop.team && distSq(h.pos, shop.pos) <= shop.radius ** 2) return index;
    }
    return null;
  }

  function buy(h: HeroEntity, id: ItemId): void {
    const def = byId.get(id);
    const items = h.inventory.items;
    if (!def || items.some((owned) => owned.item === id)) return;
    const index = def.component === null ? -1 : items.findIndex((owned) => owned.item === def.component);
    if (index < 0 && items.length >= SHOP.baseSlots + ctx.teams[h.team].flexSlots) return;
    const component = index < 0 ? undefined : byId.get(items[index]!.item);
    const cost = def.cost - (component?.cost ?? 0);
    if (h.progress.seeds < cost) return;
    const owned: OwnedItem = { item: id, readyAt: cooldowns.get(h.id)?.get(id) ?? 0, fullRefundUntil: ctx.clock.tick + refundWindow };
    if (component) {
      unequip(h, component, items[index]!);
      items[index] = owned;
    } else items.push(owned);
    h.progress.seeds -= cost;
    equip(h, def);
    bindActives(h);
    ctx.bus.emit({ type: 'item.bought', hero: h.id, item: id, cost });
  }

  function sell(h: HeroEntity, id: ItemId): void {
    const def = byId.get(id);
    const items = h.inventory.items;
    const index = items.findIndex((owned) => owned.item === id);
    if (!def || index < 0) return;
    const owned = items[index]!;
    const refund = owned.fullRefundUntil !== undefined ? def.cost : Math.floor(def.cost * SHOP.resaleFraction);
    items.splice(index, 1);
    h.progress.seeds += refund;
    unequip(h, def, owned);
    bindActives(h);
    ctx.bus.emit({ type: 'item.sold', hero: h.id, item: id, refund });
  }

  function visit(h: HeroEntity): void {
    const zone = shopZone(h);
    const inv = h.inventory;
    for (const owned of inv.items) {
      if (owned.fullRefundUntil !== undefined && (inv.shopZone !== zone || zone === null || ctx.clock.tick > owned.fullRefundUntil)) {
        delete owned.fullRefundUntil;
      }
    }
    inv.shopZone = zone;
    if (zone === null) return;
    if (h.command.buy !== null) buy(h, h.command.buy);
    else if (h.command.sell !== null) sell(h, h.command.sell);
  }

  function activate(h: HeroEntity): void {
    const conditions = h.stats.conditions;
    if (!h.command.pressed || h.health.dead || conditions.has('stunned') || conditions.has('eggCarrier')) return;
    for (const [index, button] of ITEM_BUTTONS.entries()) {
      const id = h.inventory.actives[index];
      if (!id || !(h.command.pressed & button)) continue;
      const active = byId.get(id)?.active;
      const owned = h.inventory.items.find((i) => i.item === id);
      if (!active || !owned || owned.readyAt > ctx.clock.tick || (conditions.has('silenced') && !active.whileSilenced)) continue;
      owned.readyAt = ctx.clock.tick + ticks(active.cooldownS);
      ctx.effects.applyAll(active.effects, { entity: h.id, point: { ...h.pos }, dir: vec3() }, itemCause(h, id));
      ctx.bus.emit({ type: 'item.activated', hero: h.id, item: id });
    }
  }

  ctx.bus.on('entity.spawned', (e) => {
    if (e.kind !== 'hero') return;
    const h = ctx.store.getKind(e.id, 'hero');
    if (!h) return;
    h.inventory.shopZone = shopZone(h);
    for (const owned of h.inventory.items) {
      delete owned.fullRefundUntil;
      const item = byId.get(owned.item);
      if (item) equip(h, item);
    }
    bindActives(h);
  });
  ctx.bus.on('damage.applied', (e) => {
    if (e.targetKind !== 'hero' || e.amount <= e.absorbed) return;
    lastHurt.set(e.target, ctx.clock.tick);
    if (dewOwners.has(e.target)) ctx.stats.set(e.target, dewKey, null);
  });
  ctx.bus.on('entity.died', (e) => {
    const h = ctx.store.getKind(e.victim, 'hero');
    if (!h) return;
    h.inventory.shopZone = null;
    for (const owned of h.inventory.items) delete owned.fullRefundUntil;
  });

  return {
    name: 'items',
    phases: {
      abilities() {
        for (const h of ctx.store.list('hero')) activate(h);
        for (const id of dewOwners) {
          const h = ctx.store.getKind(id, 'hero');
          if (h && !h.stats.sources.has(dewKey) && ctx.clock.tick - (lastHurt.get(id) ?? 0) >= dewDelay) {
            ctx.stats.set(id, dewKey, dewBonus);
          }
        }
      },
      economy() {
        for (const h of ctx.store.list('hero')) visit(h);
        triggers.expire();
      },
    },
    hash(hash) {
      hash.value(triggers.state);
      hash.value(lastHurt);
      hash.value(cooldowns);
    },
  };
};
