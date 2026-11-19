/**
 * Heroes are data (HeroDef in src/sim/data/heroes/<id>.ts) plus optional hooks (src/sim/heroes/<id>/index.ts) for
 * what data can't express. src/sim/heroes/registry.ts maps every HeroId to its module.
 */
import type { HeroId, LocalOffset } from './base';
import type { AbilityDef } from './abilities';
import type { EffectCause, EffectTarget } from './effects';
import type { HeroEntity } from './entity';
import type { SimContext } from './sim';
import type { StatId, StatModifier } from './stats';

/**
 * Body plan (GDD §9.0.1): sizes and attachment points in the hero's own frame, feet at the origin. The Technical
 * Artist's procedural model must match it: the head sphere is where beak shots land and the muzzle is where shots
 * start. Derived, not stored: the body capsule runs from the feet to head.centre.up − head.radius with `radius`;
 * crouching scales heights by CROUCH_SCALE; the camera pivot is CAMERA.pivotBelowHead under the head centre.
 */
export interface BodyPlan {
  /** Standing height (m), feet to crown; also scales the camera boom. */
  readonly height: number;
  /** Body capsule radius (m): the body hitbox and the movement capsule. */
  readonly radius: number;
  /** Head hitbox sphere. */
  readonly head: { readonly centre: LocalOffset; readonly radius: number };
  /** Gun muzzle socket (GDD §4.5: about 0.35 m forward, 0.25 m right, chest height). */
  readonly muzzle: LocalOffset;
}

/**
 * The gun (GDD §5.6). Per-pellet damage and magazine size are the `weaponDamage` and `magazine` base stats in
 * HeroDef.stats, so items and Molts modify them like any stat. Every gun is fully automatic (hold to fire).
 */
export interface WeaponDef {
  /** Player-facing name. */
  readonly name: string;
  /** Pellets per shot (shotguns > 1); each rolls its own spread and beak shot. */
  readonly pellets: number;
  /** Spread cone half-angle (degrees). */
  readonly spreadDeg: number;
  /** Shots per second. */
  readonly fireRate: number;
  /** Instant ray (true) or a travelling projectile at projectileSpeed. */
  readonly hitscan: boolean;
  /** m/s; ignored for hitscan guns. */
  readonly projectileSpeed: number;
  /** Seconds for a full reload, or per round for shell-loaders. */
  readonly reloadS: number;
  readonly reload: 'magazine' | 'perRound';
  /** Full damage up to `start` m, falling linearly to combat data's floor at `end` m (GDD §5.5). */
  readonly falloff: { readonly start: number; readonly end: number };
  /** Max range (m); beyond it a bullet does nothing. */
  readonly range: number;
  /** Overrides combat data's beak-shot multiplier (Owl). */
  readonly beakShotMult?: number;
  /** Overrides CAMERA.aimRange (Owl). */
  readonly aimRange?: number;
  /** Horizontal FOV and sensitivity scale while aiming. Default 0.8, Owl 0.5. */
  readonly aimZoom?: number;
  /** Projectile guns: bullet radius (m). Default: combat data's (0.06 m). Lyrebird's Echo Lute 0.25 m. */
  readonly projectileRadius?: number;
  /**
   * Guns that spin up (Woodpecker): the fire rate starts at `fromRate` shots/s and rises linearly to `fireRate`
   * over `seconds` of continuous fire; it starts over when firing stops.
   */
  readonly spinUp?: { readonly fromRate: number; readonly seconds: number };
  /** 'perRound' reloads: delay before the first round goes in (Albatross 0.3 s). Default: combat data's. */
  readonly perRoundStartS?: number;
}

/** Archetypes from BRIEF §3; each is covered three times across the 24 heroes. */
export type Archetype =
  | 'gunCarry'
  | 'songBurst'
  | 'tank'
  | 'support'
  | 'assassin'
  | 'areaControl'
  | 'poke'
  | 'skirmisher';

export interface HeroDef {
  readonly id: HeroId;
  /** Player-facing name. */
  readonly name: string;
  /** Identifying plumage, sRGB 0xRRGGBB. */
  readonly swatch?: number;
  readonly archetype: Archetype;
  readonly body: BodyPlan;
  /** Base stats at level 1. Must include maxHealth, moveSpeed, stamina, weaponDamage and magazine. */
  readonly stats: Readonly<Partial<Record<StatId, number>>>;
  /**
   * Molt growth (GDD §5.2 step 1): applied once per level above 1 by sim/economy under the stat key
   * 'economy:molts'. Use op 'pct' for weaponDamage (gun damage × (1 + growth × (level − 1))) and 'add' for flat stats.
   */
  readonly growth: readonly StatModifier[];
  readonly weapon: WeaponDef;
  /** Abilities 1–4; the fourth is the ultimate. */
  readonly abilities: readonly [AbilityDef, AbilityDef, AbilityDef, AbilityDef];
}

/** A landed cast, passed to HeroHooks.onCast. */
export interface AbilityCast {
  readonly hero: HeroEntity;
  /** 0–3. */
  readonly slot: number;
  readonly ability: AbilityDef;
  /** Upgrade tier 0–3. */
  readonly tier: number;
  readonly target: EffectTarget;
  /** The cause the framework built for this cast (values include upgrades). */
  readonly cause: EffectCause;
}

/** Per-sim hero behaviour. Keep private state in the closure that made it. */
export interface HeroHooks {
  /** An ability with `hook: true` landed (after its effects were applied). */
  onCast?(cast: AbilityCast): void;
  /** A HookEffect from this hero's data fired. */
  onEffect?(name: string, target: EffectTarget, cause: EffectCause): void;
  /** Every tick in the abilities phase, for each living hero with this id. */
  onTick?(hero: HeroEntity): void;
}

export interface HeroModule {
  readonly def: HeroDef;
  /**
   * The kit is complete: real data for body, stats, gun and all four abilities with their tiers, hooks where needed,
   * and the ability smoke tests passing. Hero select lets the player pick only implemented heroes; the others show
   * as coming soon. The hero's engineer sets it. Default false.
   */
  readonly implemented?: boolean;
  /**
   * Called once by sim/abilities at sim creation when this hero is in the match. Subscribe to events here if needed.
   */
  readonly hooks?: (ctx: SimContext) => HeroHooks;
}
