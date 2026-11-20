/**
 * Swan (GDD §9.23): support. Every number is the GDD's; "k×SP" scaling is the `song` part of a Magnitude. Tethers
 * tick every 0.5 s (GDD §5.12), so per-second numbers are halved per tick. Tiers only add (D-ABIL-006).
 */
import type { AbilityDef, Effect, HeroDef, Magnitude, StatusDef, TargetFilter } from '../../core/contracts';
import { DISARM, SLOW, UNDYING } from '../combat';

const ENEMIES: TargetFilter = { teams: 'enemies' };
const ALLY_HEROES: TargetFilter = { teams: 'allies', self: true, heroesOnly: true };
/** Allies other than the caster (the caster has its own rider). */
const OTHER_ALLY_HEROES: TargetFilter = { teams: 'allies', heroesOnly: true };
const song = (of: number | string, k: number): Effect => ({ kind: 'damage', amount: { of, song: k }, type: 'song' });
const apply = (status: StatusDef, durationS: Magnitude, magnitude?: Magnitude): Effect => ({ kind: 'applyStatus', status, durationS, magnitude });
const speed = (id: string, value: number, durationS: Magnitude): Effect => ({
  kind: 'statMod',
  id,
  name: 'Lake Glide',
  stats: [{ stat: 'moveSpeed', op: 'pct', value }],
  durationS,
});
const base = { castS: 0, channelS: 0, hook: false } as const;

/** Grace Link: the tether breaks at 35 m (a fixed value; a tiered breakDistance is not needed). */
export const LINK_BREAK_M = 35;
/** The ally's resist is refreshed by each tick of the link (0.5 s), so it lapses just after the link does. */
const LINK_RESIST: Effect = {
  kind: 'statMod',
  id: 'swan.graceLink',
  name: 'Grace Link',
  stats: [{ stat: 'talonResist', op: 'add', value: 0.1 }, { stat: 'songResist', op: 'add', value: 0.1 }],
  durationS: 0.6,
};
const LINK_HEAL: Effect = { kind: 'heal', amount: { of: 'heal', song: 0.1 } };

/** Lake Glide: the area that follows the Swan refreshes these every 0.5 s; they lapse just after it ends. */
const GLIDE_REFRESH_S = 0.55;

/** Swan Song: undying for the duration, then a heal of this share of max HP (a Magnitude can't take a fraction of max HP). */
export const SONG_ABILITY = 'swan.swanSong';
export const SONG_HEAL_HOOK = 'swanSongHeal';
export const SONG_HEAL_FRACTION = 0.25;
const SONG_UNDYING: StatusDef = { ...UNDYING, id: 'swan.song', name: 'Swan Song', durationS: 4, onExpire: [{ kind: 'hook', name: SONG_HEAL_HOOK }] };

const abilities: [AbilityDef, AbilityDef, AbilityDef, AbilityDef] = [
  {
    ...base,
    id: 'swan.graceLink',
    name: 'Grace Link',
    description:
      'Tether to an allied hero within 25 m for 8 s (it breaks beyond 35 m): you and the ally each heal 20 + 0.2 x SP per second, and the ally has +10% Talon and Song resist.',
    targeting: 'unit',
    affects: OTHER_ALLY_HEROES,
    range: 25,
    cooldownS: 18,
    charges: 1,
    // 10 per tick is 20 per second; T2 adds 5 per tick.
    values: { duration: 8, heal: 10 },
    effects: [
      {
        kind: 'tether',
        durationS: 'duration',
        breakDistance: LINK_BREAK_M,
        onSourceTick: [LINK_HEAL],
        onTargetTick: [LINK_HEAL, LINK_RESIST],
      },
    ],
    upgrades: [
      { description: '+4 s duration (12 s)', values: { duration: 4 } },
      { description: 'Heal +10 per second (30 + 0.2 x SP)', values: { heal: 5 } },
      { description: 'Link a second ally: cast again within the duration (2 charges)', charges: 1 },
    ],
  },
  {
    ...base,
    id: 'swan.hiss',
    name: 'Hiss',
    description:
      'Enemies in an 8 m, 60 degree cone take 50 + 0.5 x SP Song damage, are knocked back 6 m and slowed 30% for 2 s.',
    targeting: 'direction',
    range: 8,
    cooldownS: 12,
    charges: 1,
    values: { damage: 50, disarm: 0 },
    effects: [
      {
        kind: 'area',
        shape: { kind: 'cone', length: 8, angleDeg: 60 },
        durationS: 0,
        attach: 'source',
        affects: ENEMIES,
        // The disarm's duration is 0 until T3 raises it, and a status of 0 s applies nothing.
        effects: [song('damage', 0.5), { kind: 'displace', mode: 'push', distance: 6 }, apply(SLOW, 2, 0.3), apply(DISARM, 'disarm')],
      },
    ],
    upgrades: [
      { description: '+25 damage (75 + 0.5 x SP)', values: { damage: 25 } },
      { description: '-3 s cooldown', cooldownS: -3 },
      { description: 'Also disarms 1.0 s', values: { disarm: 1 } },
    ],
  },
  {
    ...base,
    id: 'swan.lakeGlide',
    name: 'Lake Glide',
    description:
      'For 3 s you get +40% move speed and slows are removed; allies within 6 m get +20% move speed and their slows removed.',
    targeting: 'self',
    range: 6,
    cooldownS: 16,
    charges: 1,
    values: { duration: 3 },
    effects: [
      { kind: 'cleanse', remove: [SLOW.id] },
      speed('swan.lakeGlide', 0.4, 'duration'),
      // Slows stay off for the duration: for the Swan and every ally within 6 m of it.
      {
        kind: 'area',
        shape: { kind: 'sphere', radius: 6 },
        durationS: 'duration',
        attach: 'source',
        affects: ALLY_HEROES,
        onEnter: [{ kind: 'cleanse', remove: [SLOW.id] }],
        effects: [{ kind: 'cleanse', remove: [SLOW.id] }],
      },
      {
        kind: 'area',
        shape: { kind: 'sphere', radius: 6 },
        durationS: 'duration',
        attach: 'source',
        affects: OTHER_ALLY_HEROES,
        effects: [speed('swan.lakeGlideAlly', 0.2, GLIDE_REFRESH_S)],
      },
    ],
    upgrades: [
      { description: '+1 s duration (4 s)', values: { duration: 1 } },
      { description: '-4 s cooldown', cooldownS: -4 },
      {
        description: 'Allies get the full +40%',
        effects: [
          {
            kind: 'area',
            shape: { kind: 'sphere', radius: 6 },
            durationS: 'duration',
            attach: 'source',
            affects: OTHER_ALLY_HEROES,
            effects: [speed('swan.lakeGlideAllyFull', 0.2, GLIDE_REFRESH_S)],
          },
        ],
      },
    ],
  },
  {
    ...base,
    id: SONG_ABILITY,
    name: 'Swan Song',
    description:
      'Allied heroes within 15 m (you included) are undying for 4 s; when it ends each heals 25% of max HP.',
    targeting: 'self',
    range: 15,
    cooldownS: 140,
    charges: 1,
    hook: false,
    values: { radius: 15, duration: 4 },
    effects: [
      {
        kind: 'area',
        shape: { kind: 'sphere', radius: 'radius' },
        durationS: 0,
        attach: 'source',
        affects: ALLY_HEROES,
        effects: [apply(SONG_UNDYING, 'duration')],
      },
    ],
    upgrades: [
      { description: '+5 m radius (20 m)', values: { radius: 5 } },
      { description: '+1 s duration (5 s)', values: { duration: 1 } },
      { description: '-40 s cooldown (100 s)', cooldownS: -40 },
    ],
  },
];

export const swanDef: HeroDef = {
  id: 'swan',
  name: 'Swan',
  swatch: 0xf2f4f7,
  archetype: 'support',
  body: {
    height: 2,
    radius: 0.42,
    head: { centre: { right: 0, up: 1.88, forward: 0 }, radius: 0.14 },
    muzzle: { right: 0.28, up: 1.35, forward: 0.4 },
  },
  stats: {
    maxHealth: 600,
    healthRegen: 2,
    moveSpeed: 6.9,
    sprintSpeed: 2,
    stamina: 3,
    staminaRecharge: 5,
    weaponDamage: 20,
    magazine: 14,
    meleeDamage: 50,
  },
  growth: [
    { stat: 'maxHealth', op: 'add', value: 35 },
    { stat: 'weaponDamage', op: 'pct', value: 0.03 },
    { stat: 'songPower', op: 'add', value: 1 },
    { stat: 'meleeDamage', op: 'add', value: 3 },
  ],
  weapon: {
    name: 'Lake Lance',
    pellets: 1,
    spreadDeg: 0.5,
    fireRate: 3.6,
    hitscan: true,
    projectileSpeed: 0,
    reloadS: 2,
    reload: 'magazine',
    falloff: { start: 20, end: 42 },
    range: 80,
  },
  abilities,
};
