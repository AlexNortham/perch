// TODO(Combat): guns (aim model in core/aim.ts), projectiles, head and body hitboxes, the damage pipeline (damage phase,
// GDD §5.2), statuses, death and respawn (statuses phase), melee and parry. Register the damage, heal, applyStatus,
// cleanse, shield, weaponMod and projectile effects with ctx.effects.handle(kind, 'combat', handler).
import type { SystemFactory } from '../core/contracts';

export const createCombatSystem: SystemFactory = () => ({ name: 'combat', phases: {} });
