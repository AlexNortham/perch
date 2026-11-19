/**
 * Peacock (GDD §9.13): Song burst. Every number is the GDD's; "k×SP" scaling is the `song` part of a Magnitude.
 * Per-second numbers are halved per tick because areas tick every 0.5 s (GDD §5.12). Tiers only add (D-ABIL-006):
 * a tier that switches something on either appends effects or raises a value that is 0 until then.
 */
import type { AbilityDef, Effect, HeroDef, Magnitude, ProjectileEffect, StatusDef, TargetFilter } from '../../core/contracts';
import { DISARM, REVEAL, SILENCE, SONG_SHRED, STUN } from '../combat';

const ENEMIES: TargetFilter = { teams: 'enemies' };
const song = (of: number | string, k: number): Effect => ({ kind: 'damage', amount: { of, song: k }, type: 'song' });
const apply = (status: StatusDef, durationS: Magnitude, magnitude?: Magnitude): Effect => ({ kind: 'applyStatus', status, durationS, magnitude });
const base = { castS: 0, channelS: 0, hook: false } as const;

/** A flat cone from the caster along the aim: Dazzle and Full Display. */
const cone = (length: Magnitude, angleDeg: number, effects: readonly Effect[]): Effect => ({
  kind: 'area',
  shape: { kind: 'cone', length, angleDeg },
  durationS: 0,
  attach: 'source',
  affects: ENEMIES,
  effects,
});

/** Hundred Eyes: the fan is 30° wide, so a hero can be caught by at most this many of the darts. */
export const EYES_FAN_DEG = 30;
export const EYES_MAX_HITS = 3;
/** What every dart does on a hit; the hook counts hits per hero and applies it. */
export const EYE_HIT: readonly Effect[] = [song('damage', 0.45)];
/** T3: darts also reveal for 4 s and shred 10% Song resist for 6 s. */
export const EYE_MARK: readonly Effect[] = [apply(REVEAL, 4), apply(SONG_SHRED, 6, 0.1)];
export const EYE_DART: ProjectileEffect = {
  kind: 'projectile',
  speed: 60,
  radius: 0.3,
  range: 35,
  gravity: 0,
  pierce: 'none',
  affects: ENEMIES,
  onHit: [{ kind: 'hook', name: 'eyeHit' }],
};

/** Strut: the move buff, and the marker the hook looks for to give the next cast its bonus. */
export const STRUT_ID = 'peacock.strut';
export const STRUT_ARMED_ID = 'peacock.strutArmed';
export const STRUT_AMP_ID = 'peacock.strutAmp';
/** +25% damage on the next cast; held a moment so a dart's flight or a burst still counts. */
export const STRUT_AMP = 0.25;
export const STRUT_AMP_LINGER_S = 0.8;

const abilities: [AbilityDef, AbilityDef, AbilityDef, AbilityDef] = [
  {
    ...base,
    id: 'peacock.hundredEyes',
    name: 'Hundred Eyes',
    description: 'Fire 5 eye-darts in a 30-degree fan (60 m/s, 35 m). Each deals 45 + 0.45 x SP Song damage; a hero can be hit by at most 3.',
    targeting: 'direction',
    range: 35,
    cooldownS: 12,
    charges: 1,
    hook: true, // the hook fans the darts out and counts hits per hero
    values: { damage: 45, darts: 5, mark: 0 },
    effects: [],
    upgrades: [
      { description: '+1 dart (6 darts)', values: { darts: 1 } },
      { description: '-3 s cooldown', cooldownS: -3 },
      { description: 'Darts reveal for 4 s and shred 10% Song resist for 6 s', values: { mark: 1 } },
    ],
  },
  {
    ...base,
    id: 'peacock.dazzle',
    name: 'Dazzle',
    description: 'The fan flashes in a 70-degree cone, 10 m long: enemies take 70 + 0.7 x SP Song damage and are disarmed for 1.25 s.',
    targeting: 'direction',
    range: 10,
    cooldownS: 16,
    charges: 1,
    hook: true, // Strut's bonus is spent on this cast
    values: { length: 10, disarm: 1.25 },
    effects: [cone('length', 70, [song(70, 0.7), apply(DISARM, 'disarm')])],
    upgrades: [
      { description: '+4 m range (14 m)', values: { length: 4 }, range: 4 },
      { description: 'Disarm +0.5 s (1.75 s)', values: { disarm: 0.5 } },
      { description: 'Also silences for 1 s', effects: [cone('length', 70, [apply(SILENCE, 1)])] },
    ],
  },
  {
    ...base,
    id: 'peacock.strut',
    name: 'Strut',
    description: 'For 3 s you move 30% faster, and your next ability cast in that time deals +25% damage.',
    targeting: 'self',
    range: 0,
    cooldownS: 14,
    charges: 1,
    hook: true, // the hook spends the "armed" marker on the next cast
    values: { duration: 3 },
    effects: [
      { kind: 'statMod', id: STRUT_ID, name: 'Strut', stats: [{ stat: 'moveSpeed', op: 'pct', value: 0.3 }], durationS: 'duration' },
      { kind: 'statMod', id: STRUT_ARMED_ID, name: 'Strut: armed', stats: [], durationS: 'duration' },
    ],
    upgrades: [
      { description: '+1 s duration (4 s)', values: { duration: 1 } },
      { description: '-4 s cooldown', cooldownS: -4 },
      {
        description: 'Also grants a Song shield of 100 + 1.0 x SP for 3 s',
        effects: [{ kind: 'shield', absorbs: 'song', amount: { of: 100, song: 1 }, durationS: 3 }],
      },
    ],
  },
  {
    ...base,
    id: 'peacock.fullDisplay',
    name: 'Full Display',
    description:
      'Rooted for 1 s while the fan opens, then every enemy within 18 m in your front 180 degrees takes 300 + 2.0 x SP Song damage and is revealed for 6 s.',
    targeting: 'direction',
    range: 18,
    cooldownS: 100,
    castS: 1,
    rooted: true,
    hook: true, // Strut's bonus is spent on this cast
    charges: 1,
    values: { length: 18 },
    effects: [cone('length', 180, [song(300, 2), apply(REVEAL, 6)])],
    upgrades: [
      { description: '+5 m range (23 m)', values: { length: 5 }, range: 5 },
      { description: 'Also stuns for 1 s', effects: [cone('length', 180, [apply(STUN, 1)])] },
      { description: '-30 s cooldown', cooldownS: -30 },
    ],
  },
];

export const peacockDef: HeroDef = {
  id: 'peacock',
  name: 'Peacock',
  swatch: 0x1c8f9e,
  archetype: 'songBurst',
  body: {
    height: 1.9,
    radius: 0.32,
    head: { centre: { right: 0, up: 1.75, forward: 0 }, radius: 0.15 },
    muzzle: { right: 0.38, up: 1.3, forward: 0.35 },
  },
  stats: {
    maxHealth: 540,
    healthRegen: 2,
    moveSpeed: 7,
    sprintSpeed: 2,
    stamina: 3,
    staminaRecharge: 5,
    weaponDamage: 15,
    magazine: 18,
    meleeDamage: 50,
  },
  growth: [
    { stat: 'maxHealth', op: 'add', value: 31 },
    { stat: 'weaponDamage', op: 'pct', value: 0.03 },
    { stat: 'songPower', op: 'add', value: 1 },
    { stat: 'meleeDamage', op: 'add', value: 3 },
  ],
  weapon: {
    name: 'Plume Darts',
    pellets: 1,
    spreadDeg: 0.7,
    fireRate: 4.5,
    hitscan: false,
    projectileSpeed: 85,
    reloadS: 2.2,
    reload: 'magazine',
    falloff: { start: 15, end: 35 },
    range: 120,
  },
  abilities,
};
