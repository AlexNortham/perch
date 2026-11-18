// TODO(Hero Engineer A): replace this W1 placeholder with Puffin's real kit, stats and body plan from docs/GDD.md.
import type { AbilityDef, AbilityUpgrade, HeroDef } from '../../core/contracts';

const upgrades: [AbilityUpgrade, AbilityUpgrade, AbilityUpgrade] = [
  { description: 'Placeholder tier 1' },
  { description: 'Placeholder tier 2' },
  { description: 'Placeholder tier 3' },
];

function placeholder(slot: number, cooldownS: number): AbilityDef {
  return {
    id: `puffin.${slot}`,
    name: `Puffin ability ${slot}`,
    description: 'Placeholder.',
    targeting: 'self',
    range: 0,
    cooldownS,
    charges: 1,
    castS: 0,
    channelS: 0,
    values: {},
    effects: [],
    upgrades,
    hook: false,
  };
}

export const puffinDef: HeroDef = {
  id: 'puffin',
  name: 'Puffin',
  archetype: 'areaControl',
  body: {
    height: 1.8,
    radius: 0.4,
    head: { centre: { right: 0, up: 1.6, forward: 0 }, radius: 0.18 },
    muzzle: { right: 0.25, up: 1.25, forward: 0.35 },
  },
  stats: {
    maxHealth: 550,
    healthRegen: 2,
    moveSpeed: 7,
    sprintSpeed: 2,
    stamina: 3,
    staminaRecharge: 5,
    weaponDamage: 12,
    magazine: 24,
    meleeDamage: 50,
  },
  growth: [
    { stat: 'maxHealth', op: 'add', value: 30 },
    { stat: 'weaponDamage', op: 'pct', value: 0.04 },
    { stat: 'songPower', op: 'add', value: 2 },
  ],
  weapon: {
    name: 'Puffin placeholder gun',
    pellets: 1,
    spreadDeg: 1,
    fireRate: 6,
    hitscan: true,
    projectileSpeed: 0,
    reloadS: 2.5,
    reload: 'magazine',
    falloff: { start: 20, end: 50 },
    range: 120,
  },
  abilities: [placeholder(1, 12), placeholder(2, 15), placeholder(3, 20), placeholder(4, 90)],
};
