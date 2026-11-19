/**
 * Hornbill (GDD §9.9): gun carry. Every number is the GDD's; "k×SP" scaling is the `song` part of a Magnitude.
 * Tiers only add (D-ABIL-006): a number a tier raises is a named value, an extra effect is appended by the tier.
 */
import type { AbilityDef, Effect, HeroDef, StatusDef, WeaponModEffect } from '../../core/contracts';
import { REVEAL, TALON_SHRED } from '../combat';

const base = { castS: 0, channelS: 0, hook: false } as const;

/** Status ids the hook reads back. */
export const MUD_RATE_ID = 'hornbill.mudSeal';
export const MARK_ID = 'hornbill.marked';
/** Marked Prey's tag: no modifiers of its own, the gun's weaponMod looks for it (onlyVsStatus). */
const MARKED: StatusDef = { id: MARK_ID, name: 'Marked', negative: true, stacking: 'max', maxStacks: 1, durationS: 10 };
/** Hook names. The slow rides on Heavy Rounds' bullets but a bullet-hit effect can't filter to heroes itself. */
export const HEAVY_SLOW_HOOK = 'heavySlow';
export const HOP_SLICK_HOOK = 'hopSlick';
/** Heavy Rounds' slow on heroes. */
export const HEAVY_SLOW = { magnitude: 0.15, durationS: 1.5 } as const;
/** The slick left where Bounding Hop took off (T3): 4 m for 3 s, 30% slow. */
export const SLICK = { radius: 4, durationS: 3, slow: 0.3 } as const;

const heavy = (extra: Partial<WeaponModEffect> = {}): Effect => ({ kind: 'weaponMod', durationS: 8, shots: 'rounds', ...extra });

const abilities: [AbilityDef, AbilityDef, AbilityDef, AbilityDef] = [
  {
    ...base,
    id: 'hornbill.heavyRounds',
    name: 'Heavy Rounds',
    description: 'Your next 6 shots within 8 s deal +40% gun damage and slow heroes they hit by 15% for 1.5 s.',
    targeting: 'self',
    range: 0,
    cooldownS: 14,
    charges: 1,
    hook: true, // the slow only lands on heroes
    values: { rounds: 6 },
    effects: [heavy({ gunDamage: 0.4, onBulletHit: [{ kind: 'hook', name: HEAVY_SLOW_HOOK }] })],
    upgrades: [
      { description: '+2 rounds: 8 heavy shots', values: { rounds: 2 } },
      { description: '-3 s cooldown', cooldownS: -3 },
      { description: 'Heavy rounds pierce one extra target', effects: [heavy({ pierce: 1 })] },
    ],
  },
  {
    ...base,
    id: 'hornbill.mudSeal',
    name: 'Mud Seal',
    description: 'A barrier of 200 + 2.0 x SP for 5 s. While it holds you fire 20% faster.',
    targeting: 'self',
    range: 0,
    cooldownS: 22,
    charges: 1,
    hook: true, // the fire rate ends with the barrier; T3 holds slows off you
    values: { barrier: 200 },
    effects: [
      { kind: 'shield', absorbs: 'barrier', amount: { of: 'barrier', song: 2 }, durationS: 5 },
      { kind: 'statMod', id: MUD_RATE_ID, name: 'Mud Seal', stats: [{ stat: 'fireRate', op: 'add', value: 0.2 }], durationS: 5 },
    ],
    upgrades: [
      { description: '+100 barrier (300 + 2.0 x SP)', values: { barrier: 100 } },
      { description: '-5 s cooldown', cooldownS: -5 },
      { description: 'While the barrier holds you are immune to slows' },
    ],
  },
  {
    ...base,
    id: 'hornbill.boundingHop',
    name: 'Bounding Hop',
    description: 'Hop 8 m the way you are moving (0.4 s arc, 2 m high) and reload half your magazine.',
    targeting: 'direction',
    range: 8,
    cooldownS: 12,
    charges: 1,
    hook: true, // T3's slick is placed where you take off
    values: {},
    effects: [
      { kind: 'dash', distance: 8, durationS: 0.4, dir: 'move', arcHeight: 2 },
      { kind: 'weaponMod', durationS: 0, reloadFraction: 0.5 },
    ],
    upgrades: [
      { description: '-2 s cooldown', cooldownS: -2 },
      { description: '2 charges', charges: 1 },
      {
        description: 'Leaves a 4 m slick where you took off: enemies on it are slowed 30% for 3 s',
        effects: [{ kind: 'hook', name: HOP_SLICK_HOOK }],
      },
    ],
  },
  {
    ...base,
    id: 'hornbill.markedPrey',
    name: 'Marked Prey',
    description:
      'Mark an enemy hero within 40 m for 10 s: it is revealed, your gun deals +40% damage to it and ignores falloff against it. If it dies marked, half the cooldown (45 s) is refunded.',
    targeting: 'unit',
    affects: { teams: 'enemies', heroesOnly: true },
    range: 40,
    cooldownS: 90,
    charges: 1,
    hook: true, // the refund
    values: { duration: 10 },
    effects: [
      { kind: 'applyStatus', status: MARKED, durationS: 'duration' },
      { kind: 'applyStatus', status: REVEAL, durationS: 'duration' },
    ],
    selfEffects: [{ kind: 'weaponMod', durationS: 'duration', gunDamage: 0.4, ignoreFalloff: true, onlyVsStatus: MARK_ID }],
    upgrades: [
      { description: '+4 s duration (14 s)', values: { duration: 4 } },
      {
        description: 'Your gun deals +60% damage to the mark',
        selfEffects: [{ kind: 'weaponMod', durationS: 'duration', gunDamage: 0.2, onlyVsStatus: MARK_ID }],
      },
      { description: 'The mark also has -20% Talon resist', effects: [{ kind: 'applyStatus', status: TALON_SHRED, durationS: 'duration', magnitude: 0.2 }] },
    ],
  },
];

export const hornbillDef: HeroDef = {
  id: 'hornbill',
  name: 'Hornbill',
  swatch: 0xd2452b,
  archetype: 'gunCarry',
  body: {
    height: 1.95,
    radius: 0.38,
    head: { centre: { right: 0, up: 1.72, forward: 0 }, radius: 0.2 },
    muzzle: { right: 0.25, up: 1.38, forward: 0.35 },
  },
  stats: {
    maxHealth: 620,
    healthRegen: 2,
    moveSpeed: 6.9,
    sprintSpeed: 2,
    stamina: 3,
    staminaRecharge: 5,
    weaponDamage: 30,
    magazine: 15,
    meleeDamage: 50,
  },
  growth: [
    { stat: 'maxHealth', op: 'add', value: 36 },
    { stat: 'weaponDamage', op: 'pct', value: 0.04 },
    { stat: 'songPower', op: 'add', value: 1 },
    { stat: 'meleeDamage', op: 'add', value: 3 },
  ],
  weapon: {
    name: 'Casque Rifle',
    pellets: 1,
    spreadDeg: 0.5,
    fireRate: 3,
    hitscan: true,
    projectileSpeed: 0,
    reloadS: 2.4,
    reload: 'magazine',
    falloff: { start: 22, end: 50 },
    range: 120,
  },
  abilities,
};
