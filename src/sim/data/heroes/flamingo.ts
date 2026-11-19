/**
 * Flamingo (GDD §9.10): support. Every number is the GDD's; "k×SP" scaling is the `song` part of a Magnitude.
 * Tiers only add (D-ABIL-006): a number a tier raises is a named value, an extra effect is appended by the tier.
 */
import type { AbilityDef, Effect, HeroDef, Magnitude, StatusDef, TargetFilter } from '../../core/contracts';
import { DISARM, SLOW, UNSTOPPABLE } from '../combat';

const ENEMIES: TargetFilter = { teams: 'enemies' };
const ALLY_HEROES: TargetFilter = { teams: 'allies', self: true, heroesOnly: true };
const song = (of: number | string, k: number): Effect => ({ kind: 'damage', amount: { of, song: k }, type: 'song' });
const apply = (status: StatusDef, durationS: Magnitude, magnitude?: Magnitude): Effect => ({ kind: 'applyStatus', status, durationS, magnitude });
const speed = (id: string, name: string, value: number, durationS: number): Effect => ({
  kind: 'statMod',
  id,
  name,
  stats: [{ stat: 'moveSpeed', op: 'pct', value }],
  durationS,
});
const base = { castS: 0, channelS: 0, hook: false } as const;

/** The hook heals 30% of max HP, which a Magnitude can't say. */
export const TIDE_HEAL_HOOK_FRACTION = 0.3;
export const TIDE_HEAL_OVER_S = 3;
/** T2: allies this close to the Tide Turn target get it too. */
export const TIDE_ALLY_RADIUS = 6;
export const TIDE_ID = 'flamingo.tideTurn';
const TIDE_DAMAGE: Effect = {
  kind: 'statMod',
  id: TIDE_ID,
  name: 'Tide Turn',
  stats: [{ stat: 'gunDamage', op: 'add', value: 0.3 }, { stat: 'songDamage', op: 'add', value: 0.3 }],
  durationS: 6,
};
const TIDE: readonly Effect[] = [apply(UNSTOPPABLE, 6), TIDE_DAMAGE];

const abilities: [AbilityDef, AbilityDef, AbilityDef, AbilityDef] = [
  {
    ...base,
    id: 'flamingo.pinkPool',
    name: 'Pink Pool',
    description: 'A shallow pool of 5 m radius for 6 s: allies inside heal 30 + 0.3 x SP per second.',
    targeting: 'point',
    range: 20,
    cooldownS: 18,
    charges: 1,
    values: { radius: 5, duration: 6 },
    effects: [
      {
        kind: 'area',
        shape: { kind: 'cylinder', radius: 'radius', height: 3 },
        durationS: 'duration',
        intervalS: 1,
        attach: 'point',
        affects: ALLY_HEROES,
        effects: [{ kind: 'heal', amount: { of: 30, song: 0.3 } }],
      },
    ],
    upgrades: [
      { description: '+1.5 m radius (6.5 m)', values: { radius: 1.5 } },
      { description: '+2 s duration (8 s)', values: { duration: 2 } },
      {
        description: 'Allies inside also get +15% move speed, and entering the pool removes slows',
        effects: [
          {
            kind: 'area',
            shape: { kind: 'cylinder', radius: 'radius', height: 3 },
            durationS: 'duration',
            attach: 'point',
            affects: ALLY_HEROES,
            onEnter: [{ kind: 'cleanse', remove: [SLOW.id] }],
            effects: [speed('flamingo.poolSpeed', 'Pink Pool', 0.15, 0.6)],
          },
        ],
      },
    ],
  },
  {
    ...base,
    id: 'flamingo.poise',
    name: 'Poise',
    description: 'Barrier of 150 + 1.2 x SP and +40% status resist for 5 s on an ally in your sights (you if none).',
    targeting: 'unit',
    affects: ALLY_HEROES,
    range: 30,
    cooldownS: 16,
    charges: 1,
    values: { barrier: 150 },
    effects: [
      { kind: 'shield', absorbs: 'barrier', amount: { of: 'barrier', song: 1.2 }, durationS: 5 },
      { kind: 'statMod', id: 'flamingo.poise', name: 'Poise', stats: [{ stat: 'statusResist', op: 'stack', value: 0.4 }], durationS: 5 },
    ],
    upgrades: [
      { description: '+75 barrier (225 + 1.2 x SP)', values: { barrier: 75 } },
      { description: '-4 s cooldown', cooldownS: -4 },
      { description: '+1 charge (2 charges)', charges: 1 },
    ],
  },
  {
    ...base,
    id: 'flamingo.flockDance',
    name: 'Flock Dance',
    description:
      'Enemies within 8 m take 60 + 0.6 x SP Song damage and are knocked back 5 m. Allies within 8 m get +20% move speed for 3 s.',
    targeting: 'self',
    range: 8,
    cooldownS: 15,
    charges: 1,
    values: { radius: 8 },
    effects: [
      {
        kind: 'area',
        shape: { kind: 'sphere', radius: 'radius' },
        durationS: 0,
        attach: 'source',
        affects: ENEMIES,
        effects: [song(60, 0.6), { kind: 'displace', mode: 'push', distance: 5 }],
      },
      {
        kind: 'area',
        shape: { kind: 'sphere', radius: 'radius' },
        durationS: 0,
        attach: 'source',
        affects: ALLY_HEROES,
        effects: [speed('flamingo.danceSpeed', 'Flock Dance', 0.2, 3)],
      },
    ],
    upgrades: [
      { description: '+2 m radius (10 m)', values: { radius: 2 } },
      { description: '-3 s cooldown', cooldownS: -3 },
      {
        description: 'Enemies hit are also disarmed for 1.0 s',
        effects: [
          {
            kind: 'area',
            shape: { kind: 'sphere', radius: 'radius' },
            durationS: 0,
            attach: 'source',
            affects: ENEMIES,
            effects: [apply(DISARM, 1)],
          },
        ],
      },
    ],
  },
  {
    ...base,
    id: 'flamingo.tideTurn',
    name: 'Tide Turn',
    description:
      'An ally in your sights (you if none) is unstoppable for 6 s, heals 30% of max HP over the first 3 s, and deals +30% damage.',
    targeting: 'unit',
    affects: ALLY_HEROES,
    range: 40,
    cooldownS: 100,
    charges: 1,
    hook: true, // 30% of max HP is not a Magnitude
    values: { allyRadius: 0 },
    effects: [...TIDE],
    upgrades: [
      { description: '+20 m range (60 m)', range: 20 },
      {
        description: 'Also applies to allies within 6 m of the target',
        values: { allyRadius: TIDE_ALLY_RADIUS },
        effects: [
          {
            kind: 'area',
            shape: { kind: 'sphere', radius: TIDE_ALLY_RADIUS },
            durationS: 0,
            attach: 'target',
            affects: { teams: 'allies', heroesOnly: true },
            effects: [...TIDE],
          },
        ],
      },
      { description: '-30 s cooldown (70 s)', cooldownS: -30 },
    ],
  },
];

export const flamingoDef: HeroDef = {
  id: 'flamingo',
  name: 'Flamingo',
  swatch: 0xf2799b,
  archetype: 'support',
  body: {
    height: 2.3,
    radius: 0.26,
    head: { centre: { right: 0, up: 2.15, forward: 0 }, radius: 0.14 },
    muzzle: { right: 0.2, up: 1.6, forward: 0.3 },
  },
  stats: {
    maxHealth: 560,
    healthRegen: 2,
    moveSpeed: 7,
    sprintSpeed: 2,
    stamina: 3,
    staminaRecharge: 5,
    weaponDamage: 12,
    magazine: 30,
    meleeDamage: 50,
  },
  growth: [
    { stat: 'maxHealth', op: 'add', value: 32 },
    { stat: 'weaponDamage', op: 'pct', value: 0.03 },
    { stat: 'songPower', op: 'add', value: 1 },
    { stat: 'meleeDamage', op: 'add', value: 3 },
  ],
  weapon: {
    name: 'Wader Repeater',
    pellets: 1,
    spreadDeg: 0.9,
    fireRate: 6,
    hitscan: true,
    projectileSpeed: 0,
    reloadS: 2,
    reload: 'magazine',
    falloff: { start: 16, end: 36 },
    range: 80,
  },
  abilities,
};
