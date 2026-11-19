/**
 * Pelican (GDD §9.6): gun carry. Every number is the GDD's; "k×SP" scaling is the `song` part of a Magnitude.
 * Tiers only add (D-ABIL-006): a tier that changes a base number adds to a named value, and one that switches
 * something on appends effects. Tiers are bought in order (T1, T2, T3).
 */
import type { AbilityDef, Effect, HeroDef, Magnitude, StatusDef, TargetFilter } from '../../core/contracts';
import { CARRIED, SLOW, STUN } from '../combat';

const ENEMIES: TargetFilter = { teams: 'enemies' };
const apply = (status: StatusDef, durationS: Magnitude, magnitude?: Magnitude): Effect => ({ kind: 'applyStatus', status, durationS, magnitude });
const base = { castS: 0, channelS: 0 } as const;

// ---- Gulp (the hook grabs the target; these are the effects it applies) -------------------------------------------
/** Reach of the grab: a 4 m cone, 40° wide. */
export const GULP_REACH_M = 4;
export const GULP_CONE_DEG = 40;
export const GULP_CARRY_ID = 'pelican.gulp';
/** The spit: the pouch lets go, then 70 + 0.7×SP Song damage and 10 m along the aim. Leaving CARRIED first lifts the intangibility. */
export const GULP_SPIT: readonly Effect[] = [
  { kind: 'cleanse', remove: [CARRIED.id] },
  { kind: 'damage', amount: { of: 'damage', song: 0.7 }, type: 'song' },
  { kind: 'displace', mode: 'along', distance: 10 },
];
/** Seconds the spit takes to land: a 10 m arc at 20° under 25 m/s² gravity (data/movement.ts). T3's stun starts then. */
export const SPIT_FLIGHT_S = 0.54;
export const GULP_LAND_STUN: Effect = { kind: 'delay', seconds: SPIT_FLIGHT_S, effects: [apply(STUN, 'landStun')] };
/** The attach effect, the pouch's carry status and the Pelican's slowed walk, for the hook to apply in that order. */
export const GULP_CARRY: Effect = { kind: 'attach', durationS: 'carry', onRelease: GULP_SPIT };
export const GULP_CARRIED: Effect = apply(CARRIED, 'carry');
export const GULP_BRACE: Effect = {
  kind: 'statMod',
  id: GULP_CARRY_ID,
  name: 'Carrying',
  stats: [{ stat: 'moveSpeed', op: 'pct', value: -0.2 }],
  durationS: 'carry',
};
/** A swallowed fledgling heals the Pelican. */
export const GULP_FEAST: Effect = { kind: 'heal', amount: 'heal' };
/** Kills the swallowed fledgling through the damage pipeline, so the Pelican gets the last hit and its pod. */
export const GULP_DIGEST: Effect = { kind: 'damage', amount: 1, type: 'song', executeBelow: 1 };

// ---- Feeding Frenzy -----------------------------------------------------------------------------------------------
/** Pinion-like shred from T3: 2% Talon resist per gun hit on a hero, 6 s, up to 5 stacks. */
const FRENZY_SHRED: StatusDef = {
  id: 'pelican.frenzyShred',
  name: 'Gullet shred',
  negative: true,
  stacking: 'stack',
  maxStacks: 5,
  durationS: 6,
  modifiers: { stats: [{ stat: 'talonShred', op: 'add', value: 0.02 }] },
};
const stat = (id: string, name: string, s: 'fireRate' | 'talonLifesteal' | 'gunDamage', value: number): Effect => ({
  kind: 'statMod',
  id,
  name,
  stats: [{ stat: s, op: 'add', value }],
  durationS: 'duration',
});

// ---- Belly Flop ---------------------------------------------------------------------------------------------------
const FLOP_LAND: Effect = {
  kind: 'area',
  shape: { kind: 'sphere', radius: 'radius' },
  durationS: 0,
  attach: 'point',
  affects: ENEMIES,
  effects: [{ kind: 'damage', amount: { of: 'damage', song: 0.7 }, type: 'song' }, { kind: 'displace', mode: 'push', distance: 4 }, apply(SLOW, 2, 0.3)],
};

const abilities: [AbilityDef, AbilityDef, AbilityDef, AbilityDef] = [
  {
    ...base,
    hook: true, // the grab picks one target in the cone, kills a fledgling at the Pelican's feet or carries a hero
    id: 'pelican.gulp',
    name: 'Gulp',
    description:
      'Grab the first enemy hero or fledgling in a 4 m cone. A fledgling is swallowed (your last hit, its pod at your feet) and heals you 60. A hero is carried 1 s (stunned, intangible) at 80% of your speed, then spat 10 m along your aim for 70 + 0.7×SP Song damage.',
    targeting: 'direction',
    range: GULP_REACH_M,
    cooldownS: 20,
    charges: 1,
    values: { damage: 70, carry: 1, heal: 60, landStun: 0 },
    effects: [],
    upgrades: [
      { description: 'Spit damage +30 (100 + 0.7×SP)', values: { damage: 30 } },
      { description: '-5 s cooldown', cooldownS: -5 },
      { description: 'The spat hero is stunned 0.75 s on landing', values: { landStun: 0.75 } },
    ],
  },
  {
    ...base,
    hook: false,
    id: 'pelican.feedingFrenzy',
    name: 'Feeding Frenzy',
    description: 'Instantly reload. For 6 s you fire 35% faster and heal 15% of the Talon damage you deal.',
    targeting: 'self',
    range: 0,
    cooldownS: 24,
    charges: 1,
    values: { duration: 6 },
    effects: [
      { kind: 'weaponMod', durationS: 0, reload: true },
      stat('pelican.frenzy', 'Feeding Frenzy', 'fireRate', 0.35),
      stat('pelican.frenzy.steal', 'Feeding Frenzy: lifesteal', 'talonLifesteal', 0.15),
    ],
    upgrades: [
      { description: 'Lasts +2 s (8 s)', values: { duration: 2 } },
      { description: 'Fire rate +15% (50%)', effects: [stat('pelican.frenzy.t2', 'Feeding Frenzy: tempo', 'fireRate', 0.15)] },
      {
        description: 'Each gun hit on a hero shreds 2% Talon resist for 6 s (up to 5 stacks)',
        // Items' trigger (sim/items): a weapon hit on a hero, so a fledgling hit does not shred.
        effects: [{
          kind: 'trigger',
          durationS: 'duration',
          trigger: { on: 'weaponHit', heroesOnly: true, chance: 1, cooldownS: 0, target: 'other', effects: [apply(FRENZY_SHRED, 6)] },
        }],
      },
    ],
  },
  {
    ...base,
    hook: false,
    id: 'pelican.bellyFlop',
    name: 'Belly Flop',
    description: 'Leap to a point within 10 m. The landing deals 70 + 0.7×SP Song damage in 5 m, knocks enemies back 4 m and slows them 30% for 2 s.',
    targeting: 'point',
    range: 10,
    cooldownS: 14,
    charges: 1,
    values: { damage: 70, radius: 5 },
    effects: [{ kind: 'dash', distance: 10, durationS: 0.5, dir: 'target', arcHeight: 3, onArrive: [FLOP_LAND] }],
    upgrades: [
      { description: 'Landing radius +1.5 m (6.5 m)', values: { radius: 1.5 } },
      { description: '-4 s cooldown', cooldownS: -4 },
      { description: '2 charges', charges: 1 },
    ],
  },
  {
    ...base,
    hook: false,
    id: 'pelican.bottomlessPouch',
    name: 'Bottomless Pouch',
    description: 'For 8 s your shots use no ammo and deal +30% damage, and every bullet splashes 1.5 m for 35% of its damage (splash cannot beak-shot).',
    targeting: 'self',
    range: 0,
    cooldownS: 100,
    charges: 1,
    values: { duration: 8 },
    effects: [
      { kind: 'weaponMod', durationS: 'duration', ammoFree: true, splash: { radius: 1.5, fraction: 0.35 } },
      stat('pelican.pouch', 'Bottomless Pouch: damage', 'gunDamage', 0.3),
    ],
    upgrades: [
      { description: 'Lasts +3 s (11 s)', values: { duration: 3 } },
      { description: 'Gun damage +15% (+45%)', effects: [stat('pelican.pouch.t2', 'Bottomless Pouch: damage', 'gunDamage', 0.15)] },
      { description: 'You heal 20% of the Talon damage you deal while it lasts', effects: [stat('pelican.pouch.steal', 'Bottomless Pouch: lifesteal', 'talonLifesteal', 0.2)] },
    ],
  },
];

export const pelicanDef: HeroDef = {
  id: 'pelican',
  name: 'Pelican',
  swatch: 0xf4b942,
  archetype: 'gunCarry',
  body: {
    height: 2.1,
    radius: 0.48,
    head: { centre: { right: 0, up: 1.85, forward: 0 }, radius: 0.19 },
    muzzle: { right: 0.48, up: 1.1, forward: 0.45 },
  },
  stats: {
    maxHealth: 640,
    healthRegen: 2,
    moveSpeed: 6.8,
    sprintSpeed: 2,
    stamina: 3,
    staminaRecharge: 5,
    weaponDamage: 8,
    magazine: 50,
    meleeDamage: 50,
  },
  growth: [
    { stat: 'maxHealth', op: 'add', value: 38 },
    { stat: 'weaponDamage', op: 'pct', value: 0.04 },
    { stat: 'songPower', op: 'add', value: 1 },
    { stat: 'meleeDamage', op: 'add', value: 3 },
  ],
  weapon: {
    name: 'Gullet Gatling',
    pellets: 1,
    spreadDeg: 1.6,
    fireRate: 11,
    hitscan: true,
    projectileSpeed: 0,
    reloadS: 2.8,
    reload: 'magazine',
    falloff: { start: 18, end: 40 },
    range: 60,
  },
  abilities,
};
