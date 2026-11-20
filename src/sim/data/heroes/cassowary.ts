/**
 * Cassowary (GDD §9.17): tank and initiator. Every number is the GDD's; "k×SP" scaling is the `song` part of a Magnitude.
 * Tiers only add (D-ABIL-006): a number a tier raises is a named value, an extra effect is appended by the tier.
 */
import type { AbilityDef, Effect, HeroDef, Magnitude, StatusDef, TargetFilter } from '../../core/contracts';
import { SLOW, STUN, TALON_SHRED, UNSTOPPABLE } from '../combat';

const ENEMIES: TargetFilter = { teams: 'enemies' };
const song = (of: number | string, k: number): Effect => ({ kind: 'damage', amount: { of, song: k }, type: 'song' });
const apply = (status: StatusDef, durationS: Magnitude, magnitude?: Magnitude): Effect => ({ kind: 'applyStatus', status, durationS, magnitude });
/** "+x% Talon and Song resist": additive, so +40% is exactly 40 points. */
const resist = (id: string, name: string, value: number, durationS: number): Effect => ({
  kind: 'statMod',
  id,
  name,
  stats: [{ stat: 'talonResist', op: 'add', value }, { stat: 'songResist', op: 'add', value }],
  durationS,
});
const base = { castS: 0, channelS: 0, hook: false } as const;

/** Hook names and constants shared with the hero module. */
export const RAMPAGE_HIT_HOOK = 'rampageHit';
/** Rampage: 20 m in 1.0 s; the knock-up is 0.75 s in the air (1.758 m at 25 m/s² gravity). */
export const RAMPAGE = { distanceM: 20, durationS: 1, knockUpM: 1.758, steerDeg: 30 } as const;
/** What Rampage does to a hero it runs into: the hook applies it to heroes only and stops the charge unless T3. */
export const RAMPAGE_HIT: readonly Effect[] = [song('damage', 0.8), { kind: 'displace', mode: 'up', distance: RAMPAGE.knockUpM }];
/** Bristle: enemy heroes within 15 m who damage you take this fraction back as Song damage (the hook). */
export const BRISTLE = { radiusM: 15, durationS: 5, reflect: 0.2 } as const;
/** Boom Call: unstoppable with +40% Talon and Song resist for 4 s once the pull is done. */
export const BOOM_AFTER_S = 4;

const abilities: [AbilityDef, AbilityDef, AbilityDef, AbilityDef] = [
  {
    ...base,
    id: 'cassowary.rampage',
    name: 'Rampage',
    description:
      'Charge 20 m in 1.0 s along your aim, steering up to 30° either way, unstoppable. The first enemy hero you hit takes 90 + 0.8 x SP Song damage and is knocked up 0.75 s, and the charge stops there.',
    targeting: 'direction',
    range: RAMPAGE.distanceM,
    cooldownS: 18,
    charges: 1,
    hook: true, // hits heroes only, and ends the charge on the first unless `pass` is 1
    values: { damage: 90, pass: 0 },
    effects: [
      {
        kind: 'dash',
        distance: RAMPAGE.distanceM,
        durationS: RAMPAGE.durationS,
        dir: 'aim',
        arcHeight: 0,
        maxPitchUpDeg: 0,
        steerDeg: RAMPAGE.steerDeg,
        onHit: [{ kind: 'hook', name: RAMPAGE_HIT_HOOK }],
      },
    ],
    selfEffects: [apply(UNSTOPPABLE, RAMPAGE.durationS)],
    upgrades: [
      { description: '+30 damage (120 + 0.8 x SP)', values: { damage: 30 } },
      { description: '-4 s cooldown', cooldownS: -4 },
      { description: 'Hits every hero along the path and does not stop', values: { pass: 1 } },
    ],
  },
  {
    ...base,
    id: 'cassowary.daggerKick',
    name: 'Dagger Kick',
    description: 'Kick a 4 m, 60 degree cone: 100 + 1.0 x SP Song damage, 5 m knockback and -15% Talon resist for 5 s.',
    targeting: 'direction',
    range: 4,
    cooldownS: 10,
    charges: 1,
    values: { damage: 100, shred: 0.15 },
    effects: [
      {
        kind: 'area',
        shape: { kind: 'cone', length: 4, angleDeg: 60 },
        durationS: 0,
        attach: 'source',
        affects: ENEMIES,
        effects: [song('damage', 1), { kind: 'displace', mode: 'along', distance: 5 }, apply(TALON_SHRED, 5, 'shred')],
      },
    ],
    upgrades: [
      { description: '+30 damage (130 + 1.0 x SP)', values: { damage: 30 } },
      { description: 'Shred 25%', values: { shred: 0.1 } },
      { description: '2 charges', charges: 1 },
    ],
  },
  {
    ...base,
    id: 'cassowary.bristle',
    name: 'Bristle',
    description:
      'For 5 s you have a Talon shield of 250 + 2.0 x SP, and enemy heroes within 15 m who damage you take 20% of that damage back as Song damage.',
    targeting: 'self',
    range: BRISTLE.radiusM,
    cooldownS: 24,
    charges: 1,
    hook: true, // the thorns: a fraction of the damage taken, which a Magnitude can't say
    values: { shield: 250, duration: BRISTLE.durationS },
    effects: [{ kind: 'shield', absorbs: 'talon', amount: { of: 'shield', song: 2 }, durationS: 'duration' }],
    upgrades: [
      { description: '+100 shield (350 + 2.0 x SP)', values: { shield: 100 } },
      { description: '-6 s cooldown', cooldownS: -6 },
      {
        description: 'Also a Song shield of the same amount',
        effects: [{ kind: 'shield', absorbs: 'song', amount: { of: 'shield', song: 2 }, durationS: 'duration' }],
      },
    ],
  },
  {
    ...base,
    id: 'cassowary.boomCall',
    name: 'Boom Call',
    description:
      'A deep boom pulls every enemy within 12 m 6 m toward you; they take 120 + 1.0 x SP Song damage and are slowed 50% for 2 s. Then you are unstoppable with +40% Talon and Song resist for 4 s.',
    targeting: 'self',
    range: 12,
    cooldownS: 110,
    charges: 1,
    // stunR is 0 until T2 switches the stun on: a zero-radius area hits nobody.
    values: { radius: 12, stunR: 0 },
    effects: [
      {
        kind: 'area',
        shape: { kind: 'sphere', radius: 'radius' },
        durationS: 0,
        attach: 'source',
        affects: ENEMIES,
        effects: [song(120, 1), { kind: 'displace', mode: 'pull', distance: 6 }, apply(SLOW, 2, 0.5)],
      },
      {
        kind: 'area',
        shape: { kind: 'sphere', radius: 'stunR' },
        durationS: 0,
        attach: 'source',
        affects: ENEMIES,
        effects: [apply(STUN, 0.75)],
      },
    ],
    selfEffects: [apply(UNSTOPPABLE, BOOM_AFTER_S), resist('cassowary.boom', 'Boom Call', 0.4, BOOM_AFTER_S)],
    upgrades: [
      { description: '+4 m radius (16 m)', range: 4, values: { radius: 4 } },
      { description: 'Pulled enemies are also stunned 0.75 s', values: { stunR: 16 } },
      { description: '-30 s cooldown (80 s)', cooldownS: -30 },
    ],
  },
];

export const cassowaryDef: HeroDef = {
  id: 'cassowary',
  name: 'Cassowary',
  swatch: 0x2a6fdb,
  archetype: 'tank',
  body: {
    height: 2.4,
    radius: 0.48,
    head: { centre: { right: 0, up: 2.25, forward: 0 }, radius: 0.17 },
    muzzle: { right: 0.4, up: 1.75, forward: 0.4 },
  },
  stats: {
    maxHealth: 740,
    healthRegen: 2,
    moveSpeed: 7,
    sprintSpeed: 2,
    stamina: 3,
    staminaRecharge: 5,
    weaponDamage: 20,
    magazine: 16,
    meleeDamage: 50,
  },
  growth: [
    { stat: 'maxHealth', op: 'add', value: 46 },
    { stat: 'weaponDamage', op: 'pct', value: 0.03 },
    { stat: 'songPower', op: 'add', value: 1 },
    { stat: 'meleeDamage', op: 'add', value: 3 },
  ],
  weapon: {
    name: 'Wattle Blaster',
    pellets: 1,
    spreadDeg: 1.2,
    fireRate: 3.5,
    hitscan: true,
    projectileSpeed: 0,
    reloadS: 2.4,
    reload: 'magazine',
    falloff: { start: 14, end: 30 },
    range: 60,
  },
  abilities,
};
