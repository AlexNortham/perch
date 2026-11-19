/**
 * The Ability Upgrades panel (GDD §12.4): non-pausing, cursor-free. Hover or keyboard-focus a row to read the real
 * description and every tier; the Upgrade button submits exactly one upgrade per click through the ordinary command path.
 */
import type { SimView } from '../../sim/core/contracts';
import { AP_COSTS } from '../../sim/data/abilities';
import { HEROES } from '../../sim/heroes/registry';
import type { AppActions, Bindings } from '../app/contracts';
import { MAX_TIER } from './constants';
import { keyLabel } from './display';
import { attr, button, cell, el, flag, text } from './dom';
import { upgradeDisplay } from './model';

const SLOT_KEYS = ['ability1', 'ability2', 'ability3', 'ability4'] as const;

export interface UpgradePanel {
  readonly root: HTMLElement;
  open(): void;
  /** Hide it; with `release` the pointer goes back to the game (the close button), else the app already did it. */
  close(release?: boolean): void;
  isOpen(): boolean;
  setBindings(b: Bindings): void;
  update(view: SimView): void;
}

export function createUpgradePanel(actions: AppActions): UpgradePanel {
  const root = el('pu-upg');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Ability Upgrades');
  root.hidden = true;
  const head = el('pu-upg-head', 'div', root);
  el('', 'h3', head, 'Ability Upgrades');
  const apOut = el('pu-upg-ap', 'span', head);
  const setAp = text(apOut);
  const closeBtn = button('Close (Esc)', () => api.close(true), 'pu-btn pu-quiet');
  closeBtn.setAttribute('aria-label', 'Close Ability Upgrades');
  head.append(closeBtn);
  const hint = el('pu-upg-hint', 'p', root);
  const rowsBox = el('pu-upg-rows', 'div', root);

  let keys: Bindings | null = null;
  let built = '';
  let rows: Row[] = [];
  interface Row {
    readonly set: (v: ReturnType<typeof upgradeDisplay>, tick: number, key: string) => void;
  }

  const build = (view: SimView, heroId: string): void => {
    built = heroId + (keys?.upgradeModifier ?? '');
    rowsBox.replaceChildren();
    const h = view.heroes.find((x) => x.id === view.localHero);
    if (!h) return;
    const def = HEROES[h.heroId].def;
    rows = def.abilities.map((ability, i) => {
      const row = el('pu-urow', 'div', rowsBox);
      const descId = `pu-udesc-${i}`;
      const card = el('pu-ucard', 'button', row);
      card.type = 'button';
      card.setAttribute('aria-describedby', descId);
      const name = el('nm', 'b', card, ability.name);
      const key = el('key', 'kbd', card);
      const tiers = el('tiers', 'span', card);
      const pips = Array.from({ length: MAX_TIER }, () => el('', 'i', tiers));
      const desc = el('pu-udesc', 'div', row);
      desc.id = descId;
      el('', 'p', desc, ability.description);
      const list = el('', 'ul', desc);
      const items = ability.upgrades.map((u, t) => el('', 'li', list, `Tier ${t + 1} (${AP_COSTS[t] ?? '?'} AP): ${u.description}`));
      const status = el('stat', 'p', desc);
      const buy = el('pu-ubtn', 'button', row);
      buy.type = 'button';
      el('', 'span', buy, `Upgrade ${ability.name}`);
      const cost = el('cost', 'small', buy);
      const why = el('why', 'small', buy);
      buy.addEventListener('click', () => actions.submit({ upgrade: i }));
      const setTierPips = cell((t: number) => {
        pips.forEach((p, n) => p.classList.toggle('on', n < t));
        items.forEach((li, n) => {
          li.classList.toggle('done', n < t);
          li.classList.toggle('next', n === t);
        });
      });
      const setCost = text(cost);
      const setWhy = text(why);
      const setStatus = text(status);
      const setDisabled = cell((d: boolean) => {
        buy.disabled = d;
        buy.classList.toggle('off', d);
      });
      const setKey = text(key);
      void name;
      return {
        set(u, _tick, k) {
          setTierPips(u.tier);
          setCost(u.cost === null ? 'Maximum tier' : `Cost ${u.cost} AP`);
          setWhy(u.reason ?? 'Ready to upgrade');
          setStatus(u.maxed ? 'All tiers learned.' : `Tier ${u.tier} of ${MAX_TIER} learned. Next: tier ${u.tier + 1}.`);
          setDisabled(u.reason !== null);
          setKey(k);
        },
      };
    });
  };

  const api: UpgradePanel = {
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
    setBindings(b) {
      keys = b;
    },
    update(view) {
      if (root.hidden) return;
      const h = view.heroes.find((x) => x.id === view.localHero);
      if (!h) return;
      if (built !== h.heroId + (keys?.upgradeModifier ?? '')) build(view, h.heroId);
      setAp(`Unspent AP: ${h.ap}`);
      const mod = keys ? keyLabel(keys.upgradeModifier) : 'Alt';
      hintText(`Hover or focus an ability for its details. Hold ${mod} and press 1-4 to upgrade quickly. Esc or Close returns to the game.`);
      h.abilities.forEach((slot, i) => rows[i]?.set(upgradeDisplay(slot, i, h.ap, slot.nextUpgradeCost), view.tick, keys ? `${mod}+${keyLabel(keys[SLOT_KEYS[i] ?? 'ability1'])}` : ''));
    },
  };
  const hintText = text(hint);
  void attr;
  void flag;
  return api;
}
