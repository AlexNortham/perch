/**
 * Frigatebird (GDD §9.21): long-range poke. Every number is the GDD's; "k×SP" scaling is the `song` part of a
 * Magnitude. Tiers only add (D-ABIL-006): a number a tier raises is a named value, an extra effect is appended.
 */
import type { AbilityDef, Effect, HeroDef, Magnitude, ShieldEffect, StatusDef, TargetFilter } from '../../core/contracts';
import { SLOW, STUN } from '../combat';

const ENEMIES: TargetFilter = { teams: 'enemies' };
const song = (of: number | string, k: number): Effect => ({ kind: 'damage', amount: { of, song: k }, type: 'song' });
const apply = (status: StatusDef, durationS: Magnitude, magnitude?: Magnitude): Effect => ({ kind: 'applyStatus', status, durationS, magnitude });
const base = { castS: 0, channelS: 0, hook: false } as const;

/** Plunder Shot: the Song shield the Frigatebird gets when the shot lands (the hook applies it to the caster). */
export const PLUNDER_HIT_HOOK = 'plunderHit';
export const PLUNDER_SHIELD: ShieldEffect = {
  kind: 'shield',
  id: 'frigatebird.plunder',
  absorbs: 'song',
  amount: { of: 100, song: 1 },
  durationS: 5,
};

/** High Pass: for 5 s the gun's falloff ranges are +40% (T3: and +20% gun damage). */
export const HIGH_PASS_BUFF_S = 5;
const HIGH_PASS_FALLOFF: Effect = {
  kind: 'statMod',
  id: 'frigatebird.highPass',
  name: 'High Pass',
  stats: [{ stat: 'falloffRange', op: 'add', value: 0.4 }],
  durationS: HIGH_PASS_BUFF_S,
};
const HIGH_PASS_DAMAGE: Effect = {
  kind: 'statMod',
  id: 'frigatebird.highPassDamage',
  name: 'High Pass',
  stats: [{ stat: 'gunDamage', op: 'add', value: 0.2 }],
  durationS: HIGH_PASS_BUFF_S,
};

/** Harpoon Line: the pull is the standard displacement arc (about 0.65 s for 15 m, D-HEROB-012). */
export const HARPOON = { speed: 120, radius: 0.35, pullM: 15 } as const;

const abilities: [AbilityDef, AbilityDef, AbilityDef, AbilityDef] = [
  {
    ...base,
    id: 'frigatebird.plunderShot',
    name: 'Plunder Shot',
    description:
      'Fire a bolt (80 m/s, 50 m). The first enemy hero hit takes 70 + 0.7 x SP Song damage and loses all its positive statuses; you gain a Song shield of 100 + 1.0 x SP for 5 s.',
    targeting: 'direction',
    range: 50,
    cooldownS: 14,
    charges: 1,
    values: { damage: 70 },
    effects: [
      {
        kind: 'projectile',
        speed: 80,
        radius: 0.4,
        range: 50,
        gravity: 0,
        pierce: 'none',
        affects: { teams: 'enemies', heroesOnly: true },
        onHit: [song('damage', 0.7), { kind: 'cleanse', remove: 'positive' }, { kind: 'hook', name: PLUNDER_HIT_HOOK }],
      },
    ],
    upgrades: [
      { description: '+25 damage (95 + 0.7 x SP)', values: { damage: 25 } },
      { description: '-3 s cooldown', cooldownS: -3 },
      { description: '2 charges', charges: 1 },
    ],
  },
  {
    ...base,
    id: 'frigatebird.highPass',
    name: 'High Pass',
    description:
      'Leap to a point within 30 m in a 0.8 s arc (12 m apex). For 5 s your gun falloff ranges are +40%.',
    targeting: 'point',
    range: 30,
    cooldownS: 16,
    charges: 1,
    values: { dist: 30 },
    effects: [{ kind: 'dash', distance: 'dist', durationS: 0.8, dir: 'target', arcHeight: 12 }],
    selfEffects: [HIGH_PASS_FALLOFF],
    upgrades: [
      { description: '-4 s cooldown', cooldownS: -4 },
      { description: '+10 m range (40 m)', range: 10, values: { dist: 10 } },
      { description: 'The bonus also gives +20% gun damage', selfEffects: [HIGH_PASS_DAMAGE] },
    ],
  },
  {
    ...base,
    id: 'frigatebird.balloonBoom',
    name: 'Balloon Boom',
    description:
      'The throat balloon bursts: enemies within 5 m take 50 + 0.5 x SP Song damage and are knocked back 7 m; you gain a barrier of 150 + 1.5 x SP for 3 s.',
    targeting: 'self',
    range: 5,
    cooldownS: 15,
    charges: 1,
    values: { radius: 5 },
    effects: [
      {
        kind: 'area',
        shape: { kind: 'sphere', radius: 'radius' },
        durationS: 0,
        attach: 'source',
        affects: ENEMIES,
        effects: [song(50, 0.5), { kind: 'displace', mode: 'push', distance: 7 }],
      },
    ],
    selfEffects: [{ kind: 'shield', id: 'frigatebird.balloon', absorbs: 'barrier', amount: { of: 150, song: 1.5 }, durationS: 3 }],
    upgrades: [
      { description: '+2 m radius (7 m)', values: { radius: 2 } },
      { description: '-4 s cooldown', cooldownS: -4 },
      {
        description: 'Enemies hit are also slowed 40% for 2 s',
        effects: [
          {
            kind: 'area',
            shape: { kind: 'sphere', radius: 'radius' },
            durationS: 0,
            attach: 'source',
            affects: ENEMIES,
            effects: [apply(SLOW, 2, 0.4)],
          },
        ],
      },
    ],
  },
  {
    ...base,
    id: 'frigatebird.harpoonLine',
    name: 'Harpoon Line',
    description:
      'A hooked line flies at 120 m/s (70 m): the first enemy hero hit takes 200 + 1.5 x SP Song damage, is pulled 15 m toward you and is stunned 1.0 s.',
    targeting: 'direction',
    range: 70,
    cooldownS: 90,
    charges: 1,
    values: { damage: 200, reach: 70, stun: 1 },
    effects: [
      {
        kind: 'projectile',
        speed: HARPOON.speed,
        radius: HARPOON.radius,
        range: 'reach',
        gravity: 0,
        pierce: 'none',
        affects: { teams: 'enemies', heroesOnly: true },
        onHit: [song('damage', 1.5), apply(STUN, 'stun'), { kind: 'displace', mode: 'pull', distance: HARPOON.pullM }],
      },
    ],
    upgrades: [
      { description: '+20 m range (90 m)', range: 20, values: { reach: 20 } },
      { description: 'Stun +0.5 s (1.5 s)', values: { stun: 0.5 } },
      { description: '-25 s cooldown (65 s)', cooldownS: -25 },
    ],
  },
];

export const frigatebirdDef: HeroDef = {
  id: 'frigatebird',
  name: 'Frigatebird',
  swatch: 0xc8283c,
  archetype: 'poke',
  body: {
    height: 1.8,
    radius: 0.3,
    head: { centre: { right: 0, up: 1.62, forward: 0 }, radius: 0.15 },
    muzzle: { right: 0.25, up: 1.3, forward: 0.35 },
  },
  stats: {
    maxHealth: 530,
    healthRegen: 2,
    moveSpeed: 7,
    sprintSpeed: 2,
    stamina: 3,
    staminaRecharge: 5,
    weaponDamage: 40,
    magazine: 8,
    meleeDamage: 50,
  },
  growth: [
    { stat: 'maxHealth', op: 'add', value: 31 },
    { stat: 'weaponDamage', op: 'pct', value: 0.03 },
    { stat: 'songPower', op: 'add', value: 1 },
    { stat: 'meleeDamage', op: 'add', value: 3 },
  ],
  weapon: {
    name: 'Kite Rifle',
    pellets: 1,
    spreadDeg: 0.2,
    fireRate: 1.8,
    hitscan: true,
    projectileSpeed: 0,
    reloadS: 2.5,
    reload: 'magazine',
    falloff: { start: 35, end: 80 },
    range: 130,
  },
  abilities,
};
