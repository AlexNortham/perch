/**
 * Siege proof (W4 integration): the real Play match (main map, waves and structures on, no neutrals, no bots: the
 * client's `matchConfig`), one picked Dawn hero driven only through ordinary PlayerCommands by a scripted
 * aim-and-fire agent. The agent reads state to choose where to walk and where to look, as a player reads the
 * screen; it never writes state and uses no win helper. It walks out of the base onto Riverbank, keeps behind its
 * own wave, shoots enemy fledglings and each open Dusk structure from outside that structure's reach, and the Patron's
 * phase-two heart. The run writes its seed, hash and timeline to out/siege-proof/seed-<seed>.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { Button, IDLE_COMMAND, LAYERS_SOLID } from '../src/sim/core/contracts';
import type { Entity, EntityId, HeroId, PlayerCommand, Sim, SimEvent, StructureEntity, Vec3 } from '../src/sim/core/contracts';
import { aimRay, muzzlePoint, rightDir } from '../src/sim/core/aim';
import { TICK_RATE } from '../src/sim/data/core';
import { createSim, humanRoster } from '../src/sim/index';

const SEED = 1;
const HERO: HeroId = 'owl';
const MAX_TICKS = 60 * 60 * TICK_RATE;
const ROUTE = ['hawk', 'heron', 'warden', 'shrine', 'patron'] as const;
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

function agent(sim: Sim, me: EntityId): () => PlayerCommand {
  const ctx = sim.ctx;
  const body = ctx.heroes[HERO].def.body;
  const alive = (e: Entity): boolean => !e.removed && !('health' in e && e.health.dead);
  let leg = 0;
  let yaw = 0;
  let pitch = 0;

  const nextStructure = (): StructureEntity | undefined => {
    const open = ctx.store.list('structure').filter((s) => s.team === 'dusk' && alive(s) && s.structure.lane !== 'hedgerow' && s.structure.lane !== 'pinewood');
    for (const type of ROUTE) {
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

// About 72,000 ticks (20 match minutes) in about 7 s alone; the timeout leaves room for a busy parallel run.
it('siege proof: one Owl on ordinary commands takes the Dusk structures and both Patron phases to victory', { timeout: 120_000 }, async () => {
  const sim = await createSim({
    seed: SEED, map: 'main', roster: humanRoster(SEED, HERO, { team: 'dawn', bots: 0 }),
    options: { structures: true, waves: true, neutrals: false },
  });
  const me = sim.view.localHero as EntityId;
  const route = sim.ctx.store.list('structure').filter((s) => s.team === 'dusk' &&
    (s.structure.lane === 'riverbank' || s.structure.lane === null));
  const drive = agent(sim, me);
  const events: SimEvent[] = [];
  const fell: { type: string; at: number; credit: EntityId | null }[] = [];
  const hit = new Set<EntityId>();
  let heart = 0;
  let deaths = 0;
  while (!sim.isOver && sim.tick < MAX_TICKS) {
    sim.step([{ hero: me, command: drive() }]);
    for (const e of sim.drainEvents()) {
      if (e.type === 'match.ended' || e.type === 'patron.depleted' || (e.type === 'structure.state' && e.state === 'phase2')) events.push(e);
      if (e.type === 'damage.applied' && e.source === me && e.via === 'weapon' && route.some((s) => s.id === e.target)) {
        hit.add(e.target);
        if (e.weakPoint) heart++;
      }
      if (e.type === 'entity.died' && e.victim === me) deaths++;
      if (e.type === 'entity.died' && route.some((s) => s.id === e.victim)) {
        fell.push({ type: route.find((s) => s.id === e.victim)!.structure.type, at: Math.round(sim.tick / TICK_RATE), credit: e.creditHero });
      }
    }
  }
  const patron = route.find((s) => s.structure.type === 'patron')!;
  const proof = { seed: SEED, hero: HERO, ticks: sim.tick, matchSeconds: sim.tick / TICK_RATE, hash: sim.hash(), winner: sim.winner, deaths, heartHits: heart, fell };
  mkdirSync('out/siege-proof', { recursive: true });
  writeFileSync(`out/siege-proof/seed-${SEED}.json`, `${JSON.stringify(proof, null, 2)}\n`);

  expect(events).toEqual([
    { type: 'patron.depleted', structure: patron.id },
    { type: 'structure.state', structure: patron.id, state: 'phase2' },
    { type: 'match.ended', winner: 'dawn', reason: 'patron' },
  ]);
  expect(fell.map((f) => f.type).sort()).toEqual(['hawk', 'heron', 'patron', 'shrine', 'shrine', 'warden', 'warden']);
  // The wave and the hero share the work; the hero shot at every stage of the route.
  const shot = new Set(route.filter((s) => hit.has(s.id)).map((s) => s.structure.type));
  expect([...shot].sort(), 'the hero shot each kind of route structure').toEqual([...ROUTE].sort());
  expect(heart, 'gun hits on the phase-two heart-feather').toBeGreaterThan(0);
});
