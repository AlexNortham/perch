import type { ItemDef } from '../core/contracts';
import { item, stat } from './items-kit';

export const TALON_ITEMS: readonly ItemDef[] = [
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
];
