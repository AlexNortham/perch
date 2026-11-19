/**
 * The Magpie's Hoard (GDD §12.6): three category columns, four tiers, live prices, wallet, zone, same-visit refunds,
 * inventory and flex slots. It only submits ordinary buy/sell intents; the Items system validates them again.
 * Browsing works anywhere (read-only away from a stall) and the sim keeps running behind it.
 */
import type { ItemCategory, ItemDef, SimView } from '../../sim/core/contracts';
import type { AppActions } from '../app/contracts';
import { BASE_ITEM_SLOTS, ITEM_CATEGORY_CSS, MAX_FLEX_SLOTS } from './constants';
import { button, el, text } from './dom';
import { quoteItem, refundSeconds } from './model';

const CATEGORIES: readonly { id: ItemCategory; label: string }[] = [
  { id: 'talon', label: 'Talon' },
  { id: 'plumage', label: 'Plumage' },
  { id: 'song', label: 'Song' },
];
const FLEX_UNLOCKS = ['first enemy Hawk', 'second enemy Hawk', 'first enemy Heron', 'first enemy Shrine'] as const;

export interface Shop {
  readonly root: HTMLElement;
  open(): void;
  close(release?: boolean): void;
  isOpen(): boolean;
  setCatalogue(items: readonly ItemDef[]): void;
  update(view: SimView): void;
}

export function createShop(actions: AppActions): Shop {
  const root = el('pu-shop');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', "Magpie's Hoard");
  root.hidden = true;
  const head = el('pu-shop-head', 'div', root);
  el('', 'h2', head, "The Magpie's Hoard");
  const wallet = el('pu-shop-wallet', 'span', head);
  const banner = el('pu-shop-banner', 'div', root);
  const body = el('pu-shop-body', 'div', root);
  const cols = el('pu-shop-cols', 'div', body);
  const side = el('pu-shop-side', 'div', body);
  const tip = el('pu-shop-tip', 'div', side);
  const invTitle = el('', 'h3', side);
  const slotsBox = el('pu-shop-slots', 'div', side);
  head.append(button('Close (B)', () => api.close(true), 'pu-btn pu-quiet'));

  let catalogue: readonly ItemDef[] = [];
  let hovered: string | null = null;
  let last: SimView | null = null;
  let lastTip = '';
  let lastSlots = '';
  const cards = new Map<string, { card: HTMLButtonElement; price: HTMLElement; tag: HTMLElement }>();

  const buildCards = (): void => {
    cols.replaceChildren();
    cards.clear();
    if (catalogue.length === 0) el('pu-shop-empty', 'p', cols, 'The Hoard is empty.');
    for (const cat of CATEGORIES) {
      const col = el('pu-shop-col', 'div', cols);
      col.style.setProperty('--cat', ITEM_CATEGORY_CSS[cat.id]);
      el('', 'h3', col, cat.label);
      for (const def of catalogue.filter((d) => d.category === cat.id).sort((a, b) => a.tier - b.tier || a.cost - b.cost)) {
        const card = el('pu-item', 'button', col);
        card.type = 'button';
        card.dataset['item'] = def.id;
        el('tier', 'small', card, `Tier ${def.tier}`);
        el('nm', 'b', card, def.name);
        const price = el('price', 'span', card);
        const tag = el('tag', 'em', card);
        card.addEventListener('click', () => {
          const q = last && quote(def, last);
          if (q?.canBuy) actions.submit({ buy: def.id });
        });
        card.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          if (last && quote(def, last).owned) actions.submit({ sell: def.id });
        });
        const show = (): void => void (hovered = def.id);
        card.addEventListener('mouseenter', show);
        card.addEventListener('focus', show);
        cards.set(def.id, { card, price, tag });
      }
    }
  };

  const quote = (def: ItemDef, view: SimView) => {
    const me = view.heroes.find((h) => h.id === view.localHero);
    const team = me?.team ?? 'dawn';
    return quoteItem(def, catalogue, me ?? { seeds: 0, shopZone: null, items: [] }, view.tick, view.teams[team].flexSlots);
  };

  const tipText = (def: ItemDef, view: SimView): string[] => {
    const q = quote(def, view);
    const lines = [def.name, `${def.category} tier ${def.tier}: ${q.net.toLocaleString('en-GB')} Seeds${q.linked ? ` (component credited, list ${def.cost.toLocaleString('en-GB')})` : ''}`, def.description];
    if (def.active) lines.push(`Active: ${def.active.cooldownS} s cooldown, range ${def.active.range} m.`);
    const comp = def.component && catalogue.find((c) => c.id === def.component);
    if (comp) lines.push(`Upgrades from ${comp.name}.`);
    const into = catalogue.filter((c) => c.component === def.id).map((c) => c.name);
    if (into.length) lines.push(`Upgrades into ${into.join(', ')}.`);
    if (q.owned) lines.push(`Right click to sell for ${q.refund.toLocaleString('en-GB')} Seeds${q.fullRefund ? ' (full refund this visit)' : ''}.`);
    else if (q.reason) lines.push(q.reason);
    return lines;
  };

  const api: Shop = {
    root,
    open() {
      root.hidden = false;
    },
    close(release = false) {
      if (root.hidden) return;
      root.hidden = true;
      if (release) actions.capturePointer(false);
    },
    isOpen: () => !root.hidden,
    setCatalogue(items) {
      catalogue = items;
      buildCards();
    },
    update(view) {
      last = view;
      if (root.hidden) return;
      const me = view.heroes.find((h) => h.id === view.localHero);
      if (!me) return;
      const team = view.teams[me.team];
      wallet.textContent = `Wallet ${me.seeds.toLocaleString('en-GB')} Seeds   Net worth ${me.netWorth.toLocaleString('en-GB')}`;
      const inZone = me.shopZone !== null && me.shopZone !== undefined;
      banner.textContent = inZone ? 'In a shop zone: left click buys, right click sells.' : 'Visit a Magpie stall or your Home Roost to trade';
      banner.classList.toggle('away', !inZone);
      for (const def of catalogue) {
        const c = cards.get(def.id);
        if (!c) continue;
        const q = quote(def, view);
        c.price.textContent = `${q.net.toLocaleString('en-GB')}${q.linked ? ' (linked)' : ''}`;
        c.price.classList.toggle('poor', !q.owned && me.seeds < q.net);
        c.tag.textContent = q.owned ? 'Owned' : q.canBuy ? 'Buy' : '';
        c.card.classList.toggle('owned', q.owned);
        c.card.classList.toggle('off', !q.owned && !q.canBuy);
        c.card.setAttribute('aria-disabled', String(!q.owned && !q.canBuy));
        c.card.title = tipText(def, view).join('\n');
      }
      const def = catalogue.find((d) => d.id === hovered);
      const lines = def ? tipText(def, view) : ['Hover or focus an item for its details.'];
      const tipSig = lines.join('|');
      if (tipSig !== lastTip) {
        lastTip = tipSig;
        tip.replaceChildren(...lines.map((l, i) => el(i === 0 ? 'hd' : '', 'p', undefined, l)));
      }
      invTitle.textContent = `Inventory ${me.items.length} / ${BASE_ITEM_SLOTS + team.flexSlots}`;
      const sig = `${team.flexSlots}|${me.items.map((o) => `${o.item}:${refundSeconds(o.fullRefundUntil, view.tick)}`).join(',')}`;
      if (sig === lastSlots) return;
      lastSlots = sig;
      slotsBox.replaceChildren();
      for (let i = 0; i < BASE_ITEM_SLOTS + MAX_FLEX_SLOTS; i++) {
        const flex = i >= BASE_ITEM_SLOTS;
        const locked = flex && i - BASE_ITEM_SLOTS >= team.flexSlots;
        const owned = me.items[i];
        const s = el(`slot${locked ? ' lock' : ''}${flex ? ' flex' : ''}`, 'div', slotsBox);
        if (owned) {
          const d = catalogue.find((x) => x.id === owned.item);
          s.textContent = d?.name ?? owned.item;
          s.title = `Right click to sell for ${d ? quote(d, view).refund.toLocaleString('en-GB') : '?'} Seeds`;
          const secs = refundSeconds(owned.fullRefundUntil, view.tick);
          if (secs > 0) el('', 'small', s, `full refund ${secs}s`);
          s.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            actions.submit({ sell: owned.item });
          });
        } else s.textContent = locked ? `Unlocks: ${FLEX_UNLOCKS[i - BASE_ITEM_SLOTS]}` : flex ? 'Flex slot' : '';
      }
    },
  };
  void text;
  return api;
}
