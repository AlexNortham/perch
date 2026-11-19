// The 21 Plumage items (GDD §10.2). Shields granted on purchase are ITEM_SHIELDS, run by sim/items.
import type { ItemDef } from '../core/contracts';
import { UNSTOPPABLE } from './combat';
import { AURA_S, item, stat, type ItemShield } from './items-kit';

const resist = (talon: number, song: number) => [stat('talonResist', talon, 'stack'), stat('songResist', song, 'stack')];

export const PLUMAGE_ITEMS: readonly ItemDef[] = [
  item('down-padding', 'Down Padding', '+160 max HP.', 'plumage', 1, [stat('maxHealth', 160)]),
  item('thick-quills', 'Thick Quills', '+12% Talon resist and +50 max HP.', 'plumage', 1,
    [stat('talonResist', 0.12, 'stack'), stat('maxHealth', 50)]),
  item('dew-drinker', 'Dew Drinker', '+2.5 HP/s. Gain another 10 HP/s after 8 s without taking health damage.', 'plumage', 1, [stat('healthRegen', 2.5)]),
  item('featherlight', 'Featherlight', '+1 m/s sprint speed and +20% stamina regeneration.', 'plumage', 1,
    [stat('sprintSpeed', 1), stat('staminaRecharge', 1 / 1.2, 'mul')]),
  item('grit-gizzard', 'Grit Gizzard', '+10% Song resist and +60 HP.', 'plumage', 1, [stat('songResist', 0.1, 'stack'), stat('maxHealth', 60)]),
  item('shade-ward', 'Shade Ward', '+15% Song resist and +100 HP.', 'plumage', 2,
    [stat('songResist', 0.15, 'stack'), stat('maxHealth', 100)], 'grit-gizzard'),
  item('healing-dew', 'Healing Dew', '+3 HP/s, and 12 HP/s more after 8 s without damage. Activate to heal 320 over 5 s. Cooldown 40 s.', 'plumage', 2,
    [stat('healthRegen', 3)], 'dew-drinker', {
      cooldownS: 40, targeting: 'self', range: 0, effects: [{ kind: 'heal', amount: 320, overS: 5 }] }),
  item('talon-bulwark', 'Talon Bulwark', 'A 250 Talon shield that refills after 10 s without damage, and +8% Talon resist.', 'plumage', 2,
    [stat('talonResist', 0.08, 'stack')], 'thick-quills'),
  item('second-wind', 'Second Wind', '+1 stamina pip, +0.5 m/s move speed, +1 m/s sprint speed.', 'plumage', 2,
    [stat('stamina', 1), stat('moveSpeed', 0.5), stat('sprintSpeed', 1)], 'featherlight'),
  item('rescue-call', 'Rescue Call', '+125 HP, +1.5 HP/s. Activate to heal the ally near your crosshair (or you) 150 + 1.0×SP over 3 s and give +15% resists for 3 s. Cooldown 40 s.',
    'plumage', 2, [stat('maxHealth', 125), stat('healthRegen', 1.5)], null, {
      cooldownS: 40, targeting: 'unit', range: 25, affects: { teams: 'allies', heroesOnly: true }, selfFallback: true,
      effects: [{ kind: 'heal', amount: { of: 150, song: 1 }, overS: 3 },
        { kind: 'statMod', id: 'rescue-call', name: 'Rescued', durationS: 3, stats: resist(0.15, 0.15) }],
    }),
  item('stout-breast', 'Stout Breast', '+450 max HP and +6% Talon and Song resist.', 'plumage', 3,
    [stat('maxHealth', 450), ...resist(0.06, 0.06)], 'down-padding'),
  item('preening-rite', 'Preening Rite', '+12% status resist and +150 HP. Activate to remove negative statuses and gain +25% move speed for 3 s; usable while silenced. Cooldown 40 s.',
    'plumage', 3, [stat('statusResist', 0.12, 'stack'), stat('maxHealth', 150)], null, {
      cooldownS: 40, targeting: 'self', range: 0, whileSilenced: true, effects: [{ kind: 'cleanse', remove: 'negative' },
        { kind: 'statMod', id: 'preen', name: 'Preened', durationS: 3, stats: [stat('moveSpeed', 0.25, 'pct')] }],
    }),
  item('covey-ward', 'Covey Ward', '+150 HP and +6% Song resist. Activate to give you and allies within 12 m a 220 + 1.0×SP barrier for 6 s. Cooldown 55 s.',
    'plumage', 3, [stat('maxHealth', 150), stat('songResist', 0.06, 'stack')], null, {
      cooldownS: 55, targeting: 'self', range: 0, effects: [{ kind: 'area', shape: { kind: 'sphere', radius: 12 }, durationS: 0, attach: 'source',
        affects: { teams: 'allies', self: true, heroesOnly: true },
        effects: [{ kind: 'shield', absorbs: 'barrier', amount: { of: 220, song: 1 }, durationS: 6 }] }],
    }),
  item('iron-crest', 'Iron Crest', '+25% status resist, +250 HP and +12% Song resist.', 'plumage', 3,
    [stat('statusResist', 0.25, 'stack'), stat('maxHealth', 250), stat('songResist', 0.12, 'stack')], 'shade-ward'),
  item('kite-lift', 'Kite Lift', '+1 stamina pip, +0.5 m/s move speed, +1.5 m/s sprint speed, +150 HP. Activate to rise 8 m then glide up to 4 s. Cooldown 35 s.',
    'plumage', 3, [stat('stamina', 1), stat('moveSpeed', 0.5), stat('sprintSpeed', 1.5), stat('maxHealth', 150)], 'second-wind', {
      cooldownS: 35, targeting: 'self', range: 0, effects: [
        { kind: 'statMod', id: 'kite-lift', name: 'Kite Lift', durationS: 5, stats: [stat('talonResist', 0.15, 'stack')] },
        { kind: 'displace', mode: 'up', distance: 9.5 },
        { kind: 'delay', seconds: 0.9, effects: [{ kind: 'movementMode', mode: 'glide', durationS: 4, speed: 9, verticalSpeed: 2,
          allowGun: true, allowAbilities: true, endOn: ['land', 'jump'], onEnd: [{ kind: 'cleanse', remove: ['kite-lift'] }] }] }],
    }),
  item('burr-coat', 'Burr Coat', '+250 HP and +10% Talon resist. An enemy hero within 20 m who deals you gun damage takes 15% of it back as Song damage.',
    'plumage', 3, [stat('maxHealth', 250), stat('talonResist', 0.1, 'stack')], null, null,
    [{ on: 'damaged', via: 'weapon', withinM: 20, heroesOnly: true, chance: 1, cooldownS: 0, target: 'other',
      effects: [{ kind: 'damage', amount: 0, triggerPct: 0.15, type: 'song' }] }]),
  item('second-clutch', 'Second Clutch', '+300 HP. When you would die, heal to 25% of max HP and become intangible for 1.5 s (150 s internal cooldown).', 'plumage', 4,
    [stat('maxHealth', 300)]),
  item('thunderbird-heart', 'Thunderbird Heart', '+750 max HP, +8 HP/s and +10% healing received.', 'plumage', 4,
    [stat('maxHealth', 750), stat('healthRegen', 8), stat('healAmp', 0.1)], 'stout-breast'),
  item('unbowed-crest', 'Unbowed Crest', '+30% status resist, +350 HP, +15% Song resist. Activate: unstoppable and +20% Talon and Song resist for 3 s. Cooldown 60 s.',
    'plumage', 4, [stat('statusResist', 0.3, 'stack'), stat('maxHealth', 350), stat('songResist', 0.15, 'stack')], 'iron-crest', {
      cooldownS: 60, targeting: 'self', range: 0, effects: [{ kind: 'applyStatus', status: UNSTOPPABLE, durationS: 3 },
        { kind: 'statMod', id: 'unbowed', name: 'Unbowed', durationS: 3, stats: resist(0.2, 0.2) }],
    }),
  item('nestmother-mantle', 'Nestmother’s Mantle', '+400 HP. Aura 15 m: allied heroes get +10% Talon and Song resist and +4 HP/s.', 'plumage', 4,
    [stat('maxHealth', 400)], null, null, [], {
      kind: 'area', shape: { kind: 'sphere', radius: 15 }, durationS: AURA_S, attach: 'source',
      affects: { teams: 'allies', self: true, heroesOnly: true },
      effects: [{ kind: 'statMod', id: 'nestmother', name: 'Nestmother’s Mantle', durationS: 1,
        stats: [...resist(0.1, 0.1), stat('healthRegen', 4)] }],
    }),
  item('heartwood-bark', 'Heartwood Bark', '+450 HP, +18% Talon resist, a 500 Talon shield that refills after 8 s without damage, and −30% melee damage taken.',
    'plumage', 4, [stat('maxHealth', 450), stat('talonResist', 0.18, 'stack'), stat('meleeDamageTaken', -0.3)], 'talon-bulwark'),
];

/** Shields granted on purchase and respawn. */
export const ITEM_SHIELDS: Readonly<Record<string, ItemShield>> = {
  'talon-bulwark': { absorbs: 'talon', amount: 250, rechargeS: 10 },
  'heartwood-bark': { absorbs: 'talon', amount: 500, rechargeS: 8 },
};

/** Dew Drinker and Healing Dew: extra HP/s after the quiet period (DEW.quietSeconds). */
export const DEW_BONUS: Readonly<Record<string, number>> = { 'dew-drinker': 10, 'healing-dew': 12 };

/** Second Clutch: the death save. */
export const CLUTCH = { id: 'second-clutch', healFraction: 0.25, intangibleS: 1.5, cooldownS: 150 } as const;
