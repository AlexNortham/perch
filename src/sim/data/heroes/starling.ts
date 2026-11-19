/**
 * Starling (GDD §9.8): spirit burst. Every number is the GDD's; "k×SP" scaling is the `song` part of a Magnitude.
 * Tiers only add (D-ABIL-006): a tier that changes a base number adds to a named value, and one that switches
 * something on raises a radius that is 0 (an empty area) until the tier. Tiers are bought in order (T1, T2, T3).
 * Starling needs no hooks: swarms are projectiles, areas and a dash.
 */
import type { AbilityDef, Effect, HeroDef, Magnitude, StatusDef, TargetFilter } from '../../core/contracts';
import { HEAL_REDUCTION, INTANGIBLE, REVEAL, ROOT, SILENCE, SLOW } from '../combat';

const ENEMIES: TargetFilter = { teams: 'enemies' };
const apply = (status: StatusDef, durationS: Magnitude, magnitude?: Magnitude): Effect => ({ kind: 'applyStatus', status, durationS, magnitude });
const base = { castS: 0, channelS: 0, hook: false } as const;
/** A zone's statuses are refreshed every 0.5 s tick, so each lasts a little longer than one. */
const REFRESH_S = 0.75;

const cloud = (radius: Magnitude, effects: readonly Effect[]): Effect => ({
  kind: 'area',
  shape: { kind: 'sphere', radius },
  durationS: 'duration',
  attach: 'point',
  affects: ENEMIES,
  effects,
});
const burst = (radius: Magnitude, attach: 'point' | 'source', effects: readonly Effect[]): Effect => ({
  kind: 'area',
  shape: { kind: 'sphere', radius },
  durationS: 0,
  attach,
  affects: ENEMIES,
  effects,
});
const sun = (radius: Magnitude, effects: readonly Effect[]): Effect => ({
  kind: 'area',
  shape: { kind: 'sphere', radius },
  durationS: 'duration',
  attach: 'source',
  affects: ENEMIES,
  effects,
});

/**
 * Black Sun's "+15% Song damage from all sources", refreshed each tick. One instance that refreshes (stacking 'max'),
 * because the shared SONG_AMP is independent and its overlapping refreshes would add up.
 */
const SUN_AMP: StatusDef = {
  id: 'starling.blackSunAmp',
  name: 'Black Sun',
  negative: true,
  stacking: 'max',
  maxStacks: 1,
  durationS: REFRESH_S,
  modifiers: { stats: [{ stat: 'songAmp', op: 'add', value: 1 }] },
};

const abilities: [AbilityDef, AbilityDef, AbilityDef, AbilityDef] = [
  {
    ...base,
    id: 'starling.murmuration',
    name: 'Murmuration',
    description: 'Send a swarm 30 m at 40 m/s, 2 m wide, through everything: 110 + 1.1×SP Song damage to each enemy it passes.',
    targeting: 'direction',
    range: 30,
    cooldownS: 11,
    charges: 1,
    values: { damage: 110 },
    effects: [
      {
        kind: 'projectile',
        speed: 40,
        radius: 1,
        range: 30,
        gravity: 0,
        pierce: 'all',
        affects: ENEMIES,
        onHit: [{ kind: 'damage', amount: { of: 'damage', song: 1.1 }, type: 'song' }],
      },
    ],
    upgrades: [
      { description: '+40 damage (150 + 1.1×SP)', values: { damage: 40 } },
      { description: '-3 s cooldown', cooldownS: -3 },
      { description: '2 charges', charges: 1 },
    ],
  },
  {
    ...base,
    id: 'starling.mob',
    name: 'Mob',
    description:
      'Drop a swarm cloud within 25 m: 5 m radius, 4 s. Enemies inside take 35 + 0.35×SP Song damage a second, are slowed 20% and are revealed.',
    targeting: 'point',
    range: 25,
    cooldownS: 18,
    charges: 1,
    // healR is 0 until T3 switches the heal reduction on, at T2's 6.5 m radius.
    values: { radius: 5, duration: 4, healR: 0 },
    effects: [
      cloud('radius', [{ kind: 'damage', amount: { of: 17.5, song: 0.175 }, type: 'song' }, apply(SLOW, REFRESH_S, 0.2), apply(REVEAL, REFRESH_S)]),
      cloud('healR', [apply(HEAL_REDUCTION, REFRESH_S, 0.5)]),
    ],
    upgrades: [
      { description: 'Lasts +2 s (6 s)', values: { duration: 2 } },
      { description: 'Radius +1.5 m (6.5 m)', values: { radius: 1.5 } },
      { description: 'Enemies inside also suffer 50% heal reduction', values: { healR: 6.5 } },
    ],
  },
  {
    ...base,
    id: 'starling.scatter',
    name: 'Scatter',
    description:
      'Become a swarm for 1 s: intangible, travelling 12 m along your movement keys (forward if none), then reform. Casting removes slows and roots.',
    targeting: 'direction',
    range: 12,
    cooldownS: 20,
    charges: 1,
    // burstR is 0 until T3 switches the reforming burst on.
    values: { dist: 12, burstR: 0 },
    effects: [
      { kind: 'cleanse', remove: [SLOW.id, ROOT.id] },
      apply(INTANGIBLE, 1),
      {
        kind: 'dash',
        distance: 'dist',
        durationS: 1,
        dir: 'move',
        passThrough: true,
        arcHeight: 0,
        onArrive: [burst('burstR', 'point', [{ kind: 'damage', amount: { of: 80, song: 0.8 }, type: 'song' }])],
      },
    ],
    upgrades: [
      { description: '-4 s cooldown', cooldownS: -4 },
      { description: 'Travels +6 m (18 m)', values: { dist: 6 }, range: 6 },
      { description: 'Reforming deals 80 + 0.8×SP Song damage to enemies within 4 m', values: { burstR: 4 } },
    ],
  },
  {
    ...base,
    id: 'starling.blackSun',
    name: 'Black Sun',
    description:
      'After a 0.75 s windup (rooted), a swarm sphere of 10 m radius follows you for 3 s: enemies inside take 100 + 0.9×SP Song damage a second and +15% Song damage from all sources.',
    targeting: 'self',
    range: 10,
    cooldownS: 110,
    castS: 0.75,
    rooted: true,
    charges: 1,
    // burstR is 0 until T3 switches the opening burst on, at the sun's 13 m radius (T1 bought).
    values: { radius: 10, duration: 3, burstR: 0 },
    effects: [
      burst('burstR', 'source', [{ kind: 'damage', amount: { of: 150, song: 1.2 }, type: 'song' }, apply(SILENCE, 1)]),
      sun('radius', [{ kind: 'damage', amount: { of: 50, song: 0.45 }, type: 'song' }, apply(SUN_AMP, REFRESH_S, 0.15)]),
    ],
    upgrades: [
      { description: 'Radius +3 m (13 m)', values: { radius: 3 }, range: 3 },
      { description: 'Lasts +1 s (4 s)', values: { duration: 1 } },
      { description: 'The windup ends with a burst: 150 + 1.2×SP Song damage and a 1 s silence in the radius', values: { burstR: 13 } },
    ],
  },
];

export const starlingDef: HeroDef = {
  id: 'starling',
  name: 'Starling',
  swatch: 0x4b3a78,
  archetype: 'songBurst',
  body: {
    height: 1.5,
    radius: 0.3,
    head: { centre: { right: 0, up: 1.35, forward: 0 }, radius: 0.15 },
    muzzle: { right: 0.25, up: 1.05, forward: 0.35 },
  },
  stats: {
    maxHealth: 540,
    healthRegen: 2,
    moveSpeed: 7,
    sprintSpeed: 2,
    stamina: 3,
    staminaRecharge: 5,
    weaponDamage: 9,
    magazine: 16,
    meleeDamage: 50,
  },
  growth: [
    { stat: 'maxHealth', op: 'add', value: 32 },
    { stat: 'weaponDamage', op: 'pct', value: 0.03 },
    { stat: 'songPower', op: 'add', value: 1 },
    { stat: 'meleeDamage', op: 'add', value: 3 },
  ],
  weapon: {
    name: 'Chatter Pistol',
    pellets: 2,
    spreadDeg: 2,
    fireRate: 4,
    hitscan: false,
    projectileSpeed: 70,
    reloadS: 2,
    reload: 'magazine',
    falloff: { start: 12, end: 30 },
    range: 50,
  },
  abilities,
};
