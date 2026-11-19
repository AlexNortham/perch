// No Interact key (D-EP-039, GDD §3.7, INTERFACES §14.4). Written test-first (D-EP-006, W4.5 QA): gated until Physics,
// Input and sim/ai land held-Jump latching in wave 5. Run with PERCH_PENDING=1 npx vitest run tests/rules/no-interact.test.ts
import { describe, expect, it } from 'vitest';
import { Button, type EntityId, type HeroEntity, type Vec3 } from '../../src/sim/core/contracts';
import { allBotRoster, createSim } from '../../src/sim/index';
import { TICK_RATE } from '../../src/sim/data/core';
import { createSandbox, type Sandbox } from '../helpers/sandbox';

const LATCH_HOLD_S = 0.2;
const CABLE_ABOVE_M = 12;
const RIDE_MS = 11;
const JUMP_OFF_UP_MS = 4;
const JUMP_OFF_KEEP = 0.7;
const DAMAGE_LOCKOUT_S = 3;
const LEAVE_LOCKOUT_S = 1;
const BOT_MATCH_S = 240;

const t = (s: number) => Math.ceil(s * TICK_RATE);
const lerp = (a: Vec3, b: Vec3, f: number): Vec3 => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f });

async function line(extra: 'foe' | null = null) {
  const sb = await createSandbox({
    map: 'main', heroes: extra ? ['shrike', 'lyrebird'] : ['shrike'], options: { structures: false, unlockAbilities: false },
  });
  const hero = sb.heroes[0]!;
  const cable = sb.ctx.map.updrafts.find((u) => u.lane === 'riverbank')!;
  /** A point on the ground under the cable, `f` of the way along its first segment, offset sideways by `off` m. */
  const under = (f: number, off = 1.5): Vec3 => {
    const p = lerp(cable.points[0]!, cable.points[1]!, f);
    return { x: p.x + off, y: p.y - CABLE_ABOVE_M, z: p.z };
  };
  return { sb, hero, foe: sb.heroes[1], cable, under };
}

const h = (sb: Sandbox, id: EntityId): HeroEntity => sb.hero(id);
const riding = (sb: Sandbox, id: EntityId) => h(sb, id).motor.updraft !== null;

describe.runIf(process.env.PERCH_PENDING === '1')('W5 no Interact: Updraft latch and dismount (§3.7, D-EP-039)', () => {
  it.each([0.1, 0.3, 0.5, 0.7, 0.9])('§3.7 holding Jump 0.2 s within reach latches anywhere along the cable (%s of the first segment), not only at a station', async (f) => {
    const { sb, hero, under } = await line();
    sb.place(hero, under(f));
    sb.step(3);
    sb.hold(hero, Button.Jump);
    sb.step(t(1));
    expect(riding(sb, hero), `latched at ${f}`).toBe(true);
  });

  it('§3.7 a tap of Jump never latches, and a hold shorter than 0.2 s does not either', async () => {
    const { sb, hero, under } = await line();
    sb.place(hero, under(0.5));
    sb.step(3);
    sb.press(hero, Button.Jump);
    sb.step(t(1.2));
    expect(riding(sb, hero), 'tap').toBe(false);
    sb.place(hero, under(0.5));
    sb.step(t(0.6));
    sb.hold(hero, Button.Jump);
    sb.step(t(LATCH_HOLD_S / 2));
    sb.release(hero, Button.Jump);
    sb.step(t(1));
    expect(riding(sb, hero), 'half a latch').toBe(false);
  });

  it('D-EP-039 the Interact bit does nothing: pressing or holding it beside the cable never mounts', async () => {
    const { sb, hero, under } = await line();
    sb.place(hero, under(0.5));
    sb.step(3);
    sb.press(hero, Button.Interact);
    sb.step(t(0.5));
    sb.hold(hero, Button.Interact);
    sb.step(t(1));
    expect(riding(sb, hero)).toBe(false);
  });

  it('§3.7 reach: feet more than 2.5 m horizontally from the line cannot latch; motor.updraftInReach is set inside reach and null outside, and the view carries it for the HUD prompt', async () => {
    const { sb, hero, under } = await line();
    sb.place(hero, under(0.5, 6));
    sb.step(3);
    expect(h(sb, hero).motor.updraftInReach ?? null, 'out of reach').toBeNull();
    sb.hold(hero, Button.Jump);
    sb.step(t(1));
    expect(riding(sb, hero), 'out of reach: no latch').toBe(false);
    sb.release(hero, Button.Jump);
    sb.place(hero, under(0.5, 2));
    sb.step(3);
    expect(h(sb, hero).motor.updraftInReach, 'in reach').not.toBeNull();
    expect(sb.view.heroes.find((v) => v.id === hero)?.updraftInReach).toBe(true);
  });

  it('§3.7 holding Jump through the whole ride does nothing: you stay on the cable at ride speed until you let go and press again', async () => {
    const { sb, hero, under } = await line();
    sb.place(hero, under(0.5));
    sb.step(3);
    sb.hold(hero, Button.Jump);
    sb.step(t(1));
    expect(riding(sb, hero)).toBe(true);
    sb.step(t(2));
    expect(riding(sb, hero), 'still riding with Jump held').toBe(true);
    const v = h(sb, hero).vel;
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(RIDE_MS, 0);
  });

  it('§3.7 dismount: a fresh Jump press (released since latching) jumps off with +4 m/s up and 70% of the ride velocity', async () => {
    const { sb, hero, under } = await line();
    sb.place(hero, under(0.5));
    sb.step(3);
    sb.hold(hero, Button.Jump);
    sb.step(t(1));
    sb.release(hero, Button.Jump);
    sb.step(t(0.3));
    expect(riding(sb, hero)).toBe(true);
    const ride = Math.hypot(h(sb, hero).vel.x, h(sb, hero).vel.z);
    sb.press(hero, Button.Jump);
    sb.step(2);
    expect(riding(sb, hero), 'off the cable').toBe(false);
    const v = h(sb, hero).vel;
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(ride * JUMP_OFF_KEEP, 0);
    expect(v.y).toBeGreaterThan(JUMP_OFF_UP_MS - 1);
  });

  it('§3.7 dismount: Crouch drops you off with 70% of the ride velocity and no upward kick', async () => {
    const { sb, hero, under } = await line();
    sb.place(hero, under(0.5));
    sb.step(3);
    sb.hold(hero, Button.Jump);
    sb.step(t(1));
    sb.release(hero, Button.Jump);
    sb.step(t(0.3));
    const ride = Math.hypot(h(sb, hero).vel.x, h(sb, hero).vel.z);
    sb.press(hero, Button.Crouch);
    sb.step(2);
    expect(riding(sb, hero)).toBe(false);
    expect(Math.hypot(h(sb, hero).vel.x, h(sb, hero).vel.z)).toBeCloseTo(ride * JUMP_OFF_KEEP, 0);
    expect(h(sb, hero).vel.y).toBeLessThan(JUMP_OFF_UP_MS - 1);
  });

  it('§3.7 lockouts: no latch for 3 s after enemy hero damage, or 1.0 s after leaving an Updraft', async () => {
    const { sb, hero, foe, under } = await line('foe');
    sb.modify(hero, 'qa-hp', { stats: [{ stat: 'maxHealth', op: 'add', value: 100_000 }] });
    sb.place(hero, under(0.5));
    sb.step(3);
    sb.apply({ kind: 'damage', amount: 10, type: 'talon' }, hero, sb.cause(foe!, { via: 'weapon' }));
    sb.hold(hero, Button.Jump);
    sb.step(t(DAMAGE_LOCKOUT_S - 0.6));
    expect(riding(sb, hero), 'inside the 3 s damage lockout').toBe(false);
    sb.step(t(1.5));
    expect(riding(sb, hero), 'after the lockout').toBe(true);
    sb.release(hero, Button.Jump);
    sb.step(t(0.2));
    sb.press(hero, Button.Crouch);
    sb.step(2);
    expect(riding(sb, hero)).toBe(false);
    sb.place(hero, under(0.5));
    sb.hold(hero, Button.Jump);
    sb.step(t(LEAVE_LOCKOUT_S / 2));
    expect(riding(sb, hero), 'inside the 1.0 s leave lockout').toBe(false);
  });

  it('§3.7 the Egg carrier cannot latch', async () => {
    const { sb, hero, under } = await line();
    sb.modify(hero, 'qa-egg', { conditions: ['eggCarrier'] });
    sb.place(hero, under(0.5));
    sb.step(3);
    sb.hold(hero, Button.Jump);
    sb.step(t(1));
    expect(riding(sb, hero)).toBe(false);
  });
});

describe.runIf(process.env.PERCH_PENDING === '1')('W5 no Interact: nothing in the sim asks for it (D-EP-039, INTERFACES §14.4)', () => {
  it('no command a hero runs on, human script or bot, ever carries the Interact bit; bots mount Updrafts by holding Jump', async () => {
    const sim = await createSim({ seed: 1, roster: allBotRoster(1) });
    let interactTicks = 0;
    let mounted = 0;
    const wasRiding = new Set<EntityId>();
    for (let i = 0; i < BOT_MATCH_S * TICK_RATE; i++) {
      sim.step([]);
      for (const hero of sim.ctx.store.list('hero')) {
        if (((hero.command.held | hero.command.pressed) & Button.Interact) !== 0) interactTicks++;
        const on = hero.motor.updraft !== null;
        if (on && !wasRiding.has(hero.id)) mounted++;
        if (on) wasRiding.add(hero.id);
        else wasRiding.delete(hero.id);
      }
    }
    expect(interactTicks, 'no Interact bit in any command').toBe(0);
    expect(mounted, 'bots still ride Updrafts, on held Jump').toBeGreaterThan(0);
  }, 300_000);

  it('GDD §3.1: the default bindings have no interact action (the Stage 3 default KeyE is gone)', async () => {
    const { DEFAULT_BINDINGS } = await import('../../src/client/app/bindings');
    expect(Object.keys(DEFAULT_BINDINGS)).not.toContain('interact');
    expect(Object.values(DEFAULT_BINDINGS)).not.toContain('KeyE');
  });
});
