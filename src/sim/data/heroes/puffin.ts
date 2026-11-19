/**
 * Puffin (GDD §9.12): area control. Every number is the GDD's; "k×SP" scaling is the `song` part of a Magnitude.
 * Tiers only add (D-ABIL-006): a number a tier raises is a named value; a base number a tier switches on starts at 0.
 */
import type { AbilityDef, AreaEffect, Effect, HeroDef, Magnitude, StatusDef, TargetFilter } from '../../core/contracts';
import { INVISIBILITY, REVEAL, SLOW, SONG_AMP, STUN } from '../combat';

const ENEMIES: TargetFilter = { teams: 'enemies' };
const ALLY_HEROES: TargetFilter = { teams: 'allies', self: true, heroesOnly: true };
const song = (of: number | string, k: number): Effect => ({ kind: 'damage', amount: { of, song: k }, type: 'song' });
const apply = (status: StatusDef, durationS: Magnitude, magnitude?: Magnitude): Effect => ({ kind: 'applyStatus', status, durationS, magnitude });
const base = { castS: 0, channelS: 0, hook: false } as const;

/** Hook names. */
export const TURRET_SLOW_HOOK = 'turretSlow';
export const WAVE_HOOK = 'rogueWave';
/** Fog Bank's cloak: invisible, but firing does not break it. */
export const FOG_CLOAK: StatusDef = { ...INVISIBILITY, id: 'puffin.fogCloak', name: 'Fogbound', endsOnAttack: false };
/** Rogue Wave: 30 m in 1.5 s; enemies are carried at most 12 m and stunned 1.5 s against a wall. */
export const WAVE = { speed: 20, lifeS: 1.5, carryM: 12, wallStunS: 1.5, trailS: 4, trailSlow: 0.3, trailHeight: 3 } as const;
export const WET_ID = 'puffin.wetGround';

/** The wave itself. The hook starts it at your feet (a direction cast's point is the aim point, not you). Damage lands once on entering. */
export const ROGUE_WAVE: AreaEffect = {
  kind: 'area',
  shape: { kind: 'cylinder', radius: 'halfWidth', height: WAVE.trailHeight },
  durationS: WAVE.lifeS,
  attach: 'point',
  move: { speed: WAVE.speed, carry: true, maxCarry: WAVE.carryM, onWall: [apply(STUN, WAVE.wallStunS)] },
  affects: ENEMIES,
  effects: [],
  onEnter: [song('damage', 1.3)],
};

const abilities: [AbilityDef, AbilityDef, AbilityDef, AbilityDef] = [
  {
    ...base,
    id: 'puffin.burrowColony',
    name: 'Burrow Colony',
    description:
      'Dig a burrow with a puffling turret (200 + 1.5 x SP HP, 20 s, at most 2). It shoots the nearest enemy within 18 m for 12 + 0.12 x SP Song damage every 0.5 s, preferring heroes. Two charges.',
    targeting: 'point',
    range: 15,
    cooldownS: 16,
    charges: 2,
    hook: true, // T2's slow
    values: { hp: 200, extra: 0, slow: 0, burst: 0 },
    effects: [
      {
        kind: 'summon',
        summon: 'turret',
        health: { of: 'hp', song: 1.5 },
        durationS: 20,
        maxCount: 2,
        extraCount: 'extra',
        preferHeroes: true,
        behaviour: 'turret',
        trigger: { radius: 18, affects: ENEMIES },
        effects: [song(12, 0.12), { kind: 'hook', name: TURRET_SLOW_HOOK }],
        onEnd: [
          {
            kind: 'area',
            shape: { kind: 'sphere', radius: 'burst' },
            durationS: 0,
            attach: 'point',
            affects: ENEMIES,
            effects: [song(80, 0.6)],
          },
        ],
      },
    ],
    upgrades: [
      { description: '+1 charge (3) and +1 maximum turret (3)', charges: 1, values: { extra: 1 } },
      { description: 'Turret hits slow the enemy 15% for 1 s', values: { slow: 0.15 } },
      { description: 'Turrets burst on death or expiry: 4 m radius, 80 + 0.6 x SP Song damage', values: { burst: 4 } },
    ],
  },
  {
    ...base,
    id: 'puffin.seaSpray',
    name: 'Sea Spray',
    description: 'A 50-degree cone, 10 m long: enemies take 50 + 0.5 x SP Song damage, are knocked back 6 m and slowed 25% for 2.5 s.',
    targeting: 'direction',
    range: 10,
    cooldownS: 12,
    charges: 1,
    values: { length: 10 },
    effects: [
      {
        kind: 'area',
        shape: { kind: 'cone', length: 'length', angleDeg: 50 },
        durationS: 0,
        attach: 'source',
        affects: ENEMIES,
        effects: [song(50, 0.5), { kind: 'displace', mode: 'push', distance: 6 }, apply(SLOW, 2.5, 0.25)],
      },
    ],
    upgrades: [
      { description: '+3 m range (13 m)', values: { length: 3 }, range: 3 },
      { description: '-3 s cooldown', cooldownS: -3 },
      {
        description: 'Enemies hit also take +15% Song damage for 4 s',
        effects: [
          {
            kind: 'area',
            shape: { kind: 'cone', length: 'length', angleDeg: 50 },
            durationS: 0,
            attach: 'source',
            affects: ENEMIES,
            effects: [apply(SONG_AMP, 4, 0.15)],
          },
        ],
      },
    ],
  },
  {
    ...base,
    id: 'puffin.fogBank',
    name: 'Fog Bank',
    description:
      'Sea fog of 7 m radius for 7 s: allies inside are invisible to enemies outside it (firing does not break it); enemies inside are revealed.',
    targeting: 'point',
    range: 25,
    cooldownS: 22,
    charges: 1,
    values: { radius: 7, duration: 7 },
    effects: [
      {
        kind: 'area',
        shape: { kind: 'cylinder', radius: 'radius', height: 4 },
        durationS: 'duration',
        attach: 'point',
        concealsAlliesOutside: true,
        affects: ALLY_HEROES,
        effects: [apply(FOG_CLOAK, 0.6)],
      },
      {
        kind: 'area',
        shape: { kind: 'cylinder', radius: 'radius', height: 4 },
        durationS: 'duration',
        attach: 'point',
        affects: ENEMIES,
        effects: [apply(REVEAL, 0.6)],
      },
    ],
    upgrades: [
      { description: '+2 m radius (9 m)', values: { radius: 2 } },
      { description: '+3 s duration (10 s)', values: { duration: 3 } },
      {
        description: 'Enemies inside are also slowed 20%',
        effects: [
          {
            kind: 'area',
            shape: { kind: 'cylinder', radius: 'radius', height: 4 },
            durationS: 'duration',
            attach: 'point',
            affects: ENEMIES,
            effects: [apply(SLOW, 0.6, 0.2)],
          },
        ],
      },
    ],
  },
  {
    ...base,
    id: 'puffin.rogueWave',
    name: 'Rogue Wave',
    description:
      'A wave 16 m wide travels 30 m over 1.5 s. Enemies it reaches take 160 + 1.3 x SP Song damage once and are carried with it, up to 12 m; one carried into a wall is stunned 1.5 s.',
    targeting: 'direction',
    range: 30,
    cooldownS: 110,
    charges: 1,
    hook: true, // starts the wave at your feet; T3's wet ground
    values: { damage: 160, halfWidth: 8, wet: 0 },
    effects: [{ kind: 'hook', name: WAVE_HOOK }],
    upgrades: [
      { description: '+6 m width (22 m)', values: { halfWidth: 3 } },
      { description: '+60 damage (220 + 1.3 x SP)', values: { damage: 60 } },
      { description: 'Leaves wet ground along its path for 4 s: enemies on it are slowed 30%', values: { wet: 1 } },
    ],
  },
];

export const puffinDef: HeroDef = {
  id: 'puffin',
  name: 'Puffin',
  swatch: 0x3e7fa6,
  archetype: 'areaControl',
  body: {
    height: 1.45,
    radius: 0.36,
    head: { centre: { right: 0, up: 1.27, forward: 0 }, radius: 0.19 },
    muzzle: { right: 0.25, up: 1.0, forward: 0.35 },
  },
  stats: {
    maxHealth: 580,
    healthRegen: 2,
    moveSpeed: 6.9,
    sprintSpeed: 2,
    stamina: 3,
    staminaRecharge: 5,
    weaponDamage: 18,
    magazine: 18,
    meleeDamage: 50,
  },
  growth: [
    { stat: 'maxHealth', op: 'add', value: 34 },
    { stat: 'weaponDamage', op: 'pct', value: 0.03 },
    { stat: 'songPower', op: 'add', value: 1 },
    { stat: 'meleeDamage', op: 'add', value: 3 },
  ],
  weapon: {
    name: 'Eel Sling',
    pellets: 1,
    spreadDeg: 0.6,
    fireRate: 4,
    hitscan: false,
    projectileSpeed: 100,
    reloadS: 2,
    reload: 'magazine',
    falloff: { start: 18, end: 40 },
    range: 80,
  },
  abilities,
};
