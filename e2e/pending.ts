/**
 * Stage 4 browser specs are written test-first (D-EP-006) and skipped in `npm run check` until their wave 5 owner lands
 * them. Run them with `PERCH_PENDING=1 npx playwright test e2e/<spec> --workers=1`. A spec that calls
 * `test.skip(isPending, PENDING_REASON)` in its describe block flips to always-on at the wave gate by deleting that line.
 */
export const isPending = process.env.PERCH_PENDING !== '1';
export const PENDING_REASON = 'pending: Stage 4 (wave 5) implementation; run with PERCH_PENDING=1';
