import type { ItemDef } from '../core/contracts';
import { item, stat } from './items-kit';

export const SONG_ITEMS: readonly ItemDef[] = [
  item('lilt-seed', 'Lilt Seed', '+8 Song power and +50 max HP.', 'song', 1, [stat('songPower', 8), stat('maxHealth', 50)]),
  item('quick-refrain', 'Quick Refrain', '+8% cooldown reduction.', 'song', 1, [stat('cooldownReduction', 0.08, 'stack')]),
  item('carrying-voice', 'Carrying Voice', '+15% ability range and +6 Song power.', 'song', 1, [stat('abilityRange', 0.15), stat('songPower', 6)]),
  item('mocking-note', 'Mocking Note', '+4 Song power. Ability damage shreds an enemy hero’s Song resist by 8% for 6 s.', 'song', 1,
    [stat('songPower', 4)], null, null, [{ on: 'abilityHit', heroesOnly: true, chance: 1, cooldownS: 0, target: 'other',
      effects: [{ kind: 'applyStatus', status: { id: 'mocking-note-shred', name: 'Mocking Note', negative: true,
        durationS: 6, stacking: 'perSource', maxStacks: 1, modifiers: { stats: [stat('songShred', 0.08)] } } }] }]),
  item('rising-song', 'Rising Song', '+24 Song power and +150 max HP.', 'song', 3, [stat('songPower', 24), stat('maxHealth', 150)], 'lilt-seed'),
];
