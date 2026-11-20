# Wave 6 · Technical Architect (#3) · contract round · tag ARCH

Read W5-common.md first. You own `docs/ARCHITECTURE.md`, `docs/INTERFACES.md`, `src/sim/core/**` (contracts
included), `src/sim/index.ts`, `src/sim/heroes/registry.ts`, `src/sim/data/core.ts`, `src/client/main.ts` and
`src/client/app/**`.

This is a small, targeted round. Decide each item in INTERFACES and implement what falls in your paths:

1. **Static spatial-hash entries.** The largest remaining objectives cost is rebuilding the spatial hash every tick for
   108 static Nests and Feeders. Let static entities be inserted once and updated only when they change or are removed.
   Measure the objectives perf test before and after; it's at +0.25–0.29 ms against 0.3, and the goal is real margin.
2. **A renderer-ready hook.** Page load rose from about 0.9 s to about 4 s, because Rendering and the environment layer
   generate everything up front. Add a way for the client to show the menu first and finish generating scenery
   afterwards:
   - a staged `__perch.ready` (for example `menu`, then `world`) that e2e specs can wait on;
   - an app-level hook where generation can run later or in Web Workers.

   Rendering and the Environment Artist will move their generation onto it in a later round. Prove it with a
   page-load measurement.
3. **An ability id on heals, shields and statuses**, so the Build Lab can credit each ability's value (D-BAL-003).
4. **Tether `breakDistance` as a tiered value** (deferred from W5.5), if Swan's Grace Link needs it. Hero B3 is working
   in parallel; check their branch and STATUS for requests.
5. **Any interface requests** in the newest STATUS entries: integration, Bot AI, the bird batches and the Build Lab.

Others working in parallel: Bot AI (`src/sim/ai/**`), Hero B3, three bird-model batches (`src/client/render/models/**`).
Keep changes additive so their merges stay clean, and record owner follow-ups in `docs/briefs/W5-contract-followups.md`.

**Done means:**
- `npm run check` passes. Known failures that are not yours: load-sensitive e2e and perf timeouts that pass alone, and
  the audio live-context test.
- STATUS entry and D-ARCH decisions.
- Reply in at most 200 words.
