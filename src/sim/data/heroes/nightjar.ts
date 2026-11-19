/**
 * Nightjar (GDD §9.20): assassin. Every number is the GDD's; "k×SP" scaling is the `song` part of a Magnitude.
 * Tiers only add (D-ABIL-006): a number a tier raises is a named value, an extra effect is appended by the tier.
 */
import type { AbilityDef, Effect, HeroDef, Magnitude, StatusDef, TargetFilter } from '../../core/contracts';
import { DAMAGE_AMP, REVEAL, SILENCE, SLOW } from '../combat';

const ENEMIES: TargetFilter = { teams: 'enemies' };
const ENEMY_HEROES: TargetFilter = { teams: 'enemies', heroesOnly: true };
const song = (of: number | string, k: number): Effect => ({ kind: 'damage', amount: { of, song: k }, type: 'song' });
const apply = (status: StatusDef, durationS: Magnitude, magnitude?: Magnitude): Effect => ({ kind: 'applyStatus', status, durationS, magnitude });
const base = { castS: 0, channelS: 0, hook: false } as const;

/** Names and constants shared with the hero module. */
export const NIGHTFALL_ABILITY = 'nightjar.nightfall';
export const SWALLOW_ABILITY = 'nightjar.nightSwallow';
export const SWALLOW_STRIKE_HOOK = 'swallowStrike';

/** Nightfall: invisible, and leaving it (an attack, a cast or the clock) is the player's to time. */
export const NIGHTFALL: StatusDef = {
  id: 'nightjar.nightfall',
  name: 'Nightfall',
  negative: false,
  stacking: 'max',
  maxStacks: 1,
  durationS: 7,
  modifiers: { conditions: ['invisible'] },
  endsOnAttack: true,
};
/** The first hit out of Nightfall: +60 + 0.6 x SP Song damage and a 30% slow for 1.5 s. */
export const AMBUSH_STRIKE: readonly Effect[] = [song(60, 0.6), apply(SLOW, 1.5, 0.3)];
/** How long after Nightfall ends the first hit still counts as "out of it" (as Kingfisher's Ambush window). */
export const AMBUSH_WINDOW_S = 1.5;
/** Night Swallow T3: a kill leaves you invisible for 3 s. */
export const SWALLOW_VANISH_S = 3;
/** Night Swallow: the dash takes 0.25 s; the strike lands on arrival, if the Nightjar is within this reach of the target. */
export const SWALLOW = { dashS: 0.25, reachM: 3.5 } as const;
/** The swallow-strike: 200 + 1.5 x SP Song damage, and a kill if the target is then below `execute` of its max HP. */
export const SWALLOW_STRIKE: readonly Effect[] = [
  { kind: 'damage', amount: { of: 'damage', song: 1.5 }, type: 'song', executeBelow: 'execute' },
];

const abilities: [AbilityDef, AbilityDef, AbilityDef, AbilityDef] = [
  {
    ...base,
    id: 'nightjar.gape',
    name: 'Gape',
    description:
      'Lunge 6 m along your aim and bite (1.2 m radius): 90 + 0.9 x SP Song damage and a 1 s silence. You heal 30% of the damage dealt.',
    targeting: 'direction',
    range: 6,
    cooldownS: 12,
    charges: 1,
    values: { damage: 90, silence: 1 },
    effects: [
      {
        kind: 'dash',
        distance: 6,
        durationS: 0.15,
        dir: 'aim',
        arcHeight: 0,
        maxPitchUpDeg: 0,
        onArrive: [
          // Damage resolves in the damage phase, so the 30% Song lifesteal is on for the bite (and a moment after).
          { kind: 'statMod', id: 'nightjar.gapeDrain', name: 'Gape', stats: [{ stat: 'songLifesteal', op: 'add', value: 0.3 }], durationS: 0.1 },
          {
            kind: 'area',
            shape: { kind: 'sphere', radius: 1.2 },
            durationS: 0,
            attach: 'point',
            affects: ENEMIES,
            effects: [song('damage', 0.9), apply(SILENCE, 'silence')],
          },
        ],
      },
    ],
    upgrades: [
      { description: '+30 damage (120 + 0.9 x SP)', values: { damage: 30 } },
      { description: '-3 s cooldown', cooldownS: -3 },
      { description: 'Silence 1.75 s', values: { silence: 0.75 } },
    ],
  },
  {
    ...base,
    id: NIGHTFALL_ABILITY,
    name: 'Nightfall',
    description:
      'Invisible and silent for 7 s. Your first hit out of it deals +60 + 0.6 x SP Song damage and slows 30% for 1.5 s.',
    targeting: 'self',
    range: 0,
    cooldownS: 26,
    charges: 1,
    hook: true, // the first-hit bonus, and T3's second chance
    values: { duration: 7, keep: 0 },
    effects: [apply(NIGHTFALL, 'duration')],
    upgrades: [
      { description: '+3 s duration (10 s)', values: { duration: 3 } },
      { description: '-6 s cooldown', cooldownS: -6 },
      { description: 'You stay invisible after the first hit; the second hit ends it', values: { keep: 1 } },
    ],
  },
  {
    ...base,
    id: 'nightjar.churringCall',
    name: 'Churring Call',
    description: 'Enemies in a 12 m, 60 degree cone are revealed for 5 s and take +15% damage from all sources for 5 s.',
    targeting: 'direction',
    range: 12,
    cooldownS: 14,
    charges: 1,
    values: { length: 12, amp: 0.15 },
    effects: [
      {
        kind: 'area',
        shape: { kind: 'cone', length: 'length', angleDeg: 60 },
        durationS: 0,
        attach: 'source',
        affects: ENEMIES,
        effects: [apply(REVEAL, 5), apply(DAMAGE_AMP, 5, 'amp')],
      },
    ],
    upgrades: [
      { description: '+6 m range (18 m)', range: 6, values: { length: 6 } },
      { description: '-4 s cooldown', cooldownS: -4 },
      { description: 'Damage amp +25%', values: { amp: 0.1 } },
    ],
  },
  {
    ...base,
    id: SWALLOW_ABILITY,
    name: 'Night Swallow',
    description:
      'Dash to an enemy hero within 12 m and strike: 200 + 1.5 x SP Song damage. If its HP is then below 20% of max, it dies.',
    targeting: 'unit',
    affects: ENEMY_HEROES,
    range: 12,
    cooldownS: 90,
    charges: 1,
    hook: true, // the strike lands only if you arrive, and T3's reset on a kill
    values: { damage: 200, execute: 0.2 },
    effects: [
      { kind: 'dash', distance: 12, durationS: SWALLOW.dashS, dir: 'target' },
      { kind: 'delay', seconds: SWALLOW.dashS, effects: [{ kind: 'hook', name: SWALLOW_STRIKE_HOOK }] },
    ],
    upgrades: [
      { description: 'Execute threshold 25%', values: { execute: 0.05 } },
      { description: '-20 s cooldown (70 s)', cooldownS: -20 },
      { description: 'An execute resets the cooldown and makes you invisible for 3 s' },
    ],
  },
];

export const nightjarDef: HeroDef = {
  id: 'nightjar',
  name: 'Nightjar',
  swatch: 0x8c6d4f,
  archetype: 'assassin',
  body: {
    height: 1.55,
    radius: 0.32,
    head: { centre: { right: 0, up: 1.35, forward: 0 }, radius: 0.2 },
    muzzle: { right: 0.22, up: 1, forward: 0.35 },
  },
  stats: {
    maxHealth: 520,
    healthRegen: 2,
    moveSpeed: 7.2,
    sprintSpeed: 2,
    stamina: 3,
    staminaRecharge: 5,
    weaponDamage: 26,
    magazine: 10,
    meleeDamage: 50,
  },
  growth: [
    { stat: 'maxHealth', op: 'add', value: 30 },
    { stat: 'weaponDamage', op: 'pct', value: 0.03 },
    { stat: 'songPower', op: 'add', value: 1 },
    { stat: 'meleeDamage', op: 'add', value: 3 },
  ],
  weapon: {
    name: 'Moth Pistol',
    pellets: 1,
    spreadDeg: 0.5,
    fireRate: 3.2,
    hitscan: true,
    projectileSpeed: 0,
    reloadS: 1.8,
    reload: 'magazine',
    falloff: { start: 18, end: 38 },
    range: 80,
  },
  abilities,
};
