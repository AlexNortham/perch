# W3.5 · Technical Architect · ARCH

Read W4-common.md, the W3 Logs including integration and the QA gate, INTERFACES.md §10 and the W2-contracts.md
precedent. Own the Architect paths in STATUS, W4-contract-followups.md and your log appends. Check the baseline.

1. Inventory **every** W3 request and QA follow-up in INTERFACES.md. Decide accept, modify, already satisfied or
   reject with reason and evidence, producer and consumer. Reconcile the superseded A1 requests against merged code.
2. Supply accepted contracts and live core projections for area dimensions/owner, pod expiry, projectile source and
   ability, unit statuses, hitscan events, melee posing, invisible-allied rendering, true-sight radius, map-only
   vision, allocation-free character movement, capped dash pitch, aim zoom (including Owl) and hero swatches.
3. Fix boundary ownership for render/VFX, UI/input/palette, shared loop helpers, registry and settings. Give owning
   modules a public route and list their migrations. Wire app-owned ping, respawn look and menu/overlay lifecycle.
4. Define and wire a **winnable structure match** on the actual Play path and lane router, one human Dawn hero,
   waves, real level/AP/ultimate progression, both bases and the result screen. Keep the test sandbox usable.
   Audit real gameplay data flows for structure gates, weak-point shots, Brood Ward, Home Roost, match end,
   item catalogue, shop-zone/visit and transactions, AP intents, HUD/scoreboard, minimap, ping projection,
   damage cues and audio. Make the agreed APIs usable by the owners against main before they start.
5. Map all accepted follow-ups in docs/briefs/W4-contract-followups.md, by path owner, including any non-W4 owner.
   Include data sent, consumer, normal player route and how QA can prove it. Distinguish remaining owner work.
   Contracts must support all eight specified kits and the M2 item slice (D-EP-026). Do not implement other owners' systems.

Run the six-step check and two equal seed-1 3-minute hashes. Commit each coherent piece and report per W4-common.md.
