/** Pure view-to-display logic for the panels (unit tested): upgrades, shop quotes, minimap, scoreboard, numbers. */
import type { EntityView, HeroView, ItemDef, PlayerTeam, SimView, Vec3 } from '../../sim/core/contracts';
import type { AbilitySlotState } from '../../sim/core/contracts/entity';
import { AP_COSTS, UNLOCK_LEVELS } from '../../sim/data/abilities';
import { TICK_RATE } from '../../sim/data/core';
import {
  BASE_ITEM_SLOTS,
  FULL_REFUND_FRACTION,
  GHOST_FADE_S,
  MAX_TIER,
  SELL_REFUND_FRACTION,
} from './constants';

export interface UpgradeDisplay {
  readonly tier: number;
  readonly maxed: boolean;
  /** AP for the next tier, or null when maxed. */
  readonly cost: number | null;
  /** Why the upgrade cannot be bought now, or null when it can. */
  readonly reason: string | null;
}

export function upgradeDisplay(slot: Readonly<AbilitySlotState>, index: number, ap: number, nextCost?: number | null): UpgradeDisplay {
  const maxed = slot.tier >= MAX_TIER;
  const cost = maxed ? null : (nextCost ?? AP_COSTS[slot.tier] ?? null);
  let reason: string | null = null;
  if (!slot.unlocked) reason = `Unlocks at level ${UNLOCK_LEVELS[index] ?? 1}`;
  else if (maxed) reason = 'Fully upgraded';
  else if (cost !== null && ap < cost) reason = `Not enough AP (needs ${cost}, you have ${ap})`;
  return { tier: slot.tier, maxed, cost, reason };
}

/** One shop card's price, state and the reason it cannot be bought. */
export interface ItemQuote {
  readonly owned: boolean;
  /** Owns the lower-tier component: the price drops and it is replaced in place. */
  readonly linked: boolean;
  /** Price after the component credit. */
  readonly net: number;
  readonly canBuy: boolean;
  readonly reason: string | null;
  /** What selling it returns now. */
  readonly refund: number;
  readonly fullRefund: boolean;
}

export interface ShopHero {
  readonly seeds: number;
  readonly shopZone?: number | null;
  readonly items: HeroView['items'];
}

export const slotCapacity = (flexSlots: number): number => BASE_ITEM_SLOTS + flexSlots;

export function quoteItem(def: ItemDef, catalogue: readonly ItemDef[], hero: ShopHero, tick: number, flexSlots: number): ItemQuote {
  const mine = hero.items.find((o) => o.item === def.id);
  const owned = mine !== undefined;
  const component = def.component === null ? undefined : catalogue.find((c) => c.id === def.component);
  const linked = component !== undefined && hero.items.some((o) => o.item === component.id);
  const net = linked && component ? Math.max(0, def.cost - component.cost) : def.cost;
  const fullRefund = mine?.fullRefundUntil !== undefined && mine.fullRefundUntil >= tick;
  const refund = Math.floor(def.cost * (fullRefund ? FULL_REFUND_FRACTION : SELL_REFUND_FRACTION));
  let reason: string | null = null;
  if (owned) reason = 'Owned';
  else if (hero.shopZone === null || hero.shopZone === undefined) reason = 'Visit a Magpie stall or your Home Roost to trade';
  else if (!linked && hero.items.length >= slotCapacity(flexSlots)) reason = 'No free item slot';
  else if (hero.seeds < net) reason = `Need ${net - hero.seeds} more Seeds`;
  return { owned, linked, net, canBuy: reason === null, reason, refund, fullRefund };
}

/** Seconds left on a same-visit full refund (0 when none). */
export const refundSeconds = (fullRefundUntil: number | undefined, tick: number): number =>
  fullRefundUntil === undefined ? 0 : Math.max(0, Math.ceil((fullRefundUntil - tick) / TICK_RATE));

/** Minimap and big map: north (+z) up, east (+x) at the left, so Dawn's base sits at the bottom. */
export interface MapBounds {
  readonly min: Vec3;
  readonly max: Vec3;
}
export function mapPoint(pos: Vec3, b: MapBounds, width: number, height: number): { x: number; y: number } {
  return {
    x: ((b.max.x - pos.x) / (b.max.x - b.min.x)) * width,
    y: ((b.max.z - pos.z) / (b.max.z - b.min.z)) * height,
  };
}
/** The inverse of mapPoint: a map pixel back to the ground point (y = 0). */
export function mapWorld(px: number, py: number, b: MapBounds, width: number, height: number): Vec3 {
  return { x: b.max.x - (px / width) * (b.max.x - b.min.x), y: 0, z: b.max.z - (py / height) * (b.max.z - b.min.z) };
}

export const teamBit = (team: PlayerTeam): number => (team === 'dawn' ? 1 : 2);

/** Allies always show; enemies and neutrals only when the map-visibility bits say the local flock sees them. */
export const mapVisible = (e: Pick<EntityView, 'team' | 'seenBy' | 'mapSeenBy'>, team: PlayerTeam): boolean =>
  e.team === team || ((e.mapSeenBy ?? e.seenBy) & teamBit(team)) !== 0;

export interface Ghost {
  readonly id: number;
  readonly type: string;
  readonly pos: Vec3;
  /** 1 just lost, fading to 0 over GHOST_FADE_S. */
  readonly alpha: number;
}

/** Remembers where enemy heroes were last seen on the map and fades them out. */
export function createGhosts(): { update(view: SimView, team: PlayerTeam): Ghost[]; reset(): void } {
  const last = new Map<number, { type: string; pos: Vec3; lost: number | null }>();
  return {
    reset: () => last.clear(),
    update(view, team) {
      const now = view.seconds;
      const present = new Set<number>();
      for (const e of view.entities) {
        if (e.kind !== 'hero' || e.team === team) continue;
        present.add(e.id);
        if (mapVisible(e, team)) last.set(e.id, { type: e.type, pos: e.pos, lost: null });
        else {
          const g = last.get(e.id);
          if (g && g.lost === null) g.lost = now;
        }
      }
      const out: Ghost[] = [];
      for (const [id, g] of last) {
        if (!present.has(id) || g.lost === null) continue;
        const alpha = 1 - (now - g.lost) / GHOST_FADE_S;
        if (alpha <= 0) last.delete(id);
        else out.push({ id, type: g.type, pos: g.pos, alpha });
      }
      return out;
    },
  };
}

export interface ScoreRow {
  readonly hero: HeroView;
  readonly respawn: number | null;
  readonly local: boolean;
}

export function scoreRows(view: SimView, team: PlayerTeam): ScoreRow[] {
  return view.heroes
    .filter((h) => h.team === team)
    .map((h) => ({
      hero: h,
      respawn: h.respawnAt === null ? null : Math.max(0, Math.ceil((h.respawnAt - view.tick) / TICK_RATE)),
      local: h.id === view.localHero,
    }));
}

export interface NumberStyle {
  readonly colour: string;
  readonly scale: number;
}
/** Damage number look: white Talon, violet Song, gold beak shot 1.3x, orange weak point, grey into a shield. */
export function damageNumberStyle(e: { amount: number; absorbed: number; damageType: 'talon' | 'song'; beakShot: boolean; weakPoint: boolean }, c: Record<string, string>): NumberStyle {
  if (e.absorbed >= e.amount && e.amount > 0) return { colour: c['shield'] ?? '#999', scale: 1 };
  if (e.weakPoint) return { colour: c['weak'] ?? '#f90', scale: 1.3 };
  if (e.beakShot) return { colour: c['beak'] ?? '#fd4', scale: 1.3 };
  return { colour: e.damageType === 'song' ? (c['song'] ?? '#a7f') : (c['talon'] ?? '#fff'), scale: 1 };
}

/** M:SS */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Practice dummies as the HUD labels them: ally or enemy of the local hero, by controller and team. */
export interface DummyInfo {
  readonly id: number;
  readonly label: 'Ally dummy' | 'Enemy dummy';
  readonly hero: HeroView;
  readonly hp: number;
  readonly maxHp: number;
}
export function dummies(view: SimView): DummyInfo[] {
  const me = view.heroes.find((h) => h.id === view.localHero);
  if (!me) return [];
  const out: DummyInfo[] = [];
  for (const h of view.heroes) {
    if (h.controller !== 'dummy') continue;
    const e = view.entities.find((x) => x.id === h.id);
    if (e) out.push({ id: h.id, label: h.team === me.team ? 'Ally dummy' : 'Enemy dummy', hero: h, hp: e.hp, maxHp: e.maxHp });
  }
  return out;
}
