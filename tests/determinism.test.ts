// Determinism (ARCHITECTURE.md §4, §10): same seed + same commands ⇒ the same hash(), events and telemetry.
// Two sims run in lockstep so a divergence is caught at the first checkpoint after it happens.
import { describe, expect, it } from 'vitest';
import { ABILITY_BUTTONS, Button, IDLE_COMMAND } from '../src/sim/core/contracts';
import type { EntityId, HeroCommand, PlayerCommand, Sim } from '../src/sim/core/contracts';
import { createSim, humanRoster } from '../src/sim/index';
import { TICK_RATE } from '../src/sim/data/core';

const MINUTES = 3;
const TICKS = MINUTES * 60 * TICK_RATE;
/** Compare hashes every 10 s of sim time. */
const CHECK_EVERY = 10 * TICK_RATE;
const SEED = 1;
const OTHER_SEED = 2;
const OTHER_SEED_TICKS = 60 * TICK_RATE;
const TIMEOUT_MS = 300_000;

/**
 * The scripted human: a pure function of the tick that walks, strafes, turns, looks up and down, jumps, dashes,
 * crouches, fires in bursts, reloads, melees, parries, swaps shoulders, casts all four abilities, spends AP and pings.
 */
function script(tick: number): PlayerCommand {
  const t = tick / TICK_RATE;
  let held = 0;
  let pressed = 0;
  const every = (s: number, offset = 0): boolean => (tick + Math.round(offset * TICK_RATE)) % Math.round(s * TICK_RATE) === 0;
  if (t % 4 < 2.5) held |= Button.Fire;
  if (t % 9 > 7) held |= Button.Aim;
  if (t % 11 > 10) held |= Button.Crouch;
  if (every(2)) pressed |= Button.Jump;
  if (every(5, 1)) pressed |= Button.Dash;
  if (every(7, 3)) pressed |= Button.Reload;
  if (every(6, 2)) pressed |= Button.Melee;
  if (every(13, 4)) pressed |= Button.Parry;
  if (every(17, 5)) pressed |= Button.ShoulderSwap;
  ABILITY_BUTTONS.forEach((b, slot) => {
    if (every(3 + slot * 4, slot)) pressed |= b;
  });
  held |= pressed;
  return {
    ...IDLE_COMMAND,
    forward: Math.sin(t * 0.7),
    right: Math.cos(t * 0.4),
    yaw: t * 0.5,
    pitch: Math.sin(t * 0.3) * 0.6,
    held,
    pressed,
    upgrade: every(20, 7) ? Math.floor(t / 20) % 4 : null,
    ping: every(15, 9) ? { kind: 'attack', pos: { x: Math.sin(t) * 20, y: 0, z: Math.cos(t) * 20 }, target: null } : null,
  };
}

/** FNV-1a over the JSON of each step's events: a cheap digest of the whole event stream. */
function eventDigest(): { add(text: string): void; value(): number } {
  let h = 0x811c9dc5;
  return {
    add(text) {
      for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
    },
    value: () => h >>> 0,
  };
}

async function start(seed: number): Promise<{ sim: Sim; human: EntityId; events: ReturnType<typeof eventDigest> }> {
  // 1 scripted human + 11 bots: the full 6v6 the `match` scene plays.
  const sim = await createSim({ seed, roster: humanRoster(seed, 'shrike') });
  const human = sim.view.localHero;
  expect(human).not.toBeNull();
  const events = eventDigest();
  events.add(JSON.stringify(sim.drainEvents()));
  return { sim, human: human as EntityId, events };
}

function stepOnce(run: Awaited<ReturnType<typeof start>>): void {
  const commands: HeroCommand[] = [{ hero: run.human, command: script(run.sim.tick + 1) }];
  run.sim.step(commands);
  run.events.add(JSON.stringify(run.sim.drainEvents()));
}

describe('determinism', () => {
  it(
    `same seed and command script: identical hash, events and telemetry over ${MINUTES} sim minutes`,
    async () => {
      const a = await start(SEED);
      const b = await start(SEED);
      expect(a.sim.hash()).toBe(b.sim.hash());
      const checkpoints = new Map<number, string>();
      for (let tick = 1; tick <= TICKS; tick++) {
        stepOnce(a);
        stepOnce(b);
        if (tick % CHECK_EVERY !== 0) continue;
        const ha = a.sim.hash();
        expect(b.sim.hash(), `hash diverged by tick ${tick} (${tick / TICK_RATE} s)`).toBe(ha);
        expect(b.events.value(), `event stream diverged by tick ${tick}`).toBe(a.events.value());
        checkpoints.set(tick, ha);
      }
      expect(a.sim.tick).toBe(TICKS);
      expect(b.sim.telemetry()).toEqual(a.sim.telemetry());
      expect(b.sim.view).toEqual(a.sim.view);

      // Another seed must run without crashing and end somewhere else.
      const c = await start(OTHER_SEED);
      for (let tick = 1; tick <= OTHER_SEED_TICKS; tick++) stepOnce(c);
      expect(c.sim.tick).toBe(OTHER_SEED_TICKS);
      expect(c.sim.hash()).not.toBe(checkpoints.get(OTHER_SEED_TICKS));
      expect(() => c.sim.telemetry()).not.toThrow();
    },
    TIMEOUT_MS,
  );
});
