/* eslint-disable no-restricted-properties -- a benchmark measures wall time; the clock never reaches the sim */
/** The abilities phase's time budget (D-EP-022): serial, in `npm run perf`, median of PERF_RUNS runs. */
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import type { HeroId, HeroModule } from '../core/contracts';
import { medianRun, PERF_RUNS } from '../../../tests/helpers/perf';
import { createHarness } from './testkit';
import { kingfisher, lyrebird, press, shrike } from './fixtures';

describe('performance', () => {
  const now = () => performance.now();

  /** 12 heroes with the three kits press an ability every 10 ticks; cooldowns are wiped every `wipe` ticks. */
  function measure(wipe: number): { ms: number; live: number } {
    const ids: HeroId[] = ['shrike', 'lyrebird', 'kingfisher', 'owl', 'pelican', 'swan', 'puffin', 'vulture', 'swift', 'kiwi', 'toucan', 'flamingo'];
    const kits = [shrike, lyrebird, kingfisher];
    const heroes = Object.fromEntries(ids.map((id, i) => [id, kits[i % kits.length] as HeroModule])) as Partial<Record<HeroId, HeroModule>>;
    let spent = 0;
    const t = createHarness({
      heroes,
      unlockAbilities: true,
      wrapPhase: (phase) => {
        const t0 = now();
        phase();
        spent += now() - t0;
      },
    });
    const team = ids.map((id, i) =>
      i < 6 ? t.hero(id, 'dawn', { x: i * 3 - 7.5, y: 0, z: -8 }, 0) : t.hero(id, 'dusk', { x: (i - 6) * 3 - 7.5, y: 0, z: 8 }, Math.PI),
    );
    let live = 0;
    const run = (ticks: number) => {
      for (let k = 0; k < ticks; k++) {
        const tick = t.ctx.clock.tick + 1;
        if (tick % wipe === 0) for (const h of team) for (const s of h.abilities.slots) Object.assign(s, { charges: 2, readyAt: 0, cooldownTicks: 0 });
        const pressed = (i: number) => ((tick + i) % 10 === 0 ? press(Math.floor((tick + i) / 10) % 4).pressed : 0);
        t.step(1, team.map((h, i) => [h, { pitch: -0.35, yaw: h.yaw, pressed: pressed(i) }] as const));
        live += t.ctx.store.list('area').length + t.ctx.store.list('unit').length;
      }
    };
    run(600);
    spent = 0;
    live = 0;
    const measured = 1800;
    run(measured);
    return { ms: spent / measured, live: live / measured };
  }

  it('12 heroes casting with ~30 areas and summons live stays inside the abilities share of the budget', () => {
    const brief = medianRun(PERF_RUNS, () => measure(300), (r) => r.ms);
    const stress = measure(60);
    console.log(
      `abilities phase: ${brief.ms.toFixed(4)} ms/tick with ${brief.live.toFixed(1)} areas+summons live; ` +
        `${stress.ms.toFixed(4)} ms/tick with ${stress.live.toFixed(1)}`,
    );
    expect(brief.live).toBeGreaterThan(25);
    expect(brief.ms).toBeLessThan(0.3);
  });
});

