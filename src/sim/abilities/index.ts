// TODO(Ability Systems): casting, targeting, cooldowns, charges, channels, AP, upgrades, ultimate unlock, lasting areas, summons and hero hooks (abilities phase). Register the area, summon, delay, cooldownMod and hook effects.
import type { SystemFactory } from '../core/contracts';

export const createAbilitySystem: SystemFactory = () => ({ name: 'abilities', phases: {} });
