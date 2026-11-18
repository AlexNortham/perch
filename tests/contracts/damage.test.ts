// Damage pipeline contract suite, written test-first from GDD §5.2–§5.5, §5.9–§5.10, §7, §8.3, §8.9 and INTERFACES §6
// (D-EP-006). Always on since the W2 gate: `npx vitest run tests/contracts/damage.test.ts`.
//
// Everything goes through createSim and the sandbox: damage requests are `damage` effects applied through
// ctx.effects (INTERFACES §6.1, as abilities, items and world do), gun hits come from real firing. Expected numbers
// are the GDD's; data-dependent ones (gun damage, falloff ranges) are read from the hero's own data.
import { describe, expect, it } from 'vitest';
import type {
  DamageAppliedEvent,
  DamageEffect,
  DamageType,
  EffectVia,
  EntityId,
  StatModifier,
  Vec3,
} from '../../src/sim/core/contracts';
import { TICK_RATE } from '../../src/sim/data/core';
import { createSandbox } from '../helpers/sandbox';
import type { Sandbox } from '../helpers/sandbox';

const TIMEOUT_MS = 60_000;

/** GDD §5.4 default beak multiplier (combat.beakShotMult); a WeaponDef may override it (Owl ×2.0). */
const BEAK_MULT = 1.65;
/** GDD §5.5 falloff floor. */
const FALLOFF_FLOOR = 0.25;
/** GDD §5.3 resist clamp and §5.9 damage-amp cap. */
const RESIST_MAX = 0.85;
const RESIST_MIN = -0.5;
const AMP_CAP = 0.5;
/** GDD §8.3 assist window. */
const ASSIST_WINDOW_S = 12;
/** A kill shot. */
const LETHAL = 100_000;

interface Cast {
  sb: Sandbox;
  attacker: EntityId;
  ally: EntityId;
  support: EntityId;
  victim: EntityId;
}

/** Three Dawn heroes 5 m from one Dusk victim (inside every gun's falloff start). */
async function arena(): Promise<Cast> {
  const sb = await createSandbox({
    heroes: [
      { hero: 'shrike', team: 'dawn', at: { x: 0, y: 0, z: -5 } },
      { hero: 'albatross', team: 'dawn', at: { x: 3, y: 0, z: -5 } },
      { hero: 'lyrebird', team: 'dawn', at: { x: -3, y: 0, z: -5 } },
      { hero: 'kingfisher', team: 'dusk', at: { x: 0, y: 0, z: 0 } },
    ],
  });
  sb.step();
  const [attacker, ally, support, victim] = sb.heroes as [EntityId, EntityId, EntityId, EntityId];
  return { sb, attacker, ally, support, victim };
}

const damage = (amount: number, type: DamageType, extra: Partial<DamageEffect> = {}): DamageEffect => ({
  kind: 'damage',
  amount,
  type,
  ...extra,
});

/** Talon defaults to a gun-style request, Song to a direct ability hit (GDD §5.1). */
function viaFor(type: DamageType): EffectVia {
  return type === 'talon' ? 'weapon' : 'ability';
}

/** Request `amount` damage from `from` to `to`, step once, and return the hp lost and the damage.applied event. */
function hit(
  sb: Sandbox,
  from: EntityId | null,
  to: EntityId,
  amount: number,
  type: DamageType,
  opts: { via?: EffectVia; effect?: Partial<DamageEffect> } = {},
): { lost: number; event: DamageAppliedEvent | undefined } {
  const before = sb.health(to).hp;
  sb.clearEvents();
  sb.apply(damage(amount, type, opts.effect), to, sb.cause(from, { via: opts.via ?? viaFor(type) }));
  sb.step();
  const event = sb.eventsOf('damage.applied').find((e) => e.target === to);
  // A unit that dies leaves the store at the end of the tick (INTERFACES §6.4): it lost all it had.
  const after = sb.ctx.store.get(to) ? sb.health(to).hp : 0;
  return { lost: before - after, event };
}

const stat = (s: StatModifier['stat'], op: StatModifier['op'], value: number): { stats: StatModifier[] } => ({
  stats: [{ stat: s, op, value }],
});

describe('damage pipeline order (GDD §5.2, INTERFACES §6)', () => {
  it('§5.2 / INTERFACES §6.1–6.3: a request waits for the damage phase, then lands with a full damage.applied', async () => {
    const { sb, attacker, victim } = await arena();
    const max = sb.ctx.stats.get(victim, 'maxHealth');
    sb.clearEvents();
    sb.apply(damage(100, 'song'), victim, sb.cause(attacker));
    expect(sb.health(victim).hp, 'INTERFACES §6.1: requests queue until the damage phase').toBe(max);
    sb.step();
    expect(sb.health(victim).hp).toBeCloseTo(max - 100, 6);
    const events = sb.eventsOf('damage.applied');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      source: attacker,
      sourceTeam: 'dawn',
      target: victim,
      targetKind: 'hero',
      amount: 100,
      absorbed: 0,
      damageType: 'song',
      via: 'ability',
      beakShot: false,
      weakPoint: false,
      proc: false,
      lethal: false,
    });
  }, TIMEOUT_MS);

  it('§5.3: Talon resist reduces only Talon damage, Song resist only Song damage', async () => {
    const { sb, attacker, victim } = await arena();
    sb.modify(victim, 'talon', stat('talonResist', 'stack', 0.3));
    expect(hit(sb, attacker, victim, 100, 'talon').lost).toBeCloseTo(70, 6);
    expect(hit(sb, attacker, victim, 100, 'song').lost).toBeCloseTo(100, 6);
    sb.modify(victim, 'talon', null);
    sb.modify(victim, 'song', stat('songResist', 'stack', 0.3));
    expect(hit(sb, attacker, victim, 100, 'song').lost).toBeCloseTo(70, 6);
    expect(hit(sb, attacker, victim, 100, 'talon').lost).toBeCloseTo(100, 6);
  }, TIMEOUT_MS);

  it('§5.3: two 20% resists stack to 36%; shred is subtracted after stacking', async () => {
    const { sb, attacker, victim } = await arena();
    sb.modify(victim, 'a', stat('talonResist', 'stack', 0.2));
    sb.modify(victim, 'b', stat('talonResist', 'stack', 0.2));
    expect(hit(sb, attacker, victim, 100, 'talon').lost).toBeCloseTo(64, 6);
    sb.modify(victim, 'shred', stat('talonShred', 'add', 0.1));
    expect(hit(sb, attacker, victim, 100, 'talon').lost).toBeCloseTo(74, 6);
  }, TIMEOUT_MS);

  it('§5.3: final resist is clamped to [−50%, +85%]; negative resist amplifies', async () => {
    const { sb, attacker, victim } = await arena();
    sb.modify(victim, 'r', stat('songResist', 'stack', 0.95));
    expect(hit(sb, attacker, victim, 100, 'song').lost).toBeCloseTo(100 * (1 - RESIST_MAX), 6);
    sb.modify(victim, 'r', null);
    sb.modify(victim, 'shred', stat('songShred', 'add', 0.9));
    expect(hit(sb, attacker, victim, 100, 'song').lost).toBeCloseTo(100 * (1 - RESIST_MIN), 6);
  }, TIMEOUT_MS);

  it('§5.2 step 4: gun damage % applies to gun hits only, Song damage % to Song only', async () => {
    const { sb, attacker, victim } = await arena();
    sb.modify(attacker, 'gun', stat('gunDamage', 'add', 0.2));
    sb.modify(attacker, 'song', stat('songDamage', 'add', 0.25));
    expect(hit(sb, attacker, victim, 100, 'talon', { via: 'weapon' }).lost).toBeCloseTo(120, 6);
    expect(hit(sb, attacker, victim, 100, 'talon', { via: 'melee' }).lost, '§5.7: gun damage % never applies to melee').toBeCloseTo(100, 6);
    expect(hit(sb, attacker, victim, 100, 'song').lost).toBeCloseTo(125, 6);
  }, TIMEOUT_MS);

  it('§5.2 step 4: conditional bonuses add to the outgoing % (a ×1.5 bonus is +50%) and only when they hold', async () => {
    const { sb, attacker, victim } = await arena();
    sb.modify(attacker, 'song', stat('songDamage', 'add', 0.25));
    const bonus = [{ mult: 1.5, targetKinds: ['hero'] as const }, { mult: 2, targetKinds: ['unit'] as const }];
    expect(hit(sb, attacker, victim, 100, 'song', { effect: { bonus } }).lost).toBeCloseTo(175, 6);
  }, TIMEOUT_MS);

  it('§5.2 step 5, §5.9: incoming amplification adds across sources, per type, capped at +50%', async () => {
    const { sb, attacker, victim } = await arena();
    sb.modify(victim, 'amp1', stat('talonAmp', 'add', 0.2));
    sb.modify(victim, 'amp2', stat('talonAmp', 'add', 0.2));
    expect(hit(sb, attacker, victim, 100, 'talon').lost).toBeCloseTo(140, 6);
    expect(hit(sb, attacker, victim, 100, 'song').lost).toBeCloseTo(100, 6);
    sb.modify(victim, 'amp3', stat('talonAmp', 'add', 0.3));
    expect(hit(sb, attacker, victim, 100, 'talon').lost).toBeCloseTo(100 * (1 + AMP_CAP), 6);
  }, TIMEOUT_MS);

  it('§5.2 steps 6→8: shields absorb the damage left after resists', async () => {
    const { sb, attacker, support, victim } = await arena();
    sb.modify(victim, 'r', stat('talonResist', 'stack', 0.5));
    sb.apply({ kind: 'shield', absorbs: 'talon', amount: 30 }, victim, sb.cause(support));
    sb.step();
    expect(sb.health(victim).talonShield).toBeCloseTo(30, 6);
    const { lost, event } = hit(sb, attacker, victim, 100, 'talon');
    expect(lost).toBeCloseTo(20, 6);
    expect(sb.health(victim).talonShield).toBeCloseTo(0, 6);
    expect(event?.amount, 'amount is after step 7, absorbed part included').toBeCloseTo(50, 6);
    expect(event?.absorbed).toBeCloseTo(30, 6);
  }, TIMEOUT_MS);
});

describe('shields (GDD §5.10)', () => {
  it('§5.10: matching typed shield first, then barrier, then health; the other type is untouched', async () => {
    const { sb, attacker, support, victim } = await arena();
    const max = sb.ctx.stats.get(victim, 'maxHealth');
    const by = sb.cause(support);
    sb.apply({ kind: 'shield', absorbs: 'talon', amount: 30 }, victim, by);
    sb.apply({ kind: 'shield', absorbs: 'song', amount: 40 }, victim, by);
    sb.apply({ kind: 'shield', absorbs: 'barrier', amount: 50 }, victim, by);
    sb.step();
    hit(sb, attacker, victim, 100, 'talon');
    let h = sb.health(victim);
    expect([h.talonShield, h.songShield, h.barrier]).toEqual([0, 40, 0]);
    expect(h.hp).toBeCloseTo(max - 20, 6);
    hit(sb, attacker, victim, 100, 'song');
    h = sb.health(victim);
    expect(h.songShield).toBe(0);
    expect(h.hp).toBeCloseTo(max - 80, 6);
  }, TIMEOUT_MS);

  it('§5.10: several shields of one kind drain oldest first', async () => {
    const { sb, attacker, support, victim } = await arena();
    const by = sb.cause(support);
    sb.apply({ kind: 'shield', absorbs: 'talon', amount: 30, durationS: 1 }, victim, by);
    sb.step();
    sb.apply({ kind: 'shield', absorbs: 'talon', amount: 30 }, victim, by);
    sb.step();
    hit(sb, attacker, victim, 40, 'talon');
    expect(sb.health(victim).talonShield).toBeCloseTo(20, 6);
    // The drained (older, timed) shield expiring must not take the newer one's 20 with it.
    sb.step(TICK_RATE * 1.5);
    expect(sb.health(victim).talonShield).toBeCloseTo(20, 6);
  }, TIMEOUT_MS);
});

describe('structure rules and special states (GDD §5.2 step 7, §5.9, §7)', () => {
  async function withTower(): Promise<Cast & { tower: EntityId }> {
    const cast = await arena();
    const tower = cast.sb.dummy({ kind: 'structure', type: 'hawk', team: 'dusk', at: { x: 6, y: 0, z: 0 }, hp: 4500 });
    cast.sb.step();
    return { ...cast, tower };
  }

  it('§7: structures take full gun Talon, 50% melee, 50% Song from direct ability hits, nothing from areas or DoTs', async () => {
    const { sb, attacker, tower } = await withTower();
    expect(hit(sb, attacker, tower, 100, 'talon', { via: 'weapon' }).lost).toBeCloseTo(100, 6);
    expect(hit(sb, attacker, tower, 100, 'talon', { via: 'melee' }).lost).toBeCloseTo(50, 6);
    expect(hit(sb, attacker, tower, 100, 'song', { via: 'ability' }).lost).toBeCloseTo(50, 6);
    expect(hit(sb, attacker, tower, 100, 'song', { via: 'area' }).lost).toBe(0);
    expect(hit(sb, attacker, tower, 100, 'talon', { via: 'status' }).lost).toBe(0);
  }, TIMEOUT_MS);

  it('§7.6: Brood Ward (damageTaken ×0.35) applies after resists', async () => {
    const { sb, attacker, tower } = await withTower();
    sb.modify(tower, 'ward', stat('damageTaken', 'mul', 0.35));
    sb.modify(tower, 'armour', stat('talonResist', 'stack', 0.2));
    expect(hit(sb, attacker, tower, 100, 'talon').lost).toBeCloseTo(28, 6);
  }, TIMEOUT_MS);

  it('§7.7, §5.9: invulnerable and intangible take no damage; undying never drops below 1 hp', async () => {
    const { sb, attacker, victim, tower } = await withTower();
    sb.modify(tower, 'gate', { conditions: ['invulnerable'] });
    expect(hit(sb, attacker, tower, 100, 'talon').lost).toBe(0);
    sb.modify(victim, 'phase', { conditions: ['intangible'] });
    expect(hit(sb, attacker, victim, 100, 'talon').lost).toBe(0);
    sb.modify(victim, 'phase', null);
    sb.modify(victim, 'undying', { conditions: ['undying'] });
    hit(sb, attacker, victim, LETHAL, 'song');
    expect(sb.health(victim).hp).toBe(1);
    expect(sb.health(victim).dead).toBe(false);
    expect(sb.eventsOf('entity.died')).toHaveLength(0);
  }, TIMEOUT_MS);

  it('§5.2 step 9, §5.11: lifesteal heals by its % of post-step-7 damage, 100% from heroes and 50% from non-heroes', async () => {
    const { sb, attacker, victim } = await arena();
    const unit = sb.dummy({ kind: 'unit', type: 'scrapper', team: 'dusk', at: { x: -4, y: 0, z: 0 }, hp: 1000 });
    hit(sb, victim, attacker, 300, 'song');
    sb.modify(attacker, 'steal', stat('talonLifesteal', 'add', 0.5));
    sb.modify(victim, 'armour', stat('talonResist', 'stack', 0.2));
    const healthOf = (): number => sb.health(attacker).hp;
    let before = healthOf();
    hit(sb, attacker, victim, 100, 'talon');
    expect(healthOf() - before).toBeCloseTo(40, 6);
    before = healthOf();
    hit(sb, attacker, unit, 100, 'talon');
    expect(healthOf() - before).toBeCloseTo(25, 6);
    before = healthOf();
    hit(sb, attacker, victim, 100, 'song');
    expect(healthOf() - before, '§5.11: Talon lifesteal ignores Song damage').toBeCloseTo(0, 6);
  }, TIMEOUT_MS);
});

describe('gun hits: beak shots and falloff (GDD §5.4, §5.5)', () => {
  /** Owl shoots a Pelican `distance` m away along the arena diagonal (clear of its two props). */
  async function range(distance: number): Promise<{ sb: Sandbox; shooter: EntityId; target: EntityId }> {
    const half = distance / 2 / Math.SQRT2;
    const sb = await createSandbox({
      heroes: [
        { hero: 'owl', team: 'dawn', at: { x: -half, y: 0, z: -half } },
        { hero: 'pelican', team: 'dusk', at: { x: half, y: 0, z: half }, yaw: Math.PI },
      ],
    });
    sb.step();
    const [shooter, target] = sb.heroes as [EntityId, EntityId];
    return { sb, shooter, target };
  }

  /** Hold fire at the target's head or body for `seconds`; return the gun hits that landed on it. */
  function shoot(sb: Sandbox, shooter: EntityId, target: EntityId, part: 'head' | 'body', seconds: number): DamageAppliedEvent[] {
    sb.clearEvents();
    sb.aimAt(shooter, target, part);
    sb.fire(shooter);
    sb.step(Math.round(seconds * TICK_RATE));
    sb.fire(shooter, false);
    return sb.eventsOf('damage.applied').filter((e) => e.source === shooter && e.target === target && e.via === 'weapon');
  }

  const gun = (sb: Sandbox, shooter: EntityId): { dmg: number; mult: number; start: number; end: number } => {
    const w = sb.ctx.heroes[sb.hero(shooter).hero.heroId].def.weapon;
    return { dmg: sb.ctx.stats.get(shooter, 'weaponDamage'), mult: w.beakShotMult ?? BEAK_MULT, start: w.falloff.start, end: w.falloff.end };
  };

  it('§5.4: a bullet on the head is a beak shot for × the beak multiplier; a body shot is not', async () => {
    const { sb, shooter, target } = await range(6);
    const { dmg, mult } = gun(sb, shooter);
    const head = shoot(sb, shooter, target, 'head', 3);
    expect(head.some((e) => e.beakShot), 'some beak shots when aiming at the head').toBe(true);
    for (const e of head) expect(e.amount).toBeCloseTo(e.beakShot ? dmg * mult : dmg, 6);
    const body = shoot(sb, shooter, target, 'body', 3);
    expect(body.length).toBeGreaterThan(0);
    for (const e of body) expect([e.beakShot, e.amount]).toEqual([false, expect.closeTo(dmg, 6)]);
    expect(sb.sim.telemetry().heroes[0]?.beakShots, 'telemetry counts beak shots').toBe(head.filter((e) => e.beakShot).length);
  }, TIMEOUT_MS);

  it('§5.4, §7: units and structures are never beak-shot', async () => {
    const { sb, shooter, target } = await range(6);
    const { dmg } = gun(sb, shooter);
    const at = sb.entity(target).pos;
    sb.place(target, { x: 30, y: 0, z: -30 });
    const unit = sb.dummy({ kind: 'unit', type: 'scrapper', team: 'dusk', at, hp: 5000, height: 0.9 });
    sb.step();
    const unitHits = shoot(sb, shooter, unit, 'body', 2);
    expect(unitHits.length).toBeGreaterThan(0);
    for (const e of unitHits) expect([e.beakShot, e.amount]).toEqual([false, expect.closeTo(dmg, 6)]);
    sb.ctx.store.despawn(unit);
    const tower = sb.dummy({ kind: 'structure', type: 'hawk', team: 'dusk', at, hp: 5000, height: 2, radius: 1 });
    sb.step();
    // Aim at the top of the tower, where a head would be.
    const top: Vec3 = { x: at.x, y: 1.9, z: at.z };
    sb.clearEvents();
    sb.aimAt(shooter, top);
    sb.fire(shooter);
    sb.step(2 * TICK_RATE);
    const towerHits = sb.eventsOf('damage.applied').filter((e) => e.target === tower);
    expect(towerHits.length).toBeGreaterThan(0);
    for (const e of towerHits) expect(e.beakShot).toBe(false);
  }, TIMEOUT_MS);

  it('§5.5: 100% up to falloff start, linear to 25% at falloff end, 25% beyond', async () => {
    const probe = await range(10);
    const { start, end } = gun(probe.sb, probe.shooter);
    const cases = [
      { d: start * 0.5, frac: 1, tol: 1e-6 },
      // Mid-range the exact hit point moves the distance by up to ~1 m.
      { d: (start + end) / 2, frac: (1 + FALLOFF_FLOOR) / 2, tol: (1 - FALLOFF_FLOOR) / (end - start) },
      { d: end + 5, frac: FALLOFF_FLOOR, tol: 1e-6 },
    ];
    for (const c of cases) {
      const { sb, shooter, target } = await range(c.d);
      const { dmg, mult } = gun(sb, shooter);
      const hits = shoot(sb, shooter, target, 'body', 4);
      expect(hits.length, `gun hits at ${c.d} m`).toBeGreaterThan(0);
      expect(hits.some((e) => !e.beakShot), `body hits at ${c.d} m`).toBe(true);
      for (const e of hits) {
        // Spread (GDD §5.6) can lift a body-aimed bullet onto the head at range: a real beak shot, which §5.2 applies
        // after falloff, so divide it back out.
        const base = dmg * (e.beakShot ? mult : 1);
        expect(Math.abs(e.amount / base - c.frac), `damage fraction at ${c.d} m`).toBeLessThanOrEqual(c.tol);
      }
    }
  }, TIMEOUT_MS);
});

describe('kill credit, assists and respawn (GDD §8.3, §8.9, INTERFACES §6.4)', () => {
  it('§6.4, §8.3: the killing blow gets credit and allies who damaged the victim assist', async () => {
    const { sb, attacker, ally, support, victim } = await arena();
    hit(sb, ally, victim, 50, 'song');
    const { event } = hit(sb, attacker, victim, LETHAL, 'talon');
    expect(event?.lethal).toBe(true);
    const died = sb.eventsOf('entity.died');
    expect(died).toHaveLength(1);
    expect(died[0]).toMatchObject({
      victim,
      victimKind: 'hero',
      victimTeam: 'dusk',
      victimType: 'kingfisher',
      killer: attacker,
      creditHero: attacker,
      assisters: [ally],
    });
    expect(died[0]?.assisters).not.toContain(support);
    expect(sb.health(victim).dead).toBe(true);
    const tel = sb.sim.telemetry().heroes;
    expect([tel[0]?.kills, tel[1]?.assists, tel[3]?.deaths]).toEqual([1, 1, 1]);
  }, TIMEOUT_MS);

  it('§8.3: damage older than 12 s is no assist', async () => {
    const { sb, attacker, ally, victim } = await arena();
    hit(sb, ally, victim, 50, 'song');
    sb.step(Math.round((ASSIST_WINDOW_S + 0.5) * TICK_RATE));
    hit(sb, attacker, victim, LETHAL, 'talon');
    expect(sb.eventsOf('entity.died')[0]?.assisters).toEqual([]);
  }, TIMEOUT_MS);

  it('§8.3: shielding an ally who damaged the victim is an assist', async () => {
    const { sb, attacker, ally, support, victim } = await arena();
    hit(sb, ally, victim, 50, 'song');
    sb.apply({ kind: 'shield', absorbs: 'barrier', amount: 50 }, ally, sb.cause(support));
    sb.step();
    hit(sb, attacker, victim, LETHAL, 'talon');
    expect(sb.eventsOf('entity.died')[0]?.assisters).toEqual([ally, support]);
  }, TIMEOUT_MS);

  it('§6.4: a summon’s kill is credited to its owner', async () => {
    const { sb, attacker, victim } = await arena();
    const turret = sb.dummy({ kind: 'unit', type: 'summon', owner: attacker, team: 'dawn', at: { x: 1, y: 0, z: -2 }, hp: 300 });
    sb.step();
    hit(sb, turret, victim, LETHAL, 'song', { via: 'unit' });
    expect(sb.eventsOf('entity.died')[0]).toMatchObject({ victim, killer: turret, creditHero: attacker });
  }, TIMEOUT_MS);

  it('§6.4: a unit that dies is despawned and its killer credited', async () => {
    const { sb, attacker } = await arena();
    const unit = sb.dummy({ kind: 'unit', type: 'scrapper', team: 'dusk', at: { x: -4, y: 0, z: 0 }, hp: 260 });
    sb.step();
    hit(sb, attacker, unit, LETHAL, 'talon');
    expect(sb.eventsOf('entity.died')[0]).toMatchObject({
      victim: unit,
      victimKind: 'unit',
      victimType: 'scrapper',
      creditHero: attacker,
      assisters: [],
    });
    expect(sb.ctx.store.get(unit)).toBeUndefined();
    expect(sb.sim.telemetry().heroes[0]?.lastHits).toBe(1);
  }, TIMEOUT_MS);

  it('§8.9: a hero killed at 0:00 respawns 8 s later with full hp', async () => {
    const { sb, attacker, victim } = await arena();
    hit(sb, attacker, victim, LETHAL, 'talon');
    const diedAt = sb.sim.tick;
    const respawnAt = sb.health(victim).respawnAt;
    expect(respawnAt).not.toBeNull();
    expect(Math.abs((respawnAt ?? 0) - diedAt - 8 * TICK_RATE)).toBeLessThanOrEqual(1);
    const took = sb.stepUntil(() => sb.eventsOf('hero.respawned').length > 0, 10 * TICK_RATE);
    expect(took).not.toBeNull();
    expect(sb.health(victim).dead).toBe(false);
    expect(sb.health(victim).hp).toBe(sb.ctx.stats.get(victim, 'maxHealth'));
  }, TIMEOUT_MS);
});
