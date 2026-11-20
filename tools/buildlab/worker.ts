// Build Lab worker: one match per process (a crash or a leak stays here). The parent sends a MatchJob over IPC and
// gets back { record } or { error }.
import { runMatch, type MatchJob } from './match';

process.once('message', (job: MatchJob) => {
  const started = performance.now();
  runMatch(job).then(
    (record) => process.send?.({ record, wallSeconds: (performance.now() - started) / 1000 }, () => process.exit(0)),
    (err: unknown) => process.send?.({ error: err instanceof Error ? (err.stack ?? err.message) : String(err) }, () => process.exit(1)),
  );
});
