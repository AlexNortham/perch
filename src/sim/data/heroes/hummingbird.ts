/**
 * Hummingbird (GDD §9.16): mobility skirmisher. Every number is the GDD's; "k×SP" scaling is the `song` part of a
 * Magnitude. Per-second numbers are halved per tick because tethers tick every 0.5 s (GDD §5.12). Tiers only add
 * (D-ABIL-006).
 */
import type { AbilityDef, Effect, HeroDef, Magnitude, StatusDef, TetherEffect } from '../../core/contracts';
import { SLOW } from '../combat';

const song = (of: number | string, k: number): Effect => ({ kind: 'damage', amount: { of, song: k }, type: 'song' });
const apply = (status: StatusDef, durationS: Magnitude, magnitude?: Magnitude): Effect => ({ kind: 'applyStatus', status, durationS, magnitude });
const base = { castS: 0, channelS: 0, hook: false } as const;

/** Passive Hover: Space held while airborne holds your height for this long; it recharges on landing. */
export const HOVER_S = 1.5;

/** Nectar Sip's link: the target loses what you gain, every half second. The hook picks the break distance by tier. */
export const NECTAR_BREAK_M = 12;
export const NECTAR_BREAK_T2_M = 16;
export const nectarTether = (breakDistance: number): TetherEffect => ({
  kind: 'tether',
  durationS: 'duration',
  breakDistance,
  onSourceTick: [{ kind: 'heal', amount: { of: 20, song: 0.2 } }],
  onTargetTick: [song(20, 0.2), apply(SLOW, 0.6, 'slow')],
});

/** Thousand Beats: the status that marks the wings as blades (it also carries the +2 maximum Dart charges). */
export const BEATS_ID = 'hummingbird.thousandBeats';
export const BEATS_SLOT = 3;
/** Darts charges refunded or granted are whole charges: a refund this big can only complete one. */
export const WHOLE_CHARGE_S = 100;
const BEATS_FILL_DELAY_S = 0.05;

const abilities: [AbilityDef, AbilityDef, AbilityDef, AbilityDef] = [
  {
    ...base,
    id: 'hummingbird.dart',
    name: 'Dart',
    description: 'Dash 8 m in 0.15 s along your aim, including straight up. Three charges.',
    targeting: 'direction',
    range: 8,
    cooldownS: 7,
    charges: 3,
    hook: false,
    values: {},
    effects: [
      {
        kind: 'dash',
        distance: 8,
        durationS: 0.15,
        dir: 'aim',
        maxPitchUpDeg: 90,
        passThrough: true,
        onHit: [{ kind: 'hook', name: 'dartHit' }], // Thousand Beats
      },
    ],
    upgrades: [
      { description: '+1 charge (4 charges)', charges: 1 },
      { description: '-2 s cooldown', cooldownS: -2 },
      {
        description: 'Your next gun shot within 1 s of a Dart deals +60% damage',
        effects: [{ kind: 'weaponMod', durationS: 1.15, shots: 1, gunDamage: 0.6 }],
      },
    ],
  },
  {
    ...base,
    id: 'hummingbird.nectarSip',
    name: 'Nectar Sip',
    description:
      'Tether to an enemy hero within 6 m for 2 s (it breaks beyond 12 m): the target takes 40 + 0.4 x SP Song damage a second and you heal the same amount.',
    targeting: 'unit',
    affects: { teams: 'enemies', heroesOnly: true },
    range: 6,
    cooldownS: 16,
    charges: 1,
    hook: true, // the tether's break distance depends on the tier
    values: { duration: 2, slow: 0 },
    effects: [],
    upgrades: [
      { description: '+1 s duration (3 s)', values: { duration: 1 } },
      { description: '+4 m range and break distance (10 m, breaks at 16 m)', range: 4 },
      { description: 'The target is also slowed 30%', values: { slow: 0.3 } },
    ],
  },
  {
    ...base,
    id: 'hummingbird.blur',
    name: 'Blur',
    description: 'For 2 s you move 40% faster and have +40% Talon resist.',
    targeting: 'self',
    range: 0,
    cooldownS: 15,
    charges: 1,
    values: { duration: 2 },
    effects: [
      { kind: 'statMod', id: 'hummingbird.blur', name: 'Blur', stats: [{ stat: 'moveSpeed', op: 'pct', value: 0.4 }, { stat: 'talonResist', op: 'add', value: 0.4 }], durationS: 'duration' },
    ],
    upgrades: [
      { description: '+1 s duration (3 s)', values: { duration: 1 } },
      {
        description: 'Also +40% Song resist',
        effects: [{ kind: 'statMod', id: 'hummingbird.blur.song', name: 'Blur: song', stats: [{ stat: 'songResist', op: 'add', value: 0.4 }], durationS: 'duration' }],
      },
      { description: '-5 s cooldown', cooldownS: -5 },
    ],
  },
  {
    ...base,
    id: 'hummingbird.thousandBeats',
    name: 'Thousand Beats',
    description:
      'For 5 s your wings are blades: every Dart damages enemies along its path for 100 + 0.9 x SP Song damage, Dart has 2 more charges (and they are filled now), and a Dart that hits a hero refunds a charge.',
    targeting: 'self',
    range: 0,
    cooldownS: 90,
    charges: 1,
    values: { duration: 5, damage: 100, silence: 0 },
    effects: [
      { kind: 'statMod', id: BEATS_ID, name: 'Thousand Beats', stats: [{ stat: 'abilityCharges', op: 'add', value: 2 }], durationS: 'duration' },
      // The maximum has just gone up by two. The empty slots only start recharging on the next tick (a refund of a
      // full ability does nothing), so a moment later complete two charges.
      {
        kind: 'delay',
        seconds: BEATS_FILL_DELAY_S,
        effects: [
          { kind: 'cooldownMod', scope: 'slot', slot: 0, mode: 'refund', seconds: WHOLE_CHARGE_S },
          { kind: 'cooldownMod', scope: 'slot', slot: 0, mode: 'refund', seconds: WHOLE_CHARGE_S },
        ],
      },
    ],
    upgrades: [
      { description: '+2 s duration (7 s)', values: { duration: 2 } },
      { description: '+40 damage (140 + 0.9 x SP)', values: { damage: 40 } },
      { description: 'Dart hits also silence for 0.75 s', values: { silence: 0.75 } },
    ],
  },
];

export const hummingbirdDef: HeroDef = {
  id: 'hummingbird',
  name: 'Hummingbird',
  swatch: 0x3ec45a,
  archetype: 'skirmisher',
  body: {
    height: 1.3,
    radius: 0.24,
    head: { centre: { right: 0, up: 1.18, forward: 0 }, radius: 0.13 },
    muzzle: { right: 0.28, up: 0.9, forward: 0.35 },
  },
  stats: {
    maxHealth: 480,
    healthRegen: 2,
    moveSpeed: 7.4,
    sprintSpeed: 2,
    stamina: 4,
    staminaRecharge: 5,
    weaponDamage: 6,
    magazine: 45,
    meleeDamage: 50,
  },
  growth: [
    { stat: 'maxHealth', op: 'add', value: 28 },
    { stat: 'weaponDamage', op: 'pct', value: 0.03 },
    { stat: 'songPower', op: 'add', value: 1 },
    { stat: 'meleeDamage', op: 'add', value: 3 },
  ],
  weapon: {
    name: 'Nectar Needler',
    pellets: 1,
    spreadDeg: 1.5,
    fireRate: 13,
    hitscan: true,
    projectileSpeed: 0,
    reloadS: 1.8,
    reload: 'magazine',
    falloff: { start: 12, end: 28 },
    range: 120,
  },
  abilities,
};
