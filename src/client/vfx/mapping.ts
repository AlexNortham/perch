/**
 * Sim events → effect requests. Pure (no Three): it reads the world through `Lookup` and asks for effects through
 * `FxSink`, so the mapping is unit-tested without a GPU.
 */
import type { EntityId, EntityView, PlayerTeam, SimEvent, Team, Vec3 } from '../../sim/core/contracts';
import { ENEMY_RED, NEUTRAL_COLOUR, TEAM_COLOURS } from '../app/palette';
import { CHEST, MAPPING_DRAW, RANGED_DISTANCE, RANGED_TYPES, TRACER } from './constants';
import type { BurstKind } from './constants';

export interface Lookup {
  /** The entity in the current view (events are facts of the step that produced it). */
  entity(id: EntityId): EntityView | undefined;
  /** Whether this shooter's gun is an instant ray (its tracer is drawn from the event) or fires projectiles. */
  hitscan(shooter: EntityId): boolean;
  /** The local hero's flock (Dawn when there is none). */
  readonly localTeam: PlayerTeam;
}

export interface FxSink {
  /** `axis` is the burst's direction or surface normal (null: up); `tint` replaces the colour of `tint` parts. */
  burst(kind: BurstKind, pos: Vec3, axis: Vec3 | null, tint: number): void;
  tracer(from: Vec3, to: Vec3, colour: number, width: number): void;
  hitFlash(target: EntityId): void;
  tether(source: EntityId, target: EntityId, on: boolean): void;
}

const UP: Vec3 = { x: 0, y: 1, z: 0 };
const WHITE = 0xffffff;

/** Team colour for tints: the flock's light colour; neutral is grey. */
export function teamTint(team: Team): number {
  return team === 'neutral' ? NEUTRAL_COLOUR : TEAM_COLOURS[team].light;
}

export function chestHeight(e: EntityView): number {
  return CHEST[e.kind === 'hero' ? 'hero' : e.kind === 'structure' ? 'structure' : 'unit'];
}

export function chestOf(e: EntityView): Vec3 {
  return { x: e.pos.x, y: e.pos.y + chestHeight(e), z: e.pos.z };
}

function normalised(dx: number, dy: number, dz: number): Vec3 {
  const len = Math.hypot(dx, dy, dz) || 1;
  return { x: dx / len, y: dy / len, z: dz / len };
}

const isPlain = (via: string | undefined): boolean => via === undefined || via === 'weapon';

export function mapEvents(events: readonly SimEvent[], lk: Lookup, sink: FxSink): void {
  for (const e of events) {
    switch (e.type) {
      case 'weapon.fired': {
        sink.burst('muzzle', e.muzzle, e.dir, WHITE);
        if (!lk.hitscan(e.shooter)) break; // Projectile guns: the bullet itself is drawn from the view.
        // weapon.traces carries every pellet's true endpoint, misses included; the impact scan is the fallback.
        if (events.some((t) => t.type === 'weapon.traces' && t.shooter === e.shooter)) break;
        const shooter = lk.entity(e.shooter);
        const colour = shooter && shooter.team !== lk.localTeam ? TRACER.enemy : TRACER.ally;
        let hits = 0;
        for (const i of events) {
          if (i.type !== 'projectile.impact' || i.owner !== e.shooter || !isPlain(i.via)) continue;
          if (i.target !== null && lk.entity(i.target)?.kind === 'pickup') continue; // bullets pass through pods
          sink.tracer(e.muzzle, i.pos, colour, TRACER.width);
          hits++;
        }
        if (hits === 0) {
          const far = { x: e.muzzle.x + e.dir.x * TRACER.missLength, y: e.muzzle.y + e.dir.y * TRACER.missLength, z: e.muzzle.z + e.dir.z * TRACER.missLength };
          sink.tracer(e.muzzle, far, colour, TRACER.width);
        }
        break;
      }
      case 'weapon.traces': {
        const shooter = lk.entity(e.shooter);
        const colour = shooter && shooter.team !== lk.localTeam ? TRACER.enemy : TRACER.ally;
        for (const end of e.ends) sink.tracer(e.muzzle, end, colour, TRACER.width);
        break;
      }
      case 'structure.attack': {
        const s = lk.entity(e.structure);
        const tint = s ? teamTint(s.team) : WHITE;
        if (e.attack === 'stomp' || e.attack === 'pulse' || e.attack === 'screech' || e.attack === 'rain' || e.attack === 'gale' || e.attack === 'transition') {
          sink.burst('structureBlast', e.point, UP, tint);
        } else {
          sink.tracer(e.origin, e.point, tint, e.attack === 'beam' ? TRACER.structureWidth * MAPPING_DRAW.beamWidthScale : TRACER.structureWidth);
        }
        break;
      }
      case 'structure.state': {
        const s = lk.entity(e.structure);
        if (s && (e.state === 'phase2' || e.state === 'wardDown')) sink.burst('structureBlast', chestOf(s), UP, teamTint(s.team));
        break;
      }
      case 'patron.depleted': {
        const s = lk.entity(e.structure);
        if (s) sink.burst('structureBlast', chestOf(s), UP, WHITE);
        break;
      }
      case 'projectile.impact': {
        const target = e.target === null ? undefined : lk.entity(e.target);
        if (target?.kind === 'pickup') break; // pod.resolved draws the pod's end
        if (e.beakShot) sink.burst('beakFlash', e.pos, e.normal, WHITE);
        sink.burst(!target ? 'impactWorld' : target.kind === 'structure' ? 'impactStructure' : 'impactBody', e.pos, e.normal, WHITE);
        break;
      }
      case 'damage.applied': {
        if (e.via !== 'status') sink.hitFlash(e.target);
        if (e.via !== 'unit' && e.via !== 'structure') break;
        const src = e.source === null ? undefined : lk.entity(e.source);
        if (!src) break;
        const from = chestOf(src);
        const dist = Math.hypot(e.pos.x - src.pos.x, e.pos.z - src.pos.z);
        if (src.kind === 'structure' || RANGED_TYPES.includes(src.type) || dist > RANGED_DISTANCE) {
          sink.tracer(from, e.pos, teamTint(src.team), src.kind === 'structure' ? TRACER.structureWidth : TRACER.unitWidth);
        } else {
          sink.burst('swipe', e.pos, normalised(e.pos.x - src.pos.x, 0, e.pos.z - src.pos.z), teamTint(src.team));
        }
        break;
      }
      case 'melee': {
        const a = lk.entity(e.attacker);
        if (!a) break;
        const at = chestOf(a);
        const reach = { x: at.x + Math.sin(a.yaw) * MAPPING_DRAW.reachForward, y: at.y, z: at.z + Math.cos(a.yaw) * MAPPING_DRAW.reachForward };
        if (e.target === null) sink.burst('whiff', reach, { x: Math.sin(a.yaw), y: 0, z: Math.cos(a.yaw) }, teamTint(a.team));
        else sink.burst(e.heavy ? 'swipeHeavy' : 'swipe', reach, { x: Math.sin(a.yaw), y: 0, z: Math.cos(a.yaw) }, teamTint(a.team));
        break;
      }
      case 'parry': {
        const h = lk.entity(e.hero);
        if (h) sink.burst(e.outcome === 'success' ? 'parry' : e.outcome === 'start' ? 'parryStart' : 'parryWhiff', chestOf(h), UP, WHITE);
        break;
      }
      case 'entity.died': {
        if (e.victimKind !== 'projectile') sink.burst('death', { x: e.pos.x, y: e.pos.y + MAPPING_DRAW.deathLift, z: e.pos.z }, UP, WHITE);
        break;
      }
      case 'pod.resolved':
        sink.burst(e.outcome === 'secured' ? 'podSecured' : 'podDenied', e.pos, UP, WHITE);
        break;
      case 'movement': {
        const h = lk.entity(e.hero);
        if (!h) break;
        const feet = h.pos;
        switch (e.action) {
          case 'dash':
          case 'dashJump': {
            const yaw = e.yaw ?? h.yaw;
            sink.burst('dash', chestOf(h), { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) }, WHITE);
            break;
          }
          case 'land':
            sink.burst('dust', feet, UP, WHITE);
            break;
          case 'jump':
          case 'mantle':
            sink.burst('jump', feet, UP, WHITE);
            break;
          case 'updraftBoost':
            sink.burst('updraftBoost', feet, UP, WHITE);
            break;
          case 'teleport':
            sink.burst('teleport', chestOf(h), UP, WHITE);
            break;
          case 'wallSlam':
            sink.burst('wallSlam', chestOf(h), UP, WHITE);
            break;
          default:
            break;
        }
        break;
      }
      case 'tether':
        sink.tether(e.source, e.target, e.stage === 'start');
        break;
      case 'ability': {
        const caster = lk.entity(e.caster);
        const tint = caster ? teamTint(caster.team) : WHITE;
        if (e.stage === 'start' && caster) sink.burst('castFlash', chestOf(caster), UP, tint);
        else if (e.stage === 'land') sink.burst('abilityLand', e.point, UP, caster && caster.team !== lk.localTeam ? ENEMY_RED : tint);
        break;
      }
      default:
        break;
    }
  }
}
