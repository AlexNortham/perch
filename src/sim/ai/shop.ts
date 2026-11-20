/**
 * Bot buying and AP (GDD §11.4, D-EP-036, INTERFACES §14.1). Pure functions of the hero, the catalogue and a seeded
 * stream, so the Build Lab and the tests can call them directly.
 *   score(item) = base[item] + Σ synergy[o][item] over owned items o (and their components) + phase[item][phase]
 *                 + SHOP.situational when the item is a situational pick whose condition holds
 * The next purchase is drawn from softmax(score / T) over affordable, buyable candidates (the items the scores list),
 * or uniformly with `random`. With every slot full a bot only trades up: it sells its lowest-scoring item that isn't
 * a component of the purchase, for a higher-tier item scoring at least SHOP.replaceMargin more, so it never churns.
 */
import type { GamePhase, HeroEntity, ItemDef, ItemId, ItemScores, Rng } from '../core/contracts';
import { GAME_PHASES } from '../core/contracts';
import { AP_COSTS } from '../data/abilities';
import { SHOP } from '../data/ai';
import { SHOP as STORE } from '../data/items';

export interface ShopPolicy {
  /** null with `random`. */
  readonly scores: ItemScores | null;
  readonly temperature: number;
  readonly random: boolean;
  /** Situational picks whose condition holds for this bot's match. */
  readonly situational: ReadonlySet<ItemId>;
}

export interface Purchase {
  readonly buy: ItemId;
  /** Sell this first (every slot full). */
  readonly sell: ItemId | null;
}

export function phaseOf(seconds: number, phases: { readonly midFromS: number; readonly lateFromS: number }): GamePhase {
  return GAME_PHASES[seconds < phases.midFromS ? 0 : seconds < phases.lateFromS ? 1 : 2]!;
}

/** Owned items plus every component down their upgrade chains ("owning an item's component counts", §14.1). */
export function ownedWithChains(owned: readonly ItemId[], catalogue: ReadonlyMap<ItemId, ItemDef>): Set<ItemId> {
  const out = new Set<ItemId>();
  for (const id of owned) {
    for (let c: ItemId | null | undefined = id; c && !out.has(c); c = catalogue.get(c)?.component) out.add(c);
  }
  return out;
}

export function itemScore(scores: ItemScores, item: ItemId, owned: ReadonlySet<ItemId>, phase: GamePhase, situational: ReadonlySet<ItemId>): number {
  let s = scores.base[item] ?? 0;
  for (const o of owned) s += scores.synergy[o]?.[item] ?? 0;
  s += scores.phase[item]?.[GAME_PHASES.indexOf(phase)] ?? 0;
  return situational.has(item) ? s + SHOP.situational : s;
}

/**
 * e^x from + and × only (range reduction by ln 2, then the Taylor series): the same bits on every engine, which
 * Math.exp doesn't promise (D-ARCH-021).
 */
export function exp(x: number): number {
  if (x === 0) return 1;
  const k = Math.round(x / Math.LN2);
  const r = x - k * Math.LN2;
  let term = 1;
  let sum = 1;
  for (let n = 1; Math.abs(term) > Number.EPSILON * sum; n++) {
    term = (term * r) / n;
    sum += term;
  }
  const half = k < 0;
  for (let i = 0; i < Math.abs(k); i++) sum = half ? sum / 2 : sum * 2;
  return sum;
}

/** Index drawn from softmax(logits / temperature); temperature 0 takes the first best. */
export function softmaxPick(logits: readonly number[], temperature: number, rng: Rng): number {
  let best = 0;
  for (let i = 1; i < logits.length; i++) if (logits[i]! > logits[best]!) best = i;
  if (temperature <= 0) return best;
  const top = logits[best]!;
  const weights = logits.map((l) => exp((l - top) / temperature));
  let u = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) {
    u -= weights[i]!;
    if (u < 0) return i;
  }
  return best;
}

/**
 * The next purchase for `h` with `slots` item slots, or null when nothing is affordable and buyable. Draws once from
 * `rng` when there is a choice to make.
 */
export function choosePurchase(
  h: HeroEntity,
  catalogue: ReadonlyMap<ItemId, ItemDef>,
  policy: ShopPolicy,
  phase: GamePhase,
  slots: number,
  rng: Rng,
): Purchase | null {
  const items = h.inventory.items;
  const ownedIds = items.map((o) => o.item);
  const chains = ownedWithChains(ownedIds, catalogue);
  const actives = ownedIds.filter((id) => catalogue.get(id)?.active).length;
  const full = items.length >= slots;
  const score = (id: ItemId): number => (policy.scores ? itemScore(policy.scores, id, chains, phase, policy.situational) : 0);
  // With every slot full: the lowest-scoring owned item (the first on a tie), and what selling it returns.
  let worst: ItemId | null = null;
  if (full) {
    for (const id of ownedIds) if (worst === null || score(id) < score(worst)) worst = id;
  }
  const worstDef = worst === null ? undefined : catalogue.get(worst);
  const pool = policy.random || !policy.scores ? [...catalogue.keys()] : Object.keys(policy.scores.base);
  const ids: ItemId[] = [];
  for (const id of pool) {
    const def = catalogue.get(id);
    if (!def || chains.has(id)) continue;
    const upgrade = def.component !== null && ownedIds.includes(def.component);
    const cost = def.cost - (upgrade ? (catalogue.get(def.component!)?.cost ?? 0) : 0);
    const replacesActive = upgrade && catalogue.get(def.component!)?.active;
    if (def.active && !replacesActive && actives >= SHOP.maxActives) continue;
    if (upgrade || !full) {
      if (cost <= h.progress.seeds) ids.push(id);
      continue;
    }
    // Trading up into a full inventory (never for the random baseline, which only fills slots).
    if (policy.random || !worstDef || def.tier <= worstDef.tier || score(id) < score(worst!) + SHOP.replaceMargin) continue;
    if (def.component === worst) continue;
    if (cost <= h.progress.seeds + Math.floor(worstDef.cost * STORE.resaleFraction)) ids.push(id);
  }
  if (ids.length === 0) return null;
  const buy = policy.random ? rng.pick(ids) : ids[softmaxPick(ids.map(score), policy.temperature, rng)]!;
  const def = catalogue.get(buy)!;
  const needsSlot = !(def.component !== null && ownedIds.includes(def.component));
  return { buy, sell: needsSlot && full ? worst : null };
}

/**
 * GDD §11.4 AP: the ultimate's next tier whenever affordable, otherwise the first affordable T1 in the hero's priority
 * order, then T2s, then T3s. Returns the slot to upgrade, or null.
 */
export function nextUpgrade(h: HeroEntity, priority: readonly number[]): number | null {
  const { ap, slots } = h.abilities;
  const last = slots.length - 1;
  const ult = slots[last]!;
  if (ult.unlocked && ult.tier < AP_COSTS.length && ap >= AP_COSTS[ult.tier]!) return last;
  for (let tier = 0; tier < AP_COSTS.length; tier++) {
    for (const slot of priority) {
      const s = slots[slot];
      if (s && s.unlocked && s.tier === tier && ap >= AP_COSTS[tier]!) return slot;
    }
  }
  return null;
}
