import { ITEM_BUTTONS, type EntityId, type HeroEntity, type ItemDef, type ItemId, type OwnedItem, type SystemFactory } from '../core/contracts';
import { distSq, ticks, vec3 } from '../core/math';
import { INTANGIBLE } from '../data/combat';
import { CLUTCH, DEW, DEW_BONUS, ITEMS, ITEM_SHIELDS, SHOP } from '../data/items';
import { createRiders } from './riders';
import { createTargeting } from './targeting';
import { createSongItems } from './song';
import { createTriggers, itemCause } from './triggers';

const byId = new Map(ITEMS.map((item) => [item.id, item]));
const dewKey = 'items:dew-quiet';
// Second Clutch's ward: a status whose onLethal saves the holder; the engine re-arms it after its cooldown.
const CLUTCH_STATUS = { id: CLUTCH.id, name: 'Second Clutch', negative: false, stacking: 'max', maxStacks: 1, durationS: 86_400,
  onLethal: [{ kind: 'applyStatus', status: INTANGIBLE, durationS: CLUTCH.intangibleS }] } as const;
const clutchTicks = ticks(CLUTCH.cooldownS);
const MAX_ACTIVES = 4;
const dewDelay = ticks(DEW.quietSeconds);
const refundWindow = ticks(SHOP.refundSeconds);

export const createItemSystem: SystemFactory = (ctx) => {
  ctx.itemCatalogue?.push(...ITEMS);
  const triggers = createTriggers(ctx);
  createSongItems(ctx);
  createRiders(ctx);
  const pick = createTargeting(ctx);
  const lastHurt = new Map<EntityId, number>();
  const dewOwners = new Map<EntityId, number>();
  const granted = new Map<EntityId, number>();
  const auras = new Map<EntityId, Map<ItemId, EntityId>>();
  const armed = new Set<EntityId>();
  const clutchReady = new Map<EntityId, number>();
  let spawnedAreas: EntityId[] | null = null;
  const cooldowns = new Map<EntityId, Map<ItemId, number>>();

  function equip(h: HeroEntity, item: ItemDef): void {
    ctx.stats.set(h.id, 'items:' + item.id, item.passive);
    triggers.equip(h, item);
    const dew = DEW_BONUS[item.id];
    if (dew !== undefined) dewOwners.set(h.id, dew);
    grant(h, item);
  }

  /** What an owned item gives that stats can't: its shield and aura. Called on purchase and respawn. */
  function grant(h: HeroEntity, item: ItemDef): void {
    const shield = ITEM_SHIELDS[item.id];
    const have = granted.get(h.id) ?? 0;
    if (shield && shield.amount > have) {
      ctx.effects.apply({ kind: 'shield', absorbs: shield.absorbs, amount: shield.amount - have, rechargeS: shield.rechargeS },
        { entity: h.id, point: { ...h.pos }, dir: vec3() }, itemCause(h, item.id));
      granted.set(h.id, shield.amount);
    }
    const mine = auras.get(h.id);
    if (item.aura && !mine?.has(item.id) && !h.health.dead) {
      spawnedAreas = [];
      ctx.effects.apply(item.aura, { entity: h.id, point: { ...h.pos }, dir: vec3() }, itemCause(h, item.id));
      const id = spawnedAreas[0];
      spawnedAreas = null;
      if (id !== undefined) auras.set(h.id, (mine ?? new Map()).set(item.id, id));
    }
  }

  function endAura(h: HeroEntity, id: ItemId): void {
    const area = auras.get(h.id)?.get(id);
    if (area !== undefined) ctx.store.despawn(area);
    auras.get(h.id)?.delete(id);
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
    if (DEW_BONUS[item.id] !== undefined) {
      dewOwners.delete(h.id);
      ctx.stats.set(h.id, dewKey, null);
    }
    if (item.aura) endAura(h, item.id);
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
      if ((h.team === shop.team || shop.neutral) && distSq(h.pos, shop.pos) <= shop.radius ** 2) return index;
    }
    return null;
  }

  function buy(h: HeroEntity, id: ItemId): void {
    const def = byId.get(id);
    const items = h.inventory.items;
    if (!def || items.some((owned) => owned.item === id)) return;
    const index = def.component === null ? -1 : items.findIndex((owned) => owned.item === def.component);
    const component0 = index < 0 ? undefined : items[index];
    const owns = (i: OwnedItem) => byId.get(i.item)?.active;
    // At most four actives (§8.7); an upgrade that replaces an active keeps the count.
    if (def.active && !(component0 && byId.get(component0.item)?.active) && items.filter(owns).length >= MAX_ACTIVES) return;
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

  /** Second Clutch: keep the ward armed; when it has been spent, heal to 25% and start the cooldown. */
  function clutch(h: HeroEntity): void {
    if (h.health.dead) return;
    const owns = h.inventory.items.some((o) => o.item === CLUTCH.id);
    const has = h.statuses.some((s) => s.def.id === CLUTCH.id);
    if (!owns) {
      if (has) ctx.effects.apply({ kind: 'cleanse', remove: [CLUTCH.id] }, { entity: h.id, point: { ...h.pos }, dir: vec3() }, itemCause(h, CLUTCH.id));
      armed.delete(h.id);
      return;
    }
    if (has) return;
    const target = { entity: h.id, point: { ...h.pos }, dir: vec3() };
    if (armed.delete(h.id)) {
      clutchReady.set(h.id, ctx.clock.tick + clutchTicks);
      ctx.effects.apply({ kind: 'heal', amount: Math.max(0, h.stats.final.maxHealth * CLUTCH.healFraction - h.health.hp) }, target, itemCause(h, CLUTCH.id));
    } else if (ctx.clock.tick >= (clutchReady.get(h.id) ?? 0)) {
      ctx.effects.apply({ kind: 'applyStatus', status: CLUTCH_STATUS, durationS: CLUTCH_STATUS.durationS }, target, itemCause(h, CLUTCH.id));
      armed.add(h.id);
    }
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
      const target = pick(h, active);
      if (!target) continue;
      owned.readyAt = ctx.clock.tick + ticks(active.cooldownS);
      ctx.effects.applyAll(active.effects, target, itemCause(h, id));
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
  ctx.bus.on('entity.spawned', (e) => { if (e.kind === 'area') spawnedAreas?.push(e.id); });
  ctx.bus.on('hero.respawned', (e) => {
    const h = ctx.store.getKind(e.hero, 'hero');
    if (!h) return;
    granted.delete(h.id);
    for (const owned of h.inventory.items) {
      const item = byId.get(owned.item);
      if (item) grant(h, item);
    }
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
    granted.delete(h.id);
    auras.delete(h.id);
    armed.delete(h.id);
    for (const owned of h.inventory.items) delete owned.fullRefundUntil;
  });

  return {
    name: 'items',
    phases: {
      abilities() {
        for (const h of ctx.store.list('hero')) activate(h);
        for (const [id, bonus] of dewOwners) {
          const h = ctx.store.getKind(id, 'hero');
          if (h && !h.stats.sources.has(dewKey) && ctx.clock.tick - (lastHurt.get(id) ?? 0) >= dewDelay) {
            ctx.stats.set(id, dewKey, { stats: [{ stat: 'healthRegen', op: 'add', value: bonus }] });
          }
        }
      },
      economy() {
        for (const h of ctx.store.list('hero')) {
          visit(h);
          clutch(h);
        }
        triggers.expire();
      },
    },
    hash(hash) {
      hash.value(triggers.state);
      hash.value(lastHurt);
      hash.value(cooldowns);
      hash.value(clutchReady);
      hash.value(armed);
      hash.value(granted);
      hash.value(auras);
    },
  };
};
