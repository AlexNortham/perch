# W4.5 · Technical Architect (#3) · contract round for Stage 4 · tag ARCH

Read W5-common.md first. You own `docs/ARCHITECTURE.md`, `docs/INTERFACES.md`, `src/sim/core/**` (incl. contracts),
`src/sim/index.ts`, `src/sim/heroes/registry.ts`, `src/sim/data/core.ts`, `src/client/main.ts`, `src/client/app/**`.
The Game Director is updating the GDD in parallel (map interiors, the jungle, Nests, 16 new items). Read the GDD
again before you finish and reconcile.

## 1. Highest priority: Node and the browser must hash identically
The siege replay (`?scene=replay&seed=1`, D-ARCH-020) hashes `d662ba91ea093bbd` in Node and `ab8a354ac8f9a12a` in Edge
from **tick 3** onwards, though both reach Victory on tick 69,973. ARCHITECTURE promises identical hashes. Find the root
cause (input path differences, initial state, iteration order, float paths, Rapier build or init, anything the browser
does in the first ticks) and fix it at its owner. Add a permanent cross-environment test that runs the same seeded
script in Node and in Edge (Playwright) and compares per-tick hashes. The Stage 4 Build Lab depends on headless results
meaning what the browser does.

## 2. Settle the wave 4 interface requests
Collect every "Interface requests" item from the W4 STATUS entries (for example `EntityView.castSlot`, audio occlusion
data, a hero-select audio hook, a mute setting, a true-sight radius, a minimap-only visibility bit, an out-parameter
`moveCharacter`, VFX view fields, and anything else listed). Decide each one (accept, modify or reject, with a reason)
in a "Wave 4 requests" section of INTERFACES.md.

## 3. Contracts Stage 4 needs
- **Bots:** confirm the AI command path, plus the data shape for **learned item scores** (per hero: base value,
  pairwise synergy, a game-phase factor) and **recommended builds** (early, mid and late cores plus situational picks),
  both readable by the shop UI and the wiki generator (D-EP-036).
- **Objectives:** Golden Egg, Roc and Phoenix Ember, Thickets, Nests and Feather runes: components, events and view
  fields, where missing.
- **Detailed map:** extend the map schema for **interiors**: floors and storeys, doors and openings, stairs and ladders,
  windows, interior volumes for vision and audio, interactable anchors inside buildings, and jungle zones. Keep it
  additive so today's map still loads.

## Done means
- The determinism fix lands with its cross-environment test.
- INTERFACES.md has a decision for every request.
- The contracts are landed as additive, optional types.
- `docs/briefs/W5-contract-followups.md` lists, per owner, what each must implement in waves 5 and 6.
- `npm run check` passes all six steps; two Node runs of `npm run sim -- --seed 1 --minutes 35 --bots 12` hash the same.
- STATUS entry `### W4.5 · Technical Architect · <date>`; D-ARCH decisions; reply in at most 200 words.
