// The Magpie's Hoard: overview and shop rules, then one page per category with a section per item. Items in the
// catalogue come from src/sim/data/items.ts; items still to come come from the GDD tables, marked "Coming in Stage N".
import type { ItemDef, StatModifier } from '../../src/sim/core/contracts';
import { ITEMS, SHOP, DEW } from '../../src/sim/data/items';
import { AP_COSTS } from '../../src/sim/data/abilities';
import { ITEMS_STAGE, catalogueIds, plannedItems } from './facts';
import type { PlannedItem } from './facts';
import { itemIcon } from './icons';
import { esc, num } from './lib';
import type { Ctx } from './generate';
import { rel } from './site';

type Category = 'talon' | 'plumage' | 'song';
const CATEGORIES: { id: Category; title: string; blurb: string }[] = [
  { id: 'talon', title: 'Talon', blurb: 'Gun power: damage, fire rate, magazine and reload.' },
  { id: 'plumage', title: 'Plumage', blurb: 'Vitality: health, resists, regeneration and movement.' },
  { id: 'song', title: 'Song', blurb: 'Ability power: Song power, cooldowns, range and ability effects.' },
];
const TIER_NAME = ['', 'Tier 1', 'Tier 2', 'Tier 3', 'Tier 4'];
const STAT_LABEL: Record<string, string> = {
  magazine: 'magazine size', gunDamage: 'gun damage', closeGunDamage: 'gun damage within 15 m', beakShotFlat: 'beak-shot Talon damage', fireRate: 'fire rate',
  reloadSpeed: 'reload speed', maxHealth: 'max HP', talonResist: 'Talon resist', songResist: 'Song resist', healthRegen: 'HP/s', sprintSpeed: 'm/s sprint speed',
  staminaRecharge: 'stamina regeneration', healAmp: 'healing received', songPower: 'Song power', cooldownReduction: 'cooldown reduction', abilityRange: 'ability range',
  songShred: 'Song resist shred',
};
const TARGETING: Record<string, string> = { self: 'self', direction: 'aimed', unit: 'locks the unit nearest the crosshair', point: 'placed at the aim point' };

function statLine(m: StatModifier): string {
  const label = STAT_LABEL[m.stat] ?? m.stat;
  if (m.op === 'mul') return `×${num(m.value, 3)} ${label}`;
  const asPct = m.op === 'pct' || m.stat.endsWith('Resist') || ['gunDamage', 'closeGunDamage', 'fireRate', 'reloadSpeed', 'healAmp', 'cooldownReduction', 'abilityRange', 'songShred'].includes(m.stat);
  return asPct ? `+${num(m.value * 100, 1)}% ${label}` : `+${num(m.value)} ${label}`;
}

export const itemIconFile = (id: string): string => `img/item-${id}.svg`;
const itemAnchor = (id: string): string => `item-${id}`;

export function registerItems(ctx: Ctx, extra: Map<string, string>): void {
  const planned = plannedItems().filter((p) => !catalogueIds.has(p.id));
  const byId = new Map(ITEMS.map((i) => [i.id, i]));
  const plannedById = new Map(plannedItems().map((p) => [p.id, p]));
  const nameOf = (id: string): string => byId.get(id)?.name ?? plannedById.get(id)?.name ?? id;
  const icon = (id: string, cat: Category, tier: number): string => {
    extra.set(itemIconFile(id), itemIcon(id, cat, tier));
    return `<img src="${rel(ctx.here, itemIconFile(id))}" alt="${esc(nameOf(id))} icon: ${cat} item, tier ${tier}" width="64" height="64" loading="lazy">`;
  };
  const refLink = (id: string): string => {
    const it = byId.get(id);
    const p = plannedById.get(id);
    const cat = it?.category ?? p?.category;
    return cat ? ctx.link(`items/${cat}#${itemAnchor(id)}`, nameOf(id)) : esc(id);
  };

  const builtCard = (i: ItemDef): string => {
    const into = ITEMS.filter((x) => x.component === i.id);
    const comp = i.component ? byId.get(i.component) : undefined;
    const stats = (i.passive.stats ?? []).map((s) => `<li>${esc(statLine(s))}</li>`).join('');
    const procs = i.procs.length > 0 ? `<p><strong>Trigger:</strong> ${esc(i.procs.map((p) => `on ${p.on}${p.heroesOnly ? ' (heroes only)' : ''}`).join(', '))}.</p>` : '';
    const active = i.active ? `<p><strong>Active:</strong> cooldown ${num(i.active.cooldownS)} s, ${TARGETING[i.active.targeting] ?? i.active.targeting}${i.active.range > 0 ? `, range ${num(i.active.range)} m` : ''}. Bound to the first free item key (Z, X, N or V).</p>` : '';
    const chain = [comp ? `Upgrades from ${refLink(comp.id)} (pay ${num(i.cost - comp.cost)} Seeds with it in hand)` : '', into.length ? `Upgrades into ${into.map((x) => refLink(x.id)).join(', ')}` : ''].filter(Boolean).join('. ');
    return `<section class="item tier-${i.tier}" id="${itemAnchor(i.id)}">${icon(i.id, i.category, i.tier)}<div><h4>${esc(i.name)} <span class="badge stage">${TIER_NAME[i.tier]}</span> <span class="badge live">In the shop</span></h4>
<p>${esc(i.description)}</p><p><strong>Cost:</strong> ${num(i.cost)} Seeds · <strong>Sells for:</strong> ${num(i.cost * SHOP.resaleFraction)} Seeds (full ${num(i.cost)} within ${SHOP.refundSeconds} s).</p>
<ul>${stats}</ul>${procs}${active}${chain ? `<p>${chain}.</p>` : ''}</div></section>`;
  };
  const plannedCard = (p: PlannedItem): string => {
    const comp = p.from ? `Upgrades from ${refLink(p.from)}.` : '';
    return `<section class="item tier-${p.tier}" id="${itemAnchor(p.id)}">${icon(p.id, p.category, p.tier)}<div><h4>${esc(p.name)} <span class="badge stage">${TIER_NAME[p.tier] ?? ''}</span> <span class="badge soon">Coming in Stage ${ITEMS_STAGE}</span></h4>
<p>${esc(p.effect)}</p>${p.active ? `<p><strong>Active:</strong> ${esc(p.active)}</p>` : ''}<p><strong>Planned cost:</strong> ${esc(p.cost)} Seeds. ${comp}</p></div></section>`;
  };

  ctx.add({
    path: 'items/index.html', title: "The Magpie's Hoard", section: "The Magpie's Hoard",
    description: 'The shop: categories, tiers, buying, selling, refunds and flex slots.', keywords: 'shop items hoard buy sell refund slots flex magpie stall',
    body: () => {
      const tierRows = [1, 2, 3, 4].map((t) => {
        const inShop = ITEMS.filter((i) => i.tier === t);
        const first = inShop[0];
        return `<tr><td>${TIER_NAME[t]}</td><td class="num">${first ? num(first.cost) : '-'}</td><td class="num">${inShop.length}</td></tr>`;
      }).join('');
      const cats = CATEGORIES.map((c) => `<tr><td>${ctx.link(`items/${c.id}`, c.title)}</td><td>${esc(c.blurb)}</td><td class="num">${ITEMS.filter((i) => i.category === c.id).length}</td></tr>`).join('');
      const all = [...ITEMS.map((i) => ({ id: i.id, cat: i.category, tier: i.tier })), ...planned.map((p) => ({ id: p.id, cat: p.category, tier: p.tier }))];
      return `<h1>The Magpie's Hoard</h1><p class="lead">The Hoard is the shop. Seeds you have not spent buy items from three columns, Talon, Plumage and Song, across four tiers. All ${ITEMS.length} items are in the shop: ${CATEGORIES.map((c) => `${ITEMS.filter((i) => i.category === c.id).length} ${c.title}`).join(", ")}.</p>
${ctx.figure('ui:shop', 'The Hoard open at a Magpie stall. Left click buys, right click sells.')}
<h2>Categories</h2><div class="table-wrap"><table><thead><tr><th>Column</th><th>What it does</th><th class="num">Items</th></tr></thead><tbody>${cats}</tbody></table></div>
<h2>Tiers and prices</h2><div class="table-wrap"><table><thead><tr><th>Tier</th><th class="num">Price (Seeds)</th><th class="num">Items</th></tr></thead><tbody>${tierRows}</tbody></table></div>
${ctx.md(ctx.prose('hoard').body)}
<ul>
<li><strong>Slots:</strong> ${SHOP.baseSlots} base slots hold any category, each item once. Four more flex slots unlock for your whole flock from objectives; see ${ctx.link('mechanics/economy#flex-slots', 'flex slots')}.</li>
<li><strong>Selling:</strong> you get back ${num(SHOP.resaleFraction * 100)}% of the full price, or all of it if you sell within ${SHOP.refundSeconds} s of buying during the same shop visit.</li>
<li><strong>Upgrades:</strong> buying an item whose component you own costs only the difference, and replaces the component in its slot.</li>
<li><strong>Dew Drinker style regeneration:</strong> some items add health regeneration that rises by ${num(DEW.bonusRegen)} HP/s after ${DEW.quietSeconds} s without taking damage.</li>
<li><strong>Ability upgrades are separate:</strong> they cost Ability Points (${AP_COSTS.join(', ')} AP per tier), not Seeds. See ${ctx.link('mechanics/economy#ability-points', 'Ability Points')}.</li>
</ul>
<h2>Every item</h2><div class="gallery-icons" style="display:flex;flex-wrap:wrap;gap:.5rem">${all.map((i) => `<a href="${rel(ctx.here, `items/${i.cat}.html`)}#${itemAnchor(i.id)}" title="${esc(nameOf(i.id))}">${icon(i.id, i.cat, i.tier)}</a>`).join('')}</div>`;
    },
  });

  for (const c of CATEGORIES) {
    ctx.add({
      path: `items/${c.id}.html`, title: `${c.title} items`, section: "The Magpie's Hoard", parent: 'items/index.html', description: `${c.title} column of the Magpie's Hoard.`,
      keywords: `${c.title} ${[...ITEMS, ...planned].filter((i) => i.category === c.id).map((i) => i.name).join(' ')}`,
      body: () => {
        const tiers = [1, 2, 3, 4].map((t) => {
          const have = ITEMS.filter((i) => i.category === c.id && i.tier === t);
          const soon = planned.filter((p) => p.category === c.id && p.tier === t);
          return `<h2 id="tier-${t}">${TIER_NAME[t]}</h2>${have.map(builtCard).join('')}${soon.map(plannedCard).join('')}`;
        }).join('');
        const table = ITEMS.filter((i) => i.category === c.id).map((i) => `<tr><td>${icon(i.id, i.category, i.tier)}</td><td><a href="#${itemAnchor(i.id)}">${esc(i.name)}</a></td><td>${TIER_NAME[i.tier]}</td><td class="num">${num(i.cost)}</td><td>${esc(i.description)}</td></tr>`).join('');
        return `<h1>${c.title} items</h1><p class="lead">${esc(c.blurb)}</p>
<h2>In the shop now</h2><div class="table-wrap"><table><thead><tr><th></th><th>Item</th><th>Tier</th><th class="num">Cost</th><th>Effect</th></tr></thead><tbody>${table}</tbody></table></div>${tiers}`;
      },
    });
  }
  void ITEMS_STAGE;
}
