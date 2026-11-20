#!/usr/bin/env bash
# Stage 4 Release 1 gate (D-EP-050, D-QA-0xx): 20 seeded headless 6v6 bot matches, each of which must end with a winner
# and not crash. Seeds 1..20, up to 60 simulated minutes each. Summary: out/telemetry/release-matches.json.
set -u
cd "$(dirname "$0")/.."
npm run sim -- --seed 1 --matches 20 --minutes 60 --bots 12 --parallel "${PERCH_MATCH_WORKERS:-3}" --out out/telemetry/release-matches.json || exit 1
node -e '
const s = JSON.parse(require("fs").readFileSync("out/telemetry/release-matches.json", "utf8"));
const none = s.results.filter((r) => !r.winner).map((r) => r.seed);
console.log(`release-matches: ${s.completed} completed, ${s.crashed} crashed, ${none.length} without a winner${none.length ? " (seeds " + none.join(", ") + ")" : ""}, wins ${JSON.stringify(s.wins)}, length ${s.matchMinutes.min.toFixed(1)}-${s.matchMinutes.max.toFixed(1)} min`);
process.exit(s.completed === 20 && s.crashed === 0 && none.length === 0 ? 0 : 1);
'
