# Wave 5a · Economy & Items engineer B (#11) · Song · tag ECON

Read W5-common.md first.

**Ownership.** Engineer A owns the item engine and the Talon and Plumage catalogues. You own only:
- The Song catalogue file that A creates. Expect `src/sim/data/items-song.ts`. If it doesn't exist yet when you start, create it yourself with the same typed shape and say so in your report.
- Any Song-only effect helpers you add, in new files under `src/sim/items/song/`.

**Read:** GDD §10 (the 22 Song items and their actives) and your section of W5-contract-followups.md.

**Implement:** every Song item that isn't in the Stage 3 shop yet, with its real effect wired through the existing effect vocabulary and one test per item.

If an effect needs an engine change, list it under Interface requests for engineer A rather than editing shared files.

**Done means:** QA's pending Song item tests pass with `PERCH_PENDING=1`, and `npm run check` passes all six steps.
