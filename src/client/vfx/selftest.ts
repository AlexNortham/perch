/* eslint-disable @typescript-eslint/no-magic-numbers -- the self-test is a hand-placed layout of demo positions */
/**
 * The VFX self-test (dev builds, `?vfxdemo=1`): synthetic entities and events laid out ahead of the local hero so
 * every effect is on screen at once. Effects age in slow motion here (SELF_TEST.timeScale) so a screenshot taken a
 * few frames after load still catches them alive.
 */
import type { EntityId, EntityView, SimEvent, Team, Vec3 } from '../../sim/core/contracts';
import { ViewFlag } from '../../sim/core/contracts';
import type { Frame } from '../app/contracts';
import { entityById } from '../app/loop';
import { MARKER_BITS, SELF_TEST } from './constants';

const B = SELF_TEST.fakeBase;
const FROZEN_NOW = 1000;

export interface SelfFrame {
  readonly entities: readonly EntityView[];
  /** Synthetic events to feed through the normal mapping this frame, or null. */
  readonly events: readonly SimEvent[] | null;
  readonly statusBits: ReadonlyMap<EntityId, number>;
  /** Fake shooters that use hitscan guns. */
  readonly hitscan: ReadonlySet<EntityId>;
  /** Pod ids and the sim time they count as born. */
  readonly pods: ReadonlyMap<EntityId, number>;
  readonly now: number;
}

export function createSelfTest(): { readonly timeScale: number; frame(frame: Frame): SelfFrame } {
  let sinceEmit: number = SELF_TEST.repeatS;
  return {
    timeScale: SELF_TEST.timeScale,
    frame(frame) {
      sinceEmit += frame.dt;
      const emit = sinceEmit >= SELF_TEST.repeatS;
      if (emit) sinceEmit = 0;
      return build(frame, emit);
    },
  };
}

function build(frame: Frame, emit: boolean): SelfFrame {
  const hero = frame.curr.localHero === null ? undefined : entityById(frame.curr, frame.curr.localHero);
  const base: Vec3 = hero?.pos ?? { x: 0, y: 0, z: 0 };
  const yaw = hero?.yaw ?? 0;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  /** World point at `r` metres to the right, `f` ahead and `y` up of the hero. */
  const at = (r: number, f: number, y = 0): Vec3 => ({ x: base.x - fz * r + fx * f, y: base.y + y, z: base.z + fx * r + fz * f });
  const dir = (from: Vec3, to: Vec3): Vec3 => {
    const l = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) || 1;
    return { x: (to.x - from.x) / l, y: (to.y - from.y) / l, z: (to.z - from.z) / l };
  };
  const entities: EntityView[] = [];
  const statusBits = new Map<EntityId, number>();
  const hitscan = new Set<EntityId>();
  const pods = new Map<EntityId, number>();
  const make = (id: number, kind: EntityView['kind'], team: Team, type: string, r: number, f: number, y: number, radius: number, flags = 0, vel: Vec3 = { x: 0, y: 0, z: 0 }, turn = 0): EntityView => {
    const e: EntityView = { id: B + id, kind, team, type, pos: at(r, f, y), vel, yaw: yaw + turn, pitch: 0, radius, hp: 100, maxHp: 100, shield: 0, flags, mode: null, seenBy: 3 };
    entities.push(e);
    return e;
  };
  const fwd = (speed: number): Vec3 => ({ x: fx * speed, y: 0, z: fz * speed });

  // Shooters and targets.
  const allyGun = make(1, 'hero', 'dawn', 'shrike', -7, 4, 0, 0.5);
  const enemyGun = make(2, 'hero', 'dusk', 'shrike', 7, 26, 0, 0.5);
  const boltGun = make(3, 'hero', 'dawn', 'albatross', 0, 3, 0, 0.5);
  const target = make(4, 'hero', 'dusk', 'kingfisher', -3, 24, 0, 0.5);
  const structure = make(5, 'structure', 'dusk', 'warden', 4, 30, 0, 1.5);
  hitscan.add(allyGun.id);
  hitscan.add(enemyGun.id);

  // Projectiles: a gun bolt each side, and a big ability bolt.
  make(10, 'projectile', 'dawn', '', 1, 12, 1.3, 0.08, 0, fwd(160));
  make(11, 'projectile', 'dusk', '', 3, 15, 1.3, 0.08, 0, fwd(-160));
  make(12, 'projectile', 'dawn', '', 6, 9, 1.4, 0.4, 0, fwd(14));
  make(13, 'projectile', 'dusk', '', -2, 18, 1.6, 0.45, 0, fwd(-12));

  // Seed pods in their three stages: rising, ripe (securable gold), ripe (deniable grey-blue) and withering.
  const podAt = (id: number, team: Team, r: number, age: number): void => {
    const p = make(id, 'pickup', team, 'pod', r, 11, 1.4, 0.25);
    pods.set(p.id, FROZEN_NOW - age);
  };
  podAt(20, 'dusk', -11, 0.3);
  podAt(21, 'dusk', -9, 1.1);
  podAt(22, 'dawn', -7, 1.1);
  podAt(23, 'dusk', -5, 2.2);

  // Areas: one of each shape, enemy then allied.
  make(30, 'area', 'dusk', 'sphere', -13, 16, 0, 3);
  make(31, 'area', 'dawn', 'cylinder', -13, 24, 0, 3);
  make(32, 'area', 'dusk', 'cone', 10, 6, 0, 7);
  make(33, 'area', 'dawn', 'ring', 12, 17, 0, 4);
  make(34, 'area', 'dusk', 'box', 13, 28, 0, 3.5);

  // Summons.
  make(40, 'unit', 'dawn', 'trap', -3, 16, 0, 0.5);
  make(41, 'unit', 'dawn', 'wall', 3, 14, 0, 2);
  make(42, 'unit', 'dusk', 'turret', 0, 20, 0, 0.6);

  // Status markers on a row of fledglings.
  const marked: [string, number, number][] = [
    ['stun', 0, ViewFlag.Stunned],
    ['silence', MARKER_BITS.silence, 0],
    ['root', MARKER_BITS.root, 0],
    ['slow', MARKER_BITS.slow, 0],
    ['disarm', MARKER_BITS.disarm, 0],
    ['grounded', MARKER_BITS.grounded, 0],
  ];
  marked.forEach(([, bits, flags], i) => {
    const e = make(50 + i, 'unit', 'dusk', 'scrapper', -7.5 + i * 3, 8, 0, 0.5, flags);
    if (bits !== 0) statusBits.set(e.id, bits);
  });

  // Movers: a slider, an Updraft rider, and fighters.
  make(60, 'hero', 'dawn', 'swift', 8, 8, 0, 0.5, ViewFlag.Sliding, fwd(12));
  make(61, 'hero', 'dawn', 'swift', 11, 12, 0, 0.5, ViewFlag.OnUpdraft);
  const dasher = make(62, 'hero', 'dawn', 'swift', -10, 8, 0, 0.5);
  const lander = make(63, 'hero', 'dawn', 'swift', 5, 6, 0, 0.5);
  const melee = make(64, 'unit', 'dawn', 'scrapper', -6, 34, 0, 0.5);
  const meleeFoe = make(65, 'unit', 'dusk', 'scrapper', -6, 35.2, 0, 0.5, 0, { x: 0, y: 0, z: 0 }, Math.PI);
  const slinger = make(66, 'unit', 'dawn', 'slinger', -9, 31, 0, 0.5);
  const tetherA = make(67, 'hero', 'dawn', 'swan', 8, 20, 0, 0.5);
  const tetherB = make(68, 'hero', 'dawn', 'flamingo', 12, 22, 0, 0.5);
  const caster = make(69, 'hero', 'dawn', 'lyrebird', -5, 20, 0, 0.5);

  if (!emit) return { entities, events: null, statusBits, hitscan, pods, now: FROZEN_NOW };

  const muzzleA = at(-7, 4.5, 1.4);
  const head = at(-3, 24, 2.2);
  const dmg = (source: EntityView | null, tgt: EntityView, via: 'weapon' | 'unit' | 'structure' | 'ability', pos: Vec3): SimEvent => ({
    type: 'damage.applied', source: source?.id ?? null, sourceTeam: source?.team ?? 'neutral', target: tgt.id, targetKind: tgt.kind, amount: 20, absorbed: 0,
    damageType: 'talon', via, ability: null, item: null, beakShot: false, weakPoint: false, proc: false, lethal: false, pos,
  });
  const impact = (owner: EntityView, pos: Vec3, normal: Vec3, tgt: EntityId | null, beakShot: boolean): SimEvent => ({
    type: 'projectile.impact', owner: owner.id, pos, normal, target: tgt, beakShot,
  });
  const events: SimEvent[] = [
    // Ally hitscan: a body hit, a beak shot and a shot into a wall; an enemy shot back at us; a miss.
    { type: 'weapon.fired', shooter: allyGun.id, muzzle: muzzleA, dir: dir(muzzleA, at(-3, 24, 1.2)) },
    impact(allyGun, at(-3, 24, 1.2), { x: -fx, y: 0, z: -fz }, target.id, false),
    impact(allyGun, head, { x: -fx, y: 0, z: -fz }, target.id, true),
    impact(allyGun, at(-12, 30, 1.5), { x: fx, y: 0, z: fz }, null, false),
    dmg(allyGun, target, 'weapon', head),
    { type: 'weapon.fired', shooter: enemyGun.id, muzzle: at(7, 25.5, 1.4), dir: dir(at(7, 25.5, 1.4), at(1, 6, 1.2)) },
    impact(enemyGun, at(1, 6, 0), { x: 0, y: 1, z: 0 }, null, false),
    { type: 'weapon.fired', shooter: boltGun.id, muzzle: at(0, 3.5, 1.4), dir: { x: fx, y: 0, z: fz } },
    impact(allyGun, at(3, 30, 1.5), { x: -fx, y: 0, z: -fz }, structure.id, false),
    // Fledgling melee, a slinger's shot, a structure bolt.
    dmg(melee, meleeFoe, 'unit', at(-6, 34.8, 0.8)),
    dmg(slinger, meleeFoe, 'unit', at(-6, 35.2, 0.8)),
    dmg(structure, target, 'structure', at(-3, 24, 1.2)),
    // Pods secured and denied, deaths.
    { type: 'pod.resolved', pod: B + 900, by: allyGun.id, outcome: 'secured', pos: at(-2, 10, 1.6) },
    { type: 'pod.resolved', pod: B + 901, by: enemyGun.id, outcome: 'denied', pos: at(2, 10, 1.6) },
    { type: 'entity.died', victim: B + 902, victimKind: 'unit', victimTeam: 'dusk', victimType: 'scrapper', killer: null, creditHero: null, assisters: [], via: 'unit', pos: at(0, 12, 0) },
    // Movement.
    { type: 'movement', hero: dasher.id, action: 'dash' },
    { type: 'movement', hero: lander.id, action: 'land' },
    { type: 'movement', hero: B + 61, action: 'updraftBoost' },
    { type: 'movement', hero: B + 60, action: 'jump' },
    // Abilities and tethers.
    { type: 'ability', caster: caster.id, slot: 1, ability: 'demo', stage: 'start', point: at(-5, 20) },
    { type: 'ability', caster: caster.id, slot: 1, ability: 'demo', stage: 'land', point: at(-5, 26) },
    { type: 'tether', source: tetherA.id, target: tetherB.id, ability: null, stage: 'start' },
    { type: 'melee', attacker: dasher.id, heavy: true, target: null, parried: false },
    { type: 'parry', hero: lander.id, outcome: 'success', attacker: null },
  ];
  return { entities, events, statusBits, hitscan, pods, now: FROZEN_NOW };
}
