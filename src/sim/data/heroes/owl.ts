/**
 * Owl (GDD §9.5): long-range poke. Every number is the GDD's; "k×SP" scaling is the `song` part of a Magnitude.
 * Tiers only add (D-ABIL-006), so a tier that changes a base number adds to a named value, and one that switches
 * something on raises a value that is 0 (an empty area) until the tier. Tiers are bought in order (T1, T2, T3).
 */
import type { AbilityDef, Effect, HeroDef, Magnitude, StatusDef, TargetFilter } from '../../core/contracts';
import { DAMAGE_AMP, REVEAL, SILENCE } from '../combat';

const ENEMIES: TargetFilter = { teams: 'enemies' };
const ENEMY_HEROES: TargetFilter = { teams: 'enemies', heroesOnly: true };
const apply = (status: StatusDef, durationS: Magnitude, magnitude?: Magnitude): Effect => ({ kind: 'applyStatus', status, durationS, magnitude });
const base = { castS: 0, channelS: 0, hook: false } as const;

/** Hush's burst: 3 m, Song damage and a silence, at the hit or at the end of its flight. */
const HUSH_BURST: Effect = {
  kind: 'area',
  shape: { kind: 'sphere', radius: 'radius' },
  durationS: 0,
  attach: 'point',
  affects: ENEMIES,
  effects: [{ kind: 'damage', amount: { of: 'damage', song: 0.8 }, type: 'song' }, apply(SILENCE, 'silence')],
};

/** Night Eyes: true sight for its radius (a strongest-only stat, scaled by the status magnitude) plus the condition. */
export const NIGHT_EYES_SIGHT: StatusDef = {
  id: 'owl.nightEyes',
  name: 'Night Eyes',
  negative: false,
  stacking: 'max',
  maxStacks: 1,
  durationS: 6,
  modifiers: { conditions: ['trueSight'], stats: [{ stat: 'trueSightRadius', op: 'max', value: 1 }] },
};
/** The beak-shot multiplier is ×2.0, so +20% beak damage is +0.4. */
const NIGHT_EYES_BEAK: Effect = {
  kind: 'statMod',
  id: 'owl.nightEyes.beak',
  name: 'Night Eyes: beak shots',
  stats: [{ stat: 'beakShotBonus', op: 'add', value: 0.4 }],
  durationS: 'duration',
};
/** Revealed to the flock for a moment longer than one pulse, so the reveal never flickers. */
const REVEAL_PULSE_S = 0.75;
const pulse = (radius: Magnitude, effects: readonly Effect[]): Effect => ({
  kind: 'area',
  shape: { kind: 'sphere', radius },
  durationS: 'duration',
  attach: 'source',
  affects: ENEMY_HEROES,
  effects,
});

/** Silent Wing's glide: 9 m/s across, 2 m/s down, gun and abilities free. */
export const GLIDE_ID = 'owl.silentWing';
export const GLIDE_GUN_ID = 'owl.silentWing.gun';
const SILENT_FOOTSTEPS: StatusDef = { id: GLIDE_ID, name: 'Silent Wing', negative: false, stacking: 'max', maxStacks: 1, durationS: 4 };
const GLIDE_END: readonly Effect[] = [{ kind: 'cleanse', remove: [GLIDE_ID, GLIDE_GUN_ID] }];
/** Metres up the leap rises: a knock-up of the caster to this height, then the glide takes over. */
const LEAP_M = 6;
export const GLIDE_SPEED = 9;
export const GLIDE_FALL = 2;
const glide = (durationS: Magnitude): Effect => ({
  kind: 'movementMode',
  mode: 'glide',
  durationS,
  speed: GLIDE_SPEED,
  verticalSpeed: GLIDE_FALL,
  allowGun: true,
  allowAbilities: true,
  onEnd: GLIDE_END,
});
/** Ends a glide at once: a one-tick replacement mode (the hook uses it for landing and Space). */
export const GLIDE_STOP: Effect = { ...glide(0.001), speed: 0 };

/** Moonlit Mark's shot: one that stops at the first hero, and (from T3) one that pierces every hero. */
const mark = (range: Magnitude, pierce: 'units' | 'all'): Effect => ({
  kind: 'projectile',
  speed: 220,
  radius: 0.3,
  range,
  gravity: 0,
  pierce,
  affects: ENEMY_HEROES,
  onHit: [
    { kind: 'damage', amount: { of: 'damage', song: 1.8 }, type: 'song', beakShot: true },
    apply(SILENCE, 'silence'),
    apply(REVEAL, 'reveal'),
  ],
});

const abilities: [AbilityDef, AbilityDef, AbilityDef, AbilityDef] = [
  {
    ...base,
    id: 'owl.hush',
    name: 'Hush',
    description: 'Fire a silencing bolt (55 m/s, 45 m). It bursts on impact or at the end of its flight: 85 + 0.8×SP Song damage and a 1.5 s silence in 3 m.',
    targeting: 'direction',
    range: 45,
    cooldownS: 16,
    charges: 1,
    values: { damage: 85, radius: 3, silence: 1.5 },
    effects: [
      {
        kind: 'projectile',
        speed: 55,
        radius: 0.3,
        range: 45,
        gravity: 0,
        pierce: 'none',
        affects: ENEMIES,
        onHit: [],
        onExpire: [HUSH_BURST],
      },
    ],
    upgrades: [
      { description: 'Burst radius +1 m (4 m)', values: { radius: 1 } },
      { description: 'Silence +0.75 s (2.25 s)', values: { silence: 0.75 } },
      { description: '2 charges', charges: 1 },
    ],
  },
  {
    ...base,
    id: 'owl.nightEyes',
    name: 'Night Eyes',
    description:
      'For 6 s you see invisible enemies within 30 m, every enemy hero within 35 m is revealed to your flock, and your beak shots deal +20% damage.',
    targeting: 'self',
    range: 35,
    cooldownS: 24,
    charges: 1,
    // sight and reveal are the two radii. ampRadius is 0 until T3 switches the +10% damage on, at T1's 45 m.
    values: { duration: 6, sight: 30, reveal: 35, ampRadius: 0, amp: 0 },
    effects: [
      apply(NIGHT_EYES_SIGHT, 'duration', 'sight'),
      NIGHT_EYES_BEAK,
      pulse('reveal', [apply(REVEAL, REVEAL_PULSE_S)]),
      pulse('ampRadius', [apply(DAMAGE_AMP, REVEAL_PULSE_S, 'amp')]),
    ],
    upgrades: [
      { description: 'True sight 40 m and reveal 45 m (+10 m to both)', values: { sight: 10, reveal: 10 } },
      { description: 'Lasts +3 s (9 s)', values: { duration: 3 } },
      { description: 'Revealed enemies take +10% damage (within 45 m)', values: { ampRadius: 45, amp: 0.1 } },
    ],
  },
  {
    ...base,
    id: 'owl.silentWing',
    name: 'Silent Wing',
    description: 'Leap 6 m up, then glide for up to 4 s (falling 2 m/s, 9 m/s across, steer with WASD). The gun works while gliding. Landing or Space ends it.',
    targeting: 'self',
    range: 0,
    cooldownS: 18,
    charges: 1,
    values: { glide: 4, gunBonus: 0 },
    effects: [
      { kind: 'displace', mode: 'up', distance: LEAP_M },
      glide('glide'),
      { kind: 'applyStatus', status: SILENT_FOOTSTEPS, durationS: 'glide' },
    ],
    upgrades: [
      { description: 'Glide +2 s (6 s)', values: { glide: 2 } },
      { description: '-5 s cooldown', cooldownS: -5 },
      {
        description: '+25% gun damage while gliding',
        effects: [{ kind: 'statMod', id: GLIDE_GUN_ID, name: 'Silent Wing: gun', stats: [{ stat: 'gunDamage', op: 'add', value: 0.25 }], durationS: 'glide' }],
      },
    ],
  },
  {
    ...base,
    id: 'owl.moonlitMark',
    name: 'Moonlit Mark',
    description:
      'Root and channel for 1.2 s, then fire a 220 m/s shot (120 m) that passes fledglings and neutrals and stops at the first hero: 260 + 1.8×SP Song damage (a beak shot deals ×1.5), a 2.5 s silence and an 8 s reveal.',
    targeting: 'direction',
    range: 120,
    cooldownS: 90,
    castS: 1.2,
    channelS: 0,
    rooted: true,
    hook: false,
    charges: 1,
    // rangeUnits is the shot that stops at a hero; T3 swaps it for rangeAll, the shot that pierces them.
    values: { damage: 260, silence: 2.5, reveal: 8, rangeUnits: 120, rangeAll: 0 },
    effects: [mark('rangeUnits', 'units'), mark('rangeAll', 'all')],
    upgrades: [
      { description: '+80 damage (340 + 1.8×SP)', values: { damage: 80 } },
      { description: '-20 s cooldown', cooldownS: -20 },
      { description: 'The shot also pierces heroes, hitting each for full damage', values: { rangeUnits: -120, rangeAll: 120 } },
    ],
  },
];

export const owlDef: HeroDef = {
  id: 'owl',
  name: 'Owl',
  swatch: 0xb98a55,
  archetype: 'poke',
  body: {
    height: 1.7,
    radius: 0.36,
    head: { centre: { right: 0, up: 1.45, forward: 0 }, radius: 0.24 },
    muzzle: { right: 0.25, up: 1.1, forward: 0.4 },
  },
  stats: {
    maxHealth: 520,
    healthRegen: 2,
    moveSpeed: 7,
    sprintSpeed: 2,
    stamina: 3,
    staminaRecharge: 5,
    weaponDamage: 52,
    magazine: 6,
    meleeDamage: 50,
  },
  growth: [
    { stat: 'maxHealth', op: 'add', value: 30 },
    { stat: 'weaponDamage', op: 'pct', value: 0.03 },
    { stat: 'songPower', op: 'add', value: 1 },
    { stat: 'meleeDamage', op: 'add', value: 3 },
  ],
  weapon: {
    name: 'Hush Rifle',
    pellets: 1,
    spreadDeg: 0.1,
    fireRate: 1.25,
    hitscan: true,
    projectileSpeed: 0,
    reloadS: 2.6,
    reload: 'magazine',
    falloff: { start: 40, end: 90 },
    range: 200,
    beakShotMult: 2,
    aimRange: 220,
    aimZoom: 0.5,
  },
  abilities,
};
