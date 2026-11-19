import { describe, expect, it } from 'vitest';
import { Button, Layer, LANE_IDS, type EntityId, type LaneId, type PlayerTeam, type StructureEntity, type StructureType, type Vec3 } from '../../src/sim/core/contracts';
import { TICK_RATE } from '../../src/sim/data/core';
import { createSandbox, type Sandbox } from '../helpers/sandbox';

const PHASE_ONE_HP = 15_000;
const PHASE_TWO_HP = 20_000;
const TRANSITION_TICKS = 3 * TICK_RATE;
const FINISHING_HIT = 100_000;
const SIEGE_LANE = 'riverbank';
const otherTeam = (team: PlayerTeam): PlayerTeam => team === 'dawn' ? 'dusk' : 'dawn';
const beside = (at: Vec3, dx: number, dz = 0): Vec3 => ({ x: at.x + dx, y: at.y, z: at.z + dz });

async function siege() {
  const sb = await createSandbox({
    map: 'main', heroes: [{ hero: 'shrike', team: 'dawn' }, { hero: 'albatross', team: 'dusk' }],
    options: { structures: true, unlockAbilities: false },
  });
  return { sb, dawn: sb.heroes[0]!, dusk: sb.heroes[1]! };
}

function structures(sb: Sandbox, team: PlayerTeam, type: StructureType, lane?: LaneId): StructureEntity[] {
  return sb.ctx.store.list('structure').filter((s) => s.team === team && s.structure.type === type &&
    (lane === undefined || s.structure.lane === lane));
}

function tower(sb: Sandbox, team: PlayerTeam, type: StructureType, lane?: LaneId): StructureEntity {
  const found = structures(sb, team, type, lane);
  expect(found, `§7 ${team} ${lane ?? 'base'} ${type} spawns from the real map anchor`).toHaveLength(1);
  return found[0]!;
}

function damage(sb: Sandbox, source: EntityId, target: EntityId, amount: number, type: 'talon' | 'song' = 'talon'): void {
  sb.apply({ kind: 'damage', amount, type }, target, sb.cause(source, { via: 'weapon' }));
}

function kill(sb: Sandbox, source: EntityId, target: EntityId): void {
  damage(sb, source, target, FINISHING_HIT);
  sb.step();
  expect(sb.eventsOf('entity.died'), `§7 structure ${target} fell through Combat`).toContainEqual(expect.objectContaining({
    victim: target, creditHero: source, victimKind: 'structure',
  }));
}

function scrapper(sb: Sandbox, team: PlayerTeam, at: Vec3, hp = 260): EntityId {
  return sb.dummy({ kind: 'unit', type: 'scrapper', team, lane: SIEGE_LANE, at, hp });
}

function hitsFrom(sb: Sandbox, source: EntityId, target: EntityId) {
  return sb.eventsOf('damage.applied').filter((e) => e.source === source && e.target === target);
}

describe('W4 siege objectives', () => {
  it('§7 §§6.6/16: spawns both flocks from their anchors and keeps tower bodies at least 2 m under the rider', async () => {
    const { sb } = await siege();
    const actual = sb.ctx.store.list('structure');
    const anchors = sb.ctx.map.structures;
    expect(actual).toHaveLength(anchors.length);
    for (const anchor of anchors) {
      expect(actual).toContainEqual(expect.objectContaining({
        team: anchor.team, pos: anchor.pos, structure: expect.objectContaining({ type: anchor.type, lane: anchor.lane }),
      }));
    }
    for (const s of actual.filter((s) => s.structure.type === 'hawk' || s.structure.type === 'heron')) {
      expect(s.structure.body.height).toBeLessThanOrEqual(10);
    }
    const off = await createSandbox({ map: 'main', heroes: ['shrike'], options: { structures: false } });
    expect(off.ctx.store.list('structure')).toHaveLength(0);
  });

  it.each(LANE_IDS)('§§3.7/16 %s rides over both flocks’ Hawks and Herons in either direction', async (lane) => {
    const { sb, dawn, dusk } = await siege();
    const line = sb.ctx.map.updrafts.find((route) => route.lane === lane)!;
    const targets = (['dawn', 'dusk'] as const).flatMap((team) => [
      tower(sb, team, 'hawk', lane), tower(sb, team, 'heron', lane),
    ]);
    for (const [rider, i, next] of [[dawn, 0, 1], [dusk, -1, -2]] as const) {
      // The live enemy towers shoot at the rider; it must survive to the far end so the ride tests clearance only.
      sb.modify(rider, 'siege-ride', { conditions: ['invulnerable'] });
      const origin = line.stations.at(i)!;
      const toward = line.stations.at(next)!;
      sb.place(rider, origin, Math.atan2(toward.x - origin.x, toward.z - origin.z));
      sb.press(rider, Button.Interact);
      sb.step(Math.ceil(0.3 * TICK_RATE) + 1);
      expect(sb.hero(rider).motor.updraft).not.toBeNull();
      sb.press(rider, Button.Dash);
      const crossed = new Set<EntityId>();
      for (let tick = 0; tick < 35 * TICK_RATE && sb.hero(rider).motor.updraft !== null; tick++) {
        const feet = sb.hero(rider).pos;
        for (const s of targets) {
          const distance = Math.hypot(feet.x - s.pos.x, feet.z - s.pos.z);
          if (distance >= 0.5 || crossed.has(s.id)) continue;
          const hit = sb.ctx.physics.raycast(feet, { x: 0, y: -1, z: 0 }, 15, Layer.Structure);
          expect(hit?.entity, 'physical tower collider beneath the rider').toBe(s.id);
          expect(hit?.distance).toBeGreaterThanOrEqual(2 - 0.01);
          crossed.add(s.id);
        }
        sb.step();
      }
      expect(crossed).toEqual(new Set(targets.map((s) => s.id)));
      expect(sb.eventsOf('movement')).toContainEqual(expect.objectContaining({ hero: rider, action: 'updraftBoost' }));
    }
  });

  it.each(['dawn', 'dusk'] as const)('§7.2 %s Hawk holds a target, prefers fledglings after loss, and interrupts for real hero gun damage', async (team) => {
    const { sb, dawn, dusk } = await siege();
    const hawk = tower(sb, team, 'hawk', SIEGE_LANE);
    const attacker = team === 'dawn' ? dusk : dawn;
    const ally = team === 'dawn' ? dawn : dusk;
    sb.place(attacker, beside(hawk.pos, 0, 23));
    sb.place(ally, beside(hawk.pos, 6, 12));
    sb.step(TICK_RATE / 2);
    expect(hawk.structure.target, 'hero beyond 22 m').toBeNull();
    sb.place(attacker, beside(hawk.pos, 0, 15));
    expect(sb.stepUntil(() => hawk.structure.target === attacker, TICK_RATE / 2)).not.toBeNull();
    const first = scrapper(sb, otherTeam(team), beside(hawk.pos, -6, 12), 9000);
    const nearest = scrapper(sb, otherTeam(team), beside(hawk.pos, -5, 8), 9000);
    sb.step(TICK_RATE / 2);
    expect(hawk.structure.target, 'arriving fledglings do not dislodge a sticky hero target').toBe(attacker);
    sb.place(attacker, beside(hawk.pos, 0, 24));
    expect(sb.stepUntil(() => hawk.structure.target === nearest, TICK_RATE / 2)).not.toBeNull();
    sb.place(nearest, beside(hawk.pos, -6, 27));
    expect(sb.stepUntil(() => hawk.structure.target === first, TICK_RATE / 2)).not.toBeNull();
    sb.place(attacker, beside(hawk.pos, 3, 14));
    sb.aimAt(attacker, ally);
    sb.fire(attacker);
    expect(sb.stepUntil(() => hitsFrom(sb, attacker, ally).length > 0, TICK_RATE)).not.toBeNull();
    expect(hitsFrom(sb, attacker, ally)[0]?.via).toBe('weapon');
    sb.fire(attacker, false);
    expect(sb.stepUntil(() => hawk.structure.target === attacker, TICK_RATE / 2), 'hero aggro interrupts within 0.5 s').not.toBeNull();
    expect(sb.view.entities.find((e) => e.id === hawk.id)?.structure?.target).toBe(attacker);
    expect(sb.stepUntil(() => hitsFrom(sb, hawk.id, attacker).length > 0, 2 * TICK_RATE)).not.toBeNull();
    expect(hitsFrom(sb, hawk.id, attacker)[0]).toMatchObject({ via: 'structure', damageType: 'talon', sourceTeam: team });
    const bolt = sb.eventsOf('structure.attack').find((e) => e.structure === hawk.id && e.attack === 'bolt');
    expect(bolt?.origin.y, 'bolt cue begins above the Hawk base').toBeGreaterThan(hawk.pos.y);
    expect(bolt?.impactAt).toBeGreaterThan(0);
  });

  it('§7.3 Heron beams at quarter-second intervals and telegraphs a close-range Song stomp', async () => {
    const { sb, dawn } = await siege();
    const heron = tower(sb, 'dusk', 'heron', SIEGE_LANE);
    sb.modify(dawn, 'siege-health', { stats: [{ stat: 'maxHealth', op: 'add', value: 9000 }] });
    sb.apply({ kind: 'heal', amount: 9000 }, dawn, sb.cause(dawn));
    sb.place(dawn, beside(heron.pos, 0, -31));
    sb.step(TICK_RATE / 2);
    expect(heron.structure.target).toBeNull();
    sb.place(dawn, beside(heron.pos, 0, -26));
    const beamAt: number[] = [];
    for (let i = 0; i < 2 * TICK_RATE && beamAt.length < 4; i++) {
      sb.clearEvents();
      sb.step();
      if (hitsFrom(sb, heron.id, dawn).some((e) => e.damageType === 'talon')) beamAt.push(sb.sim.tick);
    }
    expect(beamAt).toHaveLength(4);
    expect(beamAt.slice(1).map((t, i) => t - beamAt[i]!)).toEqual(Array<number>(3).fill(TICK_RATE / 4));
    expect(sb.eventsOf('structure.attack')).not.toContainEqual(expect.objectContaining({ attack: 'stomp' }));
    sb.place(dawn, beside(heron.pos, 0, -5));
    const nextStomp = () => sb.eventsOf('structure.attack').find((e) => e.structure === heron.id && e.attack === 'stomp');
    expect(sb.stepUntil(() => nextStomp() !== undefined, 4 * TICK_RATE + 1)).not.toBeNull();
    const stomp = nextStomp()!;
    expect(stomp.impactAt - sb.sim.tick).toBe(TICK_RATE / 2);
    sb.step(TICK_RATE / 2 - 1);
    expect(hitsFrom(sb, heron.id, dawn).filter((e) => e.damageType === 'song')).toHaveLength(0);
    sb.step(2);
    expect(hitsFrom(sb, heron.id, dawn)).toContainEqual(expect.objectContaining({ damageType: 'song', via: 'structure' }));
  });

  it('§§7.3–7.5/7.7 opens lane gates in order and needs two Wardens of one lane and both Shrines', async () => {
    const { sb, dawn } = await siege();
    const team = 'dusk';
    const hawk = tower(sb, team, 'hawk', SIEGE_LANE);
    const heron = tower(sb, team, 'heron', SIEGE_LANE);
    const wardens = structures(sb, team, 'warden', SIEGE_LANE);
    const otherWardens = structures(sb, team, 'warden', 'hedgerow');
    const shrines = structures(sb, team, 'shrine');
    const patron = tower(sb, team, 'patron');
    expect(wardens).toHaveLength(2);
    expect(otherWardens).toHaveLength(2);
    expect(shrines).toHaveLength(2);
    const [w1, w2] = wardens as [StructureEntity, StructureEntity];
    const [s1, s2] = shrines as [StructureEntity, StructureEntity];
    for (const s of [heron, ...wardens, ...shrines, patron]) {
      const before = s.health.hp;
      damage(sb, dawn, s.id, FINISHING_HIT);
      sb.step();
      expect(s.health.hp, `${s.structure.type} gate deflects real incoming damage`).toBe(before);
    }
    kill(sb, dawn, hawk.id);
    expect(heron.stats.conditions.has('invulnerable')).toBeFalsy();
    expect(tower(sb, team, 'heron', 'hedgerow').stats.conditions.has('invulnerable')).toBe(true);
    kill(sb, dawn, heron.id);
    sb.place(dawn, beside(w1.pos, 0, -10));
    expect(sb.stepUntil(() => hitsFrom(sb, w1.id, dawn).length > 0, 2 * TICK_RATE)).not.toBeNull();
    expect(sb.eventsOf('structure.attack')).toContainEqual(expect.objectContaining({ structure: w1.id, attack: 'bolt' }));
    sb.place(dawn, sb.ctx.map.spawns[0]!.pos);
    kill(sb, dawn, w1.id);
    kill(sb, dawn, tower(sb, team, 'hawk', 'hedgerow').id);
    kill(sb, dawn, tower(sb, team, 'heron', 'hedgerow').id);
    kill(sb, dawn, otherWardens[0]!.id);
    expect(s1.stats.conditions.has('invulnerable'), 'one fall in each of two lanes leaves Shrines gated').toBe(true);
    kill(sb, dawn, w2.id);
    expect(shrines.every((s) => !s.stats.conditions.has('invulnerable'))).toBe(true);
    sb.place(dawn, beside(s1.pos, 0, 8));
    expect(sb.stepUntil(() => hitsFrom(sb, s1.id, dawn).some((e) => e.damageType === 'song'), 3 * TICK_RATE + 1)).not.toBeNull();
    expect(sb.eventsOf('structure.attack')).toContainEqual(expect.objectContaining({ structure: s1.id, attack: 'pulse' }));
    kill(sb, dawn, s1.id);
    expect(patron.stats.conditions.has('invulnerable')).toBe(true);
    kill(sb, dawn, s2.id);
    expect(patron.stats.conditions.has('invulnerable')).toBeFalsy();
  });

  it('§7.6 Brood Ward applies ×0.35 after resists, drops only for a nearby attacking fledgling and returns on departure', async () => {
    const { sb, dawn } = await siege();
    const hawk = tower(sb, 'dusk', 'hawk', SIEGE_LANE);
    scrapper(sb, 'dusk', beside(hawk.pos, 0, 8));
    const summon = sb.dummy({ kind: 'unit', type: 'summon', team: 'dawn', at: beside(hawk.pos, 0, -8), hp: 1000 });
    const fledgling = scrapper(sb, 'dawn', beside(hawk.pos, 0, -31));
    const hit = () => {
      sb.clearEvents();
      damage(sb, dawn, hawk.id, 1000);
      sb.step();
      return hitsFrom(sb, dawn, hawk.id)[0]?.amount ?? 0;
    };
    sb.step();
    expect(hawk.structure.broodWard).toBe(true);
    const reduced = hit();
    expect(reduced).toBeGreaterThan(0);
    sb.place(fledgling, beside(hawk.pos, 0, -29));
    expect(sb.stepUntil(() => hawk.structure.broodWard === false, TICK_RATE / 2)).not.toBeNull();
    expect(sb.eventsOf('structure.state')).toContainEqual(expect.objectContaining({ structure: hawk.id, state: 'wardDown' }));
    expect(sb.view.entities.find((e) => e.id === hawk.id)?.structure?.broodWard).toBe(false);
    const open = hit();
    expect(open).toBeGreaterThan(reduced);
    expect(reduced / open).toBeCloseTo(0.35, 5);
    sb.place(fledgling, beside(hawk.pos, 0, -31));
    expect(sb.stepUntil(() => hawk.structure.broodWard === true, TICK_RATE / 2)).not.toBeNull();
    expect(sb.eventsOf('structure.state')).toContainEqual(expect.objectContaining({ structure: hawk.id, state: 'wardUp' }));
    expect(sb.ctx.store.get(summon)).toBeDefined();
  });

  it.each(['dawn', 'dusk'] as const)('§§7.7/15.1 %s Patron gates duplicate lethal hits, transitions in 3 s and loses only to a phase-two death', async (team) => {
    const { sb, dawn, dusk } = await siege();
    const attacker = team === 'dusk' ? dawn : dusk;
    const patron = tower(sb, team, 'patron');
    const hawk = tower(sb, team, 'hawk', SIEGE_LANE);
    const heron = tower(sb, team, 'heron', SIEGE_LANE);
    for (const target of [hawk, heron, ...structures(sb, team, 'warden', SIEGE_LANE), ...structures(sb, team, 'shrine')]) {
      kill(sb, attacker, target.id);
    }
    expect(patron.health.hp).toBe(PHASE_ONE_HP);
    expect(patron.structure.weakPoint).toBeNull();
    const netWorth = sb.hero(attacker).progress.netWorth;
    sb.clearEvents();
    damage(sb, attacker, patron.id, FINISHING_HIT);
    damage(sb, attacker, patron.id, FINISHING_HIT);
    sb.step();
    expect(sb.eventsOf('patron.depleted')).toEqual([{ type: 'patron.depleted', structure: patron.id }]);
    expect(hitsFrom(sb, attacker, patron.id).map((e) => e.lethal)).toEqual([false]);
    expect(sb.eventsOf('entity.died')).toHaveLength(0);
    expect(sb.sim.isOver).toBe(false);
    expect(patron.health.hp).toBe(1);
    expect(patron.structure.transitionUntil).toBe(sb.sim.tick + TRANSITION_TICKS);
    expect(sb.eventsOf('structure.attack')).toContainEqual(expect.objectContaining({ structure: patron.id, attack: 'transition' }));
    sb.step(TRANSITION_TICKS - 1);
    expect(patron.structure.phase).toBe(1);
    expect(patron.stats.conditions.has('invulnerable')).toBe(true);
    sb.step();
    expect(patron.structure.phase).toBe(2);
    expect(patron.health.hp).toBe(PHASE_TWO_HP);
    expect(patron.stats.final.maxHealth).toBe(PHASE_TWO_HP);
    expect(patron.structure.weakPoint).toMatchObject({ radius: 1, centre: { y: patron.pos.y + 6 } });
    expect(sb.eventsOf('structure.state')).toContainEqual(expect.objectContaining({ structure: patron.id, state: 'phase2' }));
    expect(sb.hero(attacker).progress.netWorth - netWorth).toBeLessThan(4);
    const heart = patron.structure.weakPoint!;
    const chestDir = Math.sign(heart.centre.z - patron.pos.z) || (team === 'dusk' ? -1 : 1);
    sb.place(attacker, { ...heart.centre, y: heart.centre.y - 1, z: heart.centre.z + 10 * chestDir });
    sb.modify(attacker, 'siege-finisher', { stats: [{ stat: 'weaponDamage', op: 'mul', value: 10_000 }] });
    sb.aimAt(attacker, heart.centre);
    sb.fire(attacker);
    expect(sb.stepUntil(() => sb.sim.isOver, TICK_RATE)).not.toBeNull();
    expect(hitsFrom(sb, attacker, patron.id)).toContainEqual(expect.objectContaining({
      via: 'weapon', weakPoint: true, beakShot: false, lethal: true,
    }));
    expect(sb.eventsOf('match.ended')).toEqual([{ type: 'match.ended', winner: otherTeam(team), reason: 'patron' }]);
    expect(sb.eventsOf('seeds.gained').filter((e) => e.reason === 'objective')).toHaveLength(0);
  });

  it('§7.7 Patron volleys and Screeches in phase one, then targets with Rain and Gale in phase two', async () => {
    const { sb, dawn } = await siege();
    const patron = tower(sb, 'dusk', 'patron');
    for (const target of [
      tower(sb, 'dusk', 'hawk', SIEGE_LANE), tower(sb, 'dusk', 'heron', SIEGE_LANE),
      ...structures(sb, 'dusk', 'warden', SIEGE_LANE), ...structures(sb, 'dusk', 'shrine'),
    ]) kill(sb, dawn, target.id);
    sb.modify(dawn, 'siege-health', { stats: [{ stat: 'maxHealth', op: 'add', value: 9000 }] });
    sb.apply({ kind: 'heal', amount: 9000 }, dawn, sb.cause(dawn));
    const station = beside(patron.pos, 0, -12);
    const attacks = () => sb.eventsOf('structure.attack').filter((e) => e.structure === patron.id);
    const waitFor = (type: ReturnType<typeof attacks>[number]['attack'], seconds: number) => {
      for (let i = 0; i < seconds * TICK_RATE; i++) {
        if (attacks().some((e) => e.attack === type)) return;
        sb.step();
        if (Math.hypot(sb.hero(dawn).pos.x - station.x, sb.hero(dawn).pos.z - station.z) > 1) sb.place(dawn, station);
      }
      expect(attacks().map((e) => e.attack)).toContain(type);
    };
    sb.place(dawn, station);
    waitFor('volley', 4);
    expect(sb.stepUntil(() => hitsFrom(sb, patron.id, dawn).some((e) => e.damageType === 'song'), 2 * TICK_RATE)).not.toBeNull();
    waitFor('screech', 11);

    damage(sb, dawn, patron.id, FINISHING_HIT);
    sb.step(TRANSITION_TICKS + 1);
    expect(patron.structure.phase).toBe(2);
    sb.clearEvents();
    sb.place(dawn, station);
    waitFor('volley', 3);
    waitFor('rain', 7);
    waitFor('gale', 13);
    expect(attacks().map((e) => e.attack)).not.toContain('screech');
    for (const e of attacks()) expect([e.origin.x, e.point.z, e.impactAt].every(Number.isFinite)).toBe(true);
  });

  it.each(['dawn', 'dusk'] as const)('§§5.11/6.6 %s Home Roost heals allies and burns enemies only inside the zone', async (team) => {
    const { sb, dawn, dusk } = await siege();
    const ally = team === 'dawn' ? dawn : dusk;
    const enemy = team === 'dawn' ? dusk : dawn;
    const roost = sb.ctx.map.shops.find((s) => s.kind === 'roost' && s.team === team)!;
    sb.place(ally, beside(roost.pos, -2));
    sb.place(enemy, beside(roost.pos, 2));
    const full = sb.hero(ally).stats.final.maxHealth;
    damage(sb, enemy, ally, full / 2, 'song');
    sb.step();
    const initialAlly = sb.health(ally).hp;
    const initialEnemy = sb.health(enemy).hp;
    sb.clearEvents();
    sb.step(TICK_RATE);
    expect(sb.health(ally).hp - initialAlly).toBeCloseTo(full * 0.2, -1);
    const burns = sb.eventsOf('damage.applied').filter((e) => e.target === enemy && e.damageType === 'song');
    expect(burns.length).toBeGreaterThan(0);
    expect(sb.health(enemy).hp).toBeLessThan(initialEnemy);
    expect(sb.eventsOf('heal.applied')).toContainEqual(expect.objectContaining({ target: ally }));
    sb.place(enemy, beside(roost.pos, roost.radius + 2));
    sb.clearEvents();
    sb.step(TICK_RATE);
    expect(sb.eventsOf('damage.applied').filter((e) => e.target === enemy && e.damageType === 'song')).toHaveLength(0);
  });
});
