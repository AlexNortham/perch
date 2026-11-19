import type { ItemActive, ItemCategory, ItemDef, ItemTier, StatId, StatModifier, StatOp, TriggerDef } from '../core/contracts';
import { SONG_ITEMS } from './items-song';

export const SHOP = { baseSlots: 12, refundSeconds: 20, resaleFraction: 0.5 } as const;
export const DEW = { quietSeconds: 8, bonusRegen: 10 } as const;
const COST = { 1: 800, 2: 1600, 3: 3200, 4: 6400 } as const;
const stat = (id: StatId, value: number, op: StatOp = 'add'): StatModifier => ({ stat: id, op, value });
function item(id: string, name: string, description: string, category: ItemCategory, tier: ItemTier,
  stats: StatModifier[], component: string | null = null, active: ItemActive | null = null, procs: TriggerDef[] = []): ItemDef {
  return { id, name, description, category, tier, cost: COST[tier], component, passive: { stats }, procs, active };
}

export const ITEMS: readonly ItemDef[] = [
  ...SONG_ITEMS,
  item('quill-clip', 'Quill Clip', '+25% magazine size and +6% gun damage.', 'talon', 1,
    [stat('magazine', 0.25, 'pct'), stat('gunDamage', 0.06)]),
  item('close-talons', 'Close Talons', '+20% gun damage within 15 m.', 'talon', 1, [stat('closeGunDamage', 0.2)]),
  item('beak-whetstone', 'Beak Whetstone', 'Beak shots deal +35 Talon damage once per shot.', 'talon', 1, [stat('beakShotFlat', 35)]),
  item('quick-preen', 'Quick Preen', '+10% fire rate and +15% reload speed.', 'talon', 1, [stat('fireRate', 0.1), stat('reloadSpeed', 0.15)]),
  item('flurry-feathers', 'Flurry Feathers', '+12% fire rate and +15% reload speed. Activate to reload instantly and gain +40% fire rate for 5 s. Cooldown 30 s.',
    'talon', 2, [stat('fireRate', 0.12), stat('reloadSpeed', 0.15)], 'quick-preen', {
      cooldownS: 30, targeting: 'self', range: 0, effects: [{ kind: 'weaponMod', reload: true, durationS: 0 },
        { kind: 'statMod', id: 'flurry', name: 'Flurry', durationS: 5, stats: [stat('fireRate', 0.4)] }],
    }),
  item('down-padding', 'Down Padding', '+160 max HP.', 'plumage', 1, [stat('maxHealth', 160)]),
  item('thick-quills', 'Thick Quills', '+12% Talon resist and +50 max HP.', 'plumage', 1,
    [stat('talonResist', 0.12, 'stack'), stat('maxHealth', 50)]),
  item('dew-drinker', 'Dew Drinker', '+2.5 HP/s. Gain another 10 HP/s after 8 s without taking health damage.', 'plumage', 1, [stat('healthRegen', 2.5)]),
  item('featherlight', 'Featherlight', '+1 m/s sprint speed and +20% stamina regeneration.', 'plumage', 1,
    [stat('sprintSpeed', 1), stat('staminaRecharge', 1 / 1.2, 'mul')]),
  item('stout-breast', 'Stout Breast', '+450 max HP and +6% Talon and Song resist.', 'plumage', 3,
    [stat('maxHealth', 450), stat('talonResist', 0.06, 'stack'), stat('songResist', 0.06, 'stack')], 'down-padding'),
  item('thunderbird-heart', 'Thunderbird Heart', '+750 max HP, +8 HP/s and +10% healing received.', 'plumage', 4,
    [stat('maxHealth', 750), stat('healthRegen', 8), stat('healAmp', 0.1)], 'stout-breast'),
  item('lilt-seed', 'Lilt Seed', '+8 Song power and +50 max HP.', 'song', 1, [stat('songPower', 8), stat('maxHealth', 50)]),
  item('quick-refrain', 'Quick Refrain', '+8% cooldown reduction.', 'song', 1, [stat('cooldownReduction', 0.08, 'stack')]),
  item('carrying-voice', 'Carrying Voice', '+15% ability range and +6 Song power.', 'song', 1, [stat('abilityRange', 0.15), stat('songPower', 6)]),
  item('mocking-note', 'Mocking Note', '+4 Song power. Ability damage shreds an enemy hero’s Song resist by 8% for 6 s.', 'song', 1,
    [stat('songPower', 4)], null, null, [{ on: 'abilityHit', heroesOnly: true, chance: 1, cooldownS: 0, target: 'other',
      effects: [{ kind: 'applyStatus', status: { id: 'mocking-note-shred', name: 'Mocking Note', negative: true,
        durationS: 6, stacking: 'perSource', maxStacks: 1, modifiers: { stats: [stat('songShred', 0.08)] } } }] }]),
  item('rising-song', 'Rising Song', '+24 Song power and +150 max HP.', 'song', 3, [stat('songPower', 24), stat('maxHealth', 150)], 'lilt-seed'),
];
