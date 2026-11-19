// Node and the browser must hash identically (ARCHITECTURE §determinism, D-ARCH-021). The same seeded scripts run in
// the Playwright runner (Node) and in the app's page (Edge, through the Vite dev server); the per-tick hashes must
// match from tick 0. Before D-ARCH-021 the siege diverged at tick 3 because V8 versions round Math.sin & co differently.
import { expect, test } from '@playwright/test';
import { open } from './game';
import { hashTrace, TRACES, type TraceName } from './hash-trace';

const TRACE_TIMEOUT_MS = 120_000;
// A runtime string, so neither TypeScript nor Playwright's loader resolves it; Vite serves the module to the page.
const TRACE_MODULE = '/e2e/hash-trace.ts';

for (const name of Object.keys(TRACES) as TraceName[]) {
  test(`${name}: the browser hashes every tick exactly as Node does`, async ({ page }) => {
    test.setTimeout(TRACE_TIMEOUT_MS);
    await open(page, '/');
    const inPage = await page.evaluate(
      async ([url, trace]) => ((await import(url)) as typeof import('./hash-trace')).hashTrace(trace),
      [TRACE_MODULE, name] as const,
    );
    const inNode = await hashTrace(name);
    const first = inNode.findIndex(([tick, hash], i) => inPage[i]?.[0] !== tick || inPage[i]?.[1] !== hash);
    expect(first, first < 0 ? '' : `first difference at tick ${inNode[first]?.[0]}: Node ${inNode[first]?.[1]}, browser ${inPage[first]?.[1]}`).toBe(-1);
    expect(inPage).toHaveLength(inNode.length);
  });
}
