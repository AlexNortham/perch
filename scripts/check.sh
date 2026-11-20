#!/usr/bin/env bash
# Merge gate: typecheck, lint, unit tests, serial timing tests (perf), a 3-minute headless sim (seed 1, 12 bots), the e2e smoke test.
# Stops at the first failure. One PASS/FAIL line per step; each step's full output is in out/check/<step>.log.
set -u
cd "$(dirname "$0")/.."
mkdir -p out/check
started=$(date +%s)

step() {
  local name=$1 t0 secs
  shift
  t0=$(date +%s)
  if "$@" >"out/check/$name.log" 2>&1; then
    printf 'PASS  %-9s %4ss\n' "$name" "$(($(date +%s) - t0))"
  else
    secs=$(($(date +%s) - t0))
    tail -n 30 "out/check/$name.log"
    printf 'FAIL  %-9s %4ss  (full log: out/check/%s.log)\n' "$name" "$secs" "$name"
    exit 1
  fi
}

# Parallel workers (D-BUILD-010): half the logical cores for the unit tests, at most 8, and a quarter for the browser
# suites, at most 4, so agents sharing the machine don't push tests past their timeouts. Override with
# PERCH_TEST_WORKERS and PERCH_E2E_WORKERS.
cores=$(nproc 2>/dev/null || echo 4)
clamp() { local n=$1 max=$2; ((n < 1)) && n=1; ((n > max)) && n=$max; echo "$n"; }
test_workers=${PERCH_TEST_WORKERS:-$(clamp $((cores / 2)) 8)}
e2e_workers=${PERCH_E2E_WORKERS:-$(clamp $((cores / 4)) 4)}

step typecheck npm run typecheck
step lint npm run lint
step test npm test -- --maxWorkers="$test_workers"
step perf npm run perf
step sim npm run sim -- --seed 1 --minutes 3 --bots 12 --out out/check/telemetry-seed-1.json
step e2e npm run e2e -- --workers="$e2e_workers"
printf 'PASS  check     %4ss\n' "$(($(date +%s) - started))"
