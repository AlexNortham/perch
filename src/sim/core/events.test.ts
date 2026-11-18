import { describe, expect, it } from 'vitest';
import { createBus } from './events';

type E = { type: 'a'; n: number } | { type: 'b'; n: number };

describe('event bus', () => {
  it('delivers in subscription order and logs in emission order', () => {
    const bus = createBus<E>();
    const seen: string[] = [];
    bus.on('a', (e) => seen.push(`first ${e.n}`));
    bus.on('a', (e) => seen.push(`second ${e.n}`));
    bus.emit({ type: 'a', n: 1 });
    expect(seen).toEqual(['first 1', 'second 1']);
    expect(bus.drain()).toEqual([{ type: 'a', n: 1 }]);
    expect(bus.drain()).toEqual([]);
  });

  it('is FIFO: events emitted by a handler run after the current event finishes', () => {
    const bus = createBus<E>();
    const seen: string[] = [];
    bus.on('a', () => {
      seen.push('a1');
      bus.emit({ type: 'b', n: 2 });
    });
    bus.on('a', () => seen.push('a2'));
    bus.on('b', () => seen.push('b'));
    bus.emit({ type: 'a', n: 1 });
    expect(seen).toEqual(['a1', 'a2', 'b']);
    expect(bus.drain().map((e) => e.type)).toEqual(['a', 'b']);
  });

  it('unsubscribes and recovers after a throwing handler', () => {
    const bus = createBus<E>();
    let calls = 0;
    const off = bus.on('a', () => calls++);
    off();
    bus.emit({ type: 'a', n: 1 });
    expect(calls).toBe(0);
    const offThrow = bus.on('b', () => {
      throw new Error('boom');
    });
    expect(() => bus.emit({ type: 'b', n: 1 })).toThrow('boom');
    offThrow();
    bus.on('a', () => calls++);
    bus.emit({ type: 'a', n: 2 });
    expect(calls).toBe(1);
  });

  it('throws on a runaway event loop', () => {
    const bus = createBus<E>();
    bus.on('a', (e) => bus.emit({ type: 'a', n: e.n + 1 }));
    expect(() => bus.emit({ type: 'a', n: 0 })).toThrow(/event loop/);
  });
});
