/**
 * Toucan (GDD §9.18): long-range poke. Every number is the GDD's; "k×SP" scaling is the `song` part of a Magnitude.
 * Tiers only add (D-ABIL-006): a number a tier raises is a named value, an extra effect is appended by the tier, and
 * Seed Spit's T3 swaps its single-target shot for a piercing one the way Owl's Moonlit Mark does.
 */
import type { AbilityDef, Effect, HeroDef, Magnitude, StatusDef, TargetFilter } from '../../core/contracts';
import { REVEAL, SLOW, SONG_SHRED } from '../combat';

const ENEMIES: TargetFilter = { teams: 'enemies' };
const song = (of: number | string, k: number): Effect => ({ kind: 'damage', amount: { of, song: k }, type: 'song' });
const apply = (status: StatusDef, durationS: Magnitude, magnitude?: Magnitude): Effect => ({ kind: 'applyStatus', status, durationS, magnitude });
const base = { castS: 0, channelS: 0, hook: false } as const;

/** Hook names and constants shared with the hero module. */
export const SWING_LAND_HOOK = 'swingLand';
export const MORTAR_HOOK = 'fruitBarrageMortar';
/** Branch Swing T3: +25% gun damage after landing. */
export const SWING_BUFF: Effect = {
  kind: 'statMod',
  id: 'toucan.swingBuff',
  name: 'Branch Swing',
  stats: [{ stat: 'gunDamage', op: 'add', value: 0.25 }],
  durationS: 'landBuff',
};
/** One Fruit Barrage mortar: 3 m radius, 50 + 0.4 x SP Song damage, at the spot the hook picked. */
export const MORTAR: Effect = {
  kind: 'area',
  shape: { kind: 'sphere', radius: 3 },
  durationS: 0,
  attach: 'point',
  affects: ENEMIES,
  effects: [song(50, 0.4)],
};

// ---- Fruit Lob ----------------------------------------------------------------------------------------------------
const LOB_FLIGHT_S = 1.2;
/** The shell lands 1.2 s after the cast: 4 m radius, 90 + 0.9 x SP Song damage and a 25% slow for 2 s. */
const LOB_SHELL: Effect = {
  kind: 'delay',
  seconds: LOB_FLIGHT_S,
  effects: [
    {
      kind: 'area',
      shape: { kind: 'sphere', radius: 4 },
      durationS: 0,
      attach: 'point',
      affects: ENEMIES,
      effects: [song('damage', 0.9), apply(SLOW, 2, 0.25)],
    },
  ],
};
/** T3: the pulp lies 4 s where the shell landed; enemies on it are slowed 40% (refreshed every 0.5 s tick). */
const LOB_PULP: Effect = {
  kind: 'delay',
  seconds: LOB_FLIGHT_S,
  effects: [
    {
      kind: 'area',
      shape: { kind: 'cylinder', radius: 4, height: 3 },
      durationS: 4,
      attach: 'point',
      affects: ENEMIES,
      effects: [apply(SLOW, 0.6, 0.4)],
    },
  ],
};

// ---- Seed Spit ----------------------------------------------------------------------------------------------------
const SHRED_DELAY_S = 0.05;
/** The spit: one that stops at the first thing it hits, and (from T3) one that pierces. */
const spit = (range: Magnitude, pierce: 'none' | 'all'): Effect => ({
  kind: 'projectile',
  speed: 100,
  radius: 0.3,
  range,
  gravity: 0,
  pierce,
  affects: ENEMIES,
  // Damage is queued to the damage phase, so a shred applied in the same hit would already count: it waits a moment.
  onHit: [song('damage', 0.6), apply(REVEAL, 6), { kind: 'delay', seconds: SHRED_DELAY_S, effects: [apply(SONG_SHRED, 6, 0.1)] }],
});

// ---- Fruit Barrage ------------------------------------------------------------------------------------------------
/** 12 mortars land every 0.25 s from 1.0 s after the cast (the hook picks each spot); T1's four fall in between. */
const mortar = (seconds: number): Effect => ({ kind: 'delay', seconds, effects: [{ kind: 'hook', name: MORTAR_HOOK }] });
const BARRAGE_START_S = 1;
const BARRAGE_SPACING_S = 0.25;
const barrage = (count: number, offsetS: number, spacingS: number): Effect[] =>
  Array.from({ length: count }, (_, i) => mortar(BARRAGE_START_S + offsetS + i * spacingS));

const abilities: [AbilityDef, AbilityDef, AbilityDef, AbilityDef] = [
  {
    ...base,
    id: 'toucan.fruitLob',
    name: 'Fruit Lob',
    description:
      'Lob a fruit up to 50 m that lands 1.2 s later: 4 m radius, 90 + 0.9 x SP Song damage and a 25% slow for 2 s. Two charges.',
    targeting: 'point',
    range: 50,
    cooldownS: 10,
    charges: 2,
    values: { damage: 90 },
    effects: [LOB_SHELL],
    upgrades: [
      { description: '+25 damage (115 + 0.9 x SP)', values: { damage: 25 } },
      { description: '+1 charge (3)', charges: 1 },
      { description: 'Leaves sticky pulp for 4 s: enemies on it are slowed 40%', effects: [LOB_PULP] },
    ],
  },
  {
    ...base,
    id: 'toucan.seedSpit',
    name: 'Seed Spit',
    description:
      'Spit a seed at 100 m/s up to 60 m: the first enemy hit takes 60 + 0.6 x SP Song damage, is revealed for 6 s and loses 10% Song resist for 6 s.',
    targeting: 'direction',
    range: 60,
    cooldownS: 9,
    charges: 1,
    // rangeOne is the shot that stops at the first enemy; T3 swaps it for rangeAll, the shot that pierces.
    values: { damage: 60, rangeOne: 60, rangeAll: 0 },
    effects: [spit('rangeOne', 'none'), spit('rangeAll', 'all')],
    upgrades: [
      { description: '+20 m range (80 m)', range: 20, values: { rangeOne: 20 } },
      { description: '-3 s cooldown', cooldownS: -3 },
      { description: 'The seed pierces, hitting every enemy in its path', values: { rangeOne: -80, rangeAll: 80 } },
    ],
  },
  {
    ...base,
    id: 'toucan.branchSwing',
    name: 'Branch Swing',
    description: 'Grapple a point within 25 m and swing to it in a 0.6 s arc.',
    targeting: 'point',
    range: 25,
    cooldownS: 16,
    charges: 1,
    values: { reach: 25, landBuff: 0 },
    effects: [{ kind: 'dash', distance: 'reach', durationS: 0.6, dir: 'target', arcHeight: 3, onArrive: [{ kind: 'hook', name: SWING_LAND_HOOK }] }],
    upgrades: [
      { description: '-4 s cooldown', cooldownS: -4 },
      { description: '+10 m range (35 m)', range: 10, values: { reach: 10 } },
      { description: '+25% gun damage for 4 s after landing', values: { landBuff: 4 } },
    ],
  },
  {
    ...base,
    id: 'toucan.fruitBarrage',
    name: 'Fruit Barrage',
    description:
      'Call a barrage on a point within 80 m. After 1.0 s, 12 mortars fall over 3 s at random spots in a 9 m radius: each lands in 3 m for 50 + 0.4 x SP Song damage.',
    targeting: 'point',
    range: 80,
    cooldownS: 100,
    charges: 1,
    values: { radius: 9 },
    effects: barrage(12, 0, BARRAGE_SPACING_S),
    upgrades: [
      { description: '+4 mortars (16)', effects: barrage(4, BARRAGE_SPACING_S / 2, BARRAGE_SPACING_S * 3) },
      { description: '+3 m radius (12 m)', values: { radius: 3 } },
      { description: '-25 s cooldown (75 s)', cooldownS: -25 },
    ],
  },
];

export const toucanDef: HeroDef = {
  id: 'toucan',
  name: 'Toucan',
  swatch: 0xf28c1e,
  archetype: 'poke',
  body: {
    height: 1.7,
    radius: 0.32,
    head: { centre: { right: 0, up: 1.5, forward: 0 }, radius: 0.17 },
    muzzle: { right: 0.25, up: 1.2, forward: 0.35 },
  },
  stats: {
    maxHealth: 540,
    healthRegen: 2,
    moveSpeed: 7,
    sprintSpeed: 2,
    stamina: 3,
    staminaRecharge: 5,
    weaponDamage: 34,
    magazine: 10,
    meleeDamage: 50,
  },
  growth: [
    { stat: 'maxHealth', op: 'add', value: 31 },
    { stat: 'weaponDamage', op: 'pct', value: 0.03 },
    { stat: 'songPower', op: 'add', value: 1 },
    { stat: 'meleeDamage', op: 'add', value: 3 },
  ],
  weapon: {
    name: 'Bill Rifle',
    pellets: 1,
    spreadDeg: 0.25,
    fireRate: 2.2,
    hitscan: true,
    projectileSpeed: 0,
    reloadS: 2.4,
    reload: 'magazine',
    falloff: { start: 35, end: 75 },
    range: 120,
  },
  abilities,
};
