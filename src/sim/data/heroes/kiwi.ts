/**
 * Kiwi (GDD §9.24): assassin. Every number is the GDD's; "k×SP" scaling is the `song` part of a Magnitude. Tiers only
 * add (D-ABIL-006). Underground is intangible plus invisible (heroes never collide with each other, so that is all
 * "no collision with heroes" needs); a lengthened Burrow raises `channelExtraS` along with `duration` (D-HEROB-001).
 */
import type { AbilityDef, Effect, HeroDef, Magnitude, StatusDef, TargetFilter } from '../../core/contracts';
import { ROOT, SLOW, TALON_SHRED } from '../combat';

const ENEMIES: TargetFilter = { teams: 'enemies' };
const ENEMY_HEROES: TargetFilter = { teams: 'enemies', heroesOnly: true };
const song = (of: number | string, k: number): Effect => ({ kind: 'damage', amount: { of, song: k }, type: 'song' });
const apply = (status: StatusDef, durationS: Magnitude, magnitude?: Magnitude): Effect => ({ kind: 'applyStatus', status, durationS, magnitude });
const base = { castS: 0, hook: false } as const;

/** Underground: not hittable or targetable, and unseen. */
export const UNDERGROUND_ID = 'kiwi.underground';
const UNDERGROUND: StatusDef = {
  id: UNDERGROUND_ID,
  name: 'Underground',
  negative: false,
  stacking: 'max',
  maxStacks: 1,
  durationS: 4,
  modifiers: { conditions: ['invisible', 'intangible'] },
};
/** A knock-up of this many seconds in the air rises this high (25 m/s² gravity: 3.125 m × seconds²). */
const knockUp = (airS: number): Effect => ({ kind: 'displace', mode: 'up', distance: (25 * airS * airS) / 8 });

/** Burrow: 9 m/s underground; surfacing erupts (3 m, 80 + 0.8 x SP, knock-up 0.6 s) and T3 heals the Kiwi. */
export const BURROW_ABILITY = 'kiwi.burrow';
export const BURROW = { speed: 9, eruptM: 3, knockUpS: 0.6 } as const;
export const BURROW_HEAL_HOOK = 'burrowHeal';
export const BURROW_HEAL_FRACTION = 0.15;

/** Night Sense: the hook reveals enemy heroes below this share of max HP, within the ability's range. */
export const NIGHT_SENSE_HOOK = 'nightSenseTick';
export const NIGHT_SENSE_HP = 0.5;
/** The reveal is refreshed by each 0.5 s area tick. */
export const NIGHT_SENSE_REVEAL_S = 0.6;
const NIGHT_SENSE: StatusDef = {
  id: 'kiwi.nightSense',
  name: 'Night Sense',
  negative: false,
  stacking: 'max',
  maxStacks: 1,
  durationS: 6,
  modifiers: { stats: [{ stat: 'trueSightRadius', op: 'add', value: 20 }], conditions: ['trueSight'] },
};

/** Ambush Pit: tunnels 1.0 s, then erupts (6 m, 220 + 1.6 x SP, knock-up 1.0 s, then a 2 s slow). */
export const PIT = { tunnelS: 1, knockUpS: 1 } as const;

const abilities: [AbilityDef, AbilityDef, AbilityDef, AbilityDef] = [
  {
    ...base,
    id: BURROW_ABILITY,
    name: 'Burrow',
    description:
      'Go underground for up to 4 s: intangible and invisible, 9 m/s, no attacks. Resurfacing (press again, or when time runs out) knocks up enemies within 3 m for 0.6 s and deals 80 + 0.8 x SP Song damage.',
    targeting: 'self',
    range: 0,
    cooldownS: 18,
    charges: 1,
    channelS: 4, // the press that ends the channel surfaces the Kiwi
    hook: false,
    values: { duration: 4, channelExtraS: 0, damage: 80, healPct: 0 },
    effects: [
      apply(UNDERGROUND, 'duration'),
      {
        kind: 'movementMode',
        mode: 'burrow',
        durationS: 'duration',
        speed: BURROW.speed,
        verticalSpeed: 0,
        allowGun: false,
        allowAbilities: false,
        onEnd: [
          { kind: 'cleanse', remove: [UNDERGROUND_ID] },
          {
            kind: 'area',
            shape: { kind: 'sphere', radius: BURROW.eruptM },
            durationS: 0,
            attach: 'point',
            affects: ENEMIES,
            effects: [song('damage', 0.8), knockUp(BURROW.knockUpS)],
          },
          { kind: 'hook', name: BURROW_HEAL_HOOK },
        ],
      },
    ],
    upgrades: [
      { description: '+1 s duration (5 s)', values: { duration: 1, channelExtraS: 1 } },
      { description: '-4 s cooldown', cooldownS: -4 },
      { description: 'Resurfacing heals you 15% of max HP', values: { healPct: BURROW_HEAL_FRACTION } },
    ],
  },
  {
    ...base,
    channelS: 0,
    id: 'kiwi.probe',
    name: 'Probe',
    description: 'Stab with your bill (3 m reach): 90 + 0.9 x SP Song damage and -15% Talon resist for 5 s.',
    targeting: 'direction',
    range: 3,
    cooldownS: 9,
    charges: 1,
    values: { damage: 90, root: 0 },
    effects: [
      {
        // A 3 m cone only 0.8 m wide at the tip: the bill's reach and width.
        kind: 'area',
        shape: { kind: 'cone', length: 3, angleDeg: 30 },
        durationS: 0,
        attach: 'source',
        affects: ENEMIES,
        // The root's duration is 0 until T3 raises it, and a status of 0 s applies nothing.
        effects: [song('damage', 0.9), apply(TALON_SHRED, 5, 0.15), apply(ROOT, 'root')],
      },
    ],
    upgrades: [
      { description: '+25 damage (115 + 0.9 x SP)', values: { damage: 25 } },
      { description: '-2 s cooldown', cooldownS: -2 },
      { description: 'Also roots 0.75 s', values: { root: 0.75 } },
    ],
  },
  {
    ...base,
    channelS: 0,
    id: 'kiwi.nightSense',
    name: 'Night Sense',
    description:
      'For 6 s: true sight within 20 m, and every enemy hero below 50% HP within 50 m is revealed to your flock.',
    targeting: 'self',
    range: 50,
    cooldownS: 22,
    charges: 1,
    hook: false,
    values: { duration: 6, radius: 50 },
    effects: [
      apply(NIGHT_SENSE, 'duration'),
      {
        kind: 'area',
        shape: { kind: 'sphere', radius: 'radius' },
        durationS: 'duration',
        attach: 'source',
        affects: ENEMY_HEROES,
        effects: [{ kind: 'hook', name: NIGHT_SENSE_HOOK }],
      },
    ],
    upgrades: [
      { description: '+3 s duration (9 s)', values: { duration: 3 } },
      {
        description: 'True sight 30 m',
        effects: [{ kind: 'statMod', id: 'kiwi.nightSenseWide', name: 'Night Sense', stats: [{ stat: 'trueSightRadius', op: 'add', value: 10 }], durationS: 'duration' }],
      },
      {
        description: '+20% move speed for the duration',
        effects: [{ kind: 'statMod', id: 'kiwi.nightSenseSpeed', name: 'Night Sense', stats: [{ stat: 'moveSpeed', op: 'pct', value: 0.2 }], durationS: 'duration' }],
      },
    ],
  },
  {
    ...base,
    channelS: 0,
    id: 'kiwi.ambushPit',
    name: 'Ambush Pit',
    description:
      'Tunnel to a point within 20 m over 1.0 s (intangible, invisible), then erupt: enemies within 6 m take 220 + 1.6 x SP Song damage, are knocked up 1.0 s, then slowed 40% for 2 s.',
    targeting: 'point',
    range: 20,
    cooldownS: 100,
    charges: 1,
    values: { dist: 20, damage: 220 },
    effects: [
      apply(UNDERGROUND, PIT.tunnelS + 0.2),
      {
        kind: 'dash',
        distance: 'dist',
        durationS: PIT.tunnelS,
        dir: 'target',
        onArrive: [
          { kind: 'cleanse', remove: [UNDERGROUND_ID] },
          {
            kind: 'area',
            shape: { kind: 'sphere', radius: 6 },
            durationS: 0,
            attach: 'point',
            affects: ENEMIES,
            effects: [song('damage', 1.6), knockUp(PIT.knockUpS), { kind: 'delay', seconds: PIT.knockUpS, effects: [apply(SLOW, 2, 0.4)] }],
          },
        ],
      },
    ],
    upgrades: [
      { description: '+10 m range (30 m)', range: 10, values: { dist: 10 } },
      { description: '+60 damage (280 + 1.6 x SP)', values: { damage: 60 } },
      { description: '-30 s cooldown (70 s)', cooldownS: -30 },
    ],
  },
];

export const kiwiDef: HeroDef = {
  id: 'kiwi',
  name: 'Kiwi',
  swatch: 0x7a5636,
  archetype: 'assassin',
  body: {
    height: 1.2,
    radius: 0.4,
    head: { centre: { right: 0, up: 1, forward: 0 }, radius: 0.15 },
    muzzle: { right: 0.22, up: 0.75, forward: 0.4 },
  },
  stats: {
    maxHealth: 560,
    healthRegen: 2,
    moveSpeed: 7.2,
    sprintSpeed: 2,
    stamina: 3,
    staminaRecharge: 5,
    weaponDamage: 7,
    magazine: 5,
    meleeDamage: 50,
  },
  growth: [
    { stat: 'maxHealth', op: 'add', value: 34 },
    { stat: 'weaponDamage', op: 'pct', value: 0.03 },
    { stat: 'songPower', op: 'add', value: 1 },
    { stat: 'meleeDamage', op: 'add', value: 3 },
  ],
  weapon: {
    name: 'Burrow Blunderbuss',
    pellets: 6,
    spreadDeg: 3.5,
    fireRate: 1.6,
    hitscan: true,
    projectileSpeed: 0,
    reloadS: 2,
    reload: 'magazine',
    falloff: { start: 8, end: 18 },
    range: 40,
  },
  abilities,
};
