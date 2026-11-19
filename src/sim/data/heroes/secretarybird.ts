/**
 * Secretarybird (GDD §9.7): mobility skirmisher. Every number is the GDD's; "k×SP" scaling is the `song` part of a
 * Magnitude. Tiers only add (D-ABIL-006): a tier that changes a base number adds to a named value, and one that
 * swaps an effect raises a value that is 0 (an empty area) while lowering its twin. Tiers are bought in order.
 *
 * Footwork (passive): each ability hit on an enemy hero gives a stack (3 max, 5 s); Stomp Kick spends them for +20%
 * damage each. The status is data here; the hook counts hits and spends it.
 */
import type { AbilityDef, Effect, HeroDef, Magnitude, StatusDef, TargetFilter } from '../../core/contracts';
import { SLOW, STUN, UNSTOPPABLE } from '../combat';

const ENEMIES: TargetFilter = { teams: 'enemies' };
const apply = (status: StatusDef, durationS: Magnitude, magnitude?: Magnitude): Effect => ({ kind: 'applyStatus', status, durationS, magnitude });
const base = { castS: 0, channelS: 0 } as const;

export const FOOTWORK: StatusDef = {
  id: 'secretarybird.footwork',
  name: 'Footwork',
  negative: false,
  stacking: 'stack',
  maxStacks: 3,
  durationS: 5,
};
export const FOOTWORK_PER_STACK = 0.2;
export const FOOTWORK_GAIN: Effect = { kind: 'applyStatus', status: FOOTWORK, durationS: 5, stacks: 1 };
/** The Song damage bonus Stomp Kick borrows for the instant of its hit (the hook adds it, then removes it). */
export const STOMP_BONUS_ID = 'secretarybird.stompBonus';
export const STOMP_ID = 'secretarybird.stompKick';
export const STRIDE_ID = 'secretarybird.longStride';
export const VIPER_ID = 'secretarybird.viperDance';
/** Names of the hook effects the abilities fire (onEffect). */
export const HOOK = { spend: 'footworkSpend', touch: 'footworkTouch' } as const;

// ---- Viper Dance (the hook runs the kicks; these are what each one does) ------------------------------------------
export const VIPER_KICK: readonly Effect[] = [{ kind: 'damage', amount: { of: 'damage', song: 0.35 }, type: 'song' }, apply(STUN, 'stun')];
export const VIPER_KNOCKBACK: Effect = { kind: 'displace', mode: 'along', distance: 'knock' };
/** T3: the last kick resets Long Stride and gives 3 Footwork. */
export const VIPER_FINISH: readonly Effect[] = [
  { kind: 'cooldownMod', scope: 'slot', slot: 1, mode: 'reset' },
  { kind: 'applyStatus', status: FOOTWORK, durationS: 5, stacks: 3 },
];
/** The dance ends: the unstoppable it gave goes with it. */
export const VIPER_END: Effect = { kind: 'cleanse', remove: [UNSTOPPABLE.id] };
/** How far behind the target the Secretarybird holds on. */
export const VIPER_BEHIND_M = 1.2;

const stompArea: Effect = {
  kind: 'area',
  shape: { kind: 'cone', length: 3.5, angleDeg: 60 },
  durationS: 0,
  attach: 'source',
  affects: ENEMIES,
  effects: [
    { kind: 'damage', amount: { of: 'damage', song: 0.8 }, type: 'song' },
    { kind: 'displace', mode: 'along', distance: 7, onWall: [apply(STUN, 'wallStun')] },
  ],
};

/** A slam burst: sphere of Song damage, a slow and (from T3) a stun, each in its own area so a tier can switch it. */
const land = (radius: Magnitude, effects: readonly Effect[]): Effect => ({
  kind: 'area',
  shape: { kind: 'sphere', radius },
  durationS: 0,
  attach: 'point',
  affects: ENEMIES,
  effects,
});

const abilities: [AbilityDef, AbilityDef, AbilityDef, AbilityDef] = [
  {
    ...base,
    hook: false,
    id: STOMP_ID,
    name: 'Stomp Kick',
    description:
      'Kick a 3.5 m, 60 degree cone: 80 + 0.8×SP Song damage and 7 m knockback. A target that hits a wall is stunned 1 s. Spends all Footwork stacks for +20% damage each.',
    targeting: 'direction',
    range: 3.5,
    cooldownS: 9,
    charges: 1,
    values: { damage: 80, wallStun: 1 },
    effects: [{ kind: 'hook', name: HOOK.spend }, stompArea],
    upgrades: [
      { description: '+25 damage (105 + 0.8×SP)', values: { damage: 25 } },
      { description: '-2 s cooldown', cooldownS: -2 },
      { description: '2 charges', charges: 1 },
    ],
  },
  {
    ...base,
    hook: false,
    id: STRIDE_ID,
    name: 'Long Stride',
    description:
      'Dash 10 m along your movement keys (forward if none) in 0.25 s, passing through units. Enemy heroes you pass are slowed 25% for 1.5 s and give 1 Footwork.',
    targeting: 'direction',
    range: 10,
    cooldownS: 10,
    charges: 2,
    values: {},
    effects: [
      {
        kind: 'dash',
        distance: 10,
        durationS: 0.25,
        dir: 'move',
        passThrough: true,
        arcHeight: 0,
        onHit: [apply(SLOW, 1.5, 0.25), { kind: 'hook', name: HOOK.touch }],
      },
    ],
    upgrades: [
      { description: '+1 charge (3)', charges: 1 },
      { description: '-3 s cooldown', cooldownS: -3 },
      {
        description: 'Each dash gives +30% fire rate for 3 s',
        effects: [{ kind: 'statMod', id: 'secretarybird.strideTempo', name: 'Long Stride: tempo', stats: [{ stat: 'fireRate', op: 'add', value: 0.3 }], durationS: 3 }],
      },
    ],
  },
  {
    ...base,
    hook: false,
    id: 'secretarybird.snakeStamp',
    name: 'Snake Stamp',
    description: 'Leap to a point within 15 m. The landing deals 100 + 0.9×SP Song damage in 4 m and slows enemies 40% for 1.5 s.',
    targeting: 'point',
    range: 15,
    cooldownS: 13,
    charges: 1,
    // slowR and stunR split the landing in two: the slow, which T3 switches off, and the stun, which it switches on.
    values: { damage: 100, radius: 4, slowR: 4, stunR: 0 },
    effects: [
      {
        kind: 'dash',
        distance: 15,
        durationS: 0.45,
        dir: 'target',
        arcHeight: 4,
        onArrive: [
          land('radius', [{ kind: 'damage', amount: { of: 'damage', song: 0.9 }, type: 'song' }]),
          land('slowR', [apply(SLOW, 1.5, 0.4)]),
          land('stunR', [apply(STUN, 0.6)]),
        ],
      },
    ],
    upgrades: [
      { description: 'Landing radius +1 m (5 m)', values: { radius: 1, slowR: 1 } },
      { description: '-3 s cooldown', cooldownS: -3 },
      { description: 'Stuns 0.6 s instead of slowing', values: { slowR: -5, stunR: 5 } },
    ],
  },
  {
    ...base,
    hook: true, // the hook holds on to the target and delivers the kicks
    id: VIPER_ID,
    name: 'Viper Dance',
    description:
      'Lock onto an enemy hero within 6 m for 2 s: 6 kicks of 40 + 0.35×SP Song damage, each stunning 0.35 s; the last knocks back 10 m. You are unstoppable and stay on the target. It ends early if the target dies or turns intangible.',
    targeting: 'unit',
    affects: { teams: 'enemies', heroesOnly: true },
    range: 6,
    cooldownS: 95,
    charges: 1,
    values: { damage: 40, stun: 0.35, kicks: 6, duration: 2, knock: 10 },
    effects: [],
    selfEffects: [apply(UNSTOPPABLE, 'duration')],
    upgrades: [
      { description: '+2 kicks in the same 2 s (8)', values: { kicks: 2 } },
      { description: '-20 s cooldown', cooldownS: -20 },
      { description: 'The last kick resets Long Stride and gives 3 Footwork' },
    ],
  },
];

export const secretarybirdDef: HeroDef = {
  id: 'secretarybird',
  name: 'Secretarybird',
  swatch: 0xd9622b,
  archetype: 'skirmisher',
  body: {
    height: 2.2,
    radius: 0.3,
    head: { centre: { right: 0, up: 2, forward: 0 }, radius: 0.15 },
    muzzle: { right: 0.34, up: 1.45, forward: 0.35 },
  },
  stats: {
    maxHealth: 600,
    healthRegen: 2,
    moveSpeed: 7.4,
    sprintSpeed: 2,
    stamina: 4,
    staminaRecharge: 5,
    weaponDamage: 11,
    magazine: 28,
    meleeDamage: 50,
  },
  growth: [
    { stat: 'maxHealth', op: 'add', value: 36 },
    { stat: 'weaponDamage', op: 'pct', value: 0.03 },
    { stat: 'songPower', op: 'add', value: 1 },
    { stat: 'meleeDamage', op: 'add', value: 3 },
  ],
  weapon: {
    name: 'Quill Pair',
    pellets: 1,
    spreadDeg: 1,
    fireRate: 8,
    hitscan: true,
    projectileSpeed: 0,
    reloadS: 1.8,
    reload: 'magazine',
    falloff: { start: 14, end: 32 },
    range: 60,
  },
  abilities,
};
