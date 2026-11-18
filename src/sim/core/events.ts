import { MAX_EVENTS_PER_TICK } from '../data/core';

/**
 * Typed, synchronous, deterministic event bus with a per-step log.
 *
 * - Handlers run in subscription order. Systems subscribe while they are created, and createSim creates them in a
 *   fixed order, so delivery order is fixed.
 * - Dispatch is FIFO (breadth-first): an event emitted by a handler is delivered after every handler of the current
 *   event has run. `emit` therefore returns before nested events are delivered when called from inside a handler.
 * - Every emitted event is appended to the log in emission order. The log holds one step's events: the sim clears
 *   it at the start of each step, and the client drains it after each step.
 */
export interface Bus<E extends { readonly type: string }> {
  on<T extends E['type']>(type: T, handler: (event: Extract<E, { type: T }>) => void): () => void;
  emit(event: E): void;
  /** Return the events logged since the last drain or clear, and empty the log. */
  drain(): E[];
  /** Empty the log and reset the per-step event guard. */
  clearLog(): void;
}

export function createBus<E extends { readonly type: string }>(): Bus<E> {
  const handlers = new Map<string, ((event: E) => void)[]>();
  const queue: E[] = [];
  let log: E[] = [];
  let dispatching = false;
  let emittedThisStep = 0;

  return {
    on(type, handler) {
      const h = handler as (event: E) => void;
      // Copy-on-write, so a subscription made during dispatch never changes the list being iterated.
      handlers.set(type, [...(handlers.get(type) ?? []), h]);
      return () => {
        const current = handlers.get(type);
        if (current) handlers.set(type, current.filter((x) => x !== h));
      };
    },
    emit(event) {
      if (++emittedThisStep > MAX_EVENTS_PER_TICK) {
        throw new Error(`event loop: more than ${MAX_EVENTS_PER_TICK} events in one step (last: ${event.type})`);
      }
      log.push(event);
      queue.push(event);
      if (dispatching) return;
      dispatching = true;
      try {
        for (let i = 0; i < queue.length; i++) {
          const e = queue[i] as E;
          const list = handlers.get(e.type);
          if (list) for (const h of list) h(e);
        }
      } finally {
        queue.length = 0;
        dispatching = false;
      }
    },
    drain() {
      const out = log;
      log = [];
      return out;
    },
    clearLog() {
      log = [];
      emittedThisStep = 0;
    },
  };
}
