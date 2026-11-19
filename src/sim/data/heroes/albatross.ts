/**
 * Albatross (GDD §9.2): tank and initiator. Every number is the GDD's; "k×SP" scaling is the `song` part of a Magnitude.
 */
import type { AbilityDef, Effect, HeroDef, Magnitude, StatusDef, TargetFilter } from '../../core/contracts';
import { STUN, UNSTOPPABLE } from '../combat';

const ENEMIES: TargetFilter = { teams: 'enemies' };
const ALLY_HEROES: TargetFilter = { teams: 'allies', heroesOnly: true };
const song = (of: number | string, k: number): Effect => ({ kind: 'damage', amount: { of, song: k }, type: 'song' });
const apply = (status: StatusDef, durationS: Magnitude, magnitude?: Magnitude): Effect => ({ kind: 'applyStatus', status, durationS, magnitude });
/** "+x% Talon and Song resist": additive, so a tier's +10% is exactly 10 points. */
const resist = (id: string, name: string, value: number, durationS: number): Effect => ({
  kind: 'statMod',
  id,
  name,
  stats: [{ stat: 'talonResist', op: 'add', value }, { stat: 'songResist', op: 'add', value }],
  durationS,
});
const base = { castS: 0, channelS: 0, hook: false } as const;

/** Status id of Gale Shield's slow, so the hook can lift it when the wall ends. */
export const SHIELD_SLOW_ID = 'albatross.shieldBrace';
/** Gale Shield T3: the wall bursts forward 8 m (a 40° cone is 6 m wide at its far end) and knocks enemies back. */
export const GALE_BURST: readonly Effect[] = [
  {
    kind: 'area',
    shape: { kind: 'cone', length: 'burst', angleDeg: 40 },
    durationS: 0,
    attach: 'point',
    affects: ENEMIES,
    effects: [song(60, 0.6), { kind: 'displace', mode: 'along', distance: 6 }],
  },
];

/** Tempest Dive's leap: 0.9 s arc, 8 m apex, landing on the cast point, then the slam. */
const TEMPEST_LEAP: Effect = {
  kind: 'dash',
  distance: 30,
  durationS: 0.9,
  dir: 'target',
  arcHeight: 8,
  onArrive: [
    {
      kind: 'area',
      shape: { kind: 'sphere', radius: 'radius' },
      durationS: 0,
      attach: 'point',
      affects: ENEMIES,
      effects: [song(180, 1.5), apply(STUN, 'stun'), { kind: 'displace', mode: 'pull', distance: 3 }],
    },
  ],
};

const abilities: [AbilityDef, AbilityDef, AbilityDef, AbilityDef] = [
  {
    ...base,
    id: 'albatross.galeShield',
    name: 'Gale Shield',
    description: 'A wind wall (6 x 3 m, 400 + 3 x SP HP) stands 2 m ahead for 4 s, turning with your aim, and blocks enemy shots until it breaks. You move 15% slower while it stands.',
    targeting: 'self',
    range: 0,
    cooldownS: 20,
    charges: 1,
    values: { hp: 400, burst: 0 },
    effects: [
      {
        kind: 'summon',
        summon: 'wall',
        health: { of: 'hp', song: 3 },
        durationS: 4,
        maxCount: 1,
        behaviour: 'galeShield', // the hero's hook keeps it 2 m ahead, facing your aim; onEnd reads its pos and yaw
        size: { x: 6, y: 3, z: 0.5 },
        effects: [],
        onEnd: GALE_BURST,
      },
      {
        kind: 'statMod',
        id: SHIELD_SLOW_ID,
        name: 'Bracing',
        stats: [{ stat: 'moveSpeed', op: 'pct', value: -0.15 }],
        durationS: 4,
      },
    ],
    upgrades: [
      { description: '+200 wall HP (600 + 3 x SP)', values: { hp: 200 } },
      { description: '-5 s cooldown', cooldownS: -5 },
      { description: 'When it expires or breaks the wall bursts forward 8 m, damaging and knocking back enemies', values: { burst: 8 } },
    ],
  },
  {
    ...base,
    id: 'albatross.wingSlam',
    name: 'Wing Slam',
    description: 'Dash 12 m in 0.35 s along your aim. Enemies you pass through take 75 + 0.7 x SP Song damage and are knocked up for 0.6 s.',
    targeting: 'direction',
    range: 12,
    cooldownS: 15,
    charges: 1,
    values: { damage: 75 },
    effects: [
      {
        kind: 'dash',
        distance: 12,
        durationS: 0.35,
        dir: 'aim',
        passThrough: true,
        arcHeight: 0, // flat today (D-SYS-003); maxPitchUpDeg is the contract's cap (0 = flat) once Physics honours it
        maxPitchUpDeg: 0,
        // 1.125 m up is 0.6 s in the air at 25 m/s² gravity.
        onHit: [song('damage', 0.7), { kind: 'displace', mode: 'up', distance: 1.125 }],
      },
    ],
    upgrades: [
      { description: '+25 damage (100 + 0.7 x SP)', values: { damage: 25 } },
      { description: '-3 s cooldown', cooldownS: -3 },
      { description: '2 charges', charges: 1 },
    ],
  },
  {
    ...base,
    id: 'albatross.saltHide',
    name: 'Salt Hide',
    description: 'For 6 s you have +30% Talon and Song resist and heal 10% of your max HP over the duration.',
    targeting: 'self',
    range: 0,
    cooldownS: 30,
    charges: 1,
    hook: true, // the heal is 10% of max HP, which a Magnitude can't say
    values: {},
    effects: [resist('albatross.saltHide', 'Salt Hide', 0.3, 6)],
    upgrades: [
      { description: '+10% to both resists (40%)', effects: [resist('albatross.saltHide.t1', 'Salt Hide', 0.1, 6)] },
      { description: '-8 s cooldown', cooldownS: -8 },
      {
        description: 'Unstoppable for the first 2 s; allies within 8 m get half the resists',
        effects: [
          apply(UNSTOPPABLE, 2),
          // Half of 30% + the 10% of tier 1 (tiers are bought in order).
          {
            kind: 'area',
            shape: { kind: 'sphere', radius: 8 },
            durationS: 0,
            attach: 'source',
            affects: ALLY_HEROES,
            effects: [resist('albatross.saltHide.ally', 'Salt Hide', 0.2, 6)],
          },
        ],
      },
    ],
  },
  {
    ...base,
    id: 'albatross.tempestDive',
    name: 'Tempest Dive',
    description: 'Leap up to 30 m in 0.9 s (unstoppable in the air) and slam: enemies within 8 m take 180 + 1.5 x SP Song damage, are stunned 1.25 s and pulled 3 m toward the centre.',
    targeting: 'point',
    range: 30,
    cooldownS: 120,
    charges: 1,
    values: { radius: 8, stun: 1.25 },
    effects: [apply(UNSTOPPABLE, 0.9), TEMPEST_LEAP],
    upgrades: [
      { description: '+2 m radius (10 m)', values: { radius: 2 } },
      { description: 'Stun +0.5 s (1.75 s)', values: { stun: 0.5 } },
      { description: '-35 s cooldown (85 s)', cooldownS: -35 },
    ],
  },
];

export const albatrossDef: HeroDef = {
  id: 'albatross',
  name: 'Albatross',
  archetype: 'tank',
  body: {
    height: 2.3,
    radius: 0.5,
    head: { centre: { right: 0, up: 2.05, forward: 0 }, radius: 0.2 },
    muzzle: { right: 0.25, up: 1.6, forward: 0.35 },
  },
  stats: {
    maxHealth: 720,
    healthRegen: 2,
    moveSpeed: 6.7,
    sprintSpeed: 2,
    stamina: 3,
    staminaRecharge: 5,
    weaponDamage: 6,
    magazine: 6,
    meleeDamage: 50,
  },
  growth: [
    { stat: 'maxHealth', op: 'add', value: 46 },
    { stat: 'weaponDamage', op: 'pct', value: 0.03 },
    { stat: 'songPower', op: 'add', value: 1 },
    { stat: 'meleeDamage', op: 'add', value: 3 },
  ],
  weapon: {
    name: 'Gale Blunderbuss',
    pellets: 8,
    spreadDeg: 5,
    fireRate: 1.4,
    hitscan: true,
    projectileSpeed: 0,
    reloadS: 0.45,
    reload: 'perRound',
    perRoundStartS: 0.3,
    falloff: { start: 8, end: 22 },
    range: 40,
  },
  abilities,
};
