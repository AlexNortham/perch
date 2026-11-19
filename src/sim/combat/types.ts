/** Private state shared by the sim/combat modules. Nothing outside src/sim/combat reads it. */
import type { EffectCause, HeroDef, HeroEntity, Vec3, WeaponModEffect } from '../core/contracts';

export type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/** An active weaponMod on a hero. */
export interface ModRec {
  readonly mod: WeaponModEffect;
  readonly expiresAt: number;
  /** Bullet hits counted for everyNth. */
  hits: number;
  /** Shots left before the mod ends (WeaponModEffect.shots); Infinity without a limit. */
  shots: number;
}

export const Melee = { Idle: 0, Charging: 1, Light: 2, Heavy: 3 } as const;
export type MeleeStage = (typeof Melee)[keyof typeof Melee];

/** Per-hero combat state, created when the hero spawns. Ticks are stored as (possibly fractional) tick numbers. */
export interface HeroState {
  readonly hero: HeroEntity;
  readonly def: HeroDef;
  /** Home Roost spawn anchor: the team's n-th spawn for its n-th roster hero (GDD §8.9). */
  readonly spawn: { readonly pos: Vec3; readonly yaw: number };
  /** Shot causes copy this template. Melee refreshes its origin before each swing. */
  readonly gunCause: EffectCause;
  readonly meleeCause: Mutable<EffectCause>;
  /** Tick of the next allowed shot. */
  nextFire: number;
  /** WeaponDef.spinUp: how far the gun is spun up, 0..1 (rises while firing, falls over COMBAT.spinDownS after). */
  spin: number;
  /** Reloading: tick the magazine completes, or the next round loads (per-round guns). */
  reloadAt: number;
  mods: ModRec[];
  melee: MeleeStage;
  /** Charging: press tick. Light or heavy: tick the swing lands (−1 once it has). */
  meleeAt: number;
  /** Light or heavy: tick the swing ends. */
  meleeEnd: number;
  /** Parry window [open, close), −1 when none is armed. */
  parryOpen: number;
  parryClose: number;
  /** Parry is off cooldown from this tick. */
  parryReady: number;
  /** No fire or melee before this tick (parry whiff). */
  lockout: number;
  /** Last level seen on `hero.level` (heal on level-up). */
  level: number;
  /** Level-up heal not yet applied because max HP had not grown yet (applied by the next statuses phase). */
  levelHeal: number;
  trainingResetAt: number | null;
}
