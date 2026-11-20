import { describe, expect, it } from 'vitest';
import { deferWork, runDeferred } from './stages';

describe('deferred work (D-ARCH-031)', () => {
  it('waits for the start, runs jobs in order one task apart, awaits async ones and runs late jobs at once', async () => {
    const log: string[] = [];
    deferWork('a', () => void log.push('a'));
    deferWork('worker', () => new Promise<void>((resolve) => setTimeout(() => { log.push('worker'); resolve(); }, 5)));
    deferWork('b', () => void log.push('b'));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(log).toEqual([]);

    const done = runDeferred();
    log.push('sync');
    await done;
    expect(log).toEqual(['sync', 'a', 'worker', 'b']);
    expect(performance.getEntriesByName('perch:job:worker', 'measure')).toHaveLength(1);

    let late: () => void = () => {};
    const ran = new Promise<void>((resolve) => (late = resolve));
    deferWork('late', () => late());
    await ran;
  });

  it('rejects with a failing job and keeps the rest queued for the next run', async () => {
    const log: string[] = [];
    deferWork('boom', () => {
      throw new Error('no WebGL');
    });
    deferWork('after', () => void log.push('after'));
    await expect(runDeferred()).rejects.toThrow('no WebGL');
    await runDeferred();
    expect(log).toEqual(['after']);
  });
});
