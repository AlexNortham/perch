/**
 * Cockatoo (GDD §9.22): spirit burst. Every number is the GDD's; "k×SP" scaling is the `song` part of a Magnitude.
 * Tiers only add (D-ABIL-006): a number a tier raises is a named value, an extra effect is appended by the tier,
 * and a channel a tier lengthens does it through the `channelExtraS` value (D-HEROB-001).
 */
import type { AbilityDef, Effect, HeroDef, Magnitude, StatusDef, TargetFilter } from '../../core/contracts';
import { SILENCE } from '../combat';

const ENEMIES: TargetFilter = { teams: 'enemies' };
const song = (of: number | string, k: number): Effect => ({ kind: 'damage', amount: { of, song: k }, type: 'song' });
const apply = (status: StatusDef, durationS: Magnitude, magnitude?: Magnitude): Effect => ({ kind: 'applyStatus', status, durationS, magnitude });
const base = { castS: 0, hook: false } as const;

/** Crest Flare: +25 SP and +15% Song damage; T2's extra +10 SP is a second statMod, so tiers only add. */
const FLARE: Effect = {
  kind: 'statMod',
  id: 'cockatoo.crestFlare',
  name: 'Crest Flare',
  stats: [{ stat: 'songPower', op: 'add', value: 25 }, { stat: 'songDamage', op: 'add', value: 0.15 }],
  durationS: 'duration',
};
const FLARE_SP: Effect = {
  kind: 'statMod',
  id: 'cockatoo.crestFlareSP',
  name: 'Crest Flare',
  stats: [{ stat: 'songPower', op: 'add', value: 10 }],
  durationS: 'duration',
};
/** Crest Flare drops the cooldowns of the other three abilities (slots 0, 2 and 3). */
const FLARE_DROPS: readonly Effect[] = [0, 2, 3].map((slot): Effect => ({ kind: 'cooldownMod', scope: 'slot', slot, mode: 'refund', seconds: 'refund' }));

/** Seed Crack: the nut cracks this long after it lands; the knock-up is 0.5 s in the air (0.78 m at 25 m/s² gravity). */
export const SEED_CRACK = { crackS: 0.8, knockUpM: 0.78125 } as const;

/** Sulphur Shriek: the channel's penalty (50% move speed, no gun); the hook ends it with the channel. */
export const SHRIEK_ABILITY = 'cockatoo.sulphurShriek';
export const SHRIEK_ID = 'cockatoo.shriek';
export const SHRIEK_PULSE_HOOK = 'shriekPulse';
/** An enemy hit by this many pulses of one channel is stunned. */
export const SHRIEK_STUN = { pulses: 3, seconds: 1 } as const;
const SHRIEKING: StatusDef = {
  id: SHRIEK_ID,
  name: 'Shrieking',
  negative: false,
  stacking: 'max',
  maxStacks: 1,
  durationS: 2,
  modifiers: { stats: [{ stat: 'slow', op: 'max', value: 0.5 }], conditions: ['disarmed'] },
};

/** T3: the pulses' -20% Song resist; one instance, so five pulses don't stack it. */
const SHRIEK_SHRED: StatusDef = {
  id: 'cockatoo.shriekShred',
  name: 'Shrieked',
  negative: true,
  stacking: 'max',
  maxStacks: 1,
  durationS: 6,
  modifiers: { stats: [{ stat: 'songShred', op: 'add', value: 0.2 }] },
};

const abilities: [AbilityDef, AbilityDef, AbilityDef, AbilityDef] = [
  {
    ...base,
    channelS: 0,
    id: 'cockatoo.screech',
    name: 'Screech',
    description: 'Enemies in a 14 m, 45 degree cone take 100 + 1.0 x SP Song damage and are silenced for 0.75 s.',
    targeting: 'direction',
    range: 14,
    cooldownS: 11,
    charges: 1,
    values: { damage: 100, silence: 0.75 },
    effects: [
      {
        kind: 'area',
        shape: { kind: 'cone', length: 14, angleDeg: 45 },
        durationS: 0,
        attach: 'source',
        affects: ENEMIES,
        effects: [song('damage', 1), apply(SILENCE, 'silence')],
      },
    ],
    upgrades: [
      { description: '+25 damage (125 + 1.0 x SP)', values: { damage: 25 } },
      { description: '-3 s cooldown', cooldownS: -3 },
      { description: 'Silence 1.5 s', values: { silence: 0.75 } },
    ],
  },
  {
    ...base,
    channelS: 0,
    id: 'cockatoo.crestFlare',
    name: 'Crest Flare',
    description:
      'For 6 s: +25 SP and +15% Song damage. On cast, the cooldowns of your other abilities drop by 3 s.',
    targeting: 'self',
    range: 0,
    cooldownS: 20,
    charges: 1,
    values: { duration: 6, refund: 3 },
    effects: [FLARE, ...FLARE_DROPS],
    upgrades: [
      { description: '+2 s duration (8 s)', values: { duration: 2 } },
      { description: '+10 SP (+35 SP in all)', effects: [FLARE_SP] },
      { description: 'Cooldown drop 6 s', values: { refund: 3 } },
    ],
  },
  {
    ...base,
    channelS: 0,
    id: 'cockatoo.seedCrack',
    name: 'Seed Crack',
    description:
      'A nut lands within 25 m and cracks 0.8 s later: enemies within 5 m take 120 + 1.1 x SP Song damage and are knocked up for 0.5 s.',
    targeting: 'point',
    range: 25,
    cooldownS: 13,
    charges: 1,
    values: { damage: 120, radius: 5 },
    effects: [
      {
        kind: 'delay',
        seconds: SEED_CRACK.crackS,
        effects: [
          {
            kind: 'area',
            shape: { kind: 'sphere', radius: 'radius' },
            durationS: 0,
            attach: 'point',
            affects: ENEMIES,
            effects: [song('damage', 1.1), { kind: 'displace', mode: 'up', distance: SEED_CRACK.knockUpM }],
          },
        ],
      },
    ],
    upgrades: [
      { description: '+1 m radius (6 m)', values: { radius: 1 } },
      { description: '-3 s cooldown', cooldownS: -3 },
      { description: '2 charges', charges: 1 },
    ],
  },
  {
    ...base,
    id: SHRIEK_ABILITY,
    name: 'Sulphur Shriek',
    description:
      'Channel for 2 s at 50% move speed with no gun: 4 pulses, one every 0.5 s, each dealing 80 + 0.7 x SP Song damage to enemies within 15 m. An enemy hit by 3 pulses is stunned 1.0 s.',
    targeting: 'self',
    range: 15,
    cooldownS: 110,
    charges: 1,
    channelS: 2,
    channelIntervalS: 0.5,
    hook: true, // resets the pulse count; the penalty ends with the channel
    values: { radius: 15, duration: 2, channelExtraS: 0, shred: 0 },
    effects: [apply(SHRIEKING, 'duration')],
    channelEffects: [
      {
        kind: 'area',
        shape: { kind: 'sphere', radius: 'radius' },
        durationS: 0,
        attach: 'source',
        affects: ENEMIES,
        // The shred's duration is 0 until T3 raises it, and a status of 0 s applies nothing.
        effects: [song(80, 0.7), apply(SHRIEK_SHRED, 'shred'), { kind: 'hook', name: SHRIEK_PULSE_HOOK }],
      },
    ],
    upgrades: [
      { description: '+3 m radius (18 m)', values: { radius: 3 } },
      { description: '+1 pulse (2.5 s channel)', values: { channelExtraS: 0.5, duration: 0.5 } },
      { description: 'Enemies hit lose 20% Song resist for 6 s', values: { shred: 6 } },
    ],
  },
];

export const cockatooDef: HeroDef = {
  id: 'cockatoo',
  name: 'Cockatoo',
  swatch: 0xf6e04a,
  archetype: 'songBurst',
  body: {
    height: 1.75,
    radius: 0.34,
    head: { centre: { right: 0, up: 1.52, forward: 0 }, radius: 0.18 },
    muzzle: { right: 0.25, up: 1.2, forward: 0.35 },
  },
  stats: {
    maxHealth: 560,
    healthRegen: 2,
    moveSpeed: 7,
    sprintSpeed: 2,
    stamina: 3,
    staminaRecharge: 5,
    weaponDamage: 14,
    magazine: 20,
    meleeDamage: 50,
  },
  growth: [
    { stat: 'maxHealth', op: 'add', value: 32 },
    { stat: 'weaponDamage', op: 'pct', value: 0.03 },
    { stat: 'songPower', op: 'add', value: 1 },
    { stat: 'meleeDamage', op: 'add', value: 3 },
  ],
  weapon: {
    name: 'Screech Horn',
    pellets: 1,
    spreadDeg: 1,
    fireRate: 4.5,
    hitscan: false,
    projectileSpeed: 75,
    reloadS: 2,
    reload: 'magazine',
    falloff: { start: 14, end: 32 },
    range: 60,
  },
  abilities,
};
