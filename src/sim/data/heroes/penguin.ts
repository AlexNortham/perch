/**
 * Penguin (GDD §9.11): tank and initiator. Every number is the GDD's; "k×SP" scaling is the `song` part of a Magnitude.
 * Tiers only add (D-ABIL-006): a number a tier raises is a named value, an extra effect is appended by the tier.
 */
import type { AbilityDef, Effect, HeroDef, Magnitude, StatusDef, TargetFilter } from '../../core/contracts';
import { GROUNDED, SLOW, UNSTOPPABLE } from '../combat';

const ENEMIES: TargetFilter = { teams: 'enemies' };
const ALLY_HEROES: TargetFilter = { teams: 'allies', self: true, heroesOnly: true };
const song = (of: number | string, k: number): Effect => ({ kind: 'damage', amount: { of, song: k }, type: 'song' });
const apply = (status: StatusDef, durationS: Magnitude, magnitude?: Magnitude): Effect => ({ kind: 'applyStatus', status, durationS, magnitude });
const base = { castS: 0, channelS: 0, hook: false } as const;

/** Hook and constants shared with the hero module. */
export const TOBOGGAN_HIT_HOOK = 'tobogganHit';
/** Toboggan's side knockback and the T3 knock-up (0.5 s in the air at 25 m/s² gravity: 0.78 m). */
export const TOBOGGAN_ASIDE_M = 4;
export const TOBOGGAN_KNOCK_UP_M = 0.78;
/** Space ends the slide with Physics' 1.2 m hop (AIR.tobogganHopApex), which keeps the slide speed. */
export const TOBOGGAN = { speed: 13, durationS: 3 } as const;
/** Emperor's March: touched heroes go up 1.0 s (3.125 m at 25 m/s² gravity); the slam is 6 m. */
export const MARCH = { touchHit: 150, touchK: 1.2, knockUpM: 3.125, slamRadius: 6, slamHit: 100, slamK: 0.8 } as const;
export const MARCH_SPEED_ID = 'penguin.march';

const speed = (id: string, name: string, value: number, durationS: Magnitude): Effect => ({
  kind: 'statMod',
  id,
  name,
  stats: [{ stat: 'moveSpeed', op: 'pct', value }],
  durationS,
});

const abilities: [AbilityDef, AbilityDef, AbilityDef, AbilityDef] = [
  {
    ...base,
    id: 'penguin.toboggan',
    name: 'Toboggan',
    description:
      'Belly-slide up to 3 s at 13 m/s, steering with the mouse (no gun). Enemies you hit take 60 + 0.6 x SP Song damage and are knocked 4 m aside, once each. Space ends it with a 1.2 m hop.',
    targeting: 'self',
    range: 0,
    cooldownS: 16,
    charges: 1,
    hook: true, // the aside knockback
    values: { damage: 60, knockUp: 0 },
    effects: [
      {
        kind: 'movementMode',
        mode: 'toboggan',
        durationS: TOBOGGAN.durationS,
        speed: TOBOGGAN.speed,
        verticalSpeed: 0,
        allowGun: false,
        allowAbilities: true,
        onCollide: [song('damage', 0.6), { kind: 'hook', name: TOBOGGAN_HIT_HOOK }],
      },
    ],
    upgrades: [
      { description: '+25 damage (85 + 0.6 x SP)', values: { damage: 25 } },
      { description: '-4 s cooldown', cooldownS: -4 },
      { description: 'Enemies hit are knocked up for 0.5 s instead of aside', values: { knockUp: 1 } },
    ],
  },
  {
    ...base,
    id: 'penguin.huddle',
    name: 'Huddle',
    description: 'You and allies within 6 m get a barrier of 180 + 1.5 x SP for 4 s.',
    targeting: 'self',
    range: 6,
    cooldownS: 22,
    charges: 1,
    values: { barrier: 180, radius: 6 },
    effects: [
      {
        kind: 'area',
        shape: { kind: 'sphere', radius: 'radius' },
        durationS: 0,
        attach: 'source',
        affects: ALLY_HEROES,
        effects: [{ kind: 'shield', absorbs: 'barrier', amount: { of: 'barrier', song: 1.5 }, durationS: 4 }],
      },
    ],
    upgrades: [
      { description: '+60 barrier (240 + 1.5 x SP)', values: { barrier: 60 } },
      { description: '+4 m radius (10 m)', values: { radius: 4 } },
      {
        description: 'Also +25% status resist for 4 s',
        effects: [
          {
            kind: 'area',
            shape: { kind: 'sphere', radius: 'radius' },
            durationS: 0,
            attach: 'source',
            affects: ALLY_HEROES,
            effects: [{ kind: 'statMod', id: 'penguin.huddle', name: 'Huddle', stats: [{ stat: 'statusResist', op: 'stack', value: 0.25 }], durationS: 4 }],
          },
        ],
      },
    ],
  },
  {
    ...base,
    id: 'penguin.iceFloe',
    name: 'Ice Floe',
    description: 'An ice patch of 6 m radius for 5 s: enemies on it are slowed 35%, allies on it get +20% move speed.',
    targeting: 'point',
    range: 20,
    cooldownS: 18,
    charges: 1,
    values: { radius: 6, duration: 5 },
    effects: [
      {
        kind: 'area',
        shape: { kind: 'cylinder', radius: 'radius', height: 3 },
        durationS: 'duration',
        attach: 'point',
        affects: ENEMIES,
        effects: [apply(SLOW, 0.6, 0.35)],
      },
      {
        kind: 'area',
        shape: { kind: 'cylinder', radius: 'radius', height: 3 },
        durationS: 'duration',
        attach: 'point',
        affects: ALLY_HEROES,
        effects: [speed('penguin.floeSpeed', 'Ice Floe', 0.2, 0.6)],
      },
    ],
    upgrades: [
      { description: '+2 s duration (7 s)', values: { duration: 2 } },
      { description: '+2 m radius (8 m)', values: { radius: 2 } },
      {
        description: 'Enemies on it are also grounded',
        effects: [
          {
            kind: 'area',
            shape: { kind: 'cylinder', radius: 'radius', height: 3 },
            durationS: 'duration',
            attach: 'point',
            affects: ENEMIES,
            effects: [apply(GROUNDED, 0.6)],
          },
        ],
      },
    ],
  },
  {
    ...base,
    id: 'penguin.emperorsMarch',
    name: "Emperor's March",
    description:
      'For 3 s you are unstoppable with +40% move speed; enemy heroes you touch are knocked up 1.0 s and take 150 + 1.2 x SP Song damage, once each. It ends with a 6 m slam: 100 + 0.8 x SP Song damage and a 0.75 s stun.',
    targeting: 'self',
    range: 0,
    cooldownS: 110,
    charges: 1,
    hook: true, // touching heroes and the slam at the end
    values: { duration: 3, stun: 0.75 },
    effects: [apply(UNSTOPPABLE, 'duration'), speed(MARCH_SPEED_ID, "Emperor's March", 0.4, 'duration')],
    upgrades: [
      { description: '+1 s duration (4 s)', values: { duration: 1 } },
      { description: 'Slam stun +0.5 s (1.25 s)', values: { stun: 0.5 } },
      { description: '-30 s cooldown (80 s)', cooldownS: -30 },
    ],
  },
];

export const penguinDef: HeroDef = {
  id: 'penguin',
  name: 'Penguin',
  swatch: 0xf2a81d,
  archetype: 'tank',
  body: {
    height: 1.6,
    radius: 0.42,
    head: { centre: { right: 0, up: 1.42, forward: 0 }, radius: 0.18 },
    muzzle: { right: 0.32, up: 1.1, forward: 0.35 },
  },
  stats: {
    maxHealth: 700,
    healthRegen: 2,
    moveSpeed: 6.6,
    sprintSpeed: 2,
    stamina: 3,
    staminaRecharge: 5,
    weaponDamage: 10,
    magazine: 35,
    meleeDamage: 50,
  },
  growth: [
    { stat: 'maxHealth', op: 'add', value: 44 },
    { stat: 'weaponDamage', op: 'pct', value: 0.03 },
    { stat: 'songPower', op: 'add', value: 1 },
    { stat: 'meleeDamage', op: 'add', value: 3 },
  ],
  weapon: {
    name: 'Ice Chipper',
    pellets: 1,
    spreadDeg: 1.8,
    fireRate: 7,
    hitscan: false,
    projectileSpeed: 80,
    reloadS: 2.5,
    reload: 'magazine',
    falloff: { start: 10, end: 25 },
    range: 60,
  },
  abilities,
};
