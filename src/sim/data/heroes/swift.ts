/**
 * Swift (GDD §9.15): mobility skirmisher. Every number is the GDD's; "k×SP" scaling is the `song` part of a Magnitude.
 * Per-second numbers are halved per tick because areas tick every 0.5 s (GDD §5.12). Tiers only add (D-ABIL-006).
 */
import type { AbilityDef, Effect, HeroDef, Magnitude, StatusDef, TargetFilter } from '../../core/contracts';
import { FIRE_RATE_SLOW, SLOW } from '../combat';

const ENEMIES: TargetFilter = { teams: 'enemies' };
const song = (of: number | string, k: number): Effect => ({ kind: 'damage', amount: { of, song: k }, type: 'song' });
const apply = (status: StatusDef, durationS: Magnitude, magnitude?: Magnitude): Effect => ({ kind: 'applyStatus', status, durationS, magnitude });
const base = { castS: 0, channelS: 0, hook: false } as const;

/** Screaming Party's aura rides on the caster. */
const aura = (effects: readonly Effect[]): Effect => ({
  kind: 'area',
  shape: { kind: 'cylinder', radius: 'radius', height: 4 },
  durationS: 'duration',
  attach: 'source',
  affects: ENEMIES,
  effects,
});

/** Sky Stitch: flight is held to this height above the ground by the hook. */
export const SKY_STITCH_CEILING_M = 25;
/** T3: where the flight ends, the hook slams the ground below. */
export const SKY_STITCH_SLAM: readonly Effect[] = [
  {
    kind: 'area',
    shape: { kind: 'sphere', radius: 5 },
    durationS: 0,
    attach: 'point',
    affects: ENEMIES,
    effects: [song(120, 1)],
  },
];

/** Slipstream T3: the damage an enemy takes as you pass through (the hook applies it from the dash's hits). */
export const SLIPSTREAM_PASS: Effect = { kind: 'damage', amount: { of: 'pass', song: 0.5 }, type: 'song' };

const abilities: [AbilityDef, AbilityDef, AbilityDef, AbilityDef] = [
  {
    ...base,
    id: 'swift.slipstream',
    name: 'Slipstream',
    description: 'Dash 16 m in 0.35 s along your aim (up to 45 degrees upward), on the ground or in the air. Two charges.',
    targeting: 'direction',
    range: 16,
    cooldownS: 9,
    charges: 2,
    values: { pass: 0 },
    effects: [
      {
        kind: 'dash',
        distance: 16,
        durationS: 0.35,
        dir: 'aim',
        maxPitchUpDeg: 45,
        passThrough: true,
        onHit: [{ kind: 'hook', name: 'slipstreamHit' }],
      },
    ],
    upgrades: [
      { description: '+1 charge (3 charges)', charges: 1 },
      { description: '-2 s cooldown', cooldownS: -2 },
      { description: 'Enemies you pass through take 50 + 0.5 x SP Song damage', values: { pass: 50 } },
    ],
  },
  {
    ...base,
    id: 'swift.screamingParty',
    name: 'Screaming Party',
    description:
      'For 4 s, enemies within 6 m of you take 25 + 0.25 x SP Song damage a second and are slowed 15%, and you move 20% faster.',
    targeting: 'self',
    range: 6,
    cooldownS: 16,
    charges: 1,
    values: { duration: 4, radius: 6 },
    effects: [
      { kind: 'statMod', id: 'swift.party', name: 'Screaming Party', stats: [{ stat: 'moveSpeed', op: 'pct', value: 0.2 }], durationS: 'duration' },
      aura([song(12.5, 0.125), apply(SLOW, 0.6, 0.15)]),
    ],
    upgrades: [
      { description: '+2 s duration (6 s)', values: { duration: 2 } },
      { description: '+3 m radius (9 m)', values: { radius: 3 }, range: 3 },
      { description: 'Enemies inside also lose 25% fire rate', effects: [aura([apply(FIRE_RATE_SLOW, 0.6, 0.25)])] },
    ],
  },
  {
    ...base,
    id: 'swift.wingScythe',
    name: 'Wing Scythe',
    description:
      'Throw a blade 25 m at 40 m/s; it returns to you, piercing. It deals 70 + 0.7 x SP Song damage on each pass and slows 25% for 1.5 s.',
    targeting: 'direction',
    range: 25,
    cooldownS: 12,
    charges: 1,
    hook: true, // counts passes per hero so the return pass can stun (T3)
    values: { damage: 70, stun: 0 },
    effects: [
      {
        kind: 'projectile',
        speed: 40,
        radius: 0.6,
        range: 25,
        gravity: 0,
        pierce: 'all',
        returns: true,
        maxHitsPerTarget: 2,
        affects: ENEMIES,
        onHit: [song('damage', 0.7), apply(SLOW, 1.5, 0.25), { kind: 'hook', name: 'scytheHit' }],
      },
    ],
    upgrades: [
      { description: '+25 damage (95 + 0.7 x SP)', values: { damage: 25 } },
      { description: '-3 s cooldown', cooldownS: -3 },
      { description: 'The return pass also stuns for 0.5 s', values: { stun: 0.5 } },
    ],
  },
  {
    ...base,
    id: 'swift.skyStitch',
    name: 'Sky Stitch',
    description:
      'Free flight for 6 s (12 m/s in any direction, up to 25 m above the ground). Your gun works and deals +20% damage.',
    targeting: 'self',
    range: 0,
    cooldownS: 100,
    charges: 1,
    hook: true, // holds the height ceiling; slams the ground when the flight ends (T3)
    values: { duration: 6, slam: 0 },
    effects: [
      {
        kind: 'movementMode',
        mode: 'flight',
        durationS: 'duration',
        speed: 12,
        verticalSpeed: 12,
        allowGun: true,
        allowAbilities: true,
        onEnd: [{ kind: 'hook', name: 'skyStitchSlam' }],
      },
      { kind: 'statMod', id: 'swift.skyStitch', name: 'Sky Stitch', stats: [{ stat: 'gunDamage', op: 'add', value: 0.2 }], durationS: 'duration' },
    ],
    upgrades: [
      { description: '+2 s duration (8 s)', values: { duration: 2 } },
      {
        description: '+20% fire rate during flight',
        effects: [{ kind: 'statMod', id: 'swift.skyStitch.rate', name: 'Sky Stitch: fire rate', stats: [{ stat: 'fireRate', op: 'add', value: 0.2 }], durationS: 'duration' }],
      },
      { description: 'When it ends, slam the ground below: 5 m radius, 120 + 1.0 x SP Song damage', values: { slam: 1 } },
    ],
  },
];

export const swiftDef: HeroDef = {
  id: 'swift',
  name: 'Swift',
  swatch: 0x6b5d54,
  archetype: 'skirmisher',
  body: {
    height: 1.5,
    radius: 0.26,
    head: { centre: { right: 0, up: 1.35, forward: 0 }, radius: 0.15 },
    muzzle: { right: 0.3, up: 1.05, forward: 0.35 },
  },
  stats: {
    maxHealth: 500,
    healthRegen: 2,
    moveSpeed: 7.6,
    sprintSpeed: 2,
    stamina: 4,
    staminaRecharge: 5,
    weaponDamage: 7,
    magazine: 42,
    meleeDamage: 50,
  },
  growth: [
    { stat: 'maxHealth', op: 'add', value: 29 },
    { stat: 'weaponDamage', op: 'pct', value: 0.03 },
    { stat: 'songPower', op: 'add', value: 1 },
    { stat: 'meleeDamage', op: 'add', value: 3 },
  ],
  weapon: {
    name: 'Sickle SMG',
    pellets: 1,
    spreadDeg: 2,
    fireRate: 12,
    hitscan: true,
    projectileSpeed: 0,
    reloadS: 1.6,
    reload: 'magazine',
    falloff: { start: 10, end: 24 },
    range: 120,
  },
  abilities,
};
