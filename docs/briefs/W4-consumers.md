# W4 · Contract follow-ups for systems outside the eight wave roles

Act for Rendering & VFX (excluding models and rigs) and Ability Systems, **only** in these owners' paths as
enumerated in STATUS and W4-contract-followups.md. Camera & Input, Combat and Character Controller have the
W4-movement.md assignment. Read W4-common.md.
These are owner implementation passes after the test-first merge. Commit each owner's changes separately.
Coordinate narrow mechanical lint ownership with the EP before touching QA's files.

Complete all accepted M2 producer/consumer wiring assigned to these owners. Cover true-sight/world-only visibility,
view and event rendering, allied ghost materials, light/heavy/parry cues, AP spending/unlock and applicable item
stat/event consumers. Migrate public app/renderer/VFX dependencies to the Architect's contract. Verify each
effect observed by a player through the real subsystem. Keep interface requests and any later-stage polish
explicit. Use the approved contracts as written.

Review Albatross at a distant open sightline. Show straight tracers for actual hit and miss pellet paths from
their real muzzle. Compare the visible shot centre with the reticle and actual ballistics. Cover the case where
one off-centre pellet hits scenery and others continue through open air.
