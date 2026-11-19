/**
 * PlayerCommand: the one input shape for the human and for bots. The client's input module builds the human's
 * command each tick; sim/ai builds each bot's. Systems read `HeroEntity.command`; nobody reads raw input.
 *
 * Bots assign their command to `HeroEntity.command` in the ai phase; a new object or one the bot reuses every tick
 * both work, but never mutate the object `h.command` holds (it is core's latch). Core copies the command into the
 * latch and sanitises it (D-ARCH-011): non-finite axes become 0 and axes clamp to ±1; non-finite look angles keep
 * the previous ones, yaw wraps to ±π and pitch clamps; an upgrade slot outside 0–3 and a ping at a non-finite point
 * are dropped. A hero with no fresh command repeats its last one without the one-shot fields (pressed, upgrade,
 * buy, sell, ping, concede).
 */
import type { EntityId, ItemId, Vec3 } from './base';

/**
 * Button bits for `held` and `pressed`. Combine with `|`, test with `(bits & Button.Fire) !== 0`.
 * Light vs heavy melee is one button (GDD §5.7): a tap is a light melee, holding it 0.35 s charges a heavy melee;
 * sim/combat tells them apart from `held` over time.
 */
export const Button = {
  Jump: 0x1,
  Crouch: 0x2,
  Dash: 0x4,
  Fire: 0x8,
  Reload: 0x10,
  Melee: 0x20,
  Parry: 0x40,
  Ability1: 0x80,
  Ability2: 0x100,
  Ability3: 0x200,
  Ability4: 0x400,
  /** Item actives on Z, X, C, V. */
  Item1: 0x800,
  Item2: 0x1000,
  Item3: 0x2000,
  Item4: 0x4000,
  ShoulderSwap: 0x8000,
  /** Aim (RMB): tighter spread and the hero's zoom, per GDD §5.6. */
  Aim: 0x10000,
  /** Interact (E): pick up, drop or deliver the Golden Egg; mount an Updraft at a station. */
  Interact: 0x20000,
} as const;
export type ButtonName = keyof typeof Button;

/** Ability buttons in slot order, for code that loops over slots. */
export const ABILITY_BUTTONS = [Button.Ability1, Button.Ability2, Button.Ability3, Button.Ability4] as const;
/** Item-active buttons in key order (Z, X, C, V). */
export const ITEM_BUTTONS = [Button.Item1, Button.Item2, Button.Item3, Button.Item4] as const;

/** GDD §12.5: tap pings are contextual (attack, take, defend, goHere); the wheel has the other four. */
export type PingKind = 'attack' | 'take' | 'defend' | 'goHere' | 'danger' | 'onMyWay' | 'retreat' | 'needHelp';

export interface Ping {
  readonly kind: PingKind;
  /** World point. The client gets it from its crosshair or minimap; bots pick it directly. */
  readonly pos: Vec3;
  /** The entity pinged (enemy, objective, structure), or null for ground. */
  readonly target: EntityId | null;
}

export interface SightLine {
  readonly origin: Vec3;
  readonly dir: Vec3;
}

export interface PlayerCommand {
  /** Centre ray of the last rendered player camera. Bots and headless callers use deterministic rig geometry. */
  readonly sight?: SightLine;
  /** Strafe axis, −1 (left) to 1 (right). */
  readonly right: number;
  /** Forward axis, −1 (back) to 1 (forward). */
  readonly forward: number;
  /** Absolute look yaw (radians). */
  readonly yaw: number;
  /** Absolute look pitch (radians, positive up). Core clamps it to CAMERA.pitchMin..pitchMax. */
  readonly pitch: number;
  /** Buttons down at sample time. */
  readonly held: number;
  /** Buttons that went down since the previous command (so a tap shorter than a tick is never lost). */
  readonly pressed: number;
  /** Spend AP on this ability slot (0–3) this tick, or null. */
  readonly upgrade: number | null;
  /** Buy this item this tick, or null. sim/items checks range to a shop and Seeds. */
  readonly buy: ItemId | null;
  /** Sell this owned item this tick, or null. */
  readonly sell: ItemId | null;
  /** Place a ping this tick, or null. Core drops pings over the rate limit (PING_LIMIT per PING_WINDOW_SECONDS). */
  readonly ping: Ping | null;
  /** The human concedes the match (allowed from CONCEDE_AFTER_SECONDS). */
  readonly concede: boolean;
}

/** A command that does nothing (used for dead heroes, idle bots and fast-forward). */
export const IDLE_COMMAND: PlayerCommand = Object.freeze({
  right: 0,
  forward: 0,
  yaw: 0,
  pitch: 0,
  held: 0,
  pressed: 0,
  upgrade: null,
  buy: null,
  sell: null,
  ping: null,
  concede: false,
});

/** A command for one hero, as passed to `sim.step`. */
export interface HeroCommand {
  /** The hero's entity id (SimView.localHero for the human). */
  readonly hero: EntityId;
  readonly command: PlayerCommand;
}
