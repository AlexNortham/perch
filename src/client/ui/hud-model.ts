/** Pure view-to-display logic for the scoreboard bar and the contextual HUD pieces (unit tested). No DOM here. */
import { ViewFlag } from '../../sim/core/contracts';
import type { PlayerTeam, SimView } from '../../sim/core/contracts';
import type { EntityView } from '../../sim/core/contracts';
import { TICK_RATE } from '../../sim/data/core';
import { PERCENT } from './constants';
import { clock } from './model';

const PATRON_NAME: Readonly<Record<PlayerTeam, string>> = { dawn: 'Elder Raven', dusk: 'Great Owl' };
const STRUCTURE_LABEL: Readonly<Record<string, string>> = { hawk: 'Hawk', heron: 'Heron', warden: 'Warden', shrine: 'Shrine' };
const FLOCK_LABEL: Readonly<Record<PlayerTeam, string>> = { dawn: 'Dawn', dusk: 'Dusk' };
const isFlock = (t: string): t is PlayerTeam => t === 'dawn' || t === 'dusk';

/** Names for the feed and the objective bars. Structures read "Dusk Heron"; the Patrons have their own names. */
export function entityName(e: Pick<EntityView, 'kind' | 'team' | 'type'>): string {
  if (e.type === 'roc') return 'The Roc';
  if (e.kind === 'structure' && isFlock(e.team)) return e.type === 'patron' ? PATRON_NAME[e.team] : `${FLOCK_LABEL[e.team]} ${STRUCTURE_LABEL[e.type] ?? 'Nest'}`;
  return e.type.length > 0 ? `${e.type.slice(0, 1).toUpperCase()}${e.type.slice(1)}` : 'The world';
}

/** How far ahead the leading flock is, as whole percent of the other's total (side null when level). */
export function leadPercent(own: number, enemy: number): { readonly side: 'own' | 'enemy' | null; readonly pct: number } {
  if (own === enemy) return { side: null, pct: 0 };
  const lo = Math.min(own, enemy);
  return { side: own > enemy ? 'own' : 'enemy', pct: Math.round(((Math.max(own, enemy) - lo) / Math.max(1, lo)) * PERCENT) };
}

/** After the timer reaches zero the Egg or Roc is up for about this long; the window shown under the totals spans it. */
export const OBJECTIVE_WINDOW_S = 30;

/** The next Egg or Roc as "Egg 12:30–13:00", or null when neither is scheduled. */
export function nextObjective(o: Pick<SimView['objectives'], 'eggAt' | 'rocAt'>, tick: number): string | null {
  const next = [
    { label: 'Egg', at: o.eggAt },
    { label: 'Roc', at: o.rocAt },
  ]
    .filter((x): x is { label: string; at: number } => x.at !== null && x.at > tick)
    .sort((a, b) => a.at - b.at)[0];
  if (!next) return null;
  const from = next.at / TICK_RATE;
  return `${next.label} ${clock(from)}–${clock(from + OBJECTIVE_WINDOW_S)}`;
}

export interface ObjectiveBar {
  readonly id: number;
  readonly name: string;
  readonly hp: number;
  readonly maxHp: number;
  /** The Patron and the Roc get the wide named bar. */
  readonly wide: boolean;
  readonly ward: boolean;
  readonly gated: boolean;
  /** Belongs to the local flock (drawn teal; the enemy's is red). */
  readonly own: boolean;
}

/** G02: a bar shows while the local bird is within this many metres of the objective, or for OBJECTIVE_HIT_S after it hit it. */
export const OBJECTIVE_NEAR_M = 40;
export const OBJECTIVE_HIT_S = 5;
export const MAX_OBJECTIVE_BARS = 2;

export function objectiveBars(view: SimView, hitAt: ReadonlyMap<number, number>): ObjectiveBar[] {
  const me = view.entities.find((e) => e.id === view.localHero);
  if (!me) return [];
  const mine = view.heroes.find((h) => h.id === view.localHero)?.team;
  const found: { bar: ObjectiveBar; recent: boolean; dist: number }[] = [];
  for (const e of view.entities) {
    const objective = (e.kind === 'structure' && e.structure !== undefined && e.structure.type !== 'nest') || e.type === 'roc';
    if (!objective || e.maxHp <= 0 || e.hp <= 0) continue;
    const dist = Math.hypot(e.pos.x - me.pos.x, e.pos.z - me.pos.z);
    const recent = view.seconds - (hitAt.get(e.id) ?? -Infinity) <= OBJECTIVE_HIT_S;
    if (dist > OBJECTIVE_NEAR_M && !recent) continue;
    found.push({
      recent,
      dist,
      bar: {
        id: e.id,
        name: entityName(e),
        hp: e.hp,
        maxHp: e.maxHp,
        wide: e.type === 'patron' || e.type === 'roc',
        ward: e.structure?.broodWard === true,
        gated: (e.flags & ViewFlag.Invulnerable) !== 0,
        own: e.team === mine,
      },
    });
  }
  return found.sort((a, b) => Number(b.recent) - Number(a.recent) || a.dist - b.dist).slice(0, MAX_OBJECTIVE_BARS).map((f) => f.bar);
}

/** The strong effect on the local bird worth a word at the bottom of the screen (G10), or null. */
export function statusWord(flags: number, statuses: readonly { readonly id: string }[]): string | null {
  if ((flags & ViewFlag.Stunned) !== 0) return 'STUNNED';
  if ((flags & ViewFlag.Silenced) !== 0) return 'SILENCED';
  const has = (part: string): boolean => statuses.some((s) => s.id.toLowerCase().includes(part));
  if (has('root')) return 'ROOTED';
  if (has('disarm')) return 'DISARMED';
  return null;
}

/** G09: the melee hint shows only with a melee-claimable target this close (and in a player's first minutes ever). */
export const MELEE_HINT_RANGE_M = 3.5;
const CLAIMABLE_PICKUPS: readonly string[] = ['ember', 'rune', 'egg'];
const CLAIMABLE_NESTS: readonly string[] = ['woven', 'feeder'];
export function meleeTargetNear(view: SimView): boolean {
  const me = view.entities.find((e) => e.id === view.localHero);
  if (!me) return false;
  return view.entities.some((e) => {
    const claimable = (e.kind === 'pickup' && CLAIMABLE_PICKUPS.includes(e.type)) || (e.kind === 'structure' && e.variant !== undefined && CLAIMABLE_NESTS.includes(e.variant));
    return claimable && Math.hypot(e.pos.x - me.pos.x, e.pos.y - me.pos.y, e.pos.z - me.pos.z) <= MELEE_HINT_RANGE_M;
  });
}

/** The gauge's red chunk of recent damage holds for CHUNK_HOLD_S, then drains over CHUNK_DRAIN_S (G03). */
export const CHUNK_HOLD_S = 0.5;
export const CHUNK_DRAIN_S = 0.4;
export interface Chunk {
  /** Health share the chunk reaches now (never below the real share). */
  readonly shown: number;
  /** Where the chunk drains from, and the health share it drains to. */
  readonly from: number;
  readonly to: number;
  /** Seconds since the last hit. */
  readonly t: number;
}
export const FULL_CHUNK: Chunk = { shown: 1, from: 1, to: 1, t: 0 };

export function stepChunk(prev: Chunk, share: number, dt: number): Chunk {
  if (share >= prev.shown) return { shown: share, from: share, to: share, t: 0 };
  // A new hit lowers the target: the chunk stays where it was and its hold restarts.
  const hit = share < prev.to;
  const from = hit ? prev.shown : prev.from;
  const t = hit ? 0 : prev.t + dt;
  const drained = Math.min(1, Math.max(0, (t - CHUNK_HOLD_S) / CHUNK_DRAIN_S));
  return { shown: from - (from - share) * drained, from, to: share, t };
}
