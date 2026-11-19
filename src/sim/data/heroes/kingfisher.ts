/**
 * Kingfisher (GDD §9.3): assassin. Every number is the GDD's; "k×SP" scaling is the `song` part of a Magnitude.
 * Tiers only add (D-ABIL-006), so the tiers that change a base number use a value that is 0 until the tier raises it
 * (Plunge T3), or a parallel effect that switches off at the tier (Spear Bill's execute threshold).
 */
import type { AbilityDef, Effect, HeroDef, Magnitude, StatusDef, TargetFilter } from '../../core/contracts';
import { INVISIBILITY, SILENCE, SLOW } from '../combat';

const ENEMIES: TargetFilter = { teams: 'enemies' };
const ENEMY_HEROES: TargetFilter = { teams: 'enemies', heroesOnly: true };
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
const base = { castS: 0, channelS: 0, hook: false } as const;

/** Spear Bill's bleed: 15 + 0.15×SP Song damage a second, so half of that every 0.5 s tick. */
const BLEED: StatusDef = {
  id: 'kingfisher.bleed',
  name: 'Bleeding',
  negative: true,
  stacking: 'perSource',
  maxStacks: 1,
  durationS: 4,
  periodic: { intervalS: 0.5, effects: [song(7.5, 0.075)] },
};

/** Glint: invisible with +25% move speed. Leaving it (attack, cast or timeout) starts Ambush, which the hook applies. */
export const GLINT_ID = 'kingfisher.glint';
const GLINT: StatusDef = {
  id: GLINT_ID,
  name: 'Glint',
  negative: false,
  stacking: 'max',
  maxStacks: 1,
  durationS: 5,
  modifiers: { conditions: ['invisible'], stats: [{ stat: 'moveSpeed', op: 'pct', value: 0.25 }] },
  endsOnAttack: true,
};
/** Ambush: +40% damage on all hits for 1.5 s. */
export const AMBUSH: Effect = {
  kind: 'statMod',
  id: 'kingfisher.ambush',
  name: 'Ambush',
  stats: [{ stat: 'gunDamage', op: 'add', value: 0.4 }, { stat: 'songDamage', op: 'add', value: 0.4 }],
  durationS: 1.5,
};
/** Glint T3: the first hit on a hero during Ambush silences it for 2 s. */
export const AMBUSH_SILENCE = apply(SILENCE, 2);
export const AMBUSH_SILENCE_WINDOW_S = 1.5;
/** Riverstrike T3: invisible for 1.5 s after the strike. */
const STRIKE_VANISH = apply(INVISIBILITY, 1.5);

/** One stab at the lunge's tip: 110 + 1.0×SP, +50% below `below` of max HP, and a bleed. */
const stab = (radius: Magnitude, below: number): Effect =>
  burst(radius, ENEMIES, [
    { kind: 'damage', amount: { of: 'damage', song: 1 }, type: 'song', bonus: [{ mult: 1.5, targetHpBelow: below }] },
    apply(BLEED, 'bleed'),
  ]);

const abilities: [AbilityDef, AbilityDef, AbilityDef, AbilityDef] = [
  {
    ...base,
    id: 'kingfisher.plunge',
    name: 'Plunge',
    description: 'A diving dash strike. Stops on the first enemy hero it meets, then fires faster for 3 s.',
    targeting: 'direction',
    range: 14,
    cooldownS: 12,
    charges: 2,
    // slowS and refund stay 0 until T3 switches them on.
    values: { damage: 80, slowS: 0, refund: 0 },
    effects: [
      {
        kind: 'dash',
        distance: 14,
        durationS: 0.3,
        dir: 'aim',
        maxPitchUpDeg: 30, // a dive keeps its downward pitch; upward is capped as for any aim dash
        stopOnHit: true,
        onHit: [
          song('damage', 0.8),
          apply(SLOW, 'slowS', 0.4),
          { kind: 'cooldownMod', scope: 'slot', slot: 0, mode: 'refund', seconds: 'refund' },
        ],
      },
      { kind: 'statMod', id: 'kingfisher.plunge', name: 'Plunge', stats: [{ stat: 'fireRate', op: 'add', value: 0.25 }], durationS: 3 },
    ],
    upgrades: [
      { description: '+30 damage', values: { damage: 30 } },
      { description: '-3 s cooldown', cooldownS: -3 },
      { description: 'A hero hit is slowed 40% for 2 s and a charge is refunded', values: { slowS: 2, refund: 12 } },
    ],
  },
  {
    ...base,
    id: GLINT_ID,
    name: 'Glint',
    description: 'Turn invisible and quick. Leaving invisibility starts Ambush: +40% damage for 1.5 s.',
    targeting: 'self',
    range: 0,
    cooldownS: 28,
    charges: 1,
    values: { duration: 5 },
    effects: [apply(GLINT, 'duration')],
    upgrades: [
      { description: '+3 s duration', values: { duration: 3 } },
      { description: '-6 s cooldown', cooldownS: -6 },
      { description: "Ambush's first hit on a hero also silences it for 2 s" },
    ],
  },
  {
    ...base,
    id: 'kingfisher.spearBill',
    name: 'Spear Bill',
    description: 'Lunge and stab: bonus damage to wounded targets and a bleed.',
    targeting: 'direction',
    range: 5,
    cooldownS: 10,
    charges: 1,
    // Two stabs, one on at a time: the 40% one, and from T2 the 50% one (the other drops to radius 0).
    values: { damage: 110, bleed: 4, radius40: 1, radius50: 0 },
    effects: [{ kind: 'dash', distance: 5, durationS: 0.15, dir: 'aim', arcHeight: 0, maxPitchUpDeg: 0, onArrive: [stab('radius40', 0.4), stab('radius50', 0.5)] }],
    upgrades: [
      { description: 'Bleed +2 s', values: { bleed: 2 } },
      { description: 'Execute threshold 50%', values: { radius40: -1, radius50: 1 } },
      { description: 'Killing a hero resets Spear Bill and Plunge' }, // the hook
    ],
  },
  {
    ...base,
    id: 'kingfisher.riverstrike',
    name: 'Riverstrike',
    description: 'Teleport behind a hero and strike. A kill soon after refunds half the cooldown.',
    targeting: 'unit',
    affects: ENEMY_HEROES,
    range: 30,
    cooldownS: 100,
    castS: 0.5,
    channelS: 0,
    rooted: true,
    hook: true, // refund on a kill within 3 s
    charges: 1,
    values: { damage: 220 },
    effects: [
      { kind: 'teleport', to: 'behindTarget', behind: 1.5, face: 'target' },
      { kind: 'damage', amount: { of: 'damage', song: 1.6 }, type: 'song', missingHpPct: 0.12 },
    ],
    upgrades: [
      { description: '+10 m range', range: 10 },
      // 12% → 18%: a second hit of the extra 6% (a number until the W3.5 round makes missingHpPct a Magnitude).
      { description: 'Missing-HP part 18%', effects: [{ kind: 'damage', amount: 0, type: 'song', missingHpPct: 0.06 }] },
      { description: 'The target is silenced 1.5 s and you turn invisible 1.5 s after the strike', effects: [apply(SILENCE, 1.5)], selfEffects: [STRIKE_VANISH] },
    ],
  },
];

export const kingfisherDef: HeroDef = {
  id: 'kingfisher',
  name: 'Kingfisher',
  archetype: 'assassin',
  body: {
    height: 1.6,
    radius: 0.28,
    head: { centre: { right: 0, up: 1.42, forward: 0 }, radius: 0.16 },
    muzzle: { right: 0.25, up: 1.12, forward: 0.35 },
  },
  stats: {
    maxHealth: 520,
    healthRegen: 2,
    moveSpeed: 7.3,
    sprintSpeed: 2,
    stamina: 3,
    staminaRecharge: 5,
    weaponDamage: 22,
    magazine: 12,
    meleeDamage: 50,
  },
  growth: [
    { stat: 'maxHealth', op: 'add', value: 30 },
    { stat: 'weaponDamage', op: 'pct', value: 0.03 },
    { stat: 'songPower', op: 'add', value: 1 },
    { stat: 'meleeDamage', op: 'add', value: 3 },
  ],
  weapon: {
    name: 'Dart Pistol',
    pellets: 1,
    spreadDeg: 0.4,
    fireRate: 4,
    hitscan: true,
    projectileSpeed: 0,
    reloadS: 1.6,
    reload: 'magazine',
    falloff: { start: 18, end: 40 },
    range: 80,
  },
  abilities,
};
