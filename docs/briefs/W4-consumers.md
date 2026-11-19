# W4 · Contract follow-ups for systems outside the eight wave roles

Act for Rendering & VFX (excluding models and rigs), Camera & Input, Combat, Ability Systems and Character
Controller, **only** in these owners' paths as enumerated in STATUS and W4-contract-followups.md. Read W4-common.md.
These are owner implementation passes after the test-first merge. Commit each owner's changes separately.
Coordinate narrow mechanical lint ownership with the EP before touching QA's files.

Complete all accepted M2 producer/consumer wiring assigned to these owners. Cover true-sight/world-only visibility,
view and event rendering, allied ghost material, aim zoom, capped dashes, respawn/ping input, out-parameter
movement, the weak-point gun path, turret damage, Brood Ward, AP spending/unlock/level-up heal and any first-item
stat/event consumers. Migrate public app/renderer/VFX dependencies to the Architect's contract. Verify each
effect observed by a player through the real subsystem. Keep interface requests and any later-stage polish
explicit. Use the approved contracts as written.
