/**
 * Shrike (GDD §9.1): area control. Every number is the GDD's; "k×SP" scaling is the `song` part of a Magnitude.
 * Per-second numbers are halved per tick because areas and DoTs tick every 0.5 s (GDD §5.12).
 */
import type { AbilityDef, Effect, HeroDef, Magnitude, StatusDef, TargetFilter } from '../../core/contracts';
import { GROUNDED, HEAL_REDUCTION, REVEAL, ROOT, SLOW, SONG_AMP, STUN } from '../combat';

const ENEMIES: TargetFilter = { teams: 'enemies' };
const ENEMY_HEROES: TargetFilter = { teams: 'enemies', heroesOnly: true };
const song = (of: number | string, k: number): Effect => ({ kind: 'damage', amount: { of, song: k }, type: 'song' });
const apply = (status: StatusDef, durationS: Magnitude, magnitude?: Magnitude): Effect => ({ kind: 'applyStatus', status, durationS, magnitude });
const burst = (radius: Magnitude, affects: TargetFilter, effects: readonly Effect[]): Effect => ({
  kind: 'area',
  shape: { kind: 'sphere', radius },
  durationS: 0,
  attach: 'point',
  affects,
  effects,
});
const zone = (radius: Magnitude, durationS: Magnitude, affects: TargetFilter, effects: readonly Effect[]): Effect => ({
  kind: 'area',
  shape: { kind: 'cylinder', radius, height: 4 },
  durationS,
  attach: 'point',
  affects,
  effects,
});
const base = { castS: 0, channelS: 0, hook: false } as const;

/** The pin: what a wall slam adds to Impaling Bolt. */
export const BOLT_PIN: readonly Effect[] = [song(40, 0.4), apply(STUN, 'pinStun')];

const boltProjectile = (range: 'singleRange' | 'pierceRange'): Effect => ({
  kind: 'projectile',
  speed: 70,
  radius: 0.4,
  range,
  gravity: 0,
  pierce: range === 'singleRange' ? 'none' : 'all',
  affects: ENEMY_HEROES,
  onHit: [
    song('damage', 0.8),
    { kind: 'displace', mode: 'along', distance: 6, onWall: BOLT_PIN },
  ],
});

const abilities: [AbilityDef, AbilityDef, AbilityDef, AbilityDef] = [
  {
    ...base,
    id: 'shrike.thornLarder',
    name: 'Thorn Larder',
    description: 'Plant a thorn trap (arms after 0.75 s, lasts 60 s, at most 4). The first enemy hero within 1.5 m takes 80 + 0.9 x SP Song damage, is rooted 1 s and revealed 4 s. Two charges.',
    targeting: 'point',
    range: 20,
    cooldownS: 14,
    charges: 2,
    // burst is the radius of the hit: the triggering hero only (1.5 m) until T3 widens it to 4 m.
    values: { damage: 80, root: 1, burst: 1.5 },
    effects: [
      {
        kind: 'delay', // arms after 0.75 s
        seconds: 0.75,
        effects: [
          {
            kind: 'summon',
            summon: 'trap',
            health: 0,
            durationS: 60,
            maxCount: 4,
            behaviour: 'trap',
            trigger: { radius: 1.5, affects: ENEMY_HEROES },
            effects: [burst('burst', ENEMY_HEROES, [song('damage', 0.9), apply(ROOT, 'root'), apply(REVEAL, 4)])],
          },
        ],
      },
    ],
    upgrades: [
      { description: '+1 charge (3 charges)', charges: 1 },
      { description: 'Root lasts 1.5 s', values: { root: 0.5 } },
      { description: 'Trigger bursts in a 4 m radius and hits every enemy hero in it', values: { burst: 2.5 } },
    ],
  },
  {
    ...base,
    id: 'shrike.briarPatch',
    name: 'Briar Patch',
    description: 'A 5 m zone for 6 s: enemies inside take 25 + 0.3 x SP Song damage a second and are slowed 30%.',
    targeting: 'point',
    range: 25,
    cooldownS: 18,
    charges: 1,
    values: { radius: 5 },
    effects: [zone('radius', 6, ENEMIES, [song(12.5, 0.15), apply(SLOW, 0.6, 0.3)])],
    upgrades: [
      { description: '+1.5 m radius (6.5 m)', values: { radius: 1.5 } },
      { description: '-4 s cooldown', cooldownS: -4 },
      // A tier that adds to a lasting zone appends a parallel zone of the same size (D-ABIL-006).
      { description: 'Enemies inside are grounded and take +15% Song damage', effects: [zone('radius', 6, ENEMIES, [apply(GROUNDED, 0.6), apply(SONG_AMP, 0.6, 0.15)])] },
    ],
  },
  {
    ...base,
    id: 'shrike.impalingBolt',
    name: 'Impaling Bolt',
    description: 'A bolt (35 m): the first enemy hero hit takes 70 + 0.8 x SP Song damage and is knocked back 6 m. If they hit a wall they are pinned, stunned 1.25 s and take 40 + 0.4 x SP more.',
    targeting: 'direction',
    range: 35,
    cooldownS: 16,
    charges: 1,
    // Tier 3 pierces: the single-target bolt's range drops to 0 (no bolt) and the piercing bolt's rises to 35 (D-ABIL-006).
    values: { damage: 70, pinStun: 1.25, singleRange: 35, pierceRange: 0 },
    effects: [boltProjectile('singleRange'), boltProjectile('pierceRange')],
    upgrades: [
      { description: '+30 damage (100 + 0.8 x SP)', values: { damage: 30 } },
      { description: '-4 s cooldown', cooldownS: -4 },
      { description: 'Pierces all heroes; pin stun 2.0 s', values: { pinStun: 0.75, singleRange: -35, pierceRange: 35 } },
    ],
  },
  {
    ...base,
    id: 'shrike.butchersRing',
    name: "Butcher's Ring",
    description: 'After 0.8 s a ring of thorns (9 m radius) stands for 6 s. A hero crossing it takes 150 + 1.4 x SP Song damage and is rooted 1.25 s (once per 1.5 s). Enemies inside have 40% heal reduction. It does not block shots.',
    targeting: 'point',
    range: 25,
    cooldownS: 110,
    charges: 1,
    values: { duration: 6 },
    effects: [
      {
        kind: 'delay', // stands after 0.8 s
        seconds: 0.8,
        effects: [
          {
            kind: 'area',
            shape: { kind: 'ring', inner: 8.75, outer: 9.25, height: 1.5 },
            durationS: 'duration',
            intervalS: 1.5, // onCross fires once per hero per 1.5 s (D-ABIL-004)
            attach: 'point',
            affects: ENEMY_HEROES,
            effects: [],
            onCross: [song(150, 1.4), apply(ROOT, 1.25)],
          },
          zone(9, 'duration', ENEMIES, [apply(HEAL_REDUCTION, 0.6, 0.4)]),
        ],
      },
    ],
    upgrades: [
      { description: '+2 s duration (8 s)', values: { duration: 2 } },
      { description: '-25 s cooldown', cooldownS: -25 },
      {
        description: 'Enemies inside also take 30 + 0.3 x SP Song damage per second',
        effects: [{ kind: 'delay', seconds: 0.8, effects: [zone(9, 'duration', ENEMIES, [song(15, 0.15)])] }],
      },
    ],
  },
];

export const shrikeDef: HeroDef = {
  id: 'shrike',
  name: 'Shrike',
  archetype: 'areaControl',
  body: {
    height: 1.75,
    radius: 0.32,
    head: { centre: { right: 0, up: 1.55, forward: 0 }, radius: 0.17 },
    muzzle: { right: 0.25, up: 1.22, forward: 0.35 },
  },
  stats: {
    maxHealth: 580,
    healthRegen: 2,
    moveSpeed: 7,
    sprintSpeed: 2,
    stamina: 3,
    staminaRecharge: 5,
    weaponDamage: 14,
    magazine: 24,
    meleeDamage: 50,
  },
  growth: [
    { stat: 'maxHealth', op: 'add', value: 34 },
    { stat: 'weaponDamage', op: 'pct', value: 0.03 },
    { stat: 'songPower', op: 'add', value: 1 },
    { stat: 'meleeDamage', op: 'add', value: 3 },
  ],
  weapon: {
    name: 'Barb Rifle',
    pellets: 1,
    spreadDeg: 0.6,
    fireRate: 6,
    hitscan: false,
    projectileSpeed: 180,
    reloadS: 2.2,
    reload: 'magazine',
    falloff: { start: 20, end: 45 },
    range: 120,
  },
  abilities,
};
