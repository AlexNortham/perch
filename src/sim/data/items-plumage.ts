import type { ItemDef } from '../core/contracts';
import { item, stat } from './items-kit';

export const PLUMAGE_ITEMS: readonly ItemDef[] = [
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
];
