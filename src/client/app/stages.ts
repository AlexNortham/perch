/**
 * Staged start-up (D-ARCH-031). Owner: client/app. The page reaches `'menu'` once its first screen (the menu, or the
 * HUD of a `?scene=` match) is up and answering input; then the deferred work queue runs; `'world'` follows once the
 * queue is empty and the full scene has drawn. `window.__perch.stage` reports the stage and `__perch.ready` is true
 * from `'world'`, so the screenshot harness and the e2e suites see what they always did, and a spec that only needs
 * the menu can wait on `'menu'`.
 */

/** Load stages, in the order they come; they only move forward. */
export type LoadStage = 'boot' | 'menu' | 'world';

interface Job {
  readonly label: string;
  readonly run: () => void | Promise<void>;
}

const jobs: Job[] = [];
let started = false;
let running: Promise<void> | null = null;

/** Gives the browser a turn (paint, input) before the next job. */
const yieldToPage = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const drain = (): Promise<void> =>
  (running ??= (async () => {
    try {
      for (let job = jobs.shift(); job; job = jobs.shift()) {
        await yieldToPage();
        const start = performance.now();
        await job.run();
        performance.measure(`perch:job:${job.label}`, { start });
      }
    } finally {
      running = null;
    }
  })());

/**
 * Queue work that can wait until the first screen is up: scenery generation, model and portrait bakes, Web Worker
 * jobs. Any client module may call it, at any time. Jobs run in the order queued, one per browser task, each awaited,
 * so a job may hand its work to a Web Worker and resolve when the worker answers (inline the worker, Vite's
 * `?worker&inline`, so `build:single` still runs from file://). A job queued after the queue has started runs at the
 * next free moment. Each job's time is recorded as a `perch:job:<label>` performance measure.
 */
export function deferWork(label: string, run: () => void | Promise<void>): void {
  jobs.push({ label, run });
  if (started) void drain().catch(reportLate);
}

/** The app starts the queue once at 'menu'; resolves when it is empty and rejects with the first job that throws. */
export function runDeferred(): Promise<void> {
  started = true;
  return drain();
}

/** A job queued after 'world' that throws has no one awaiting it: say so instead of failing silently. */
function reportLate(err: unknown): void {
  console.error('PERCH deferred work failed:', err);
}
