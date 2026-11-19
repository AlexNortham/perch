/**
 * sim/combat: guns and projectiles (guns.ts), hitboxes (hitboxes.ts), the damage pipeline, healing, shields, kill
 * credit, death and respawn (damage.ts), melee and parry (melee.ts), statuses (statuses.ts), and the combat-owned
 * effect kinds. Phases: combat (projectiles, melee, guns), damage (resolve), statuses (timers, regen, respawns).
 */
import type { EffectCause, EntityId, SimContext, StatModEffect, StatusDef, SystemFactory } from '../core/contracts';
import { copy } from '../core/math';
import { createDamage, isDamageable } from './damage';
import { createGuns } from './guns';
import { createHitboxes } from './hitboxes';
import { createMelee } from './melee';
import { createStatuses } from './statuses';
import { Melee } from './types';
import type { HeroState, Mutable } from './types';

export { respawnSeconds } from './damage';

export const createCombatSystem: SystemFactory = (ctx: SimContext) => {
  const heroes = new Map<EntityId, HeroState>();
  const hb = createHitboxes(ctx);
  const statuses = createStatuses(ctx, {
    periodicDamage: (fx, t, c, k) => damage.effect(fx, t, c, k),
    periodicHeal: (fx, t, c, k) => damage.healEffect(fx, t, c, k),
    supported: (c, e) => damage.supported(c, e),
  });
  const damage = createDamage(ctx, hb, statuses, heroes);
  const guns = createGuns(ctx, hb, damage, statuses, heroes);
  const melee = createMelee(ctx, hb, damage, statuses, guns, heroes);
  /** statMod effects become positive 'stack' statuses; one StatusDef per effect object. */
  const statModDefs = new WeakMap<StatModEffect, StatusDef>();

  const damageable = (id: EntityId | null) => {
    const e = id === null ? undefined : ctx.store.get(id);
    return isDamageable(e) && !e.removed ? e : undefined;
  };

  ctx.bus.on('entity.spawned', (ev) => {
    const h = ev.kind === 'hero' ? ctx.store.getKind(ev.id, 'hero') : undefined;
    if (!h) return;
    const cause = (via: 'weapon' | 'melee'): Mutable<EffectCause> => ({
      source: h.id,
      team: h.team,
      via,
      ability: null,
      item: null,
      values: null,
      songPower: 0,
      proc: false,
      origin: copy(h.pos),
    });
    heroes.set(h.id, {
      hero: h,
      def: ctx.heroes[h.hero.heroId].def,
      // core spawns each hero on its Home Roost anchor, so its first position is where it respawns.
      spawn: { pos: copy(h.pos), yaw: h.yaw },
      gunCause: cause('weapon'),
      meleeCause: cause('melee'),
      nextFire: 0,
      spinStart: 0,
      reloadAt: 0,
      mods: [],
      melee: Melee.Idle,
      meleeAt: -1,
      meleeEnd: 0,
      parryOpen: -1,
      parryClose: -1,
      parryReady: 0,
      lockout: 0,
      level: h.progress.level,
      levelHeal: 0,
      trainingResetAt: null,
    });
  });
  ctx.bus.on('entity.despawned', (ev) => {
    statuses.drop(ev.id);
    damage.drop(ev.id);
    guns.drop(ev.id);
    heroes.delete(ev.id);
  });
  // Casting cancels a reload and ends invisibility (GDD §5.6, §5.9).
  ctx.bus.on('ability', (ev) => {
    const s = ev.stage === 'start' ? heroes.get(ev.caster) : undefined;
    if (!s) return;
    guns.cancelReload(s);
    damage.inCombat(s.hero);
    statuses.endOnAttack(s.hero);
  });
  ctx.bus.on('hero.level', (ev) => damage.levelUp(ev.hero, ev.level));
  const clampResources = (ev: { readonly hero: EntityId }): void => {
    const h = heroes.get(ev.hero)?.hero;
    if (!h) return;
    h.health.hp = Math.min(h.health.hp, h.stats.final.maxHealth);
    h.weapon.ammo = Math.min(h.weapon.ammo, Math.round(h.stats.final.magazine));
  };
  ctx.bus.on('item.bought', clampResources);
  ctx.bus.on('item.sold', clampResources);

  ctx.effects.handle('damage', 'combat', (fx, t, c) => damage.effect(fx, t, c, 1));
  ctx.effects.handle('heal', 'combat', (fx, t, c) => damage.healEffect(fx, t, c, 1));
  ctx.effects.handle('shield', 'combat', damage.shield);
  ctx.effects.handle('weaponMod', 'combat', guns.weaponMod);
  ctx.effects.handle('projectile', 'combat', guns.projectile);
  ctx.effects.handle('applyStatus', 'combat', (fx, t, c) => {
    const e = damageable(t.entity);
    if (!e) return;
    const dur = fx.durationS === undefined ? fx.status.durationS : ctx.effects.magnitude(fx.durationS, c);
    const mag = fx.magnitude === undefined ? 1 : ctx.effects.magnitude(fx.magnitude, c);
    statuses.apply(e, fx.status, c, dur, mag, fx.stacks ?? 1);
  });
  ctx.effects.handle('statMod', 'combat', (fx, t, c) => {
    const e = damageable(t.entity);
    if (!e) return;
    let def = statModDefs.get(fx);
    if (!def) {
      def = {
        id: fx.id,
        name: fx.name,
        negative: false,
        stacking: 'stack',
        maxStacks: fx.maxStacks ?? 1,
        durationS: 0,
        modifiers: { stats: fx.stats },
      };
      statModDefs.set(fx, def);
    }
    statuses.apply(e, def, c, ctx.effects.magnitude(fx.durationS, c), 1, 1);
  });
  ctx.effects.handle('cleanse', 'combat', (fx, t) => {
    const e = damageable(t.entity);
    if (e) statuses.cleanse(e, fx.remove);
  });

  return {
    name: 'combat',
    phases: {
      combat() {
        guns.projectiles();
        for (const h of ctx.store.list('hero')) {
          const s = heroes.get(h.id);
          if (!s) continue;
          if (h.health.dead) {
            h.weapon.firing = false;
            continue;
          }
          melee.tick(s);
          guns.tick(s);
        }
      },
      damage: () => damage.resolve(),
      statuses() {
        statuses.tick();
        damage.tick();
      },
    },
    hash(h) {
      for (const s of heroes.values()) {
        h.num(s.hero.id);
        h.num(s.nextFire);
        h.num(s.spinStart);
        for (const m of s.mods) h.num(m.shots);
        h.num(s.reloadAt);
        h.num(s.melee);
        h.num(s.meleeAt);
        h.num(s.meleeEnd);
        h.num(s.parryOpen);
        h.num(s.parryClose);
        h.num(s.parryReady);
        h.num(s.lockout);
        h.num(s.level);
        h.num(s.trainingResetAt ?? -1);
        h.num(s.mods.length);
      }
      statuses.hash(h);
      damage.hash(h);
      guns.hash(h);
    },
  };
};
