import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { Button } from '../core/contracts';
import type { HeroId, PlayerTeam } from '../core/contracts';
import { createKit } from './testkit';

const GUNS: readonly HeroId[] = ['kingfisher', 'albatross', 'shrike', 'owl', 'pelican', 'lyrebird'];
const HUGE = 1e9;

/** ms per tick of combat's phases (plus the spatial rebuild and despawn flush) for a 6v6 firefight. */
function measure(firing: boolean): { ms: number; hits: number; shots: number } {
  const k = createKit({ keepEvents: false });
  const heroes = (['dawn', 'dusk'] as PlayerTeam[]).flatMap((team) =>
    GUNS.map((id, i) => k.hero(id, team, { x: (i - 2.5) * 3, y: 0, z: team === 'dawn' ? -15 : 15 }, team === 'dawn' ? 0 : Math.PI)),
  );
  for (let i = 0; i < 150; i++) {
    const u = k.unit(i % 2 ? 'dawn' : 'dusk', { x: -30 + (i % 15) * 4, y: 0, z: -9 + Math.floor(i / 15) * 2 }, HUGE);
    u.health.hp = HUGE;
  }
  for (const h of heroes) {
    k.ctx.stats.setBase(h.id, { ...h.stats.base, maxHealth: HUGE });
    h.health.hp = HUGE;
    const foe = heroes.find((o) => o.team !== h.team && o.hero.heroId === h.hero.heroId);
    if (foe) k.aimAt(h, { x: foe.pos.x, y: 1.2, z: foe.pos.z });
    k.input(h, firing ? Button.Fire : 0);
  }
  let hits = 0;
  let shots = 0;
  k.ctx.bus.on('damage.applied', () => hits++);
  k.ctx.bus.on('weapon.fired', () => shots++);
  k.step(300);
  const ticks = 1800;
  const t0 = performance.now();
  k.step(ticks);
  return { ms: (performance.now() - t0) / ticks, hits, shots };
}

describe('performance', () => {
  it('12 heroes firing continuously with 150 units in the spatial hash stay inside the combat budget', () => {
    const idle = measure(false);
    const busy = measure(true);
    console.log(`combat: ${busy.ms.toFixed(3)} ms/tick firing (${idle.ms.toFixed(3)} idle), ${busy.shots} shots, ${busy.hits} hits`);
    expect(busy.shots).toBeGreaterThan(1000);
    expect(busy.hits).toBeGreaterThan(1000);
    // Combat's share of the 1 ms tick (ARCHITECTURE §8); measured ~0.09 ms on the dev machine.
    expect(busy.ms).toBeLessThan(0.3);
  });
});
