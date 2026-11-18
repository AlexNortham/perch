// Fledgling rules suite, written test-first from GDD §7.1 and the unit contracts (entity.ts UnitInfo, events.ts
// wave.spawned, damage.applied; SimContext.objectives) (D-EP-006). Pending until Objectives lands (W3):
// `PERCH_PENDING=1 npx vitest run tests/rules/fledglings.test.ts`.
//
// Real waves on the real map. Heroes are sandbox heroes placed relative to a fledgling every tick; their damage is a
// `damage` effect. Targeting is re-picked every 0.5 s (§7.1), so each check allows that long.
import { describe, expect, it } from 'vitest';
import type { DamageAppliedEvent, EntityId, Lane, LaneId, PlayerTeam, UnitEntity, Vec3 } from '../../src/sim/core/contracts';
import { TICK_RATE } from '../../src/sim/data/core';
import { laneOf, offset, progress, project } from '../helpers/lanes';
import { createSandbox } from '../helpers/sandbox';
import type { Sandbox, SandboxHero } from '../helpers/sandbox';

const PENDING = process.env.PERCH_PENDING === '1';
const TIMEOUT_MS = 120_000;
const LONG_TIMEOUT_MS = 600_000;

/** GDD §7.1 numbers. */
const FIRST_WAVE_S = 30;
const WAVE_EVERY_S = 30;
const HP = { scrapper: 260, slinger: 200 } as const;
const HIT = { scrapper: { dmg: 20, everyS: 1.0 }, slinger: { dmg: 14, everyS: 1.2 } } as const;
const SCALING_PER_MIN = 0.015;
const VS_STRUCTURES = 1.5;
const MARCH_SPEED = 5.0;
const COLUMN_GAP = 1.5;
const AGGRO_FLEDGLING = 14;
const AGGRO_HERO = 10;
const LEASH = 18;
const RETARGET_S = 0.5;
/** Composition per lane per flock from these match times (§7.1 table); 3 lanes × 2 flocks = 6 groups. */
const BANDS = [
  { fromS: 0, scrapper: 3, slinger: 1 },
  { fromS: 10 * 60, scrapper: 3, slinger: 2 },
  { fromS: 20 * 60, scrapper: 4, slinger: 2 },
] as const;
const GROUPS = 6;

const ticks = (s: number): number => Math.round(s * TICK_RATE);
/** Re-pick interval plus a tick of slack. */
const RETARGET = ticks(RETARGET_S) + 2;
const scaling = (tick: number): number => 1 + (SCALING_PER_MIN * tick) / TICK_RATE / 60;
/** Two marching waves close at 10 m/s, so an enemy this near now was within 14 m a full re-pick ago. */
const SURELY_IN_AGGRO = AGGRO_FLEDGLING - RETARGET_S * 2 * MARCH_SPEED;

type FledglingType = 'scrapper' | 'slinger';
const isFledgling = (u: UnitEntity): boolean => u.unit.type === 'scrapper' || u.unit.type === 'slinger';
const dist = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const TEAMS = ['dawn', 'dusk'] as const;

async function match(heroes: readonly SandboxHero[] = []): Promise<Sandbox> {
  return createSandbox({ map: 'main', heroes, options: { waves: true, neutrals: false } });
}

function live(sb: Sandbox): UnitEntity[] {
  return sb.ctx.store.list('unit').filter(isFledgling);
}

/** Fledglings spawned since the last clearEvents. */
function spawnedUnits(sb: Sandbox): UnitEntity[] {
  return sb
    .eventsOf('entity.spawned')
    .filter((e) => e.kind === 'unit')
    .map((e) => sb.ctx.store.getKind(e.id, 'unit'))
    .filter((u): u is UnitEntity => u !== undefined && isFledgling(u));
}

interface Wave {
  readonly wave: number;
  readonly tick: number;
  /** Fledglings spawned on the wave's tick. */
  readonly units: UnitEntity[];
}

/** Step to the next wave.spawned. */
function nextWave(sb: Sandbox, maxS = WAVE_EVERY_S + 1): Wave {
  sb.clearEvents();
  const took = sb.stepUntil(() => sb.eventsOf('wave.spawned').length > 0, ticks(maxS));
  expect(took, 'a wave.spawned event').not.toBeNull();
  return { wave: sb.eventsOf('wave.spawned')[0]?.wave ?? -1, tick: sb.sim.tick, units: spawnedUnits(sb) };
}

function laneFor(sb: Sandbox, u: UnitEntity): Lane {
  expect(u.unit.lane, `fledgling ${u.id} has a lane`).not.toBeNull();
  return laneOf(sb.ctx.map, u.unit.lane as LaneId);
}

/** Unit direction a fledgling marches at its position. */
function marching(sb: Sandbox, u: UnitEntity): Vec3 {
  const d = project(laneFor(sb, u), u.pos).dir;
  return u.team === 'dawn' ? d : { x: -d.x, y: 0, z: -d.z };
}

/** The scrapper furthest along its lane, for one flock and lane. */
function front(sb: Sandbox, units: readonly UnitEntity[], team: PlayerTeam, id: LaneId): UnitEntity {
  const group = units.filter((u) => u.team === team && u.unit.lane === id && u.unit.type === 'scrapper');
  expect(group.length, `${team} ${id} scrappers`).toBeGreaterThan(0);
  const l = laneOf(sb.ctx.map, id);
  return group.reduce((a, b) => (progress(l, team, b.pos) > progress(l, team, a.pos) ? b : a));
}

/** Put a hero `along` m ahead of a fledgling (negative: behind), in its marching direction. */
function keep(sb: Sandbox, hero: EntityId, f: UnitEntity, along: number): void {
  sb.place(hero, offset(f.pos, marching(sb, f), along));
}

/** Step up to `max` ticks, calling `each` before every step, until `done` holds. Returns the ticks taken or null. */
function stepWhile(sb: Sandbox, max: number, each: () => void, done: () => boolean = () => false): number | null {
  for (let i = 1; i <= max; i++) {
    each();
    sb.step();
    if (done()) return i;
  }
  return null;
}

/** Step `n` ticks (calling `each` first) and return each damage.applied from `source` to `target` with its tick. */
function hitsOver(sb: Sandbox, n: number, each: () => void, source: EntityId, target: EntityId): { tick: number; e: DamageAppliedEvent }[] {
  const out: { tick: number; e: DamageAppliedEvent }[] = [];
  for (let i = 0; i < n; i++) {
    each();
    const from = sb.events.length;
    sb.step();
    for (const e of sb.events.slice(from)) {
      if (e.type === 'damage.applied' && e.source === source && e.target === target) out.push({ tick: sb.sim.tick, e });
    }
  }
  return out;
}

describe.runIf(PENDING)('fledgling waves (GDD §7.1)', () => {
  it('§7.1: the first wave spawns at 0:30, then every 30 s, and ObjectiveState.nextWaveAt announces it', async () => {
    const sb = await match();
    sb.step();
    expect(sb.ctx.objectives.nextWaveAt).toBe(ticks(FIRST_WAVE_S));
    const first = nextWave(sb);
    expect(first.wave).toBe(1);
    expect(Math.abs(first.tick - ticks(FIRST_WAVE_S))).toBeLessThanOrEqual(1);
    expect(sb.ctx.objectives.nextWaveAt).toBe(first.tick + ticks(WAVE_EVERY_S));
    const second = nextWave(sb);
    expect(second.wave).toBe(2);
    expect(second.tick - first.tick).toBe(ticks(WAVE_EVERY_S));
  }, TIMEOUT_MS);

  it('§7.1: before 10:00 a wave is 3 Scrappers + 1 Slinger per lane per flock (24), at 260/200 HP +1.5% per minute', async () => {
    const sb = await match();
    const w = nextWave(sb);
    const all = [...w.units];
    for (let i = 0; i < TICK_RATE; i++) {
      sb.clearEvents();
      sb.step();
      all.push(...spawnedUnits(sb));
    }
    expect(all).toHaveLength(BANDS[0].scrapper * GROUPS + BANDS[0].slinger * GROUPS);
    for (const team of TEAMS) {
      for (const l of sb.ctx.map.lanes) {
        const group = all.filter((u) => u.team === team && u.unit.lane === l.id);
        expect(group.filter((u) => u.unit.type === 'scrapper'), `${team} ${l.id} scrappers`).toHaveLength(BANDS[0].scrapper);
        expect(group.filter((u) => u.unit.type === 'slinger'), `${team} ${l.id} slingers`).toHaveLength(BANDS[0].slinger);
      }
    }
    for (const u of w.units) {
      const max = HP[u.unit.type as FledglingType] * scaling(w.tick);
      expect(u.stats.final.maxHealth, `${u.unit.type} max HP`).toBeCloseTo(max, 6);
      expect(u.health.hp).toBeCloseTo(max, 6);
    }
  }, TIMEOUT_MS);

  it('§7.1: a wave forms a column two wide, 1.5 m apart, Scrappers in front, on its lane', async () => {
    const sb = await match();
    const w = nextWave(sb);
    expect(w.units.length).toBeGreaterThan(0);
    for (const team of TEAMS) {
      for (const l of sb.ctx.map.lanes) {
        const group = w.units.filter((u) => u.team === team && u.unit.lane === l.id);
        const along = (u: UnitEntity): number => progress(l, team, u.pos);
        const scrapperMin = Math.min(...group.filter((u) => u.unit.type === 'scrapper').map(along));
        for (const s of group.filter((u) => u.unit.type === 'slinger')) {
          expect(along(s), `${team} ${l.id}: slingers behind scrappers`).toBeLessThanOrEqual(scrapperMin + 0.01);
        }
        const side = (u: UnitEntity): number => {
          const p = project(l, u.pos);
          const s = Math.sign((u.pos.x - p.point.x) * p.dir.z - (u.pos.z - p.point.z) * p.dir.x);
          return Math.round(p.off * s * 10);
        };
        expect(new Set(group.map(side)).size, `${team} ${l.id}: two files`).toBeLessThanOrEqual(2);
        for (const u of group) expect(project(l, u.pos).off).toBeLessThanOrEqual(l.halfWidth);
        for (const a of group) {
          for (const b of group) if (a !== b) expect(dist(a.pos, b.pos)).toBeGreaterThanOrEqual(COLUMN_GAP - 0.05);
        }
      }
    }
  }, TIMEOUT_MS);

  it('§7.1: fledglings march their own lane toward the enemy at 5.0 m/s and stay on the path', async () => {
    const sb = await match();
    const w = nextWave(sb);
    const leaders = sb.ctx.map.lanes.flatMap((l) => TEAMS.map((t) => front(sb, w.units, t, l.id)));
    const walked = (u: UnitEntity): number => progress(laneFor(sb, u), u.team as PlayerTeam, u.pos);
    const start = leaders.map(walked);
    for (let i = 0; i < 5; i++) {
      sb.step(TICK_RATE);
      for (const u of leaders) expect(project(laneFor(sb, u), u.pos).off, `fledgling ${u.id} on its path`).toBeLessThanOrEqual(laneFor(sb, u).halfWidth);
    }
    leaders.forEach((u, i) => {
      expect(walked(u) - (start[i] ?? 0), `${u.team} ${u.unit.lane}: metres in 5 s`).toBeCloseTo(MARCH_SPEED * 5, 0);
    });
  }, TIMEOUT_MS);
});

describe.runIf(PENDING)('fledgling targeting and attacks (GDD §7.1)', () => {
  /** A Dawn hero, a Dusk hero and the first wave; returns the Dawn Hedgerow leader 2 s after it spawned. */
  async function lead(): Promise<{ sb: Sandbox; ally: EntityId; foe: EntityId; f: UnitEntity; w: Wave }> {
    const sb = await match([
      { hero: 'albatross', team: 'dawn' },
      { hero: 'shrike', team: 'dusk' },
    ]);
    const [ally, foe] = sb.heroes as [EntityId, EntityId];
    const w = nextWave(sb);
    const f = front(sb, w.units, 'dawn', 'hedgerow');
    sb.step(ticks(2));
    keep(sb, ally, f, -20);
    keep(sb, foe, f, 60);
    sb.step();
    return { sb, ally, foe, f, w };
  }

  it('§7.1 rule 4 and the 18 m leash: an enemy hero within 10 m is targeted, and dropped beyond 18 m', async () => {
    const { sb, foe, f } = await lead();
    const near = stepWhile(sb, RETARGET, () => keep(sb, foe, f, AGGRO_HERO - 2), () => f.unit.target === foe);
    expect(near, 'targets the hero within 10 m').not.toBeNull();
    const gone = stepWhile(sb, RETARGET, () => keep(sb, foe, f, LEASH + 2), () => f.unit.target !== foe);
    expect(gone, 'drops the hero beyond 18 m').not.toBeNull();
  }, TIMEOUT_MS);

  it('§7.1 rule 2: an enemy hero within 14 m who hurt an allied hero in the last 2 s is targeted', async () => {
    const { sb, ally, foe, f } = await lead();
    const at = AGGRO_FLEDGLING - 2;
    expect(stepWhile(sb, RETARGET, () => keep(sb, foe, f, at), () => f.unit.target === foe), 'not at 12 m before it hurts anyone').toBeNull();
    sb.apply({ kind: 'damage', amount: 30, type: 'talon' }, ally, sb.cause(foe, { via: 'weapon' }));
    expect(stepWhile(sb, RETARGET, () => keep(sb, foe, f, at), () => f.unit.target === foe), 'once it hurt an allied hero').not.toBeNull();
  }, TIMEOUT_MS);

  it('§7.1 rule 3: an enemy structure in reach is attacked, for ×1.5 damage', async () => {
    const { sb, f, w } = await lead();
    const tower = sb.dummy({ kind: 'structure', type: 'hawk', team: 'dusk', at: offset(f.pos, marching(sb, f), 20), hp: 50_000, radius: 1.5, height: 6 });
    expect(sb.stepUntil(() => f.unit.target === tower, ticks(10)), 'targets the structure').not.toBeNull();
    const hits = hitsOver(sb, ticks(2.5), () => undefined, f.id, tower);
    expect(hits.length).toBeGreaterThan(0);
    for (const { e } of hits) expect(e.amount).toBeCloseTo(HIT.scrapper.dmg * scaling(w.tick) * VS_STRUCTURES, 6);
  }, TIMEOUT_MS);

  it('§7.1: a Scrapper hits for 20 Talon (+1.5%/min at spawn) every 1.0 s; a Slinger for 14 every 1.2 s', async () => {
    const { sb, foe, f, w } = await lead();
    const melee = hitsOver(sb, ticks(3.5), () => keep(sb, foe, f, 2), f.id, foe);
    expect(melee.length).toBeGreaterThanOrEqual(2);
    for (const { e } of melee) {
      expect([e.damageType, e.via]).toEqual(['talon', 'unit']);
      expect(e.amount).toBeCloseTo(HIT.scrapper.dmg * scaling(w.tick), 6);
    }
    for (let i = 1; i < melee.length; i++) expect((melee[i]?.tick ?? 0) - (melee[i - 1]?.tick ?? 0)).toBe(ticks(HIT.scrapper.everyS));

    const slinger = w.units.find((u) => u.team === 'dawn' && u.unit.lane === 'hedgerow' && u.unit.type === 'slinger');
    expect(slinger, 'a Dawn Hedgerow slinger').toBeDefined();
    const s = slinger as UnitEntity;
    const shots = hitsOver(sb, ticks(4), () => keep(sb, foe, s, AGGRO_HERO - 2), s.id, foe);
    expect(shots.length).toBeGreaterThanOrEqual(2);
    for (const { e } of shots) expect(e.amount).toBeCloseTo(HIT.slinger.dmg * scaling(w.tick), 6);
    for (let i = 1; i < shots.length; i++) expect((shots[i]?.tick ?? 0) - (shots[i - 1]?.tick ?? 0)).toBe(ticks(HIT.slinger.everyS));
  }, TIMEOUT_MS);

  it('§7.1 rule 1: when waves meet, enemy fledglings within 14 m come first, even with an enemy hero closer', async () => {
    const { sb, foe } = await lead();
    const contact = (): UnitEntity | undefined => {
      const units = live(sb);
      return units.find((a) => a.team === 'dawn' && units.some((b) => b.team === 'dusk' && dist(a.pos, b.pos) <= SURELY_IN_AGGRO));
    };
    expect(sb.stepUntil(() => contact() !== undefined, ticks(45)), 'the waves meet').not.toBeNull();
    const f = contact() as UnitEntity;
    stepWhile(sb, RETARGET, () => keep(sb, foe, f, -(AGGRO_HERO - 4)));
    const fighting = (a: UnitEntity): boolean => {
      const t = a.unit.target === null ? undefined : sb.ctx.store.getKind(a.unit.target, 'unit');
      return t !== undefined && isFledgling(t) && t.team !== a.team;
    };
    expect(fighting(f), 'targets an enemy fledgling, not the hero 6 m away').toBe(true);
    const units = live(sb);
    for (const a of units) {
      if (!units.some((b) => b.team !== a.team && dist(a.pos, b.pos) <= SURELY_IN_AGGRO)) continue;
      expect(fighting(a), `fledgling ${a.id} fights the enemy wave`).toBe(true);
    }
  }, TIMEOUT_MS);

  it('§7.1: a fledgling pulled more than 18 m off its path drops its target and walks back', async () => {
    const { sb, foe, f } = await lead();
    const l = laneFor(sb, f);
    const pull = (): void => {
      const p = project(l, f.pos);
      const len = Math.hypot(f.pos.x - p.point.x, f.pos.z - p.point.z);
      const out = len > 0.01 ? { x: (f.pos.x - p.point.x) / len, y: 0, z: (f.pos.z - p.point.z) / len } : { x: -p.dir.z, y: 0, z: p.dir.x };
      sb.place(foe, offset(f.pos, out, AGGRO_HERO - 4));
    };
    expect(stepWhile(sb, ticks(15), pull, () => project(l, f.pos).off > LEASH), 'chased the hero 18 m off its path').not.toBeNull();
    keep(sb, foe, f, 60);
    expect(sb.stepUntil(() => project(l, f.pos).off <= l.halfWidth, ticks(LEASH / MARCH_SPEED + 3)), 'walks back').not.toBeNull();
    expect(f.unit.target).not.toBe(foe);
  }, TIMEOUT_MS);
});

describe.runIf(PENDING)('wave composition over a match (GDD §7.1; slow: 20 sim minutes)', () => {
  it('§7.1: 24 per wave until 9:59, 30 from 10:00, 36 from 20:00; HP scaling fixed at spawn', async () => {
    const sb = await match();
    const waves: { wave: number; tick: number; scrapper: number; slinger: number; hp: number[] }[] = [];
    while (sb.sim.tick < ticks(BANDS[2].fromS + 2)) {
      sb.clearEvents();
      sb.step();
      for (const e of sb.eventsOf('wave.spawned')) waves.push({ wave: e.wave, tick: sb.sim.tick, scrapper: 0, slinger: 0, hp: [] });
      const current = waves.at(-1);
      if (!current || sb.sim.tick - current.tick >= TICK_RATE) continue;
      for (const u of spawnedUnits(sb)) {
        current[u.unit.type as FledglingType]++;
        if (u.unit.type === 'scrapper') current.hp.push(u.stats.final.maxHealth);
      }
    }
    for (const [n, band] of [[19, BANDS[0]], [20, BANDS[1]], [39, BANDS[1]], [40, BANDS[2]]] as const) {
      const w = waves.find((x) => x.wave === n);
      expect(w, `wave ${n}`).toBeDefined();
      expect([w?.scrapper, w?.slinger], `wave ${n} at ${(n * WAVE_EVERY_S) / 60} min`).toEqual([band.scrapper * GROUPS, band.slinger * GROUPS]);
    }
    const w20 = waves.find((x) => x.wave === 20);
    for (const hp of w20?.hp ?? []) expect(hp).toBeCloseTo(HP.scrapper * scaling(w20?.tick ?? 0), 6);
  }, LONG_TIMEOUT_MS);
});
