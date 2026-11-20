/**
 * Feather runes (GDD §7.10): at 5:00 and every 5:00 after, a rune on each rune bridge at once, replacing any left
 * unclaimed. Each spawn offers two different types; 10:00 offers the two that 5:00 didn't; later spawns draw a seeded
 * pair different from the one before. A heavy melee hit claims one (D-EP-039): a 150 s status whose strength is set
 * at the claim, linear from its 5:00 value to its 40:00 value, lost on death; a new rune replaces the old.
 */
import type { EntityId, Hasher, PickupEntity, SimContext, StatModifier, StatusDef } from '../core/contracts';
import { ticks } from '../core/math';
import { RUNES } from '../data/world';
import type { RuneType } from '../data/world';
import { giveStatus, spawnPickup, worldCause } from './neutral';

const TYPES = Object.keys(RUNES.types) as RuneType[];
const STATUS_ID = 'rune';

/** The rune's status at match second `s`. */
export function runeStatus(type: RuneType, s: number): StatusDef {
  const f = Math.min(1, Math.max(0, (s - RUNES.fromS) / (RUNES.toS - RUNES.fromS)));
  const stats: StatModifier[] = RUNES.types[type].stats.map(([stat, op, lo, hi]) => {
    const v = lo + (hi - lo) * f;
    return { stat, op, value: op === 'mul' ? 1 / (1 + v) : v };
  });
  return { id: STATUS_ID, name: RUNES.types[type].name, negative: false, stacking: 'max', maxStacks: 1, durationS: RUNES.durationS,
    modifiers: { stats } };
}

export interface Runes {
  update(): void;
  hash(h: Hasher): void;
}

export function createRunes(ctx: SimContext): Runes {
  const spots = ctx.map.runeSpots;
  const rng = ctx.rng.stream('world/runes');
  const every = ticks(RUNES.everyS);
  const live: (PickupEntity | null)[] = spots.map(() => null);
  const runeAt = (ctx.objectives.runeAt ??= spots.map(() => null));
  let pair: readonly RuneType[] = [];
  let spawns = 0;
  if (spots.length > 0) {
    ctx.objectives.runesAt = ticks(RUNES.firstS);
    spots.forEach((_, i) => (runeAt[i] = ticks(RUNES.firstS)));
  }

  const nextPair = (): RuneType[] => {
    if (spawns === 1) return TYPES.filter((t) => !pair.includes(t));
    for (;;) {
      const pick = rng.shuffle([...TYPES]).slice(0, 2);
      if (spawns === 0 || !pick.every((t) => pair.includes(t))) return pick;
    }
  };

  const spawnAll = (): void => {
    const now = ctx.clock.tick;
    pair = nextPair();
    spawns++;
    const order = rng.shuffle([...pair]);
    spots.forEach((spot, i) => {
      const old = live[i];
      if (old && !old.removed) ctx.store.despawn(old.id);
      const variant = order[i % order.length]!;
      const p = spawnPickup(ctx, 'rune', { x: spot.pos.x, y: spot.pos.y + RUNES.radius, z: spot.pos.z }, RUNES.radius,
        { variant, melee: 'heavy' });
      live[i] = p;
      runeAt[i] = null;
      ctx.bus.emit({ type: 'objective', action: 'runeSpawned', hero: null, team: 'neutral', pickup: p.id, pickupType: 'rune',
        pos: { ...p.pos }, variant });
    });
    ctx.objectives.runesAt = now + every;
  };

  ctx.bus.on('melee', (ev) => {
    if (!ev.heavy || ev.parried || ev.target === null) return;
    const i = live.findIndex((p) => p?.id === ev.target);
    const p = live[i];
    const hero = ctx.store.getKind(ev.attacker, 'hero');
    if (!p || p.removed || !hero) return;
    const type = p.pickup.variant as RuneType;
    giveStatus(ctx, hero, runeStatus(type, ctx.clock.seconds), worldCause(null, 'neutral', p.pos, 'rune'));
    ctx.store.despawn(p.id);
    live[i] = null;
    runeAt[i] = ctx.objectives.runesAt;
    ctx.bus.emit({ type: 'objective', action: 'runeTaken', hero: hero.id, team: hero.team, pickup: p.id, pickupType: 'rune',
      pos: { ...p.pos }, variant: type });
  });

  return {
    update() {
      const at = ctx.objectives.runesAt;
      if (at !== null && ctx.clock.tick >= at && spots.length > 0) spawnAll();
    },
    hash(h) {
      h.value(live.map((p): EntityId => p?.id ?? -1));
      h.value(pair);
      h.num(spawns);
    },
  };
}
