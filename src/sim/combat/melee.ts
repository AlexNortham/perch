/**
 * Melee and parry (GDD §5.7, §5.8). One button: released before heavyHoldS is a light swing (hits lightHitS after
 * the release); held to heavyHoldS commits a heavy swing (lunge, hit heavyWindupS after the press). A swing is a
 * sphere cast of radiusM along the look direction from the camera pivot, reachM long; the nearest hitbox is struck.
 */
import { COMBAT, STUN } from '../data/combat';
import { Button, LAYERS_SOLID } from '../core/contracts';
import type { DashEffect, DisplaceEffect, EntityId, SimContext } from '../core/contracts';
import { lookDir, pivotHeight } from '../core/aim';
import { copy, ticks } from '../core/math';
import { isDamageable } from './damage';
import type { Damage } from './damage';
import type { Guns } from './guns';
import type { CastFilter, Hitboxes } from './hitboxes';
import type { Statuses } from './statuses';
import { Melee } from './types';
import type { HeroState } from './types';

const M = COMBAT.melee;
const P = COMBAT.parry;
const LUNGE: DashEffect = { kind: 'dash', distance: M.heavyLungeM, durationS: M.heavyWindupS - M.heavyHoldS, dir: 'aim' };
const KNOCKBACK: DisplaceEffect = { kind: 'displace', mode: 'push', distance: M.heavyKnockbackM };

export interface MeleeSystem {
  /** Combat phase, per living hero: parry window, melee input and swings. */
  tick(s: HeroState): void;
}

export function createMelee(
  ctx: SimContext,
  hb: Hitboxes,
  damage: Damage,
  statuses: Statuses,
  guns: Guns,
  heroes: ReadonlyMap<EntityId, HeroState>,
): MeleeSystem {
  const f: CastFilter = {
    team: null,
    allies: false,
    ignore: -1,
    heroes: true,
    units: true,
    structures: true,
    pods: true,
    ember: false,
  };

  /** Light damage: the meleeDamage stat (base plus growth), with the GDD default when hero data gives no base. */
  const lightDamage = (s: HeroState): number =>
    s.hero.stats.final.meleeDamage + (s.hero.stats.base.meleeDamage === undefined ? M.lightDamage : 0);

  const parrying = (s: HeroState, now: number): boolean =>
    s.parryClose >= 0 && now >= s.parryOpen && now < s.parryClose && !s.hero.stats.conditions.has('stunned');

  const startSwing = (s: HeroState, heavy: boolean): void => {
    const now = ctx.clock.tick;
    const h = s.hero;
    if (heavy) {
      s.melee = Melee.Heavy;
      h.weapon.meleePose = 'heavy';
      s.meleeAt = s.meleeAt + ticks(M.heavyWindupS);
      s.meleeEnd = s.meleeAt + ticks(M.heavyRecoveryS);
      s.meleeCause.origin = copy(h.pos);
      ctx.effects.apply(LUNGE, { entity: h.id, point: copy(h.pos), dir: lookDir(h.yaw, h.pitch) }, s.meleeCause);
    } else {
      s.melee = Melee.Light;
      h.weapon.meleePose = 'light';
      s.meleeAt = now + ticks(M.lightHitS);
      s.meleeEnd = now + ticks(M.lightTotalS);
    }
    statuses.endOnAttack(h);
  };

  const swing = (s: HeroState, heavy: boolean): void => {
    const h = s.hero;
    const now = ctx.clock.tick;
    const crouch = h.motor.crouching || h.motor.sliding;
    const origin = { x: h.pos.x, y: h.pos.y + pivotHeight(s.def.body, crouch), z: h.pos.z };
    const dir = lookDir(h.yaw, h.pitch);
    f.team = h.team;
    f.ignore = h.id;
    f.ember = heavy;
    const cover = ctx.physics.raycast(origin, dir, M.reachM, LAYERS_SOLID);
    const first = hb.cast(origin, dir, cover?.entity === null ? cover.distance : M.reachM, M.radiusM, f)[0];
    const target = first ? ctx.store.get(first.id) : undefined;
    s.meleeCause.origin = copy(h.pos);
    if (!first || !target) {
      ctx.bus.emit({ type: 'melee', attacker: h.id, heavy, target: null, parried: false });
      return;
    }
    const ps = target.kind === 'hero' ? heroes.get(target.id) : undefined;
    if (ps && parrying(ps, now)) {
      const toAttacker = (h.pos.x - target.pos.x) * Math.sin(target.yaw) + (h.pos.z - target.pos.z) * Math.cos(target.yaw);
      if (toAttacker >= 0) {
        // Parried from the front: no damage, the attacker is stunned, the parry is ready again (GDD §5.8).
        ps.parryOpen = -1;
        ps.parryClose = -1;
        ps.parryReady = now;
        delete ps.hero.weapon.meleePose;
        delete h.weapon.meleePose;
        ps.meleeCause.origin = copy(target.pos);
        statuses.apply(h, STUN, ps.meleeCause, P.stunS, 1, 1);
        ctx.bus.emit({ type: 'melee', attacker: h.id, heavy, target: target.id, parried: true });
        ctx.bus.emit({ type: 'parry', hero: target.id, outcome: 'success', attacker: h.id });
        return;
      }
    }
    ctx.bus.emit({ type: 'melee', attacker: h.id, heavy, target: target.id, parried: false });
    if (!isDamageable(target)) return;
    const light = lightDamage(s);
    const point = { x: origin.x + dir.x * first.t, y: origin.y + dir.y * first.t, z: origin.z + dir.z * first.t };
    damage.request(target.id, s.meleeCause, 'talon', heavy ? light * M.heavyMult + M.heavyFlat : light, point);
    if (heavy) ctx.effects.apply(KNOCKBACK, { entity: target.id, point: copy(target.pos), dir }, s.meleeCause);
  };

  return {
    tick(s) {
      const h = s.hero;
      const now = ctx.clock.tick;
      const c = h.stats.conditions;
      const cmd = h.command;
      if (c.has('stunned')) {
        s.melee = Melee.Idle;
        s.parryOpen = -1;
        s.parryClose = -1;
        delete h.weapon.meleePose;
        return;
      }
      if (s.parryClose >= 0 && now >= s.parryClose) {
        // Whiff: nothing parried in the window.
        s.lockout = s.parryClose + ticks(P.whiffLockoutS);
        s.parryReady = s.parryClose + ticks(P.cooldownS);
        s.parryOpen = -1;
        s.parryClose = -1;
        delete h.weapon.meleePose;
        ctx.bus.emit({ type: 'parry', hero: h.id, outcome: 'whiff', attacker: null });
      }
      const idle = s.melee === Melee.Idle;
      if (
        (cmd.pressed & Button.Parry) !== 0 &&
        idle &&
        s.parryClose < 0 &&
        now >= s.parryReady &&
        now >= s.lockout &&
        !c.has('eggCarrier') &&
        h.motor.updraft === null && !h.motor.mantling
      ) {
        h.weapon.meleePose = 'parry';
        damage.inCombat(h);
        s.parryOpen = now + ticks(P.delayS);
        s.parryClose = s.parryOpen + ticks(P.windowS);
        guns.cancelReload(s);
        ctx.bus.emit({ type: 'parry', hero: h.id, outcome: 'start', attacker: null });
        return;
      }
      if (idle) {
        if ((cmd.pressed & Button.Melee) === 0 || now < s.lockout || s.parryClose >= 0 || h.motor.mantling) return;
        h.weapon.meleePose = 'charging';
        damage.inCombat(h);
        s.melee = Melee.Charging;
        s.meleeAt = now;
        guns.cancelReload(s);
      }
      if (s.melee === Melee.Charging) {
        if ((cmd.held & Button.Melee) === 0) startSwing(s, false);
        else if (now - s.meleeAt >= ticks(M.heavyHoldS)) startSwing(s, true);
        return;
      }
      if (s.meleeAt >= 0 && now >= s.meleeAt) {
        s.meleeAt = -1;
        swing(s, s.melee === Melee.Heavy);
      }
      if (now >= s.meleeEnd) {
        s.melee = Melee.Idle;
        delete h.weapon.meleePose;
      }
    },
  };
}
