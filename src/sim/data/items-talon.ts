// The 21 Talon items (GDD §10.1). Effects the effect vocabulary can't carry as a trigger are riders (items-kit.ts),
// keyed by item id and run by sim/items/riders.ts.
import type { ItemDef } from '../core/contracts';
import { DISARM, HEAL_REDUCTION, REVEAL, SLOW } from './combat';
import { item, stat, type Rider } from './items-kit';

const slow = (magnitude: number, durationS: number) => ({ kind: 'applyStatus', status: SLOW, magnitude, durationS }) as const;
/** Pinion Shred: each gun hit on a hero adds a stack (max 5) of 3% Talon resist shred for 6 s. */
const PINION = { id: 'pinion-shred', name: 'Pinion Shred', negative: true, stacking: 'stack', maxStacks: 5, durationS: 6,
  modifiers: { stats: [stat('talonShred', 0.03)] } } as const;
/** Hooked Spur and Stoop Dive: a heavy melee hit on a hero slows it. */
const HEAVY_SLOW: Rider = { on: 'heavyMelee', effects: [slow(0.25, 1.5)] };
const onGunHit = (effects: ItemDef['procs'][number]['effects']) =>
  ({ on: 'weaponHit', heroesOnly: true, chance: 1, cooldownS: 0, target: 'other', effects }) as const;

export const TALON_ITEMS: readonly ItemDef[] = [
  item('quill-clip', 'Quill Clip', '+25% magazine size and +6% gun damage.', 'talon', 1,
    [stat('magazine', 0.25, 'pct'), stat('gunDamage', 0.06)]),
  item('close-talons', 'Close Talons', '+20% gun damage within 15 m.', 'talon', 1, [stat('closeGunDamage', 0.2)]),
  item('beak-whetstone', 'Beak Whetstone', 'Beak shots deal +35 Talon damage once per shot.', 'talon', 1, [stat('beakShotFlat', 35)]),
  item('quick-preen', 'Quick Preen', '+10% fire rate and +15% reload speed.', 'talon', 1, [stat('fireRate', 0.1), stat('reloadSpeed', 0.15)]),
  item('hooked-spur', 'Hooked Spur', '+20% melee damage and +60 HP. A heavy melee hit on a hero slows it 25% for 1.5 s.', 'talon', 1,
    [stat('meleeDamage', 0.2, 'pct'), stat('maxHealth', 60)]),
  item('foragers-talon', 'Forager’s Talon', '+30% gun damage to non-heroes, +8% to heroes, +100 HP.', 'talon', 2,
    [stat('gunDamage', 0.08), stat('maxHealth', 100)]),
  item('long-fletching', 'Long Fletching', '+45% falloff range, +15% projectile speed and +8% gun damage.', 'talon', 2,
    [stat('falloffRange', 0.45), stat('bulletSpeed', 0.15), stat('gunDamage', 0.08)]),
  item('bloodbeak', 'Bloodbeak', '15% Talon lifesteal and +75 HP.', 'talon', 2, [stat('talonLifesteal', 0.15), stat('maxHealth', 75)]),
  item('flurry-feathers', 'Flurry Feathers', '+12% fire rate and +15% reload speed. Activate to reload instantly and gain +40% fire rate for 5 s. Cooldown 30 s.',
    'talon', 2, [stat('fireRate', 0.12), stat('reloadSpeed', 0.15)], 'quick-preen', {
      cooldownS: 30, targeting: 'self', range: 0, effects: [{ kind: 'weaponMod', reload: true, durationS: 0 },
        { kind: 'statMod', id: 'flurry', name: 'Flurry', durationS: 5, stats: [stat('fireRate', 0.4)] }],
    }),
  item('sourberry-rounds', 'Sourberry Rounds', '+8% gun damage, +4% fire rate. Gun hits on heroes apply 35% heal reduction for 2.5 s.', 'talon', 2,
    [stat('gunDamage', 0.08), stat('fireRate', 0.04)], null, null,
    [onGunHit([{ kind: 'applyStatus', status: HEAL_REDUCTION, magnitude: 0.35, durationS: 2.5 }])]),
  item('wasp-barbs', 'Wasp Barbs', '+6% gun damage, +6 Song power. Each shot that hits a hero also deals 8 + 0.15×SP Song damage.', 'talon', 2,
    [stat('gunDamage', 0.06), stat('songPower', 6)], null, null,
    [onGunHit([{ kind: 'damage', amount: { of: 8, song: 0.15 }, type: 'song' }])]),
  item('hawkeye-lens', 'Hawkeye Lens', '+15% gun damage. Beak shots deal +80 Talon damage and give +20% fire rate for 3 s.', 'talon', 3,
    [stat('gunDamage', 0.15), stat('beakShotFlat', 80)], 'beak-whetstone', null,
    [{ on: 'beakShot', chance: 1, cooldownS: 0, target: 'self',
      effects: [{ kind: 'statMod', id: 'hawkeye', name: 'Hawkeye', durationS: 3, stats: [stat('fireRate', 0.2)] }] }]),
  item('pinion-shred', 'Pinion Shred', '+10% gun damage. Each gun hit on a hero shreds 3% Talon resist for 6 s (max 5 stacks).', 'talon', 3,
    [stat('gunDamage', 0.1)], null, null, [onGunHit([{ kind: 'applyStatus', status: PINION }])]),
  item('skipping-stone', 'Skipping Stone', '+8% gun damage. Each shot that hits bounces to one more enemy within 8 m for 45% damage.', 'talon', 3,
    [stat('gunDamage', 0.08)]),
  item('tailwind-volley', 'Tailwind Volley', '+35% magazine size and +12% gun damage. Activate to reload instantly, +35% gun damage and +25% projectile speed for 4 s. Cooldown 25 s.',
    'talon', 3, [stat('magazine', 0.35, 'pct'), stat('gunDamage', 0.12)], 'quill-clip', {
      cooldownS: 25, targeting: 'self', range: 0, effects: [{ kind: 'weaponMod', reload: true, durationS: 0 },
        { kind: 'statMod', id: 'volley', name: 'Volley', durationS: 4, stats: [stat('gunDamage', 0.35), stat('bulletSpeed', 0.25)] }],
    }),
  item('stoop-dive', 'Stoop Dive', '+30% melee damage, +10% gun damage, +100 HP; heavy melee slows. Activate to dash to the enemy hero near your crosshair and strike. Cooldown 30 s.',
    'talon', 3, [stat('meleeDamage', 0.3, 'pct'), stat('gunDamage', 0.1), stat('maxHealth', 100)], 'hooked-spur', {
      cooldownS: 30, targeting: 'unit', range: 18, affects: { teams: 'enemies', heroesOnly: true },
      effects: [{ kind: 'dash', dir: 'target', distance: 18, durationS: 0.35, stopOnHit: true, onArrive: [
        { kind: 'area', shape: { kind: 'sphere', radius: 2.5 }, durationS: 0, attach: 'source', affects: { teams: 'enemies', heroesOnly: true },
          effects: [{ kind: 'damage', amount: 140, type: 'talon' }, slow(0.4, 2), { kind: 'applyStatus', status: DISARM, durationS: 1 }] }] }],
    }),
  item('apex-talon', 'Apex Talon', '+40% gun damage, +10% fire rate, +15% magazine size.', 'talon', 4,
    [stat('gunDamage', 0.4), stat('fireRate', 0.1), stat('magazine', 0.15, 'pct')]),
  item('carrion-feast', 'Carrion Feast', '28% Talon lifesteal and +200 HP. A hero kill or assist heals 15% of max HP.', 'talon', 4,
    [stat('talonLifesteal', 0.28), stat('maxHealth', 200)], 'bloodbeak'),
  item('thunderclap-quills', 'Thunderclap Quills', '+10% gun damage. Every 6th shot that hits deals +150 Talon damage and slows 30% for 1.5 s.', 'talon', 4,
    [stat('gunDamage', 0.1)], null, null,
    [{ on: 'weaponHit', count: 6, chance: 1, cooldownS: 0, target: 'other', effects: [{ kind: 'damage', amount: 150, type: 'talon' }, slow(0.3, 1.5)] }]),
  item('talon-tempest', 'Talon Tempest', '+20% fire rate and +20% reload speed. Activate for 5 s: +60% fire rate and no ammo use. Cooldown 45 s.',
    'talon', 4, [stat('fireRate', 0.2), stat('reloadSpeed', 0.2)], 'flurry-feathers', {
      cooldownS: 45, targeting: 'self', range: 0, effects: [{ kind: 'weaponMod', ammoFree: true, durationS: 5 },
        { kind: 'statMod', id: 'tempest', name: 'Tempest', durationS: 5, stats: [stat('fireRate', 0.6)] }],
    }),
  item('kestrel-eye', 'Kestrel’s Eye', '+25% gun damage, +60% falloff range, +15% projectile speed. Gun hits from 25 m or farther deal +20% damage and reveal the target for 3 s.',
    'talon', 4, [stat('gunDamage', 0.25), stat('falloffRange', 0.6), stat('bulletSpeed', 0.15)], 'long-fletching', null,
    // The +20% is a repeat of the hit, resisted once (D-SYS-014, D-ARCH-027).
    [{ on: 'weaponHit', beyondM: 25, chance: 1, cooldownS: 0, target: 'other',
      effects: [{ kind: 'damage', amount: 0, triggerPct: 0.2, type: 'talon' }, { kind: 'applyStatus', status: REVEAL, durationS: 3 }] }]),
];

export const TALON_RIDERS: Readonly<Record<string, readonly Rider[]>> = {
  'hooked-spur': [HEAVY_SLOW],
  'stoop-dive': [HEAVY_SLOW],
  // 30% to non-heroes less the 8% the passive already gives.
  'foragers-talon': [{ on: 'gunHit', vs: 'nonHero', extra: 0.22 }],
  'skipping-stone': [{ on: 'gunHit', bounce: { radius: 8, fraction: 0.45 } }],
  'carrion-feast': [{ on: 'killAssist', healMaxPct: 0.15 }],
};
