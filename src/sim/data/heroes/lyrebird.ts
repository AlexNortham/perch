/**
 * Lyrebird (GDD §9.4): support. Every number is the GDD's; "k×SP" scaling is the `song` part of a Magnitude.
 * Tiers only add (D-ABIL-006): a number a tier raises is a named value; a base penalty a tier lifts is cleansed by id.
 */
import type { AbilityDef, Effect, HeroDef, Magnitude, StatusDef, TargetFilter } from '../../core/contracts';
import { DAMAGE_AMP, DISARM, INVISIBILITY, SLOW } from '../combat';

const ENEMIES: TargetFilter = { teams: 'enemies' };
const ALLY_HEROES: TargetFilter = { teams: 'allies', self: true, heroesOnly: true };
const song = (of: number | string, k: number): Effect => ({ kind: 'damage', amount: { of, song: k }, type: 'song' });
const apply = (status: StatusDef, durationS: Magnitude, magnitude?: Magnitude): Effect => ({ kind: 'applyStatus', status, durationS, magnitude });
const burst = (radius: Magnitude, affects: TargetFilter, effects: readonly Effect[]): Effect => ({
  kind: 'area',
  shape: { kind: 'sphere', radius },
  durationS: 0,
  attach: 'point',
  affects,
  effects,
});
const base = { castS: 0, hook: false } as const;

/** Grand Chorus: 60% move speed and no gun while channelling (T3 cleanses it right after it lands). */
export const CHORUS_ID = 'lyrebird.chorus';
const CHORUS: StatusDef = {
  id: CHORUS_ID,
  name: 'Singing',
  negative: false,
  stacking: 'max',
  maxStacks: 1,
  durationS: 5,
  modifiers: { stats: [{ stat: 'slow', op: 'max', value: 0.4 }], conditions: ['disarmed'] },
};
const CHORUS_RESIST: Effect = {
  kind: 'statMod',
  id: 'lyrebird.chorusResist',
  name: 'Chorus',
  stats: [{ stat: 'talonResist', op: 'add', value: 0.2 }, { stat: 'songResist', op: 'add', value: 0.2 }],
  durationS: 1.1, // refreshed by each pulse (1 s)
};
const CHORUS_RATE: Effect = {
  kind: 'statMod',
  id: 'lyrebird.chorusRate',
  name: 'Chorus tempo',
  stats: [{ stat: 'fireRate', op: 'add', value: 0.15 }],
  durationS: 0.6, // refreshed by each area tick (0.5 s)
};

const abilities: [AbilityDef, AbilityDef, AbilityDef, AbilityDef] = [
  {
    ...base,
    channelS: 0,
    id: 'lyrebird.mendedSong',
    name: 'Mended Song',
    description: 'Heal an ally (or yourself) at once and then over 4 s.',
    targeting: 'unit',
    affects: ALLY_HEROES,
    range: 30,
    cooldownS: 13,
    charges: 2,
    values: { heal: 100 },
    effects: [{ kind: 'heal', amount: { of: 'heal', song: 1 } }, { kind: 'heal', amount: { of: 50, song: 0.4 }, overS: 4 }],
    upgrades: [
      { description: '+40 instant heal', values: { heal: 40 } },
      {
        description: 'Also +15% Talon resist for 4 s',
        effects: [{ kind: 'statMod', id: 'lyrebird.mended', name: 'Mended', stats: [{ stat: 'talonResist', op: 'add', value: 0.15 }], durationS: 4 }],
      },
      { description: 'Also cleanses negative statuses', effects: [{ kind: 'cleanse', remove: 'negative' }] },
    ],
  },
  {
    ...base,
    channelS: 0,
    id: 'lyrebird.echoDouble',
    name: 'Echo Double',
    description: 'A decoy of you runs along your aim and shoots the nearest enemy while you vanish for 2 s.',
    targeting: 'self',
    range: 0,
    cooldownS: 22,
    charges: 1,
    // shot is 30% of the 16 Talon gun damage; decoys is how many a cast makes; burst is the death burst radius (T3).
    values: { hp: 150, shot: 4.8, decoys: 1, burst: 0 },
    effects: [
      {
        kind: 'summon',
        summon: 'decoy',
        health: { of: 'hp', song: 1 },
        durationS: 6,
        maxCount: 2,
        behaviour: 'decoy',
        trigger: { radius: 25, affects: ENEMIES },
        effects: [{ kind: 'damage', amount: 'shot', type: 'talon' }],
        count: 'decoys',
        spreadDeg: 30, // two decoys run ±15° either side of your aim
        onEnd: [burst('burst', ENEMIES, [song(80, 0.8), apply(DISARM, 1.5)])],
      },
      apply(INVISIBILITY, 2),
    ],
    upgrades: [
      { description: 'Decoy HP +150', values: { hp: 150 } },
      { description: '2 decoys, 15° either side of your aim', values: { decoys: 1 } },
      { description: 'Decoys burst on death or expiry: 4 m radius, 80 + 0.8 x SP Song damage, disarm 1.5 s', values: { burst: 4 } },
    ],
  },
  {
    ...base,
    channelS: 0,
    id: 'lyrebird.discord',
    name: 'Discord',
    description: 'A burst at a point damages and disarms enemies.',
    targeting: 'point',
    range: 25,
    cooldownS: 18,
    charges: 1,
    values: { radius: 6, disarm: 1.5 },
    effects: [burst('radius', ENEMIES, [song(70, 0.7), apply(DISARM, 'disarm')])],
    upgrades: [
      { description: '+1.5 m radius', values: { radius: 1.5 } },
      { description: 'Disarm +0.75 s', values: { disarm: 0.75 } },
      { description: 'Enemies hit take +20% damage from all sources for 4 s', effects: [burst('radius', ENEMIES, [apply(DAMAGE_AMP, 4, 0.2)])] },
    ],
  },
  {
    ...base,
    id: 'lyrebird.grandChorus',
    name: 'Grand Chorus',
    description: 'Channel a song: allies nearby heal and resist, enemies slow. You move slowly and cannot shoot.',
    targeting: 'self',
    range: 14,
    cooldownS: 120,
    charges: 1,
    channelS: 5,
    channelIntervalS: 1,
    values: { radius: 14 },
    effects: [apply(CHORUS, 5)],
    channelEffects: [
      {
        kind: 'area',
        shape: { kind: 'sphere', radius: 'radius' },
        durationS: 0,
        attach: 'source',
        affects: ALLY_HEROES,
        effects: [{ kind: 'heal', amount: { of: 45, song: 0.4 } }, CHORUS_RESIST],
      },
      { kind: 'area', shape: { kind: 'sphere', radius: 'radius' }, durationS: 0, attach: 'source', affects: ENEMIES, effects: [apply(SLOW, 1.1, 0.2)] },
    ],
    upgrades: [
      { description: '+4 m radius', values: { radius: 4 } },
      {
        description: 'Allies also get +15% fire rate',
        effects: [{ kind: 'area', shape: { kind: 'sphere', radius: 'radius' }, durationS: 5, attach: 'source', affects: ALLY_HEROES, effects: [CHORUS_RATE] }],
      },
      { description: 'You can shoot and move at full speed while channelling', effects: [{ kind: 'cleanse', remove: [CHORUS_ID] }] },
    ],
  },
];

export const lyrebirdDef: HeroDef = {
  id: 'lyrebird',
  name: 'Lyrebird',
  archetype: 'support',
  body: {
    height: 1.8,
    radius: 0.3,
    head: { centre: { right: 0, up: 1.62, forward: 0 }, radius: 0.15 },
    muzzle: { right: 0.25, up: 1.26, forward: 0.35 },
  },
  stats: {
    maxHealth: 560,
    healthRegen: 2,
    moveSpeed: 7,
    sprintSpeed: 2,
    stamina: 3,
    staminaRecharge: 5,
    weaponDamage: 16,
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
    name: 'Echo Lute',
    pellets: 1,
    spreadDeg: 0.8,
    fireRate: 4.5,
    hitscan: false,
    projectileSpeed: 90,
    projectileRadius: 0.25,
    reloadS: 2,
    reload: 'magazine',
    falloff: { start: 15, end: 35 },
    range: 100,
  },
  abilities,
};
