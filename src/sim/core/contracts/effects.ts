/**
 * The one effect vocabulary (GDD §9.25). Abilities, upgrade tiers, item actives and procs, statuses, Feather runes,
 * the Phoenix Ember and objectives all express what they do as Effect data and apply it with `ctx.effects.apply`.
 * Core routes each kind to the single system that owns it (EFFECT_OWNERS); no other system implements a kind.
 *
 * GDD §9.25 primitive → kind here: damage, heal, applyStatus, cleanse, displace, dash, teleport, projectile, area,
 * statMod, summon, weaponMod, shield, movementMode, attach, tether, delay, cooldownMod and trigger: all 19, one-to-one.
 * `hook` is the escape hatch to a hero module.
 */
import type { AbilityId, EntityId, ItemId, StatusId, Team, Vec3 } from './base';
import type { EntityKind } from './entity';
import type { StatModifier } from './stats';
import type { StatusDef } from './statuses';

/** GDD §5.1: there are exactly two damage types. */
export type DamageType = 'talon' | 'song';

/**
 * A number in data.
 * - `number`: that value.
 * - `string`: the named entry of the casting ability's `values` (after upgrades), so upgrade tiers can change it.
 * - `{ of, song }`: `of` (number or value name) plus the cause's Song power × `song` ("base + k × SP").
 */
export type Magnitude = number | string | { readonly of: number | string; readonly song: number };

/** Who an area, projectile or trigger affects, relative to the cause's team (GDD §5.12 defaults). */
export interface TargetFilter {
  readonly teams: 'enemies' | 'allies' | 'all';
  /** Include the source itself (allies or all only). Default false. */
  readonly self?: boolean;
  /** Entity kinds affected. Default ['hero', 'unit']: areas never hit structures unless stated. */
  readonly kinds?: readonly EntityKind[];
  /** Heroes only (shorthand for kinds ['hero']). */
  readonly heroesOnly?: boolean;
}

/**
 * A conditional bonus on a damage effect. All given conditions must hold. GDD §5.2 step 4 is additive within the
 * step: a bonus that holds adds (mult − 1) to the attacker's outgoing bonus (gunDamage or songDamage and other
 * bonuses), which is then applied once, so 100 Song with +25% songDamage and a ×1.5 bonus deals 175 (D-QA-004).
 */
export interface DamageBonus {
  readonly mult: number;
  /** Target hp fraction below this tier-resolved threshold. */
  readonly targetHpBelow?: Magnitude;
  readonly targetKinds?: readonly EntityKind[];
  /** Source-to-target distance is at most this (m). */
  readonly maxDistance?: number;
  /** Source-to-target distance is at least this (m). */
  readonly minDistance?: number;
  /** The target has this status (e.g. a Marked tag). */
  readonly targetHasStatus?: StatusId;
}

/** Damage through the pipeline (GDD §5.2). Owner: sim/combat. */
export interface DamageEffect {
  readonly kind: 'damage';
  readonly amount: Magnitude;
  readonly type: DamageType;
  /**
   * Can crit on the head hitbox like a gun bullet (Owl's Moonlit Mark): a beak shot when `target.point` lies in the
   * target's head sphere (D-COMBAT-003). Default false.
   */
  readonly beakShot?: boolean;
  /** The multiplier for such a beak shot. Default: combat data's `abilityBeakShotMult` (×1.5). */
  readonly beakShotMult?: number;
  readonly bonus?: readonly DamageBonus[];
  /** Fraction of missing hp added to damage. */
  readonly missingHpPct?: Magnitude;
  /** Fraction of the target's current hp added to damage, read when the hit resolves (Blight Spores). */
  readonly currentHpPct?: Magnitude;
  /** Fraction of the target's max hp added to damage (Rookery Dirge's aura). */
  readonly maxHpPct?: Magnitude;
  /**
   * Trigger effects only: fraction of the triggering hit's amount (before the holder's resists) added to damage
   * (Burr Coat returns 0.15 of the gun damage it took).
   */
  readonly triggerPct?: Magnitude;
  /** Execute below this post-hit fraction of max hp. */
  readonly executeBelow?: Magnitude;
}

/** Restore hp, at once or spread over `overS`. Owner: sim/combat. */
export interface HealEffect {
  readonly kind: 'heal';
  readonly amount: Magnitude;
  readonly overS?: Magnitude;
  /**
   * Trigger effects only: fraction of the triggering hit's damage dealt (what its `damage.applied` reports) added to
   * the heal (Gape heals 0.3 of its bite through a brief 'abilityHit' trigger, D-ARCH-027). Combat reads it like
   * `DamageEffect.triggerPct` (D-SYS-014); with no hit being reported it adds nothing.
   */
  readonly triggerPct?: Magnitude;
}

/** Apply a status (GDD §5.9), including stat buffs. Owner: sim/combat. */
export interface ApplyStatusEffect {
  readonly kind: 'applyStatus';
  readonly status: StatusDef;
  /** Overrides the status's own duration. A resolved duration ≤ 0 applies nothing (tiers can switch a status on). */
  readonly durationS?: Magnitude;
  /** Graded statuses: scales the status's modifiers (e.g. 0.3 for a 30% slow). Default 1. */
  readonly magnitude?: Magnitude;
  /** Stacks added for 'stack' statuses. Default 1. */
  readonly stacks?: number;
}

/**
 * A timed stat change (GDD `statMod`): sugar for applyStatus with a positive status whose modifiers are `stats`.
 * Stacking follows `maxStacks` (1: reapplying refreshes). Owner: sim/combat.
 */
export interface StatModEffect {
  readonly kind: 'statMod';
  /** Status id it shows as (UI) and stacks under. */
  readonly id: StatusId;
  readonly name: string;
  readonly stats: readonly StatModifier[];
  readonly durationS: Magnitude;
  readonly maxStacks?: number;
}

/** Remove statuses: every negative one, every positive one, or the listed ids (shields with a listed `id` too). Owner: sim/combat. */
export interface CleanseEffect {
  readonly kind: 'cleanse';
  readonly remove: 'negative' | 'positive' | readonly StatusId[];
}

/** Talon shield, Song shield or barrier (GDD §5.10). Owner: sim/combat. */
export interface ShieldEffect {
  readonly kind: 'shield';
  /**
   * Names the shield (D-ARCH-027): applying a shield with an id the holder already has replaces that one, and a
   * `cleanse` that lists the id removes it (Items take an item's shield back on sale, e.g. `'item:<itemId>'`).
   * Absent: an anonymous shield that stacks and only drains or expires.
   */
  readonly id?: string;
  readonly absorbs: 'talon' | 'song' | 'barrier';
  readonly amount: Magnitude;
  /** Lifetime; omitted lasts until drained. */
  readonly durationS?: Magnitude;
  /** Refills to full after this long without taking damage (item shields). */
  readonly rechargeS?: number;
}

/** Change how the target's gun works, for a while or at once. Owner: sim/combat. */
export interface WeaponModEffect {
  readonly kind: 'weaponMod';
  /** 0 for one-off changes (instant reload). With `shots`, the longest the mod can last. */
  readonly durationS: Magnitude;
  /** The mod ends after this many shots fired (Heavy Rounds: "your next 6 shots within 8 s"). Default: no limit. */
  readonly shots?: Magnitude;
  /** Shots use no ammo. */
  readonly ammoFree?: boolean;
  /** Refill the magazine now. */
  readonly reload?: boolean;
  /** Add this fraction of a magazine, capped at capacity (Bounding Hop). */
  readonly reloadFraction?: number;
  /** Step-four gun damage bonus on this mod, respecting onlyVsStatus. */
  readonly gunDamage?: number;
  /** Each bullet hit also damages others within radius for this fraction of its damage. */
  readonly splash?: { readonly radius: number; readonly fraction: number };
  /** Bullets bounce to this many further targets. */
  readonly bounces?: number;
  /** Bullets pass through this many targets. */
  readonly pierce?: number;
  readonly ignoreFalloff?: boolean;
  /** The mod applies only to hits on targets with this status (e.g. Marked Prey). */
  readonly onlyVsStatus?: StatusId;
  readonly onBulletHit?: readonly Effect[];
  readonly everyNth?: { readonly n: number; readonly effects: readonly Effect[] };
}

/**
 * Launch a projectile from the cause's origin along the target direction. `onHit` applies to each entity hit (and
 * its point); `onExpire` at the end point when it expires or hits the world. Owner: sim/combat.
 */
export interface ProjectileEffect {
  readonly kind: 'projectile';
  readonly speed: Magnitude;
  readonly radius: number;
  readonly range: Magnitude;
  /** Downward acceleration (m/s²); 0 flies straight. */
  readonly gravity: number;
  readonly pierce: 'none' | 'units' | 'all';
  /** Flies back to the caster after reaching its range, hitting again on the way. */
  readonly returns?: boolean;
  /** Hits on one target per projectile (default 1). */
  readonly maxHitsPerTarget?: number;
  readonly affects: TargetFilter;
  readonly onHit: readonly Effect[];
  readonly onExpire?: readonly Effect[];
}

/**
 * Knockback, pull, knock-up or a push along a direction (GDD §5.9 displacements) of `target.entity`, hero or unit
 * (physics moves units too while displacing them, D-ARCH-014). Owner: sim/physics.
 */
export interface DisplaceEffect {
  readonly kind: 'displace';
  /** push: away from the cause's origin; pull: toward it; up: knock-up (airborne); along: the target direction. */
  readonly mode: 'push' | 'pull' | 'up' | 'along';
  /** Metres travelled (height for 'up'). */
  readonly distance: Magnitude;
  /**
   * Wall slam (GDD §3.9): applied to the displaced entity, with this effect's cause, when it hits a wall with at
   * least movement data's slam speed (4 m/s) toward it (Impaling Bolt's pin, Stomp Kick, Rogue Wave).
   */
  readonly onWall?: readonly Effect[];
}

/**
 * Move along a path. Who moves (D-CTRL-004): dir 'target' moves the cause's source toward `target.entity` (else
 * `target.point`); 'aim' and 'move' move `target.entity`, or the source when it is null. For the self, direction and
 * point casts that use dashes, `target.entity` is the caster (D-ABIL-001). Owner: sim/physics.
 */
export interface DashEffect {
  readonly kind: 'dash';
  readonly distance: Magnitude;
  readonly durationS: Magnitude;
  /** aim: along the aim direction; move: along the move input; target: to the target point or entity. */
  readonly dir: 'aim' | 'move' | 'target';
  /** Peak height of a leap arc (0 for a flat dash). */
  readonly arcHeight?: number;
  /** Aim dash upward pitch cap in degrees. Zero keeps both directions flat, positive caps preserve downward pitch. */
  readonly maxPitchUpDeg?: number;
  /** Passes through units and heroes. */
  readonly passThrough?: boolean;
  /** Stops at the first enemy touched. */
  readonly stopOnHit?: boolean;
  /**
   * dir 'aim' only: the dash follows the caster's aim while it runs, at most this many degrees either side of where it
   * started (Rampage 30). Absent or ≤ 0: a straight dash. Replaces the `steerDeg` value name (D-ARCH-027).
   */
  readonly steerDeg?: Magnitude;
  /**
   * Applied to each enemy touched during the dash. A tier adds a hit by raising a value from 0: damage that resolves
   * to 0 and a status of ≤ 0 s apply nothing (D-ARCH-027).
   */
  readonly onHit?: readonly Effect[];
  /** Applied at the end point when the dash ends. */
  readonly onArrive?: readonly Effect[];
}

/**
 * Move instantly. 'point' and 'behindTarget' move the cause's source; 'base' moves `target.entity`, or the source
 * when it is null (D-CTRL-004). Owner: sim/physics.
 */
export interface TeleportEffect {
  readonly kind: 'teleport';
  /** point: the target point; behindTarget: `behind` m behind the target entity; base: the team spawn. */
  readonly to: 'point' | 'behindTarget' | 'base';
  readonly behind?: number;
  /**
   * 'target' turns the mover to face the target; physics reports the new yaw on the `movement` event ('teleport')
   * and the hero's controller (client input, sim/ai) adopts it, since core re-latches yaw from the command.
   */
  readonly face: 'keep' | 'target';
}

/** Special movement modes from abilities (GDD §9.25). */
export type MovementModeKind = 'glide' | 'flight' | 'hover' | 'cling' | 'toboggan' | 'burrow';

/** Move differently for a while (Owl's glide, Swift's flight, Woodpecker's cling …). Owner: sim/physics. */
export interface MovementModeEffect {
  readonly kind: 'movementMode';
  readonly mode: MovementModeKind;
  readonly durationS: Magnitude;
  /** Horizontal speed (m/s). */
  readonly speed: number;
  /** Vertical speed (m/s): fall speed for glide, climb/dive limit for flight; 0 otherwise. */
  readonly verticalSpeed: number;
  /** What the hero may do meanwhile. Physics publishes both on Motor (modeAllowsGun, modeAllowsAbilities). */
  readonly allowGun: boolean;
  readonly allowAbilities: boolean;
  /** Applied to an enemy the hero runs into (toboggan, burrow eruption). */
  readonly onCollide?: readonly Effect[];
  /** Applied to the hero (at its position) when the mode ends. */
  readonly onEnd?: readonly Effect[];
  /**
   * Besides its duration, the mode ends when the hero lands, presses Jump and/or is stunned ('stun': the 'stunned'
   * condition, D-ARCH-027; `onEnd` still runs, so Tree Cling's cleanse of its gun bonus is data). Absent keeps physics' per-mode
   * default (glide ends on both, D-CTRL-009; toboggan on Jump, with its hop). Lets kits say it without a hook.
   */
  readonly endOn?: readonly ('land' | 'jump' | 'stun')[];
}

/** Attach the target to the source's socket for a while (Pelican's Gulp). Owner: sim/physics. */
export interface AttachEffect {
  readonly kind: 'attach';
  readonly durationS: Magnitude;
  /** Applied to the attached target on release (spit). */
  readonly onRelease: readonly Effect[];
}

export type AreaShape =
  | { readonly kind: 'sphere'; readonly radius: Magnitude }
  | { readonly kind: 'cylinder'; readonly radius: Magnitude; readonly height: number }
  /** Along the target direction from the target point. */
  | { readonly kind: 'cone'; readonly length: Magnitude; readonly angleDeg: number }
  | { readonly kind: 'ring'; readonly inner: Magnitude; readonly outer: Magnitude; readonly height: number }
  /** Width (x), height (y) and length (z, along the target direction). */
  | { readonly kind: 'box'; readonly size: Vec3 };

/**
 * An area at the target point (or attached to the source or target). With durationS 0 it applies `effects` once to
 * everything inside; otherwise it becomes an 'area' entity that applies `effects` every intervalS (GDD §5.12: each
 * target at most once per tick per area kind) and the enter/exit/cross effects as entities move. Owner: sim/abilities.
 */
export interface AreaEffect {
  readonly kind: 'area';
  readonly shape: AreaShape;
  readonly durationS: Magnitude;
  /** Default EFFECT_TICK_SECONDS (0.5 s, src/sim/data/core.ts). */
  readonly intervalS?: number;
  readonly attach: 'point' | 'source' | 'target';
  /** A moving area (Rogue Wave): travels along the target direction at `speed` m/s, optionally carrying the units it hits. */
  readonly move?: { readonly speed: number; readonly carry: boolean; readonly maxCarry?: number; readonly onWall?: readonly Effect[] };
  /** Fog Bank grants concealment only against observers outside its footprint. */
  readonly concealsAlliesOutside?: boolean;
  readonly affects: TargetFilter;
  readonly effects: readonly Effect[];
  readonly onEnter?: readonly Effect[];
  readonly onExit?: readonly Effect[];
  /** Applied when an entity crosses the area's edge (ring walls). */
  readonly onCross?: readonly Effect[];
}

/** Units a hero makes. They are 'unit' entities of type 'summon'. */
export type SummonKind = 'trap' | 'decoy' | 'wall' | 'turret';

/** Spawn summons for the source's team. Owner: sim/abilities. */
export interface SummonEffect {
  readonly kind: 'summon';
  readonly summon: SummonKind;
  /** 0 for summons that can't be damaged. */
  readonly health: Magnitude;
  readonly durationS: Magnitude;
  /** The oldest of this source's summons with the same behaviour despawns beyond this. */
  readonly maxCount: number;
  /** Tier-resolved cap increment for Burrow Colony. */
  readonly extraCount?: Magnitude;
  readonly preferHeroes?: boolean;
  /** Behaviour id: sim/abilities' built-ins ('trap', 'decoy', 'wall', 'turret') or a hero hook's name. */
  readonly behaviour: string;
  /** Traps: fire when an entity matching `affects` comes within `radius`. */
  readonly trigger?: { readonly radius: number; readonly affects: TargetFilter };
  /** Walls: size (width, height, depth); copied to UnitInfo.size. */
  readonly size?: Vec3;
  /** Applied by the summon: on trigger (traps) or to its attack target (turrets, decoys). */
  readonly effects: readonly Effect[];
  /**
   * Applied when the summon dies, expires or is replaced (maxCount), with target = its last position (entity null)
   * and the summon's cause: death or expiry bursts (Echo Double T3, Burrow Colony T3, Gale Shield T3).
   */
  readonly onEnd?: readonly Effect[];
  /** Summons per application (default 1); a value name lets a tier add one (Echo Double T2). */
  readonly count?: Magnitude;
  /** With count > 1, their directions fan evenly across this total angle around the target direction (default 0). */
  readonly spreadDeg?: number;
}

/**
 * A link from the source to the target (ally or enemy) for a while; it breaks beyond `breakDistance`. Every
 * `intervalS` the tick effects apply to each end (Grace Link, Nectar Sip). Its start and end are `tether` events.
 * Owner: sim/abilities.
 */
export interface TetherEffect {
  readonly kind: 'tether';
  readonly durationS: Magnitude;
  readonly breakDistance: number;
  /** Default EFFECT_TICK_SECONDS (0.5 s, src/sim/data/core.ts). */
  readonly intervalS?: number;
  readonly onSourceTick?: readonly Effect[];
  readonly onTargetTick?: readonly Effect[];
}

/** Apply effects later, to the same target and cause (telegraphs, echoes, arm times). Owner: sim/abilities. */
export interface DelayEffect {
  readonly kind: 'delay';
  readonly seconds: Magnitude;
  readonly effects: readonly Effect[];
}

/**
 * Reset or refund cooldowns: every ability, every item active, or one ability slot. Owner: sim/abilities, which
 * for scope 'items' writes OwnedItem.readyAt (the one exception to sim/items owning Inventory).
 */
export interface CooldownModEffect {
  readonly kind: 'cooldownMod';
  readonly scope: 'abilities' | 'items' | 'slot';
  /** For scope 'slot': 0–3. */
  readonly slot?: number;
  readonly mode: 'reset' | 'refund';
  /** For 'refund': seconds taken off. */
  readonly seconds?: Magnitude;
}

/** Events a trigger (item proc or ability passive) can fire on, from the holder's point of view. */
export type TriggerEvent =
  /** The holder's bullet hit an enemy. */
  | 'weaponHit'
  /** The holder's bullet hit an enemy's head. */
  | 'beakShot'
  | 'meleeHit'
  /** The holder's ability or item damaged an enemy. */
  | 'abilityHit'
  /** The holder took damage. */
  | 'damaged'
  /** The holder got kill credit on a hero. */
  | 'kill'
  | 'assist'
  /** A hit would kill the holder (implemented through StatusDef.onLethal). */
  | 'wouldDie'
  /** The holder cast an ability. */
  | 'cast';

export interface TriggerDef {
  readonly on: TriggerEvent;
  /** Fire on every Nth such event (default 1). */
  readonly count?: number;
  /** 0..1; 1 always fires. */
  /** Restrict the other party of a hit (e.g. Mocking Note only shreds heroes). */
  readonly heroesOnly?: boolean;
  readonly chance: number;
  /** Internal cooldown (seconds); 0 for none. */
  readonly cooldownS: number;
  /** Who the effects land on: the other party of the event, or the holder. */
  readonly target: 'other' | 'self';
  readonly effects: readonly Effect[];
  /** The trigger ends after firing this many times (Warbler's Trill 1, Skylark Cadence 3), or at its duration. */
  readonly uses?: number;
  /** Only events whose hit came this way ('damaged' by a gun: 'weapon'). */
  readonly via?: EffectVia;
  /** Only when the other party is within this many metres (Burr Coat 20 m). */
  readonly withinM?: number;
  /** Only when the other party is at least this many metres away (Kestrel's Eye 25 m, D-ARCH-027). */
  readonly beyondM?: number;
}

/** Give the target a trigger for a while (item procs use the same TriggerDef permanently). Owner: sim/items. */
export interface TriggerEffect {
  readonly kind: 'trigger';
  readonly trigger: TriggerDef;
  readonly durationS: Magnitude;
}

/**
 * Escape hatch for what data can't express: calls HeroHooks.onEffect(name, …) on the hero module of the cause's
 * source. Owner: sim/abilities.
 */
export interface HookEffect {
  readonly kind: 'hook';
  readonly name: string;
}

export type Effect =
  | DamageEffect
  | HealEffect
  | ApplyStatusEffect
  | StatModEffect
  | CleanseEffect
  | ShieldEffect
  | WeaponModEffect
  | ProjectileEffect
  | DisplaceEffect
  | DashEffect
  | TeleportEffect
  | MovementModeEffect
  | AttachEffect
  | TetherEffect
  | AreaEffect
  | SummonEffect
  | DelayEffect
  | CooldownModEffect
  | TriggerEffect
  | HookEffect;

export type EffectKind = Effect['kind'];
export type EffectOfKind<K extends EffectKind> = Extract<Effect, { kind: K }>;

/** The single owner of each effect kind. `ctx.effects.handle` refuses any other system. */
export const EFFECT_OWNERS = {
  damage: 'combat',
  heal: 'combat',
  applyStatus: 'combat',
  statMod: 'combat',
  cleanse: 'combat',
  shield: 'combat',
  weaponMod: 'combat',
  projectile: 'combat',
  displace: 'physics',
  dash: 'physics',
  teleport: 'physics',
  movementMode: 'physics',
  attach: 'physics',
  tether: 'abilities',
  area: 'abilities',
  summon: 'abilities',
  delay: 'abilities',
  cooldownMod: 'abilities',
  hook: 'abilities',
  trigger: 'items',
} as const satisfies Record<EffectKind, string>;

/**
 * How the effect came about. GDD §5.1's isGun / isMelee / isAbility flags are via 'weapon' / 'melee' / (cause.ability
 * !== null). 'area' marks effects applied by a lasting area or an area burst and 'status' those from a status's
 * periodic effects: structures take no damage from either (GDD §7).
 */
export type EffectVia =
  | 'weapon'
  | 'melee'
  | 'ability'
  | 'area'
  | 'item'
  | 'status'
  | 'rune'
  | 'objective'
  | 'unit'
  | 'structure';

/**
 * Why an effect happens: who gets credit, for which team, scaled how. Build one when an ability, item or attack
 * fires and pass the same object to everything it spawns (projectiles, areas, statuses, delays), so credit and
 * scaling survive the source's death.
 */
export interface EffectCause {
  /** Credited entity (kill credit, assists, lifesteal, triggers), or null for the world. */
  readonly source: EntityId | null;
  /** The source's team when the cause was built. */
  readonly team: Team;
  readonly via: EffectVia;
  readonly ability: AbilityId | null;
  readonly item: ItemId | null;
  /** The casting ability's values after upgrades, for string magnitudes; null outside abilities. */
  readonly values: Readonly<Record<string, number>> | null;
  /** The source's Song power when the cause was built. */
  readonly songPower: number;
  /** True for effects from a trigger; their damage never fires triggers. */
  readonly proc: boolean;
  /** Where it came from (caster, impact point or area centre). Push and pull use it. */
  readonly origin: Vec3;
}

/** Where an effect lands. */
export interface EffectTarget {
  /** The entity affected, or null for effects aimed at a point (areas, projectiles, dashes). */
  readonly entity: EntityId | null;
  readonly point: Vec3;
  /** Unit direction (the aim direction for aimed effects). */
  readonly dir: Vec3;
  /**
   * The point lies on a wall, tree or other surface rather than the floor below it: sim/abilities sets it for a
   * `surface` cast that took the surface under the crosshair, and a 'target' dash to it flies straight there
   * (D-ARCH-027). Absent: an ordinary point.
   */
  readonly surface?: boolean;
}

export type EffectHandler<K extends EffectKind> = (
  effect: EffectOfKind<K>,
  target: EffectTarget,
  cause: EffectCause,
) => void;

/** `ctx.effects`. Implemented by core. */
export interface EffectRouter {
  /** Register the handler for a kind. Only the kind's owner (EFFECT_OWNERS) may, once, while systems are created. */
  handle<K extends EffectKind>(kind: K, owner: string, handler: EffectHandler<K>): void;
  /** Apply one effect now (synchronously). Kinds whose owner hasn't registered yet are ignored. */
  apply(effect: Effect, target: EffectTarget, cause: EffectCause): void;
  /** Apply a list in order. */
  applyAll(effects: readonly Effect[], target: EffectTarget, cause: EffectCause): void;
  /** Resolve a magnitude against a cause. Throws on a value name the cause doesn't have. */
  magnitude(m: Magnitude, cause: EffectCause): number;
}
