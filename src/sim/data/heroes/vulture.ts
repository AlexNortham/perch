/**
 * Vulture (GDD §9.14): area control. Every number is the GDD's; "k×SP" scaling is the `song` part of a Magnitude.
 * Per-second numbers are halved per tick because areas tick every 0.5 s (GDD §5.12). Tiers only add (D-ABIL-006).
 */
import type { AbilityDef, AreaEffect, Effect, HeroDef, Magnitude, MovementModeEffect, StatusDef, TargetFilter } from '../../core/contracts';
import { GROUNDED, HEAL_REDUCTION, TALON_SHRED } from '../combat';

const ENEMIES: TargetFilter = { teams: 'enemies' };
/** Thermal lifts any allied hero in it, the caster included. */
const ALLY_HEROES: TargetFilter = { teams: 'allies', heroesOnly: true, self: true };
const song = (of: number | string, k: number): Effect => ({ kind: 'damage', amount: { of, song: k }, type: 'song' });
const apply = (status: StatusDef, durationS: Magnitude, magnitude?: Magnitude): Effect => ({ kind: 'applyStatus', status, durationS, magnitude });
const base = { castS: 0, channelS: 0, hook: false } as const;
const zone = (
  radius: Magnitude,
  durationS: Magnitude,
  affects: TargetFilter,
  effects: readonly Effect[],
  more: Pick<AreaEffect, 'onEnter' | 'onExit'> = {},
): Effect => ({ kind: 'area', shape: { kind: 'cylinder', radius, height: 4 }, durationS, attach: 'point', affects, effects, ...more });

/** Pick the Bones heals for half the damage it deals: a Song lifesteal that lasts just the tick the cone lands. */
export const BONES_STEAL_ID = 'vulture.bonesSteal';
const BONES_STEAL_S = 0.02;

/** Thermal: the same 9 m/s glide as the Owl's Silent Wing, gun and abilities free, falling 2 m/s. */
const THERMAL_LIFT_M = 10;
const THERMAL_GLIDE_S = 3;
const glide: MovementModeEffect = {
  kind: 'movementMode',
  mode: 'glide',
  durationS: THERMAL_GLIDE_S,
  speed: 9,
  verticalSpeed: 2,
  allowGun: true,
  allowAbilities: true,
};
/** T3: allies who leave the column get +20% damage for 4 s. */
export const THERMAL_BOOST_ID = 'vulture.thermalBoost';

const abilities: [AbilityDef, AbilityDef, AbilityDef, AbilityDef] = [
  {
    ...base,
    id: 'vulture.carrionCircle',
    name: 'Carrion Circle',
    description:
      'After 1 s, vultures circle a 6 m area for 7 s: enemies inside take 20 + 0.2 x SP Song damage a second and have 30% heal reduction.',
    targeting: 'point',
    range: 25,
    cooldownS: 18,
    charges: 1,
    // finish is the HP fraction below which the damage doubles: 0 (never) until T3.
    values: { radius: 6, reduction: 0.3, finish: 0 },
    effects: [
      {
        kind: 'delay',
        seconds: 1,
        effects: [
          zone('radius', 7, ENEMIES, [
            { kind: 'damage', amount: { of: 10, song: 0.1 }, type: 'song', bonus: [{ mult: 2, targetHpBelow: 'finish' }] },
            apply(HEAL_REDUCTION, 0.6, 'reduction'),
          ]),
        ],
      },
    ],
    upgrades: [
      { description: '+2 m radius (8 m)', values: { radius: 2 } },
      { description: 'Heal reduction 50%', values: { reduction: 0.2 } },
      { description: 'Enemies below 50% HP inside take double damage', values: { finish: 0.5 } },
    ],
  },
  {
    ...base,
    id: 'vulture.pickTheBones',
    name: 'Pick the Bones',
    description:
      'A 60-degree cone, 8 m long: enemies take 50 + 0.5 x SP Song damage and lose 12% Talon resist for 6 s. You heal for 50% of the damage dealt.',
    targeting: 'direction',
    range: 8,
    cooldownS: 12,
    charges: 1,
    values: { damage: 50, shred: 0.12 },
    effects: [
      { kind: 'statMod', id: BONES_STEAL_ID, name: 'Pick the Bones', stats: [{ stat: 'songLifesteal', op: 'add', value: 0.5 }], durationS: BONES_STEAL_S },
      {
        kind: 'area',
        shape: { kind: 'cone', length: 8, angleDeg: 60 },
        durationS: 0,
        attach: 'source',
        affects: ENEMIES,
        effects: [song('damage', 0.5), apply(TALON_SHRED, 6, 'shred')],
      },
    ],
    upgrades: [
      { description: '+25 damage (75 + 0.5 x SP)', values: { damage: 25 } },
      { description: 'Shred 18%', values: { shred: 0.06 } },
      { description: '2 charges', charges: 1 },
    ],
  },
  {
    ...base,
    id: 'vulture.thermal',
    name: 'Thermal',
    description:
      'A rising column, 3 m wide, for 6 s. An allied hero who enters it is lifted 10 m and can glide for 3 s (9 m/s across, falling 2 m/s).',
    targeting: 'point',
    range: 20,
    cooldownS: 24,
    charges: 1,
    values: { duration: 6 },
    effects: [
      zone(3, 'duration', ALLY_HEROES, [], { onEnter: [{ kind: 'displace', mode: 'up', distance: THERMAL_LIFT_M }, glide] }),
    ],
    upgrades: [
      { description: '+3 s duration (9 s)', values: { duration: 3 } },
      { description: '-6 s cooldown', cooldownS: -6 },
      {
        description: 'Allies leaving the column get +20% damage for 4 s',
        effects: [
          zone(3, 'duration', ALLY_HEROES, [], {
            onExit: [
              {
                kind: 'statMod',
                id: THERMAL_BOOST_ID,
                name: 'Thermal: lift-off',
                stats: [{ stat: 'gunDamage', op: 'add', value: 0.2 }, { stat: 'songDamage', op: 'add', value: 0.2 }],
                durationS: 4,
              },
            ],
          }),
        ],
      },
    ],
  },
  {
    ...base,
    id: 'vulture.deathSpiral',
    name: 'Death Spiral',
    description:
      'A vortex, 12 m wide, for 5 s: enemies inside are pulled toward the centre at 3 m/s, grounded, and take 40 + 0.5 x SP Song damage a second.',
    targeting: 'point',
    range: 30,
    cooldownS: 120,
    charges: 1,
    // pull is metres per 0.5 s tick (3 m/s).
    values: { duration: 5, pull: 1.5 },
    effects: [
      zone(12, 'duration', ENEMIES, [
        song(20, 0.25),
        { kind: 'displace', mode: 'pull', distance: 'pull' },
        apply(GROUNDED, 0.6),
      ]),
    ],
    upgrades: [
      { description: '+2 s duration (7 s)', values: { duration: 2 } },
      { description: 'Pull 5 m/s', values: { pull: 1 } },
      {
        description: 'When it ends, a 5 m burst at the centre deals 150 + 1.2 x SP Song damage',
        effects: [
          {
            kind: 'delay',
            seconds: 'duration',
            effects: [
              {
                kind: 'area',
                shape: { kind: 'sphere', radius: 5 },
                durationS: 0,
                attach: 'point',
                affects: ENEMIES,
                effects: [song(150, 1.2)],
              },
            ],
          },
        ],
      },
    ],
  },
];

export const vultureDef: HeroDef = {
  id: 'vulture',
  name: 'Vulture',
  swatch: 0x8a5a3c,
  archetype: 'areaControl',
  body: {
    height: 2,
    radius: 0.42,
    head: { centre: { right: 0, up: 1.7, forward: 0 }, radius: 0.16 },
    muzzle: { right: 0.5, up: 1.35, forward: 0.35 },
  },
  stats: {
    maxHealth: 600,
    healthRegen: 2,
    moveSpeed: 6.9,
    sprintSpeed: 2,
    stamina: 3,
    staminaRecharge: 5,
    weaponDamage: 18,
    magazine: 20,
    meleeDamage: 50,
  },
  growth: [
    { stat: 'maxHealth', op: 'add', value: 36 },
    { stat: 'weaponDamage', op: 'pct', value: 0.03 },
    { stat: 'songPower', op: 'add', value: 1 },
    { stat: 'meleeDamage', op: 'add', value: 3 },
  ],
  weapon: {
    name: 'Bone Shot',
    pellets: 1,
    spreadDeg: 0.8,
    fireRate: 4.2,
    hitscan: true,
    projectileSpeed: 0,
    reloadS: 2.4,
    reload: 'magazine',
    falloff: { start: 18, end: 38 },
    range: 120,
  },
  abilities,
};
