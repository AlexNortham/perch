/**
 * The siege-proof player (W4): a scripted aim-and-fire agent for one Owl in the real Play match (main map, waves and
 * structures, no neutrals, no bots). Shared by the headless proof (tests/siege-proof.test.ts) and the browser
 * replay (`?scene=replay`, D-ARCH-020). It reads state to choose where to walk and where to look, as a player reads
 * the screen, and returns one ordinary PlayerCommand per tick. It never writes state and uses no win helper. It walks
 * out of the base onto Riverbank, keeps behind its own wave, shoots enemy fledglings and each open Dusk structure from
 * outside that structure's reach, and the Patron's phase-two heart.
 */
import { Button, IDLE_COMMAND, LAYERS_SOLID } from '../core/contracts';
import type { Entity, EntityId, HeroId, PlayerCommand, Sim, StructureEntity, Vec3 } from '../core/contracts';
import { aimRay, muzzlePoint, rightDir } from '../core/aim';

export const SIEGE_HERO: HeroId = 'owl';
export const SIEGE_ROUTE = ['hawk', 'heron', 'warden', 'shrine', 'patron'] as const;
/** Down the Home Roost's west ramp, round the Patron dais and out of the Riverbank gate. */
const EXIT = [{ x: -12.5, z: -141 }, { x: -12.5, z: -131 }, { x: -3, z: -119 }, { x: 0, z: -108 }];
/** Fledglings closer than this are shot first; farther ones only when no structure is open. */
const THREAT_M = 20;
const UNIT_REACH_M = 45;
const STRUCTURE_REACH_M = 60;
/** Stay this far behind the own wave's front fledgling. */
const BEHIND_WAVE_M = 4;

/** Where to stand for each Dusk structure: outside its reach (Hawk 22 m, Heron beam 30 m, Warden 24 m, Patron 35 m). */
function standFor(s: StructureEntity): { x: number; z: number } {
  switch (s.structure.type) {
    case 'hawk': return { x: 0, z: 14 };
    case 'heron': return { x: 0, z: 46 };
    case 'warden': return { x: 0, z: 81 };
    // A Shrine sits behind the base wall: look through the far side of the 12 m gate, 37.6 m from Shrine and Patron.
    case 'shrine': return { x: -Math.sign(s.pos.x) * 11.6, z: 100.4 };
    default: return { x: 0, z: 92 };
  }
}

/** The agent for hero `me` in `sim`: call it once per tick for that tick's command. */
export function siegeAgent(sim: Sim, me: EntityId): () => PlayerCommand {
  const ctx = sim.ctx;
  const body = ctx.heroes[SIEGE_HERO].def.body;
  const alive = (e: Entity): boolean => !e.removed && !('health' in e && e.health.dead);
  let leg = 0;
  let yaw = 0;
  let pitch = 0;

  const nextStructure = (): StructureEntity | undefined => {
    const open = ctx.store.list('structure').filter((s) => s.team === 'dusk' && alive(s) && s.structure.lane !== 'hedgerow' && s.structure.lane !== 'pinewood');
    for (const type of SIEGE_ROUTE) {
      const found = open.filter((s) => s.structure.type === type).sort((a, b) => Math.abs(a.pos.x) - Math.abs(b.pos.x) || a.id - b.id);
      if (found[0]) return found[0];
    }
    return undefined;
  };
  const aimPoint = (e: Entity): Vec3 => {
    const up = e.kind === 'structure' ? e.structure.body.height / 2 : e.kind === 'unit' ? e.unit.height / 2 : 1;
    return e.kind === 'structure' && e.structure.weakPoint ? e.structure.weakPoint.centre : { x: e.pos.x, y: e.pos.y + up, z: e.pos.z };
  };
  const inSight = (from: Vec3, p: Vec3, target: EntityId): boolean => {
    const d = { x: p.x - from.x, y: p.y - from.y, z: p.z - from.z };
    const len = Math.hypot(d.x, d.y, d.z);
    const hit = ctx.physics.raycast(from, { x: d.x / len, y: d.y / len, z: d.z / len }, len, LAYERS_SOLID, me);
    return !hit || hit.entity === target || hit.distance > len - 1;
  };

  return () => {
    const h = ctx.store.getKind(me, 'hero')!;
    if (h.health.dead) {
      leg = 0;
      return IDLE_COMMAND;
    }
    const goal = nextStructure();
    let to = EXIT[leg];
    if (to && Math.hypot(h.pos.x - to.x, h.pos.z - to.z) < 1.5) leg++;
    if (!to) {
      // Up the lane, never ahead of the own Riverbank wave: its fledglings draw the towers and the enemy wave.
      const stand = goal ? standFor(goal) : { x: 0, z: 0 };
      const ours = ctx.store.list('unit').filter((u) => u.team === 'dawn' && alive(u) && u.unit.lane === 'riverbank');
      const front = ours.reduce((z, u) => Math.max(z, u.pos.z), -Infinity);
      const z = Math.min(stand.z, front - BEHIND_WAVE_M, Number.isFinite(front) ? Infinity : h.pos.z);
      // Along the lane's open centre line, stepping aside only at the stand point (the river bank has edges).
      to = { x: Math.abs(h.pos.z - z) > 3 ? 0 : stand.x, z };
    }

    const dist = (e: Entity): number => Math.hypot(e.pos.x - h.pos.x, e.pos.z - h.pos.z);
    const foes = ctx.store.list('unit').filter((u) => u.team === 'dusk' && alive(u)).sort((a, b) => dist(a) - dist(b) || a.id - b.id);
    const muzzle = muzzlePoint(h.pos, h.yaw, body, h.motor.crouching);
    let target: Entity | undefined;
    if (foes[0] && dist(foes[0]) < THREAT_M) target = foes[0];
    else if (goal && !goal.stats.conditions.has('invulnerable') && dist(goal) < STRUCTURE_REACH_M && inSight(muzzle, aimPoint(goal), goal.id)) target = goal;
    else if (foes[0] && dist(foes[0]) < UNIT_REACH_M) target = foes[0];

    const dx = to.x - h.pos.x;
    const dz = to.z - h.pos.z;
    const len = Math.hypot(dx, dz);
    if (target) {
      // The camera sits behind and beside the pivot, so turning moves it: iterate until the crosshair is on the point.
      const p = aimPoint(target);
      for (let i = 0; i < 8; i++) {
        const ray = aimRay(h.pos, yaw, pitch, h.shoulder, body, h.motor.crouching);
        yaw = Math.atan2(p.x - ray.origin.x, p.z - ray.origin.z);
        pitch = Math.atan2(p.y - ray.origin.y, Math.hypot(p.x - ray.origin.x, p.z - ray.origin.z));
      }
    } else if (len > 1) {
      yaw = Math.atan2(dx, dz);
      pitch = 0;
    }
    // Walk toward `to` in world terms, whatever the look direction.
    const wx = len > 1 ? dx / len : 0;
    const wz = len > 1 ? dz / len : 0;
    const r = rightDir(yaw);
    const reload = h.weapon.ammo === 0 ? Button.Reload : 0;
    return {
      ...IDLE_COMMAND,
      forward: wx * Math.sin(yaw) + wz * Math.cos(yaw),
      right: wx * r.x + wz * r.z,
      yaw,
      pitch,
      held: (target ? Button.Fire : 0) | reload,
      pressed: reload,
    };
  };
}
