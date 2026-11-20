/**
 * Woodpecker (GDD §9.19): gun carry. Every number is the GDD's; "k×SP" scaling is the `song` part of a Magnitude.
 * Tiers only add (D-ABIL-006): a number a tier raises is a named value, an extra effect is appended by the tier.
 */
import type { AbilityDef, Effect, HeroDef, Magnitude, StatusDef, TargetFilter } from '../../core/contracts';
import { COMBAT, STUN, TALON_SHRED } from '../combat';

const ENEMY_HEROES: TargetFilter = { teams: 'enemies', heroesOnly: true };
const apply = (status: StatusDef, durationS: Magnitude, magnitude?: Magnitude): Effect => ({ kind: 'applyStatus', status, durationS, magnitude });
const fireRate = (id: string, name: string, value: number, durationS: Magnitude): Effect => ({
  kind: 'statMod',
  id,
  name,
  stats: [{ stat: 'fireRate', op: 'add', value }],
  durationS,
});
const base = { castS: 0, channelS: 0, hook: false } as const;

/** Hook and status names shared with the hero module. */
export const CLING_ABILITY = 'woodpecker.treeCling';
export const CLING_BUFF_ID = 'woodpecker.clingDamage';
export const HAMMER_ABILITY = 'woodpecker.hammerhead';
/** Hammerhead detonates on every Nth gun hit on the same hero (T2 lowers it to 8). */
export const HAMMER_EVERY = 10;
/** Tree Cling T3 heals this fraction of max HP a second; the hook pays it out every half second. */
export const CLING_HEAL_PER_S = 0.03;
/** One Hammerhead detonation on the hero hit: 150 + 1.0 x SP Song damage and a 0.5 s stun. */
export const HAMMER_BLAST: readonly Effect[] = [
  { kind: 'damage', amount: { of: 'damage', song: 1 }, type: 'song' },
  apply(STUN, 0.5),
];

/** Drumroll T3: each gun hit on a hero shreds 3% Talon resist for 6 s, up to 5 stacks. */
const DRILL_SHRED: StatusDef = {
  id: 'woodpecker.drillShred',
  name: 'Drilled',
  negative: true,
  stacking: 'stack',
  maxStacks: 5,
  durationS: 6,
  modifiers: { stats: [{ stat: 'talonShred', op: 'add', value: 0.03 }] },
};

const abilities: [AbilityDef, AbilityDef, AbilityDef, AbilityDef] = [
  {
    ...base,
    id: 'woodpecker.drumroll',
    name: 'Drumroll',
    description: 'Rev the drill to full spin at once: for 6 s you fire 20% faster and the drill never spins down.',
    targeting: 'self',
    range: 0,
    cooldownS: 18,
    charges: 1,
    values: { duration: 6 },
    // Its id is combat's full-spin status: the gun is at full spin from the cast and stays there (D-SYS-013).
    effects: [fireRate(COMBAT.fullSpinStatus, 'Drumroll', 0.2, 'duration')],
    upgrades: [
      { description: '+2 s duration (8 s)', values: { duration: 2 } },
      { description: '+10% fire rate (30%)', effects: [fireRate('woodpecker.drumroll.t2', 'Drumroll: tempo', 0.1, 'duration')] },
      {
        description: 'Each gun hit on a hero shreds 3% Talon resist for 6 s (up to 5 stacks)',
        effects: [
          {
            kind: 'trigger',
            durationS: 'duration',
            trigger: { on: 'weaponHit', heroesOnly: true, chance: 1, cooldownS: 0, target: 'other', effects: [apply(DRILL_SHRED, 6)] },
          },
        ],
      },
    ],
  },
  {
    ...base,
    id: 'woodpecker.boreHole',
    name: 'Bore Hole',
    description:
      'Fire a drill bit at 50 m/s up to 25 m: the first enemy hero hit takes 60 + 0.6 x SP Song damage and loses 15% Talon resist for 6 s.',
    targeting: 'direction',
    range: 25,
    cooldownS: 12,
    charges: 1,
    values: { damage: 60, shred: 0.15 },
    effects: [
      {
        kind: 'projectile',
        speed: 50,
        radius: 0.25,
        range: 25,
        gravity: 0,
        pierce: 'none',
        affects: ENEMY_HEROES,
        onHit: [{ kind: 'damage', amount: { of: 'damage', song: 0.6 }, type: 'song' }, apply(TALON_SHRED, 6, 'shred')],
      },
    ],
    upgrades: [
      { description: 'Shred 20%', values: { shred: 0.05 } },
      { description: '-3 s cooldown', cooldownS: -3 },
      { description: '2 charges', charges: 1 },
    ],
  },
  {
    ...base,
    id: CLING_ABILITY,
    name: 'Tree Cling',
    description:
      'Dash to a wall, tree or other surface within 12 m and cling there for up to 6 s: you can shoot, and your gun does +15% damage. Jump or a stun ends it.',
    targeting: 'point',
    surface: true,
    range: 12,
    cooldownS: 14,
    charges: 1,
    hook: false, // the T3 heal is the hero module's (ticks while clinging)
    values: { reach: 12, cling: 6 },
    effects: [
      {
        kind: 'dash',
        distance: 'reach',
        durationS: 0.25,
        dir: 'target',
        arcHeight: 0,
        onArrive: [
          { kind: 'movementMode', mode: 'cling', durationS: 'cling', speed: 0, verticalSpeed: 0, allowGun: true, allowAbilities: true,
            endOn: ['jump', 'stun'], onEnd: [{ kind: 'cleanse', remove: [CLING_BUFF_ID] }] },
          { kind: 'statMod', id: CLING_BUFF_ID, name: 'Tree Cling', stats: [{ stat: 'gunDamage', op: 'add', value: 0.15 }], durationS: 'cling' },
        ],
      },
    ],
    upgrades: [
      { description: '+6 m range (18 m)', range: 6, values: { reach: 6 } },
      { description: '-4 s cooldown', cooldownS: -4 },
      { description: 'Heal 3% of max HP a second while clinging' },
    ],
  },
  {
    ...base,
    id: HAMMER_ABILITY,
    name: 'Hammerhead',
    description:
      'For 6 s you fire 25% faster, and every 10th gun hit on the same hero detonates on it: 150 + 1.0 x SP Song damage and a 0.5 s stun.',
    targeting: 'self',
    range: 0,
    cooldownS: 90,
    charges: 1,
    hook: true, // counts gun hits per hero
    values: { duration: 6, damage: 150, every: HAMMER_EVERY, splash: 0 },
    effects: [fireRate('woodpecker.hammerhead', 'Hammerhead', 0.25, 'duration')],
    upgrades: [
      { description: '+3 s duration (9 s)', values: { duration: 3 } },
      { description: 'Detonates every 8 hits', values: { every: -2 } },
      { description: 'Detonations also hit enemies within 4 m of the target', values: { splash: 4 } },
    ],
  },
];

export const woodpeckerDef: HeroDef = {
  id: 'woodpecker',
  name: 'Woodpecker',
  swatch: 0xd62f2f,
  archetype: 'gunCarry',
  body: {
    height: 1.75,
    radius: 0.3,
    head: { centre: { right: 0, up: 1.6, forward: 0 }, radius: 0.16 },
    muzzle: { right: 0.22, up: 1.3, forward: 0.35 },
  },
  stats: {
    maxHealth: 600,
    healthRegen: 2,
    moveSpeed: 6.9,
    sprintSpeed: 2,
    stamina: 3,
    staminaRecharge: 5,
    weaponDamage: 7,
    magazine: 60,
    meleeDamage: 50,
  },
  growth: [
    { stat: 'maxHealth', op: 'add', value: 35 },
    { stat: 'weaponDamage', op: 'pct', value: 0.04 },
    { stat: 'songPower', op: 'add', value: 1 },
    { stat: 'meleeDamage', op: 'add', value: 3 },
  ],
  weapon: {
    name: 'Drum Drill',
    pellets: 1,
    spreadDeg: 1.4,
    fireRate: 14,
    spinUp: { fromRate: 6, seconds: 1.5 },
    hitscan: true,
    projectileSpeed: 0,
    reloadS: 3,
    reload: 'magazine',
    falloff: { start: 16, end: 36 },
    range: 70,
  },
  abilities,
};
